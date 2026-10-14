import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { logAccess, requireStaff, USER_ROLE_ID } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, typeLabel } from "@/lib/staff/riskLevels";
import { logSystemError } from "@/lib/errorLogger";

// จำนวนผู้ใช้ต่อหน้า
const PAGE_SIZE = 8;

// เงื่อนไข SQL ของแต่ละตัวกรองสถานะผู้ใช้
const STATUS_WHERE = {
  all: "TRUE",
  active: "x.is_active AND x.last_seen >= NOW() - INTERVAL '30 days'",
  inactive: "x.is_active AND x.last_seen < NOW() - INTERVAL '30 days'",
  suspended: "NOT x.is_active",
} as const;
type StatusKey = keyof typeof STATUS_WHERE;

// ORDER BY ของแต่ละรูปแบบการเรียง
const SORTS = {
  recent: "x.last_seen DESC, x.user_id DESC",
  newest: "x.created_at DESC, x.user_id DESC",
  most: "x.assessments DESC, x.last_seen DESC, x.user_id DESC",
  name: "LOWER(x.username) ASC, x.user_id ASC",
} as const;
type SortKey = keyof typeof SORTS;

// CTE พื้นฐาน: ผู้ใช้ทั่วไปพร้อมจำนวนการประเมิน และเวลาใช้งานล่าสุด (last_seen)
const BASE = `
  WITH ac AS (
    SELECT a.user_id,
           MAX(a.assessed_at) AS last_assessed,
           COUNT(*) FILTER (WHERE NOT (t.assessment_name = ANY($2::text[])))::int AS assessments
      FROM assessment a
      JOIN assessment_types t USING (assessment_type_id)
     GROUP BY a.user_id
  ),
  x AS (
    SELECT u.user_id, u.username, u.email, u.created_at,
           COALESCE(u.is_active, TRUE) AS is_active,
           u.suspended_reason, u.suspended_at,
           ac.last_assessed,
           COALESCE(ac.assessments, 0) AS assessments,
           GREATEST(ac.last_assessed, u.created_at, u.last_login_at) AS last_seen
      FROM users u
      LEFT JOIN ac ON ac.user_id = u.user_id
     WHERE u.role_id = $1
  )`;

// ตรวจว่าค่าที่ส่งมาเป็นตัวกรองสถานะที่รองรับ
const isStatus = (v: string | null): v is StatusKey => !!v && Object.hasOwn(STATUS_WHERE, v);
// ตรวจว่าค่าที่ส่งมาเป็นรูปแบบการเรียงที่รองรับ
const isSort = (v: string | null): v is SortKey => !!v && Object.hasOwn(SORTS, v);

// แถวผู้ใช้ที่ได้จาก CTE BASE
type Row = {
  user_id: number;
  username: string;
  email: string;
  created_at: Date;
  is_active: boolean;
  suspended_reason: string | null;
  suspended_at: Date | null;
  last_assessed: Date | null;
  assessments: number;
  last_seen: Date;
};

// ระบุสถานะผู้ใช้: ถูกระงับ / ไม่เคลื่อนไหวเกิน 30 วัน / ใช้งานอยู่
const statusOf = (r: Row) =>
  !r.is_active ? "suspended" : new Date(r.last_seen).getTime() < Date.now() - 30 * 86_400_000 ? "inactive" : "active";

// แปลงแถวจากฐานข้อมูลเป็นอ็อบเจกต์ผู้ใช้สำหรับส่งให้หน้าเว็บ
const toUser = (r: Row) => ({
  userId: r.user_id,
  username: r.username,
  email: r.email,
  createdAt: r.created_at,
  lastActive: r.last_seen,
  assessments: r.assessments,
  status: statusOf(r),
});

