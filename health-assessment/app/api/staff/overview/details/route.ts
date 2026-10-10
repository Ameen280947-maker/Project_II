import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireStaff, USER_ROLE_ID } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, severityOf, riskLabel, typeLabel } from "@/lib/staff/riskLevels";
import { logSystemError } from "@/lib/errorLogger";
import { LOCAL_ASSESSED, inRange, localOf, parseRange } from "@/lib/staff/overviewRange";

/* =========================================================
   GET /api/staff/overview/details?kind=...&from=YYYY-MM-DD&to=YYYY-MM-DD
   รายการเบื้องหลังตัวเลขแต่ละกล่องในหน้า "ภาพรวม"
     kind=users        ผู้ใช้งานทั้งหมด ณ สิ้นสุดช่วง (ระบุว่าใครสมัครใหม่ในช่วง)
     kind=assessments  การประเมินในช่วง
     kind=waiting      ผู้มีความเสี่ยงสูงรอติดตาม (สถานะปัจจุบัน)
     kind=active       ผู้ใช้ที่ทำแบบประเมินในช่วง
   ผลสุขภาพรายบุคคลแสดงเฉพาะผู้ที่ยินยอมให้เจ้าหน้าที่ดู (consent_staff) เหมือนหน้าผู้ใช้งาน
========================================================= */

const LIMIT = 500;
const KINDS = ["users", "assessments", "waiting", "active"] as const;
type Kind = (typeof KINDS)[number];

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") as Kind | null;
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ success: false, message: "ประเภทข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = parseRange(params);
  if ("error" in parsed) {
    return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
  }
  const { from, to } = parsed;

  try {
    if (kind === "users") {
      const { rows } = await pool.query(
        `SELECT u.user_id, u.username, u.created_at,
                (${inRange(localOf("u.created_at"), "$2", "$3")}) AS is_new,
                COALESCE(s.consent_staff, FALSE) AS consent
           FROM users u
           LEFT JOIN user_settings s ON s.user_id::text = u.user_id::text
          WHERE u.role_id = $1 AND ${localOf("u.created_at")} < $3::date + 1
          ORDER BY u.created_at DESC
          LIMIT ${LIMIT + 1}`,
        [USER_ROLE_ID, from, to]
      );
      return respond(rows, (r) => ({
        userId: r.user_id,
        username: r.username,
        at: r.created_at,
        isNew: r.is_new,
        consent: r.consent,
      }));
    }

    if (kind === "assessments") {
      const { rows } = await pool.query(
        `SELECT a.assessment_id, u.username, t.assessment_name, a.risk_level, a.assessed_at,
                COALESCE(s.consent_staff, FALSE) AS consent
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
           LEFT JOIN user_settings s ON s.user_id::text = u.user_id::text
          WHERE u.role_id = $1 AND NOT (t.assessment_name = ANY($2))
            AND ${inRange(LOCAL_ASSESSED, "$3", "$4")}
          ORDER BY a.assessed_at DESC
          LIMIT ${LIMIT + 1}`,
        [USER_ROLE_ID, EXCLUDED_TYPES, from, to]
      );
      return respond(rows, (r) => ({
        assessmentId: r.assessment_id,
        username: r.username,
        assessment: typeLabel(r.assessment_name),
        at: r.assessed_at,
        consent: r.consent,
        // ไม่ยินยอม: ไม่ส่งผลการประเมินออกไป
        riskLevel: r.consent ? riskLabel(r.assessment_name, r.risk_level) : null,
        severity: r.consent ? severityOf(r.assessment_name, r.risk_level) : null,
      }));
    }

    if (kind === "waiting") {
      const { rows } = await pool.query(
        `SELECT c.case_id, c.severity, c.created_at, u.username, t.assessment_name, a.risk_level
           FROM follow_up_cases c
           JOIN users u ON u.user_id = c.user_id
           JOIN assessment a ON a.assessment_id = c.assessment_id
           JOIN assessment_types t ON t.assessment_type_id = c.assessment_type_id
           JOIN user_settings s ON s.user_id::text = c.user_id::text
          WHERE c.status = 'waiting' AND s.consent_staff IS TRUE
          ORDER BY c.severity DESC, c.created_at ASC
          LIMIT ${LIMIT + 1}`
      );
      return respond(rows, (r) => ({
        caseId: r.case_id,
        username: r.username,
        assessment: typeLabel(r.assessment_name),
        riskLevel: riskLabel(r.assessment_name, r.risk_level),
        severity: r.severity,
        at: r.created_at,
      }));
    }

    // active: ผู้ใช้ที่ทำแบบประเมินในช่วง
    const { rows } = await pool.query(
      `SELECT u.user_id, u.username, COUNT(*)::int AS count, MAX(a.assessed_at) AS last_at,
              COALESCE(s.consent_staff, FALSE) AS consent
         FROM assessment a
         JOIN assessment_types t USING (assessment_type_id)
         JOIN users u ON u.user_id = a.user_id
         LEFT JOIN user_settings s ON s.user_id::text = u.user_id::text
        WHERE u.role_id = $1 AND NOT (t.assessment_name = ANY($2))
          AND ${inRange(LOCAL_ASSESSED, "$3", "$4")}
        GROUP BY u.user_id, u.username, s.consent_staff
        ORDER BY last_at DESC
        LIMIT ${LIMIT + 1}`,
      [USER_ROLE_ID, EXCLUDED_TYPES, from, to]
    );
    return respond(rows, (r) => ({
      userId: r.user_id,
      username: r.username,
      count: r.count,
      at: r.last_at,
      consent: r.consent,
    }));
  } catch (error) {
    void logSystemError("GET /api/staff/overview/details", error);
    console.error("GET /api/staff/overview/details error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดรายละเอียดได้" }, { status: 500 });
  }
}

// ตัดที่ LIMIT รายการ และบอกว่ามีมากกว่านี้หรือไม่
function respond<T>(rows: T[], map: (r: T) => unknown) {
  return NextResponse.json({
    success: true,
    items: rows.slice(0, LIMIT).map(map),
    truncated: rows.length > LIMIT,
  });
}
