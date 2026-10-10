import { NextRequest, NextResponse } from "next/server";
import type { Pool } from "pg";
import pool from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  badRequest,
  loadActiveChoices,
  readJsonObject,
  resolveChoiceAnswers,
  userExists,
} from "../_lib/validate";
import { logSystemError } from "@/lib/errorLogger";
import { rejectIfAssessmentClosed } from "../_lib/assessmentStatus";
import { rejectIfNoHealthConsent } from "../_lib/healthConsent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   CONSTANT
========================================================= */

const ASSESSMENT_TYPE_ID = 8;

/* =========================================================
   พฤติกรรมเนือยนิ่ง (ข้อ 2)
   เอกสารอ้างอิงแปลผลแยกจากกิจกรรมทางกาย (ตารางที่ 20)
   1 = ปกติ, 2 = เสี่ยงปานกลาง, 3 = เสี่ยงสูง
========================================================= */

const SEDENTARY_LEVEL: Record<number, string> = {
  1: "ปกติ",
  2: "เสี่ยงปานกลาง",
  3: "เสี่ยงสูง",
};

async function getSedentaryResult(
  client: { query: Pool["query"] },
  score: number | null,
  // ดูผลย้อนหลัง: ใช้คำแนะนำฉบับที่ใช้อยู่ตอนทำแบบประเมินครั้งนั้น
  assessmentId: number | null = null
) {
  if (score === null || !SEDENTARY_LEVEL[score]) {
    return null;
  }

  const level = SEDENTARY_LEVEL[score];

  const rec = await client.query(
    `
    SELECT v.recommendation_text
    FROM recommendation r
    CROSS JOIN LATERAL recommendation_at(
      r.rec_id,
      (SELECT assessed_at FROM assessment WHERE assessment_id = $3)
    ) v
    WHERE r.assessment_type_id = $1
      AND r.risk_level = $2
    LIMIT 1
    `,
    [ASSESSMENT_TYPE_ID, `พฤติกรรมเนือยนิ่ง-${level}`, assessmentId]
  );

  return {
    score,
    risk_level: level,
    recommendation_text:
      rec.rows[0]?.recommendation_text ?? null,
  };
}

