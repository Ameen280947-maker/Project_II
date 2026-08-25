import pool from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitBody = {
  userId: number;
  systolic: number;
  diastolic: number;
};

type QuestionRow = {
  question_id: number;
  question_text: string;
  display_order: number;
};

/* =========================================================
   ฟังก์ชันแปลระดับความดัน
========================================================= */

function calculateRiskLevel(
  systolic: number,
  diastolic: number,
) {
  /*
    เรียงจากระดับรุนแรงที่สุดลงมา
    เพื่อป้องกันค่าที่เข้าได้หลายเงื่อนไข
  */

  if (systolic >= 180 || diastolic >= 110) {
    return "ความดันโลหิตสูงอันตราย";
  }

  if (
    (systolic >= 160 && systolic <= 179) ||
    (diastolic >= 100 && diastolic <= 109)
  ) {
    return "น่าจะเป็นโรคความดันโลหิตสูง";
  }

  if (
    (systolic >= 140 && systolic <= 159) ||
    (diastolic >= 90 && diastolic <= 99)
  ) {
    return "อาจเป็นโรคความดันโลหิตสูง";
  }

  if (
    (systolic >= 130 && systolic <= 139) ||
    (diastolic >= 85 && diastolic <= 89)
  ) {
    return "ความดันโลหิตเริ่มสูง";
  }

  if (systolic < 90 && diastolic < 60) {
    return "ความดันต่ำกว่าเกณฑ์";
  }

  return "ความดันอยู่ในระดับปกติ";
}

