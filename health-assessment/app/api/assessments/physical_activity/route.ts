import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

/* =========================================================
   DATABASE
========================================================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/* =========================================================
   CONSTANT
========================================================= */

const ASSESSMENT_TYPE_ID = 8;

/* =========================================================
   GET
========================================================= */

export async function GET(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { searchParams } = new URL(request.url);

    const assessmentIdParam =
      searchParams.get("assessmentId");

    const userIdParam =
      searchParams.get("userId");

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

    const resultParams: any[] = [
      assessmentId,
    ];

    /* =====================================================
       CHECK USER OWNERSHIP
    ===================================================== */

    if (userIdParam) {
      const userId = Number(userIdParam);

      if (
        !Number.isInteger(userId) ||
        userId <= 0
      ) {
        return NextResponse.json(
          {
            message: "User ID ไม่ถูกต้อง",
          },
          { status: 400 }
        );
      }

      const ownershipResult =
        await client.query(
          `
          SELECT assessment_id
          FROM assessment
          WHERE assessment_id = $1
            AND user_id = $2
          LIMIT 1
          `,
          [assessmentId, userId]
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
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "GET Physical Activity Error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "ไม่สามารถโหลดข้อมูลแบบประเมินได้",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
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
  const client = await pool.connect();

  try {
    const body = await request.json();

    const userId = Number(
      body.userId
    );

    const answers = Array.isArray(
      body.answers
    )
      ? body.answers
      : [];

    /* =====================================================
       VALIDATE USER
    ===================================================== */

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          message:
            "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่",
        },
        { status: 400 }
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
       CHECK ANSWER COUNT
    ===================================================== */

    if (
      answers.length !==
      physicalQuestions.length
    ) {
      return NextResponse.json(
        {
          message: `กรุณาตอบคำถามให้ครบ ${physicalQuestions.length} ข้อ`,
        },
        { status: 400 }
      );
    }

    /* =====================================================
       PREPARE QUESTION IDS
    ===================================================== */

    const questionIds =
      physicalQuestions.map(
        (q) => Number(q.question_id)
      );

    /* =====================================================
       GET ALL CHOICES
    ===================================================== */

    const choicesResult =
      await client.query(
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

    const choices =
      choicesResult.rows;

    /* =====================================================
       VALIDATE ANSWERS
    ===================================================== */

    const validatedAnswers: {
      question_id: number;
      choice_id: number;
      answer_value: string;
      score: number;
    }[] = [];

    for (
      const answer of answers
    ) {
      const questionId =
        Number(answer.question_id);

      const choiceId =
        Number(answer.choice_id);

      /* ---------------------------------------------------
         CHECK QUESTION
      --------------------------------------------------- */

      if (
        !questionIds.includes(
          questionId
        )
      ) {
        return NextResponse.json(
          {
            message:
              `ไม่พบ Question ID ${questionId}`,
          },
          { status: 400 }
        );
      }

      /* ---------------------------------------------------
         CHECK CHOICE
      --------------------------------------------------- */

      const choice =
        choices.find(
          (c) =>
            Number(c.question_id) ===
              questionId &&
            Number(c.choice_id) ===
              choiceId
        );

      if (!choice) {
        return NextResponse.json(
          {
            message:
              `ตัวเลือกไม่ถูกต้องสำหรับคำถาม ${questionId}`,
          },
          { status: 400 }
        );
      }

      validatedAnswers.push({
        question_id:
          questionId,

        choice_id:
          choiceId,

        answer_value:
          String(
            answer.answer_value ??
              choice.choice_text
          ),

        score: Number(
          choice.score
        ),
      });
    }

    /* =====================================================
       CHECK DUPLICATE QUESTIONS
    ===================================================== */

    const uniqueQuestionIds =
      new Set(
        validatedAnswers.map(
          (a) => a.question_id
        )
      );

    if (
      uniqueQuestionIds.size !==
      physicalQuestions.length
    ) {
      return NextResponse.json(
        {
          message:
            "คำตอบของแต่ละคำถามไม่ครบหรือมีคำถามซ้ำ",
        },
        { status: 400 }
      );
    }

    /* =====================================================
       CALCULATE TOTAL SCORE
    ===================================================== */

    const totalScore =
      validatedAnswers.reduce(
        (sum, answer) =>
          sum + answer.score,
        0
      );

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

        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}