/* =========================================================
   GET
========================================================= */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const assessmentIdParam =
    searchParams.get("assessmentId");

  /*
    ดูผลได้เฉพาะของตัวเอง
    ?userId= ถ้าส่งมาต้องตรงกับ session (ไม่งั้น 403)
  */
  let sessionUserId = 0;

  if (assessmentIdParam) {
    const auth = requireUser(
      request,
      searchParams.get("userId"),
    );

    if (!auth.ok) return auth.response;

    sessionUserId = auth.userId;
  }

  const client = await pool.connect();

  try {

    /* =====================================================
       GET QUESTIONS
       /api/assessments/physical_activity
    ===================================================== */

    if (!assessmentIdParam) {
      const questionsResult = await client.query(
        `
        SELECT
          q.question_id,
          q.question_text,
          q.question_type,
          q.display_order,
          q.is_required,
          q.is_active
        FROM questions q
        WHERE q.assessment_type_id = $1
          AND q.is_active = true
        ORDER BY
          q.display_order ASC,
          q.question_id ASC
        `,
        [ASSESSMENT_TYPE_ID]
      );

      const questions = questionsResult.rows;

      if (questions.length === 0) {
        return NextResponse.json(
          {
            message:
              "ไม่พบคำถามสำหรับแบบประเมินกิจกรรมทางกาย",
          },
          { status: 404 }
        );
      }

      const questionIds = questions.map(
        (q) => q.question_id
      );

      const choicesResult = await client.query(
        `
        SELECT
          choice_id,
          question_id,
          choice_text,
          score,
          display_order,
          is_active
        FROM question_choices
        WHERE question_id = ANY($1::int[])
          AND is_active = true
        ORDER BY
          question_id ASC,
          display_order ASC,
          choice_id ASC
        `,
        [questionIds]
      );

      const questionsWithChoices = questions.map(
        (question) => ({
          ...question,

          choices: choicesResult.rows
            .filter(
              (choice) =>
                Number(choice.question_id) ===
                Number(question.question_id)
            )
            .map((choice) => ({
              choice_id: choice.choice_id,
              choice_text: choice.choice_text,
              score: Number(choice.score),
            })),
        })
      );

      return NextResponse.json(
        {
          assessment_type_id:
            ASSESSMENT_TYPE_ID,
          assessment_name:
            "Physical Activity",
          questions: questionsWithChoices,
        },
        { status: 200 }
      );
    }

    /* =====================================================
       GET RESULT
       /api/assessments/physical_activity?assessmentId=xx
    ===================================================== */

    const assessmentId =
      Number(assessmentIdParam);

    if (
      !Number.isInteger(assessmentId) ||
      assessmentId <= 0
    ) {
      return NextResponse.json(
        {
          message: "Assessment ID ไม่ถูกต้อง",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       GET ASSESSMENT RESULT
    ===================================================== */

    const resultQuery = `
      SELECT
        v.answer_id,
        v.assessment_id,
        v.username,
        v.question_text,
        v.answer_value,
        v.choice_text,
        v.answer_score,
        v.assessment_total_score,
        v.risk_level,
        v.recommendation_text,
        v.assessed_at
      FROM v_assessment_physical v
      WHERE v.assessment_id = $1
    `;

    const resultParams = [assessmentId];

    /* =====================================================
       CHECK USER OWNERSHIP (ทุกครั้ง)
    ===================================================== */

    const ownershipResult =
      await client.query(
        `
        SELECT assessment_id
        FROM assessment
        WHERE assessment_id = $1
          AND user_id = $2
          AND assessment_type_id = $3
        LIMIT 1
        `,
        [
          assessmentId,
          sessionUserId,
          ASSESSMENT_TYPE_ID,
        ]
      );

    if (ownershipResult.rowCount === 0) {
      return NextResponse.json(
        {
          message:
            "ไม่พบผลการประเมินของผู้ใช้นี้",
        },
        { status: 404 }
      );
    }

    const result =
      await client.query(
        resultQuery,
        resultParams
      );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          message:
            "ไม่พบผลการประเมิน",
        },
        { status: 404 }
      );
    }

    /* =====================================================
       BUILD RESULT
    ===================================================== */

    const firstRow = result.rows[0];

    const answers = result.rows
      .sort(
        (a, b) =>
          Number(a.answer_id) -
          Number(b.answer_id)
      )
      .map((row) => ({
        answer_id: Number(
          row.answer_id
        ),
        question_text:
          row.question_text,
        answer_value:
          row.answer_value,
        choice_text:
          row.choice_text || "-",
        answer_score: Number(
          row.answer_score
        ),
      }));

    const sedentaryAnswer = await client.query(
      `
      SELECT aa.score
      FROM assessment_answers aa
      JOIN questions q
        ON q.question_id = aa.question_id
      WHERE aa.assessment_id = $1
      ORDER BY q.display_order ASC, q.question_id ASC
      OFFSET 1
      LIMIT 1
      `,
      [assessmentId]
    );

    const sedentary = await getSedentaryResult(
      client,
      sedentaryAnswer.rows[0]
        ? Number(sedentaryAnswer.rows[0].score)
        : null,
      assessmentId
    );

    return NextResponse.json(
      {
        assessment_id: Number(
          firstRow.assessment_id
        ),

        username:
          firstRow.username,

        total_score: Number(
          firstRow.assessment_total_score
        ),

        risk_level:
          firstRow.risk_level,

        recommendation_text:
          firstRow.recommendation_text,

        assessed_at:
          firstRow.assessed_at,

        answers,

        sedentary,
      },
      { status: 200 }
    );
  } catch (error) {
    void logSystemError("GET /api/assessments/physical_activity", error);
    console.error(
      "GET Physical Activity Error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "ไม่สามารถโหลดข้อมูลแบบประเมินได้",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  const body = await readJsonObject(request);

  if (!body) {
    return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");
  }

  /* =====================================================
     VALIDATE USER
     ผู้ใช้มาจาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
  ===================================================== */

  const auth = requireUser(
    request,
    body.userId ?? body.user_id
  );

  if (!auth.ok) return auth.response;

  // staff ปิดแบบประเมินนี้อยู่ ไม่รับผลใหม่
  const closed = await rejectIfAssessmentClosed(8);
  if (closed) return closed;
  // ผู้ใช้ถอนความยินยอมเก็บข้อมูลสุขภาพ ไม่รับผลใหม่
  const noConsent = await rejectIfNoHealthConsent(auth.userId);
  if (noConsent) return noConsent;

  const userId = auth.userId;

  if (!Array.isArray(body.answers)) {
    return badRequest("ไม่พบคำตอบแบบประเมิน");
  }

  const answers = body.answers as Array<{
    question_id?: unknown;
    choice_id?: unknown;
  }>;

  const client = await pool.connect();

  try {
    if (!(await userExists(client, userId))) {
      return badRequest(
        "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่"
      );
    }

    /* =====================================================
       GET PHYSICAL ACTIVITY QUESTIONS
    ===================================================== */

    const questionsResult =
      await client.query(
        `
        SELECT
          question_id,
          question_text,
          display_order,
          is_required,
          is_active
        FROM questions
        WHERE assessment_type_id = $1
          AND is_active = true
        ORDER BY
          display_order ASC,
          question_id ASC
        `,
        [ASSESSMENT_TYPE_ID]
      );

    const physicalQuestions =
      questionsResult.rows;

    /* =====================================================
       CHECK QUESTIONS
    ===================================================== */

    if (
      physicalQuestions.length === 0
    ) {
      return NextResponse.json(
        {
          message:
            "ไม่พบคำถามแบบประเมินกิจกรรมทางกาย",
        },
        { status: 404 }
      );
    }

    /* =====================================================
       VALIDATE ANSWERS
       ตอบครบทุกข้อ ข้อละ 1 คำตอบ
       ตัวเลือกต้องเป็นของคำถามนั้น คะแนนดึงจากฐานข้อมูล
    ===================================================== */

    const resolved = resolveChoiceAnswers(
      await loadActiveChoices(
        client,
        ASSESSMENT_TYPE_ID
      ),
      answers.map((answer) => ({
        questionId: answer?.question_id,
        choiceId: answer?.choice_id ?? null,
      }))
    );

    if (!resolved.ok) {
      return badRequest(resolved.message);
    }

    const validatedAnswers =
      resolved.picked.map((choice) => ({
        question_id: choice.question_id,
        choice_id: choice.choice_id,
        answer_value: choice.choice_text,
        score: choice.score,
      }));

    /* =====================================================
       FIND FIRST QUESTION
       เป็นคำถามหลักเรื่อง "กิจกรรมทางกาย"
    ===================================================== */

    const activityQuestionId =
      Number(
        physicalQuestions[0]
          .question_id
      );

    const activityAnswer =
      validatedAnswers.find(
        (answer) =>
          answer.question_id ===
          activityQuestionId
      );

    if (!activityAnswer) {
      return NextResponse.json(
        {
          message:
            "ไม่พบคำตอบของคำถามกิจกรรมทางกาย",
        },
        { status: 400 }
      );
    }

    /*
      เอกสารอ้างอิงไม่มีคะแนนรวม 2 ข้อ
      คะแนนที่บันทึกคือคะแนนกิจกรรมทางกาย (ข้อ 1, ตารางที่ 18)
      ส่วนข้อ 2 แปลผลแยกเป็นพฤติกรรมเนือยนิ่ง (ตารางที่ 20)
    */
    const totalScore = activityAnswer.score;

    const sedentaryQuestionId = physicalQuestions[1]
      ? Number(physicalQuestions[1].question_id)
      : null;

    const sedentaryScore =
      validatedAnswers.find(
        (answer) =>
          answer.question_id ===
          sedentaryQuestionId
      )?.score ?? null;

    /* =====================================================
       DETERMINE RISK LEVEL

       3 = เพียงพอ
       2 = ไม่เพียงพอ
       1 = ไม่มีกิจกรรมทางกาย
    ===================================================== */

    let riskLevel = "";

    let recommendationId =
      0;

    switch (
      activityAnswer.score
    ) {
      case 3:
        riskLevel =
          "เพียงพอ";

        recommendationId =
          26;

        break;

      case 2:
        riskLevel =
          "ไม่เพียงพอ";

        recommendationId =
          27;

        break;

      case 1:
        riskLevel =
          "ไม่มีกิจกรรมทางกาย";

        recommendationId =
          28;

        break;

      default:
        return NextResponse.json(
          {
            message:
              `คะแนนกิจกรรมทางกายไม่ถูกต้อง: ${activityAnswer.score}`,
          },
          { status: 400 }
        );
    }

    /* =====================================================
       VERIFY RECOMMENDATION
    ===================================================== */

    const recommendationResult =
      await client.query(
        `
        SELECT
          rec_id,
          assessment_type_id,
          risk_level,
          recommendation_text
        FROM recommendation
        WHERE rec_id = $1
          AND assessment_type_id = $2
        LIMIT 1
        `,
        [
          recommendationId,
          ASSESSMENT_TYPE_ID,
        ]
      );

    if (
      recommendationResult.rowCount ===
      0
    ) {
      return NextResponse.json(
        {
          message:
            `ไม่พบคำแนะนำสำหรับ recommendation_id ${recommendationId}`,
        },
        { status: 500 }
      );
    }

    /* =====================================================
       START TRANSACTION
    ===================================================== */

    await client.query(
      "BEGIN"
    );

    /* =====================================================
       INSERT ASSESSMENT

       สำคัญ:
       recommendation_id ถูกบันทึกตรงนี้
    ===================================================== */

    const assessmentResult =
      await client.query(
        `
        INSERT INTO assessment (
          user_id,
          assessment_type_id,
          total_score,
          risk_level,
          recommendation_id,
          assessed_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW()
        )
        RETURNING
          assessment_id,
          total_score,
          risk_level,
          recommendation_id,
          assessed_at
        `,
        [
          userId,
          ASSESSMENT_TYPE_ID,
          totalScore,
          riskLevel,
          recommendationId,
        ]
      );

    const assessment =
      assessmentResult.rows[0];

    const assessmentId =
      Number(
        assessment.assessment_id
      );

    /* =====================================================
       INSERT ANSWERS
    ===================================================== */

    for (
      const answer of validatedAnswers
    ) {
      await client.query(
        `
        INSERT INTO assessment_answers (
          assessment_id,
          question_id,
          answer_value,
          choice_id,
          score
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )
        `,
        [
          assessmentId,

          answer.question_id,

          answer.answer_value,

          answer.choice_id,

          answer.score,
        ]
      );
    }

    /* =====================================================
       COMMIT
    ===================================================== */

    await client.query(
      "COMMIT"
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        assessment_id:
          assessmentId,

        total_score:
          totalScore,

        risk_level:
          riskLevel,

        recommendation_id:
          recommendationId,

        recommendation_text:
          recommendationResult
            .rows[0]
            .recommendation_text,

        sedentary:
          await getSedentaryResult(
            client,
            sedentaryScore
          ),

        assessed_at:
          assessment.assessed_at,
      },
      { status: 201 }
    );
  } catch (error) {
    /* =====================================================
       ROLLBACK
    ===================================================== */

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "POST Physical Activity Error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "ไม่สามารถบันทึกผลการประเมินได้",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}