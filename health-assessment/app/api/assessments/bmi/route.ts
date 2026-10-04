import pool from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitBody = {
  userId?: number;
  weightKg: number;
  heightCm: number;
};

type QuestionRow = {
  question_id: number;
  question_text: string;
  display_order: number;
};

/* =========================================================
   BMI level mapper
========================================================= */
function mapBmiToLevel(bmi: number) {
  if (bmi < 18.5) return "ผอม";
  if (bmi < 23) return "ปกติ";
  if (bmi < 25) return "น้ำหนักเกิน";
  if (bmi < 30) return "อ้วน";
  return "อ้วนอันตราย";
}

/* =========================================================
   GET
   ดึงผล assessment BMI
========================================================= */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const assessmentId = Number(url.searchParams.get("assessmentId"));

    if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
      return NextResponse.json(
        { success: false, message: "assessmentId ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

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
      LEFT JOIN recommendation r
        ON r.rec_id = a.recommendation_id
      WHERE a.assessment_id = $1
        AND t.assessment_name = 'BMI'
      LIMIT 1
      `,
      [assessmentId],
    );

    if ((assessmentResult.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { success: false, message: "ไม่พบผลการประเมิน BMI" },
        { status: 404 },
      );
    }

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
      if (answer.display_order === 1) {
        weightKg = Number(answer.answer_value);
      }

      if (answer.display_order === 2) {
        heightCm = Number(answer.answer_value);
      }
    }

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
    console.error("GET BMI ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "ไม่สามารถโหลดผลประเมินได้",
      },
      { status: 500 },
    );
  }
}

/* =========================================================
   POST
   บันทึกแบบประเมิน BMI
========================================================= */
export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    const body = (await request.json()) as SubmitBody;

    const userId = Number(body.userId);
    const weightKg = Number(body.weightKg);
    const heightCm = Number(body.heightCm);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ success: false, message: "userId ไม่ถูกต้อง" }, { status: 400 });
    }

    if (!Number.isFinite(weightKg) || weightKg < 10 || weightKg > 400) {
      return NextResponse.json({ success: false, message: "ค่าน้ำหนักไม่ถูกต้อง" }, { status: 400 });
    }

    if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250) {
      return NextResponse.json({ success: false, message: "ค่าส่วนสูงไม่ถูกต้อง" }, { status: 400 });
    }

    await client.query("BEGIN");

    /* ตรวจผู้ใช้ */
    const userResult = await client.query(
      `
      SELECT user_id
      FROM users
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    if ((userResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, message: `ไม่พบผู้ใช้ user_id ${userId}` }, { status: 404 });
    }

    /* หาประเภทแบบประเมิน */
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

    /* ดึงคำถาม (คาดว่ามี 2 คำถาม: น้ำหนัก=1 ส่วนสูง=2) */
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

    const weightQuestion = questionResult.rows.find((q) => q.display_order === 1);
    const heightQuestion = questionResult.rows.find((q) => q.display_order === 2);

    if (!weightQuestion || !heightQuestion) {
      throw new Error("ไม่พบคำถามน้ำหนักหรือส่วนสูง");
    }

    /* คำนวณ BMI */
    const bmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(2));
    const riskLevel = mapBmiToLevel(bmi);

    /* เลือกคำแนะนำ */
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

    /* บันทึก assessment */
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

    /* บันทึกคำตอบ น้ำหนัก */
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

    /* บันทึกคำตอบ ส่วนสูง */
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

    await client.query("COMMIT");

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
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("POST BMI ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "ไม่สามารถบันทึกผลประเมินได้",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
