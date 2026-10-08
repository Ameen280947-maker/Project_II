import pool from "@/lib/db";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { badRequest, readJsonObject, toIntInRange, userExists } from "../_lib/validate";
import { logSystemError } from "@/lib/errorLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    เรียงจากระดับรุนแรงที่สุดลงมา (เอกสารอ้างอิง ตารางที่ 4)
    เช็กแค่ขอบล่างของแต่ละระดับ เพราะระดับที่สูงกว่าถูกคัดออกไปก่อนแล้ว
    ค่าทศนิยม เช่น 139.5 จึงไม่ตกช่องว่างระหว่างระดับ
  */

  if (systolic >= 180 || diastolic >= 110) {
    return "ความดันโลหิตสูงอันตราย";
  }

  if (systolic >= 160 || diastolic >= 100) {
    return "น่าจะเป็นโรคความดันโลหิตสูง";
  }

  if (systolic >= 140 || diastolic >= 90) {
    return "อาจเป็นโรคความดันโลหิตสูง";
  }

  if (systolic >= 130 || diastolic >= 85) {
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
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;

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

      -- คำแนะนำฉบับที่ใช้อยู่ตอนทำแบบประเมิน (staff แก้ภายหลังไม่กระทบผลเก่า)
      LEFT JOIN LATERAL recommendation_at(a.recommendation_id, a.assessed_at) r
        ON TRUE

      WHERE a.assessment_id = $1
        AND a.user_id = $2
        AND t.assessment_name = 'Blood Pressure'

      LIMIT 1
      `,
      [assessmentId, auth.userId],
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
    void logSystemError("GET /api/assessments/blood-pressure", error);
    console.error(
      "GET BLOOD PRESSURE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message: "ไม่สามารถโหลดผลประเมินได้",
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
  const body = await readJsonObject(request);
  if (!body) return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");

  // ผู้ใช้มาจาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
  const auth = requireUser(request, body.userId ?? body.user_id);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  /* ================= Validation =================
     ค่าความดันเป็นจำนวนเต็ม mmHg
     SBP 60-250, DBP 30-150 และตัวบนต้องสูงกว่าตัวล่าง
  ================================================= */

  const systolic = toIntInRange(body.systolic, 60, 250);
  const diastolic = toIntInRange(body.diastolic, 30, 150);

  if (systolic === null) {
    return badRequest("ค่าความดันตัวบน (SBP) ต้องเป็นจำนวนเต็ม 60-250 mmHg");
  }

  if (diastolic === null) {
    return badRequest("ค่าความดันตัวล่าง (DBP) ต้องเป็นจำนวนเต็ม 30-150 mmHg");
  }

  if (systolic <= diastolic) {
    return badRequest("ค่าความดันตัวบนต้องมากกว่าค่าความดันตัวล่าง");
  }

  const client = await pool.connect();

  try {
    if (!(await userExists(client, userId))) {
      return badRequest("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
    }

    await client.query("BEGIN");

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
    void logSystemError("POST /api/assessments/blood-pressure", error);
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

        message: "ไม่สามารถบันทึกผลประเมินได้",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}