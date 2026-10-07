import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { logAccess, requireStaff, USER_ROLE_ID } from "@/lib/staff/auth";
import { loadCustomSeverities } from "@/lib/customAssessments";
import { EXCLUDED_TYPES, severityOf, riskLabel, typeLabel } from "@/lib/staff/riskLevels";
import { logSystemError } from "@/lib/errorLogger";

/* =========================================================
   /api/staff/users
   GET  ?filter=all|active|inactive|suspended&q=&sort=recent|newest|name&page=1
   GET  ?user=<id>                 → ข้อมูลรายบุคคล (บันทึก access log)
   PATCH { userId, action: "suspend" | "activate", reason }
   - เจ้าหน้าที่จัดการได้เฉพาะบัญชีผู้ใช้ทั่วไป (role_id = 2)
   - ผลสุขภาพรายบุคคลแสดงเฉพาะคนที่ยินยอม (consent_staff)
========================================================= */

const PAGE_SIZE = 8;

const FILTERS: Record<string, string> = {
  all: "TRUE",
  active: "x.is_active AND x.last_seen >= NOW() - INTERVAL '30 days'",
  inactive: "x.is_active AND x.last_seen < NOW() - INTERVAL '30 days'",
  suspended: "NOT x.is_active",
};

const SORTS: Record<string, string> = {
  recent: "x.last_assessed DESC NULLS LAST, x.user_id DESC",
  newest: "x.created_at DESC",
  name: "LOWER(x.username) ASC",
};

// ข้อมูลผู้ใช้รายคน พร้อมจำนวนครั้งที่ประเมิน และเวลาใช้งานล่าสุด
const BASE = `
  WITH x AS (
    SELECT u.user_id, u.username, u.email, u.created_at, COALESCE(u.is_active, TRUE) AS is_active,
           u.suspended_reason, u.suspended_at,
           COALESCE(s.consent_staff, FALSE) AS consent,
           MAX(a.assessed_at) AS last_assessed,
           COUNT(a.assessment_id)::int AS assessments,
           GREATEST(MAX(a.assessed_at), u.created_at) AS last_seen
      FROM users u
      LEFT JOIN user_settings s ON s.user_id::text = u.user_id::text
      LEFT JOIN assessment a ON a.user_id = u.user_id
     WHERE u.role_id = $1
     GROUP BY u.user_id, s.consent_staff
  )`;

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const p = new URL(request.url).searchParams;

  try {
    await loadCustomSeverities();
    const detailId = Number(p.get("user"));
    if (detailId) return userDetail(detailId, auth.staff.userId);

    const filter = FILTERS[p.get("filter") ?? ""] ? (p.get("filter") as string) : "all";
    const sort = SORTS[p.get("sort") ?? ""] ? (p.get("sort") as string) : "recent";
    const q = (p.get("q") ?? "").trim().slice(0, 100);
    const page = Math.max(1, Number(p.get("page")) || 1);

    const where = `${FILTERS[filter]} AND ($2 = '' OR x.username ILIKE '%' || $2 || '%' OR x.email ILIKE '%' || $2 || '%')`;

    const [statsRes, countRes, rowsRes] = await Promise.all([
      pool.query(
        `${BASE}
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE ${FILTERS.active})::int AS active,
                COUNT(*) FILTER (WHERE date_trunc('month', x.created_at) = date_trunc('month', NOW()))::int AS new_month,
                COUNT(*) FILTER (WHERE NOT x.is_active)::int AS suspended
           FROM x`,
        [USER_ROLE_ID]
      ),
      pool.query(`${BASE} SELECT COUNT(*)::int AS n FROM x WHERE ${where}`, [USER_ROLE_ID, q]),
      pool.query(
        `${BASE} SELECT * FROM x WHERE ${where} ORDER BY ${SORTS[sort]} LIMIT ${PAGE_SIZE} OFFSET $3`,
        [USER_ROLE_ID, q, (page - 1) * PAGE_SIZE]
      ),
    ]);

    // ความเสี่ยงสูงสุดจากผลล่าสุดของแต่ละแบบประเมิน (เฉพาะคนที่ยินยอม)
    const consentIds = rowsRes.rows.filter((r) => r.consent).map((r) => r.user_id);
    const worst = new Map<number, { label: string; severity: number }>();
    if (consentIds.length) {
      const { rows } = await pool.query(
        `SELECT DISTINCT ON (a.user_id, a.assessment_type_id) a.user_id, t.assessment_name, a.risk_level
           FROM assessment a JOIN assessment_types t USING (assessment_type_id)
          WHERE a.user_id = ANY($1) AND NOT (t.assessment_name = ANY($2))
          ORDER BY a.user_id, a.assessment_type_id, a.assessed_at DESC`,
        [consentIds, EXCLUDED_TYPES]
      );
      for (const r of rows) {
        const sev = severityOf(r.assessment_name, r.risk_level);
        const cur = worst.get(r.user_id);
        if (!cur || sev > cur.severity) {
          worst.set(r.user_id, {
            severity: sev,
            label: sev === 0 ? "ปกติทุกด้าน" : `${typeLabel(r.assessment_name)} · ${riskLabel(r.assessment_name, r.risk_level)}`,
          });
        }
      }
    }

    const stats = statsRes.rows[0];
    return NextResponse.json({
      success: true,
      stats: { total: stats.total, active: stats.active, newMonth: stats.new_month, suspended: stats.suspended },
      total: countRes.rows[0].n,
      page,
      pageSize: PAGE_SIZE,
      users: rowsRes.rows.map((r) => {
        const inactive = r.is_active && new Date(r.last_seen).getTime() < Date.now() - 30 * 86_400_000;
        return {
          userId: r.user_id,
          username: r.username,
          email: r.email,
          createdAt: r.created_at,
          lastAssessed: r.last_assessed,
          assessments: r.assessments,
          consent: r.consent,
          worst: worst.get(r.user_id) ?? null,
          status: !r.is_active ? "suspended" : inactive ? "inactive" : "active",
        };
      }),
    });
  } catch (error) {
    void logSystemError("GET /api/staff/users", error);
    console.error("GET /api/staff/users error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดรายชื่อผู้ใช้ได้" }, { status: 500 });
  }
}

