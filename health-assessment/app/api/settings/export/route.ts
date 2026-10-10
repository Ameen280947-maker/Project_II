import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

/* =========================================================
   GET /api/settings/export?userId=...
   ข้อมูลของผู้ใช้สำหรับปุ่ม "ดาวน์โหลดข้อมูลของฉัน" (สิทธิ์ขอรับข้อมูลตาม PDPA)
   - profiles    : โปรไฟล์สุขภาพทุกเวอร์ชัน (แถวล่าสุดคือข้อมูลปัจจุบัน)
   - assessments : ประวัติการประเมิน
   - answers     : คำตอบรายข้อของทุกการประเมิน
========================================================= */

export async function GET(request: NextRequest) {
  try {
    // ใช้ผู้ใช้จาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
    const auth = requireUser(request, new URL(request.url).searchParams.get("userId"));
    if (!auth.ok) return auth.response;
    const userId = auth.userId;

    const [profiles, assessments, answers] = await Promise.all([
      pool.query(
        `SELECT profile_id, age, gender, height_cm, weight_kg, waist_cm,
                smoking, has_diabetes, family_diabetes, created_at
           FROM health_profile
          WHERE user_id = $1
          ORDER BY profile_id DESC`,
        [userId],
      ),
      pool.query(
        `SELECT a.assessment_id, t.assessment_name, a.total_score, a.risk_level, a.assessed_at
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
          WHERE a.user_id = $1
          ORDER BY a.assessed_at DESC`,
        [userId],
      ),
      pool.query(
        `SELECT a.assessment_id, t.assessment_name, a.assessed_at,
                q.display_order AS question_no, q.question_text,
                COALESCE(qc.choice_text, aa.answer_value::text) AS answer, aa.score
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN assessment_answers aa ON aa.assessment_id = a.assessment_id
           LEFT JOIN questions q ON q.question_id = aa.question_id
           LEFT JOIN question_choices qc ON qc.choice_id = aa.choice_id
          WHERE a.user_id = $1
          ORDER BY a.assessed_at DESC, q.display_order ASC, aa.question_id ASC`,
        [userId],
      ),
    ]);

    return NextResponse.json({
      success: true,
      profiles: profiles.rows,
      assessments: assessments.rows,
      answers: answers.rows,
    });
  } catch (error) {
    void logSystemError("GET /api/settings/export", error);
    console.error("GET /api/settings/export error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถดาวน์โหลดข้อมูลได้" }, { status: 500 });
  }
}
