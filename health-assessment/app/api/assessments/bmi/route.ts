import pool from "@/lib/db";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { badRequest, readJsonObject, toNumberInRange, userExists } from "../_lib/validate";
import { logSystemError } from "@/lib/errorLogger";
import { rejectIfAssessmentClosed } from "../_lib/assessmentStatus";
import { rejectIfNoHealthConsent } from "../_lib/healthConsent";
import { markAssessmentSaved } from "../_lib/assessmentVersion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// แถวคำถามจากตาราง questions
type QuestionRow = {
  question_id: number;
  question_text: string;
  display_order: number;
};

// แปลค่า BMI เป็นระดับ ผอม/ปกติ/น้ำหนักเกิน/อ้วน/อ้วนอันตราย (เกณฑ์คนเอเชีย)
function mapBmiToLevel(bmi: number) {
  if (bmi < 18.5) return "ผอม";
  if (bmi < 23) return "ปกติ";
  if (bmi < 25) return "น้ำหนักเกิน";
  if (bmi < 30) return "อ้วน";
  return "อ้วนอันตราย";
}

// API: ดึงผลประเมิน BMI ตาม assessmentId ของผู้ใช้ที่ล็อกอิน พร้อมคำแนะนำ
export async function GET(request: Request) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    // ตรวจ assessmentId จาก query string
    const url = new URL(request.url);

    const assessmentId = Number(url.searchParams.get("assessmentId"));

    if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
      return NextResponse.json(
        { success: false, message: "assessmentId ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // ดึงผลประเมิน BMI ของผู้ใช้พร้อมคำแนะนำ
    const assessmentResult = await pool.query<{
      assessment_id: number;
      user_id: number;
      assessment_type_id: number;
      assessment_name: string;
      total_score: string | number | null;
      risk_level: string | null;
      recommendation_text: string | null;
      assessed_at: string;
    }>(
      `
      SELECT
        a.assessment_id,
        a.user_id,
        a.assessment_type_id,
        t.assessment_name,
        a.total_score,
        a.risk_level,
        r.recommendation_text,
        a.assessed_at
      FROM assessment a
      INNER JOIN assessment_types t
        ON t.assessment_type_id = a.assessment_type_id
      -- คำแนะนำฉบับที่ใช้อยู่ตอนทำแบบประเมิน (staff แก้ภายหลังไม่กระทบผลเก่า)
      LEFT JOIN LATERAL recommendation_at(a.recommendation_id, a.assessed_at) r
        ON TRUE
      WHERE a.assessment_id = $1
        AND a.user_id = $2
        AND t.assessment_name = 'BMI'
      LIMIT 1
      `,
      [assessmentId, auth.userId],
    );

    if ((assessmentResult.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { success: false, message: "ไม่พบผลการประเมิน BMI" },
        { status: 404 },
      );
    }

    // ดึงคำตอบ แล้วแยกน้ำหนัก/ส่วนสูงเพื่อคำนวณ BMI กลับ
    const answersResult = await pool.query<{
      display_order: number;
      question_text: string;
      answer_value: string | null;
    }>(
      `
      SELECT
        q.display_order,
        q.question_text,
        aa.answer_value
      FROM assessment_answers aa
      JOIN questions q
        ON q.question_id = aa.question_id
      WHERE aa.assessment_id = $1
      ORDER BY q.display_order
      `,
      [assessmentId],
    );

    let weightKg: number | null = null;
    let heightCm: number | null = null;

    for (const answer of answersResult.rows) {
      if (answer.question_text.includes("น้ำหนัก")) {
        weightKg = Number(answer.answer_value);
      }

      if (answer.question_text.includes("ส่วนสูง")) {
        heightCm = Number(answer.answer_value);
      }
    }

    // ประกอบผลลัพธ์แล้วคืน JSON
    const assessment = assessmentResult.rows[0];

    const bmi =
      weightKg && heightCm
        ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(2))
        : null;

    return NextResponse.json({
      success: true,
      result: {
        assessmentId: assessment.assessment_id,
        weightKg,
        heightCm,
        bmi,
        riskLevel: assessment.risk_level ?? mapBmiToLevel(bmi ?? 0),
        recommendation: assessment.recommendation_text ?? "ยังไม่มีคำแนะนำสำหรับระดับนี้",
        assessedAt: assessment.assessed_at,
        assessmentName: assessment.assessment_name,
      },
    });
  } catch (error) {
    // จัดการ error → บันทึก log และคืน 500
    void logSystemError("GET /api/assessments/bmi", error);
    console.error("GET BMI ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "ไม่สามารถโหลดผลประเมินได้",
      },
      { status: 500 },
    );
  }
}