async function userDetail(userId: number, staffId: number) {
  const { rows } = await pool.query(
    `${BASE} SELECT x.*, hp.gender, hp.age FROM x LEFT JOIN health_profile hp ON hp.user_id = x.user_id WHERE x.user_id = $2`,
    [USER_ROLE_ID, userId]
  );
  const u = rows[0];
  if (!u) return NextResponse.json({ success: false, message: "ไม่พบผู้ใช้" }, { status: 404 });

  let latest: { assessment: string; riskLevel: string; severity: number; assessedAt: string }[] | null = null;
  if (u.consent) {
    const res = await pool.query(
      `SELECT DISTINCT ON (a.assessment_type_id) t.assessment_name, a.risk_level, a.assessed_at
         FROM assessment a JOIN assessment_types t USING (assessment_type_id)
        WHERE a.user_id = $1 AND NOT (t.assessment_name = ANY($2))
        ORDER BY a.assessment_type_id, a.assessed_at DESC`,
      [userId, EXCLUDED_TYPES]
    );
    latest = res.rows
      .map((r) => ({
        assessment: typeLabel(r.assessment_name),
        riskLevel: riskLabel(r.assessment_name, r.risk_level),
        severity: severityOf(r.assessment_name, r.risk_level),
        assessedAt: r.assessed_at,
      }))
      .sort((a, b) => b.severity - a.severity);
    await logAccess(staffId, userId, "view_user_detail");
  }

  return NextResponse.json({
    success: true,
    user: {
      userId: u.user_id,
      username: u.username,
      email: u.email,
      gender: u.gender,
      age: u.age,
      createdAt: u.created_at,
      lastAssessed: u.last_assessed,
      assessments: u.assessments,
      isActive: u.is_active,
      suspendedReason: u.suspended_reason,
      suspendedAt: u.suspended_at,
      consent: u.consent,
      latest,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const userId = Number(body.userId);
  const action = body.action;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  if (!userId || (action !== "suspend" && action !== "activate")) {
    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (action === "suspend" && !reason) {
    return NextResponse.json({ success: false, message: "กรุณาระบุเหตุผลการระงับ" }, { status: 400 });
  }

  try {
    const { rowCount } = await pool.query(
      action === "suspend"
        ? "UPDATE users SET is_active = FALSE, suspended_reason = $3, suspended_at = NOW() WHERE user_id = $1 AND role_id = $2"
        : "UPDATE users SET is_active = TRUE, suspended_reason = NULL, suspended_at = NULL WHERE user_id = $1 AND role_id = $2",
      action === "suspend" ? [userId, USER_ROLE_ID, reason] : [userId, USER_ROLE_ID]
    );
    if (!rowCount) return NextResponse.json({ success: false, message: "ไม่พบผู้ใช้ หรือไม่มีสิทธิ์จัดการบัญชีนี้" }, { status: 404 });

    await logAccess(auth.staff.userId, userId, action === "suspend" ? "suspend_user" : "activate_user", reason || undefined);
    return NextResponse.json({ success: true });
  } catch (error) {
    void logSystemError("PATCH /api/staff/users", error);
    console.error("PATCH /api/staff/users error:", error);
    return NextResponse.json({ success: false, message: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