/* =========================================================
   GET
   ดึงผล assessment จาก assessmentId
========================================================= */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const assessmentId = Number(
      url.searchParams.get("assessmentId"),
    );

    if (
      !Number.isInteger(assessmentId) ||
      assessmentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "assessmentId ไม่ถูกต้อง",
        },
        { status: 400 },
      );
    }

    /*
      ดึงข้อมูล assessment 
    */

    const assessmentResult = await pool.query<{
      assessment_id: number;
      user_id: number;
      assessment_type_id: number;
      assessment_name: string;
      total_score: string | number | null;
      risk_level: string | null;
      assessed_at: string;
      recommendation_text: string | null;
    }>(
      `
      SELECT
        a.assessment_id,
        a.user_id,
        a.assessment_type_id,
        t.assessment_name,
        a.total_score,
        a.risk_level,
        a.assessed_at,
        r.recommendation_text
      FROM assessment a

      JOIN assessment_types t
        ON t.assessment_type_id =
           a.assessment_type_id

      LEFT JOIN recommendation r
        ON r.rec_id =
           a.recommendation_id

      WHERE a.assessment_id = $1
        AND t.assessment_name = 'Blood Pressure'

      LIMIT 1
      `,
      [assessmentId],
    );

    if (
      (assessmentResult.rowCount ?? 0) === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบผลการประเมินความดันโลหิต",
        },
        { status: 404 },
      );
    }

    /*
      ดึงคำตอบ SBP / DBP
    */

    const answersResult =
      await pool.query<{
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
          ON q.question_id =
             aa.question_id

        WHERE aa.assessment_id = $1

        ORDER BY q.display_order
        `,
        [assessmentId],
      );

    let systolic: number | null = null;
    let diastolic: number | null = null;

    for (const answer of answersResult.rows) {
      if (answer.display_order === 1) {
        systolic = Number(answer.answer_value);
      }

      if (answer.display_order === 2) {
        diastolic = Number(answer.answer_value);
      }
    }

    const assessment =
      assessmentResult.rows[0];

    return NextResponse.json({
      success: true,

      result: {
        assessmentId:
          assessment.assessment_id,

        userId:
          assessment.user_id,

        assessmentName:
          assessment.assessment_name,

        systolic,

        diastolic,

        riskLevel:
          assessment.risk_level ??
          "ไม่ทราบระดับความเสี่ยง",

        recommendation:
          assessment.recommendation_text ??
          "ยังไม่มีคำแนะนำสำหรับระดับนี้",

        assessedAt:
          assessment.assessed_at,
      },
    });
  } catch (error) {
    console.error(
      "GET BLOOD PRESSURE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถโหลดผลประเมินได้",
      },
      { status: 500 },
    );
  }
}

/* =========================================================
   POST
   บันทึกแบบประเมินความดัน
========================================================= */

export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    const body =
      (await request.json()) as SubmitBody;

    const userId = Number(body.userId);
    const systolic = Number(body.systolic);
    const diastolic = Number(body.diastolic);

    /* ================= Validation ================= */

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "userId ไม่ถูกต้อง",
        },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(systolic) ||
      !Number.isFinite(diastolic)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณากรอกค่าความดันให้ถูกต้อง",
        },
        { status: 400 },
      );
    }

    if (
      systolic < 50 ||
      systolic > 300 ||
      diastolic < 30 ||
      diastolic > 200
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ค่าความดันอยู่นอกช่วงที่ระบบรองรับ",
        },
        { status: 400 },
      );
    }

    await client.query("BEGIN");

    /* ================= ตรวจ User ================= */

    const userResult = await client.query(
      `
      SELECT user_id
      FROM users
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (
      (userResult.rowCount ?? 0) === 0
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message:
            `ไม่พบผู้ใช้ user_id ${userId}`,
        },
        { status: 404 },
      );
    }

    /* ================= Assessment Type ================= */

    const typeResult =
      await client.query<{
        assessment_type_id: number;
      }>(
        `
        SELECT assessment_type_id

        FROM assessment_types

        WHERE assessment_name =
              'Blood Pressure'

          AND is_active = TRUE

        LIMIT 1
        `,
      );

    if (
      (typeResult.rowCount ?? 0) === 0
    ) {
      throw new Error(
        "ไม่พบ Assessment Type: Blood Pressure",
      );
    }

    const assessmentTypeId =
      typeResult.rows[0]
        .assessment_type_id;

    /* ================= ดึงคำถาม ================= */

    const questionResult =
      await client.query<QuestionRow>(
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
      throw new Error(
        "คำถาม Blood Pressure ในฐานข้อมูลไม่ครบ",
      );
    }

    const systolicQuestion =
      questionResult.rows.find(
        (question) =>
          question.display_order === 1,
      );

    const diastolicQuestion =
      questionResult.rows.find(
        (question) =>
          question.display_order === 2,
      );

    if (
      !systolicQuestion ||
      !diastolicQuestion
    ) {
      throw new Error(
        "ไม่พบคำถาม SBP หรือ DBP",
      );
    }

    /* ================= คำนวณระดับ ================= */

    const riskLevel =
      calculateRiskLevel(
        systolic,
        diastolic,
      );

    /* ================= Recommendation ================= */

    const recommendationResult =
      await client.query<{
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
        [
          assessmentTypeId,
          riskLevel,
        ],
      );

    const recommendation =
      recommendationResult.rows[0] ??
      null;

    /* ================= Insert Assessment ================= */

    const assessmentResult =
      await client.query<{
        assessment_id: number;
      }>(
        `
        INSERT INTO assessment (
          user_id,
          assessment_type_id,
          recommendation_id,
          total_score,
          risk_level
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )

        RETURNING assessment_id
        `,
        [
          userId,
          assessmentTypeId,
          recommendation?.rec_id ??
            null,

          /*
            Blood Pressure ไม่ใช่แบบรวมคะแนน
            ดังนั้น total_score ให้ NULL
          */
          null,

          riskLevel,
        ],
      );

    const assessmentId =
      assessmentResult.rows[0]
        .assessment_id;

    /* ================= บันทึก SBP ================= */

    await client.query(
      `
      INSERT INTO assessment_answers (
        assessment_id,
        question_id,
        choice_id,
        answer_value,
        score
      )

      VALUES (
        $1,
        $2,
        NULL,
        $3,
        0
      )
      `,
      [
        assessmentId,
        systolicQuestion.question_id,
        String(systolic),
      ],
    );

    /* ================= บันทึก DBP ================= */

    await client.query(
      `
      INSERT INTO assessment_answers (
        assessment_id,
        question_id,
        choice_id,
        answer_value,
        score
      )

      VALUES (
        $1,
        $2,
        NULL,
        $3,
        0
      )
      `,
      [
        assessmentId,
        diastolicQuestion.question_id,
        String(diastolic),
      ],
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,

        assessmentId,

        systolic,
        diastolic,

        riskLevel,

        recommendation:
          recommendation
            ?.recommendation_text ??
          "ยังไม่มีคำแนะนำสำหรับระดับนี้",
      },
      { status: 201 },
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(
      "POST BLOOD PRESSURE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถบันทึกผลประเมินได้",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}