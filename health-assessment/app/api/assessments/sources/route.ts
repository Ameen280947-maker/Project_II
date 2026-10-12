import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

/* =========================================================
   แหล่งอ้างอิงที่เจ้าหน้าที่กรอกไว้ (แสดงฝั่งผู้ใช้)
   GET ?typeId=<id>        → แหล่งอ้างอิงของแบบประเมิน (หน้าทำแบบประเมิน, ไม่ต้องล็อกอิน)
   GET ?assessmentId=<id>  → แหล่งอ้างอิงของแบบประเมิน + ของคำแนะนำที่ได้ (หน้าผล, เฉพาะเจ้าของผล)
     คำแนะนำใช้ฉบับที่ใช้อยู่ตอนทำแบบประเมิน (recommendation_at) เหมือนข้อความคำแนะนำ
========================================================= */

// ตัดช่องว่างหัวท้าย คืน null ถ้าไม่ใช่ข้อความหรือเป็นค่าว่าง
const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// GET: คืนแหล่งอ้างอิงของแบบประเมิน (typeId) หรือของผลประเมิน+คำแนะนำ (assessmentId)
export async function GET(request: NextRequest) {
  const p = new URL(request.url).searchParams;
  const typeId = Number(p.get("typeId"));
  const assessmentId = Number(p.get("assessmentId"));

  try {
    if (Number.isInteger(typeId) && typeId > 0) {
      const { rows } = await pool.query("SELECT source FROM assessment_types WHERE assessment_type_id = $1", [typeId]);
      return NextResponse.json({ success: true, assessmentSource: clean(rows[0]?.source) });
    }

    if (Number.isInteger(assessmentId) && assessmentId > 0) {
      const auth = requireUser(request);
      if (!auth.ok) return auth.response;

      const { rows } = await pool.query(
        `SELECT t.source AS assessment_source, r.source AS recommendation_source
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           LEFT JOIN LATERAL recommendation_at(a.recommendation_id, a.assessed_at) r ON TRUE
          WHERE a.assessment_id = $1 AND a.user_id = $2`,
        [assessmentId, auth.userId]
      );
      if (!rows[0]) return NextResponse.json({ success: false, message: "ไม่พบผลการประเมิน" }, { status: 404 });
      return NextResponse.json({
        success: true,
        assessmentSource: clean(rows[0].assessment_source),
        recommendationSource: clean(rows[0].recommendation_source),
      });
    }

    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  } catch (error) {
    void logSystemError("GET /api/assessments/sources", error);
    console.error("GET /api/assessments/sources error:", error);
    return NextResponse.json({ success: false, message: "โหลดแหล่งอ้างอิงไม่สำเร็จ" }, { status: 500 });
  }
}