// API (เจ้าหน้าที่): คืนรายชื่อผู้ใช้แบบค้นหา/กรองสถานะ/เรียง/แบ่งหน้า หรือรายละเอียดถ้ามี userId
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const p = new URL(request.url).searchParams;

  try {
    const detailId = Number(p.get("userId") ?? p.get("user"));
    if (Number.isInteger(detailId) && detailId > 0) return userDetail(detailId, auth.staff.userId);

    // อ่านตัวกรอง การเรียง คำค้น และหน้าจาก query
    const statusParam = p.get("status") ?? p.get("filter");
    const status: StatusKey = isStatus(statusParam) ? statusParam : "all";
    const sortParam = p.get("sort");
    const sort: SortKey = isSort(sortParam) ? sortParam : "recent";
    const q = (p.get("q") ?? "").trim().slice(0, 100);
    const requestedPage = Math.max(1, Math.floor(Number(p.get("page"))) || 1);

    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const search = `($3 = '' OR x.username ILIKE $4 OR x.email ILIKE $4)`;
    const params = [USER_ROLE_ID, EXCLUDED_TYPES, q, like];

    // นับ KPI รวม และจำนวนต่อแท็บสถานะตามคำค้น
    const [kpiRes, tabRes] = await Promise.all([
      pool.query(
        `${BASE}
         SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE ${STATUS_WHERE.active})::int AS active30,
                COUNT(*) FILTER (
                  WHERE date_trunc('month', (x.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')
                      = date_trunc('month', NOW() AT TIME ZONE 'Asia/Bangkok')
                )::int AS new_month,
                COUNT(*) FILTER (WHERE NOT x.is_active)::int AS suspended
           FROM x`,
        [USER_ROLE_ID, EXCLUDED_TYPES]
      ),
      pool.query(
        `${BASE}
         SELECT COUNT(*)::int AS "all",
                COUNT(*) FILTER (WHERE ${STATUS_WHERE.active})::int AS active,
                COUNT(*) FILTER (WHERE ${STATUS_WHERE.inactive})::int AS inactive,
                COUNT(*) FILTER (WHERE ${STATUS_WHERE.suspended})::int AS suspended
           FROM x WHERE ${search}`,
        params
      ),
    ]);

    // คำนวณหน้าแล้วดึงรายชื่อผู้ใช้ของหน้านั้น
    const counts = tabRes.rows[0] as Record<StatusKey, number>;
    const total = counts[status];
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requestedPage, pages);

    const rowsRes = await pool.query<Row>(
      `${BASE}
       SELECT * FROM x
        WHERE ${STATUS_WHERE[status]} AND ${search}
        ORDER BY ${SORTS[sort]}
        LIMIT ${PAGE_SIZE} OFFSET $5`,
      [...params, (page - 1) * PAGE_SIZE]
    );

    const k = kpiRes.rows[0];
    return NextResponse.json({
      success: true,
      kpis: { total: k.total, active30: k.active30, newMonth: k.new_month, suspended: k.suspended },
      counts,
      total,
      page,
      pageSize: PAGE_SIZE,
      users: rowsRes.rows.map(toUser),
    });
  } catch (error) {
    void logSystemError("GET /api/staff/users", error);
    console.error("GET /api/staff/users error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดรายชื่อผู้ใช้ได้" }, { status: 500 });
  }
}

// ดึงรายละเอียดผู้ใช้ แบบประเมินที่ทำ ประวัติการจัดการบัญชี และบันทึกการเข้าดู
async function userDetail(userId: number, staffId: number) {
  const { rows } = await pool.query<Row>(`${BASE} SELECT * FROM x WHERE x.user_id = $3`, [
    USER_ROLE_ID,
    EXCLUDED_TYPES,
    userId,
  ]);
  const u = rows[0];
  if (!u) return NextResponse.json({ success: false, message: "ไม่พบผู้ใช้" }, { status: 404 });

  // ดึงจำนวนการประเมินแยกประเภท และประวัติระงับ/เปิดบัญชี แล้วบันทึก log การเข้าดู
  const [typesRes, historyRes] = await Promise.all([
    pool.query(
      `SELECT t.assessment_name, COUNT(*)::int AS n
         FROM assessment a JOIN assessment_types t USING (assessment_type_id)
        WHERE a.user_id = $1 AND NOT (t.assessment_name = ANY($2::text[]))
        GROUP BY t.assessment_name
        ORDER BY n DESC, t.assessment_name`,
      [userId, EXCLUDED_TYPES]
    ),
    pool.query(
      `SELECT l.action, l.detail, l.created_at, s.username AS staff_name
         FROM access_logs l LEFT JOIN users s ON s.user_id = l.staff_id
        WHERE l.target_user_id = $1 AND l.action IN ('suspend_user', 'activate_user')
        ORDER BY l.created_at DESC
        LIMIT 20`,
      [userId]
    ),
  ]);

  await logAccess(staffId, userId, "view_user_detail");

  return NextResponse.json({
    success: true,
    user: {
      ...toUser(u),
      isActive: u.is_active,
      suspendedReason: u.suspended_reason,
      suspendedAt: u.suspended_at,
      byType: typesRes.rows.map((r) => ({ name: typeLabel(r.assessment_name), count: r.n })),
      history: historyRes.rows.map((r) => ({
        action: r.action === "suspend_user" ? "suspend" : "activate",
        reason: r.detail,
        staff: r.staff_name ?? "เจ้าหน้าที่",
        at: r.created_at,
      })),
    },
  });
}

// API (เจ้าหน้าที่): ระงับหรือเปิดใช้งานบัญชีผู้ใช้ พร้อมเหตุผลและบันทึก access log
export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  // ตรวจข้อมูลที่ส่งมา: userId, action และเหตุผล (จำเป็นเมื่อระงับ)
  const body = await request.json().catch(() => ({}));
  const userId = Number(body.userId);
  const action = body.action;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";

  if (!Number.isInteger(userId) || userId <= 0 || (action !== "suspend" && action !== "activate")) {
    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (action === "suspend" && !reason) {
    return NextResponse.json({ success: false, message: "กรุณาระบุเหตุผลการระงับ" }, { status: 400 });
  }

  try {
    // อัปเดตสถานะบัญชีใน users แล้วบันทึก access log
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
