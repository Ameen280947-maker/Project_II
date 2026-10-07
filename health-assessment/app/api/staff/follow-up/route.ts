import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { logAccess, requireStaff } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, severityOf, riskLabel, typeLabel } from "@/lib/staff/riskLevels";
import { loadCustomSeverities } from "@/lib/customAssessments";
import { countHighRiskWithoutConsent, syncFollowUpCases } from "@/lib/staff/syncFollowUps";
import { CASE_STATUSES, CASE_STATUS_LABEL, isCaseStatus } from "@/lib/staff/cases";
import { logSystemError } from "@/lib/errorLogger";

/* =========================================================
   /api/staff/follow-up
   GET  ?summary=1       → จำนวนเคสรอติดตาม (ตัวเลขบน Sidebar)
   GET  ?case=<id>       → รายละเอียดเคส + ผลประเมินล่าสุด + บันทึก (บันทึก access log)
   GET                   → รายการเคสทั้งหมด + จำนวนแต่ละสถานะ
   POST { caseId, status, nextFollowUp, note, assignToMe } → บันทึกการติดตาม
   แสดงเฉพาะผู้ใช้ที่ยินยอมให้เจ้าหน้าที่เข้าถึงข้อมูล (user_settings.consent_staff)
========================================================= */

const CONSENT_JOIN = "JOIN user_settings st ON st.user_id::text = c.user_id::text AND st.consent_staff IS TRUE";

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;

  try {
    if (params.get("summary")) {
      await syncFollowUpCases();
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS waiting FROM follow_up_cases c ${CONSENT_JOIN} WHERE c.status = 'waiting'`
      );
      return NextResponse.json({ success: true, waiting: rows[0].waiting });
    }

    const caseId = Number(params.get("case"));
    if (caseId) {
      await loadCustomSeverities();
      return caseDetail(caseId, auth.staff.userId);
    }

    await syncFollowUpCases();
    const notConsented = await countHighRiskWithoutConsent();
    const { rows } = await pool.query(
      `SELECT c.case_id, c.status, c.severity, c.created_at, c.updated_at,
              to_char(c.next_follow_up, 'YYYY-MM-DD') AS next_follow_up,
              u.username, u.email, t.assessment_name, a.risk_level, a.total_score
         FROM follow_up_cases c
         ${CONSENT_JOIN}
         JOIN users u ON u.user_id = c.user_id
         JOIN assessment a ON a.assessment_id = c.assessment_id
         JOIN assessment_types t ON t.assessment_type_id = c.assessment_type_id
        ORDER BY CASE c.status WHEN 'waiting' THEN 0 WHEN 'progress' THEN 1 WHEN 'referred' THEN 2 ELSE 3 END,
                 c.severity DESC, c.created_at ASC`
    );

    const counts = Object.fromEntries(CASE_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

    return NextResponse.json({
      success: true,
      counts: { all: rows.length, ...counts },
      notConsented,
      cases: rows.map((r) => ({
        caseId: r.case_id,
        status: r.status,
        severity: r.severity,
        username: r.username,
        email: r.email,
        assessment: typeLabel(r.assessment_name),
        riskLevel: riskLabel(r.assessment_name, r.risk_level),
        score: r.total_score === null ? null : Number(r.total_score),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        nextFollowUp: r.next_follow_up,
      })),
    });
  } catch (error) {
    void logSystemError("GET /api/staff/follow-up", error);
    console.error("GET /api/staff/follow-up error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดข้อมูลการติดตามได้" }, { status: 500 });
  }
}

async function caseDetail(caseId: number, staffId: number) {
  // next_follow_up เป็นชนิด date: ส่งเป็นข้อความ YYYY-MM-DD กันวันเลื่อนจากการแปลงเขตเวลา
  const { rows } = await pool.query(
    `SELECT c.*, to_char(c.next_follow_up, 'YYYY-MM-DD') AS next_follow_up, u.username, u.email, u.created_at AS joined_at,
            hp.gender, hp.age, st.emergency_name, st.emergency_relation, st.emergency_phone,
            o.username AS owner_name, t.assessment_name, a.risk_level, a.total_score,
            (SELECT MIN(assessed_at) FROM assessment WHERE user_id = c.user_id) AS first_assessed
       FROM follow_up_cases c
       ${CONSENT_JOIN}
       JOIN users u ON u.user_id = c.user_id
       JOIN assessment a ON a.assessment_id = c.assessment_id
       JOIN assessment_types t ON t.assessment_type_id = c.assessment_type_id
       LEFT JOIN health_profile hp ON hp.user_id = c.user_id
       LEFT JOIN users o ON o.user_id = c.owner_id
      WHERE c.case_id = $1`,
    [caseId]
  );
  const c = rows[0];
  if (!c) return NextResponse.json({ success: false, message: "ไม่พบเคส หรือผู้ใช้ยกเลิกความยินยอมแล้ว" }, { status: 404 });

  const [latestRes, notesRes] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (a.assessment_type_id) t.assessment_name, a.risk_level, a.total_score, a.assessed_at
         FROM assessment a JOIN assessment_types t USING (assessment_type_id)
        WHERE a.user_id = $1 AND NOT (t.assessment_name = ANY($2))
        ORDER BY a.assessment_type_id, a.assessed_at DESC`,
      [c.user_id, EXCLUDED_TYPES]
    ),
    pool.query(
      `SELECT n.note_id, n.status, n.note, n.created_at, s.username AS staff
         FROM follow_up_notes n LEFT JOIN users s ON s.user_id = n.staff_id
        WHERE n.case_id = $1 ORDER BY n.created_at ASC`,
      [caseId]
    ),
  ]);

  await logAccess(staffId, c.user_id, "view_follow_up_case", `case ${caseId}`);

  const latest = latestRes.rows
    .map((r) => ({
      assessment: typeLabel(r.assessment_name),
      riskLevel: riskLabel(r.assessment_name, r.risk_level),
      score: r.total_score === null ? null : Number(r.total_score),
      severity: severityOf(r.assessment_name, r.risk_level),
      assessedAt: r.assessed_at,
    }))
    .sort((a, b) => b.severity - a.severity || +new Date(b.assessedAt) - +new Date(a.assessedAt));

  return NextResponse.json({
    success: true,
    case: {
      caseId: c.case_id,
      status: c.status,
      severity: c.severity,
      assessment: typeLabel(c.assessment_name),
      riskLevel: riskLabel(c.assessment_name, c.risk_level),
      score: c.total_score === null ? null : Number(c.total_score),
      createdAt: c.created_at,
      nextFollowUp: c.next_follow_up,
      owner: c.owner_name,
      ownedByMe: c.owner_id === staffId,
      user: {
        username: c.username,
        email: c.email,
        gender: c.gender,
        age: c.age,
        firstAssessed: c.first_assessed,
        emergency: c.emergency_phone
          ? [c.emergency_name, c.emergency_relation].filter(Boolean).join(" · ") + ` · ${c.emergency_phone}`
          : null,
      },
      latest,
      notes: notesRes.rows.map((n) => ({
        id: n.note_id,
        staff: n.staff,
        status: n.status,
        note: n.note,
        at: n.created_at,
      })),
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const caseId = Number(body.caseId);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const status = body.status;
  const next = typeof body.nextFollowUp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.nextFollowUp) ? body.nextFollowUp : null;

  if (!caseId || !isCaseStatus(status)) {
    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT c.case_id, c.status, c.user_id FROM follow_up_cases c ${CONSENT_JOIN} WHERE c.case_id = $1`,
      [caseId]
    );
    const current = rows[0];
    if (!current) return NextResponse.json({ success: false, message: "ไม่พบเคส" }, { status: 404 });
    if (!note && status === current.status && !body.assignToMe && !next) {
      return NextResponse.json({ success: false, message: "กรุณาเปลี่ยนสถานะหรือเขียนบันทึก" }, { status: 400 });
    }

    // เริ่มติดตามหรือกดรับเคส → เป็นผู้รับผิดชอบเคส (ถ้ายังไม่มี)
    const takeOwner = Boolean(body.assignToMe) || status !== "waiting";
    await pool.query(
      `UPDATE follow_up_cases
          SET status = $2,
              next_follow_up = $3,
              owner_id = CASE WHEN $4::boolean THEN COALESCE(owner_id, $5) ELSE owner_id END,
              updated_at = NOW()
        WHERE case_id = $1`,
      [caseId, status, status === "closed" ? null : next, takeOwner, auth.staff.userId]
    );

    const text =
      status !== current.status
        ? `เปลี่ยนสถานะเป็น "${CASE_STATUS_LABEL[status]}"${note ? ` · ${note}` : ""}`
        : note || (next ? `นัดติดตามครั้งถัดไป ${next}` : "รับเป็นผู้รับผิดชอบเคส");
    await pool.query(
      "INSERT INTO follow_up_notes (case_id, staff_id, status, note) VALUES ($1, $2, $3, $4)",
      [caseId, auth.staff.userId, status, text]
    );
    await logAccess(auth.staff.userId, current.user_id, "update_follow_up_case", `case ${caseId} → ${status}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    void logSystemError("POST /api/staff/follow-up", error);
    console.error("POST /api/staff/follow-up error:", error);
    return NextResponse.json({ success: false, message: "บันทึกการติดตามไม่สำเร็จ" }, { status: 500 });
  }
}
