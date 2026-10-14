import pool from "@/lib/db";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { badRequest, readJsonObject, toIntInRange, userExists } from "../_lib/validate";
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

// แปลค่าความดันตัวบน/ตัวล่างเป็นระดับความเสี่ยงความดันโลหิต
function calculateRiskLevel(
  systolic: number,
  diastolic: number,
) {

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

// API: ดึงผลประเมินความดันโลหิตตาม assessmentId ของผู้ใช้ที่ล็อกอิน พร้อมคำแนะนำ
export async function GET(request: Request) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    // ตรวจ assessmentId จาก query string
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

    // ดึงผลประเมินของผู้ใช้พร้อมคำแนะนำฉบับ ณ เวลาที่ประเมิน
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

    // ดึงคำตอบ แล้วแยกค่าความดันตัวบน (ข้อ 1) และตัวล่าง (ข้อ 2)
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

    // ประกอบผลลัพธ์แล้วคืน JSON
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
    // จัดการ error → บันทึก log และคืน 500
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

// API: ตรวจค่าความดันที่กรอก คำนวณระดับความเสี่ยง แล้วบันทึกผลประเมินลงฐานข้อมูล
export async function POST(request: Request) {
  // อ่าน body ตรวจสิทธิ์ผู้ใช้ สถานะแบบประเมิน และความยินยอม
  const body = await readJsonObject(request);
  if (!body) return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");

  const auth = requireUser(request, body.userId ?? body.user_id);
  if (!auth.ok) return auth.response;

  const closed = await rejectIfAssessmentClosed(2);
  if (closed) return closed;
  const noConsent = await rejectIfNoHealthConsent(auth.userId);
  if (noConsent) return noConsent;
  const userId = auth.userId;

  // ตรวจค่าความดันที่กรอก (ช่วงค่าที่ยอมรับ และตัวบนต้องมากกว่าตัวล่าง)
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

    // เริ่ม transaction แล้วหา assessment_type_id ของแบบประเมินความดัน
    await client.query("BEGIN");

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

    // ดึงคำถาม SBP (ข้อ 1) และ DBP (ข้อ 2) จาก DB
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

    // คำนวณระดับความเสี่ยงและหาคำแนะนำที่ตรงกัน
    const riskLevel =
      calculateRiskLevel(
        systolic,
        diastolic,
      );

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

    // บันทึกผลประเมินลงตาราง assessment
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

          null,

          riskLevel,
        ],
      );

    // บันทึกคำตอบ SBP และ DBP ลง assessment_answers
    const assessmentId =
      assessmentResult.rows[0]
        .assessment_id;

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

    // commit ผูกเวอร์ชันแบบประเมิน แล้วคืนผลลัพธ์ (201)
    await client.query("COMMIT");

    await markAssessmentSaved(client, { userId, typeId: assessmentTypeId, assessmentId: assessmentId });

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
    // จัดการ error → บันทึก log, rollback และคืน 500
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