// API: คำนวณ BMI จากน้ำหนัก/ส่วนสูง บันทึกผลประเมินลงฐานข้อมูล แล้วคืนระดับและคำแนะนำ
export async function POST(request: Request) {
  // อ่าน body ตรวจสิทธิ์ผู้ใช้ สถานะแบบประเมิน และความยินยอม
  const body = await readJsonObject(request);
  if (!body) return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");

  const auth = requireUser(request, body.userId ?? body.user_id);
  if (!auth.ok) return auth.response;

  const closed = await rejectIfAssessmentClosed(1);
  if (closed) return closed;
  const noConsent = await rejectIfNoHealthConsent(auth.userId);
  if (noConsent) return noConsent;
  const userId = auth.userId;

  // ตรวจน้ำหนัก (10–400 กก.) และส่วนสูง (50–250 ซม.)
  const weightKg = toNumberInRange(body.weightKg, 10, 400);
  const heightCm = toNumberInRange(body.heightCm, 50, 250);

  if (weightKg === null) {
    return badRequest("ค่าน้ำหนักไม่ถูกต้อง");
  }

  if (heightCm === null) {
    return badRequest("ค่าส่วนสูงไม่ถูกต้อง");
  }

  const client = await pool.connect();

  try {
    if (!(await userExists(client, userId))) {
      return badRequest("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
    }

    // เริ่ม transaction แล้วหา assessment_type_id และคำถามน้ำหนัก/ส่วนสูงใน DB
    await client.query("BEGIN");

    const typeResult = await client.query<{ assessment_type_id: number }>(
      `
      SELECT assessment_type_id
      FROM assessment_types
      WHERE assessment_name = 'BMI'
        AND is_active = TRUE
      LIMIT 1
      `,
    );

    if ((typeResult.rowCount ?? 0) === 0) {
      throw new Error("ไม่พบ Assessment Type: BMI");
    }

    const assessmentTypeId = typeResult.rows[0].assessment_type_id;

    const questionResult = await client.query<QuestionRow>(
      `
      SELECT
        question_id,
        question_text,
        display_order
      FROM questions
      WHERE assessment_type_id = $1
        AND is_active = TRUE
      ORDER BY display_order
      `,
      [assessmentTypeId],
    );

    if (questionResult.rows.length < 2) {
      throw new Error("คำถาม BMI ในฐานข้อมูลไม่ครบ");
    }

    const weightQuestion = questionResult.rows.find((q) => q.question_text.includes("น้ำหนัก"));
    const heightQuestion = questionResult.rows.find((q) => q.question_text.includes("ส่วนสูง"));

    if (!weightQuestion || !heightQuestion) {
      throw new Error("ไม่พบคำถามน้ำหนักหรือส่วนสูง");
    }

    // คำนวณ BMI ระดับความเสี่ยง และหาคำแนะนำที่ตรงกัน
    const bmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(2));
    const riskLevel = mapBmiToLevel(bmi);

    const recommendationResult = await client.query<{
      rec_id: number;
      recommendation_text: string;
    }>(
      `
      SELECT
        rec_id,
        recommendation_text
      FROM recommendation
      WHERE assessment_type_id = $1
        AND risk_level = $2
      LIMIT 1
      `,
      [assessmentTypeId, riskLevel],
    );

    const recommendation = recommendationResult.rows[0] ?? null;

    // บันทึกผลลง assessment และคำตอบน้ำหนัก/ส่วนสูงลง assessment_answers
    const assessmentResult = await client.query<{ assessment_id: number }>(
      `
      INSERT INTO assessment (
        user_id,
        assessment_type_id,
        recommendation_id,
        total_score,
        risk_level
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING assessment_id
      `,
      [userId, assessmentTypeId, recommendation?.rec_id ?? null, bmi, riskLevel],
    );

    const assessmentId = assessmentResult.rows[0].assessment_id;

    await client.query(
      `
      INSERT INTO assessment_answers (
        assessment_id,
        question_id,
        choice_id,
        answer_value,
        score
      )
      VALUES ($1, $2, NULL, $3, 0)
      `,
      [assessmentId, weightQuestion.question_id, String(weightKg)],
    );

    await client.query(
      `
      INSERT INTO assessment_answers (
        assessment_id,
        question_id,
        choice_id,
        answer_value,
        score
      )
      VALUES ($1, $2, NULL, $3, 0)
      `,
      [assessmentId, heightQuestion.question_id, String(heightCm)],
    );

    // commit ผูกเวอร์ชันแบบประเมิน แล้วคืนผลลัพธ์
    await client.query("COMMIT");

    await markAssessmentSaved(client, { userId, typeId: assessmentTypeId, assessmentId: assessmentId });

    return NextResponse.json(
      {
        success: true,
        assessmentId,
        weightKg,
        heightCm,
        bmi,
        riskLevel,
        recommendation: recommendation?.recommendation_text ?? "ยังไม่มีคำแนะนำสำหรับระดับนี้",
      },
      { status: 201 },
    );
  } catch (error) {
    // จัดการ error → บันทึก log, rollback และคืน 500
    void logSystemError("POST /api/assessments/bmi", error);
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("POST BMI ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "ไม่สามารถบันทึกผลประเมินได้",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
