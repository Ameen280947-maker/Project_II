import pool from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuestionRow = {
  question_id: number;
  question_text: string;
  question_type: "number" | "choice" | "text";
  display_order: number;
  is_required: boolean;
  choice_id: number | null;
  choice_text: string | null;
  choice_score: number | null;
  choice_order: number | null;
};

type QuestionChoice = {
  choiceId: number;
  choiceText: string;
  score: number;
  displayOrder: number;
};

type AssessmentQuestion = {
  questionId: number;
  questionText: string;
  questionType: "number" | "choice" | "text";
  displayOrder: number;
  isRequired: boolean;
  choices: QuestionChoice[];
};

type SubmittedAnswer = {
  questionId: number;
  answerValue?: string | number | null;
  choiceId?: number | null;
};

type SubmitBody = {
  userId: number;
  answers: SubmittedAnswer[];
};

/* =========================================================
   GET
   1. ไม่มี assessmentId = ดึงคำถามและ Profile
   2. มี assessmentId = ดึงผลประเมินและคำแนะนำ
========================================================= */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const assessmentId = Number(
      url.searchParams.get("assessmentId"),
    );

    const userId = Number(url.searchParams.get("userId") ?? "1");

    if (Number.isInteger(assessmentId) && assessmentId > 0) {
      return getAssessmentResult(assessmentId);
    }

    return getAssessmentQuestions(userId);
  } catch (error) {
  
  
    console.error("========== POST Thai CVD ERROR ==========");
    console.error(error);
  
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unknown Error",
        stack:
          error instanceof Error
            ? error.stack
            : error,
      },
      { status: 500 },
    );
  }
}

/* =========================================================
   ดึงคำถามและข้อมูล Profile
========================================================= */

async function getAssessmentQuestions(userId: number) {
  const questionResult = await pool.query<QuestionRow>(
    `
    SELECT
      q.question_id,
      q.question_text,
      q.question_type,
      q.display_order,
      q.is_required,
      qc.choice_id,
      qc.choice_text,
      qc.score AS choice_score,
      qc.display_order AS choice_order
    FROM questions q
    JOIN assessment_types t
      ON t.assessment_type_id = q.assessment_type_id
    LEFT JOIN question_choices qc
      ON qc.question_id = q.question_id
     AND qc.is_active = TRUE
    WHERE t.assessment_name = $1
      AND t.is_active = TRUE
      AND q.is_active = TRUE
    ORDER BY
      q.display_order,
      qc.display_order
    `,
    ["Thai CVD"],
  );

  const questionMap = new Map<number, AssessmentQuestion>();

  for (const row of questionResult.rows) {
    if (!questionMap.has(row.question_id)) {
      questionMap.set(row.question_id, {
        questionId: row.question_id,
        questionText: row.question_text,
        questionType: row.question_type,
        displayOrder: row.display_order,
        isRequired: row.is_required,
        choices: [],
      });
    }

    if (
      row.choice_id !== null &&
      row.choice_text !== null &&
      row.choice_score !== null
    ) {
      questionMap.get(row.question_id)?.choices.push({
        choiceId: row.choice_id,
        choiceText: row.choice_text,
        score: Number(row.choice_score),
        displayOrder: row.choice_order ?? 1,
      });
    }
  }

  let profile = null;

  if (Number.isInteger(userId) && userId > 0) {
    const profileResult = await pool.query(
      `
      SELECT
        age,
        gender,
        height_cm,
        weight_kg,
        waist_cm,
        smoking,
        has_diabetes
      FROM health_profile
      WHERE user_id = $1
      ORDER BY
        updated_at DESC NULLS LAST,
        created_at DESC
      LIMIT 1
      `,
      [userId],
    );

    profile = profileResult.rows[0] ?? null;
  }

  return NextResponse.json({
    success: true,
    assessmentName: "Thai CVD",
    questions: Array.from(questionMap.values()),
    profile,
  });
}

/* =========================================================
   ดึงผลประเมินและคำแนะนำ
========================================================= */

async function getAssessmentResult(assessmentId: number) {
  const result = await pool.query<{
    assessment_id: number;
    total_score: string | number | null;
    risk_level: string | null;
    assessed_at: string;
    assessment_name: string;
    recommendation_text: string | null;
  }>(
    `
    SELECT
      a.assessment_id,
      a.total_score,
      a.risk_level,
      a.assessed_at,
      t.assessment_name,
      r.recommendation_text
    FROM assessment a
    JOIN assessment_types t
      ON t.assessment_type_id = a.assessment_type_id
    LEFT JOIN recommendation r
      ON r.rec_id = a.recommendation_id
    WHERE a.assessment_id = $1
      AND t.assessment_name = $2
    LIMIT 1
    `,
    [assessmentId, "Thai CVD"],
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "ไม่พบผลการประเมิน",
      },
      { status: 404 },
    );
  }

  const row = result.rows[0];

  return NextResponse.json({
    success: true,
    result: {
      assessmentId: row.assessment_id,
      riskPercent: Number(row.total_score ?? 0),
      riskLevel: row.risk_level ?? "ไม่ทราบระดับความเสี่ยง",
      recommendation:
        row.recommendation_text ??
        "ยังไม่มีคำแนะนำสำหรับระดับความเสี่ยงนี้",
      assessedAt: row.assessed_at,
      assessmentName: row.assessment_name,
    },
  });
}

/* =========================================================
   POST: บันทึกคำตอบ คำนวณ และบันทึกผล
========================================================= */

export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    const body = (await request.json()) as SubmitBody;

    if (
      !Number.isInteger(body.userId) ||
      body.userId <= 0 ||
      !Array.isArray(body.answers)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ข้อมูลที่ส่งมาไม่ถูกต้อง",
        },
        { status: 400 },
      );
    }

    await client.query("BEGIN");

    const userResult = await client.query(
      `
      SELECT user_id
      FROM users
      WHERE user_id = $1
      LIMIT 1
      `,
      [body.userId],
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: `ไม่พบผู้ใช้ user_id ${body.userId}`,
        },
        { status: 404 },
      );
    }

    const typeResult = await client.query<{
      assessment_type_id: number;
    }>(
      `
      SELECT assessment_type_id
      FROM assessment_types
      WHERE assessment_name = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      ["Thai CVD"],
    );

    if (typeResult.rowCount === 0) {
      throw new Error("ไม่พบประเภทแบบประเมิน Thai CVD");
    }

    const assessmentTypeId =
      typeResult.rows[0].assessment_type_id;

    const questionResult = await client.query<{
      question_id: number;
      question_text: string;
      question_type: "number" | "choice" | "text";
      display_order: number;
      is_required: boolean;
    }>(
      `
      SELECT
        question_id,
        question_text,
        question_type,
        display_order,
        is_required
      FROM questions
      WHERE assessment_type_id = $1
        AND is_active = TRUE
      ORDER BY display_order
      `,
      [assessmentTypeId],
    );

    const validQuestionIds = new Set(
      questionResult.rows.map((question) => question.question_id),
    );

    const answerMap = new Map<number, SubmittedAnswer>();

    for (const answer of body.answers) {
      if (!validQuestionIds.has(answer.questionId)) {
        throw new Error(
          `question_id ${answer.questionId} ไม่ใช่คำถามของ Thai CVD`,
        );
      }

      answerMap.set(answer.questionId, answer);
    }

    const missingQuestion = questionResult.rows.find(
      (question) =>
        question.is_required &&
        !answerMap.has(question.question_id),
    );

    if (missingQuestion) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: `กรุณาตอบคำถาม: ${missingQuestion.question_text}`,
        },
        { status: 400 },
      );
    }

    const normalizedValues = new Map<number, number>();

    for (const question of questionResult.rows) {
      const answer = answerMap.get(question.question_id);

      if (!answer) {
        continue;
      }

      if (question.question_type === "choice") {
        if (!answer.choiceId) {
          throw new Error(
            `คำถาม "${question.question_text}" ต้องมี choiceId`,
          );
        }

        const choiceResult = await client.query<{
          score: number;
        }>(
          `
          SELECT score
          FROM question_choices
          WHERE choice_id = $1
            AND question_id = $2
            AND is_active = TRUE
          LIMIT 1
          `,
          [answer.choiceId, question.question_id],
        );

        if (choiceResult.rowCount === 0) {
          throw new Error(
            `ตัวเลือกไม่ตรงกับคำถาม "${question.question_text}"`,
          );
        }

        normalizedValues.set(
          question.display_order,
          Number(choiceResult.rows[0].score),
        );
      } else {
        const value = Number(answer.answerValue);

        if (!Number.isFinite(value)) {
          throw new Error(
            `ค่าของคำถาม "${question.question_text}" ไม่ถูกต้อง`,
          );
        }

        normalizedValues.set(question.display_order, value);
      }
    }

    /*
      display_order:
      1 อายุ
      2 เพศ ชาย=1 หญิง=0
      3 สูบบุหรี่ สูบ=1 ไม่สูบ=0
      4 เบาหวาน เป็น=1 ไม่เป็น=0
      5 SBP
      6 รอบเอว
      7 ส่วนสูง
    */

    const age = normalizedValues.get(1);
    const sex = normalizedValues.get(2);
    const smoking = normalizedValues.get(3);
    const diabetes = normalizedValues.get(4);
    const systolic = normalizedValues.get(5);
    const waist = normalizedValues.get(6);
    const height = normalizedValues.get(7);

    const requiredValues = [
      age,
      sex,
      smoking,
      diabetes,
      systolic,
      waist,
      height,
    ];

    if (
      requiredValues.some(
        (value) =>
          value === undefined || !Number.isFinite(value),
      )
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "ข้อมูลสำหรับคำนวณ Thai CVD ไม่ครบ",
        },
        { status: 400 },
      );
    }

    if ((height as number) <= 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "ส่วนสูงต้องมากกว่า 0",
        },
        { status: 400 },
      );
    }

    const fullScore =
      0.079 * (age as number) +
      0.128 * (sex as number) +
      0.019350987 * (systolic as number) +
      0.58454 * (diabetes as number) +
      3.512566 *
        ((waist as number) / (height as number)) +
      0.459 * (smoking as number);

    const rawRisk =
      (1 -
        Math.pow(
          0.978296,
          fullScore - 7.720484,
        )) *
      100;

    const riskPercent = Math.min(
      Math.max(rawRisk, 0),
      100,
    );

    let riskLevel:
      | "เสี่ยงน้อย"
      | "เสี่ยงปานกลาง"
      | "เสี่ยงสูง";

    if (riskPercent < 10) {
      riskLevel = "เสี่ยงน้อย";
    } else if (riskPercent < 30) {
      riskLevel = "เสี่ยงปานกลาง";
    } else {
      riskLevel = "เสี่ยงสูง";
    }

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

    const recommendation =
      recommendationResult.rows[0] ?? null;

    const assessmentResult = await client.query<{
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
      VALUES ($1, $2, $3, $4, $5)
      RETURNING assessment_id
      `,
      [
        body.userId,
        assessmentTypeId,
        recommendation?.rec_id ?? null,
        Number(riskPercent.toFixed(2)),
        riskLevel,
      ],
    );

    const assessmentId =
      assessmentResult.rows[0].assessment_id;

    for (const question of questionResult.rows) {
      const answer = answerMap.get(question.question_id);

      if (!answer) {
        continue;
      }

      let choiceId: number | null = null;
      let answerValue: string | null = null;
      let answerScore = 0;

      if (question.question_type === "choice") {
        choiceId = answer.choiceId ?? null;

        const choiceResult = await client.query<{
          score: number;
        }>(
          `
          SELECT score
          FROM question_choices
          WHERE choice_id = $1
            AND question_id = $2
          LIMIT 1
          `,
          [choiceId, question.question_id],
        );

        answerScore = Number(
          choiceResult.rows[0]?.score ?? 0,
        );
      } else {
        answerValue = String(answer.answerValue ?? "");
      }
      console.log(assessmentId);
      console.log(question.question_id);
      console.log(choiceId);
      console.log(answerValue);
      console.log(answerScore);

      await client.query(
        `
        INSERT INTO assessment_answers (
          assessment_id,
          question_id,
          choice_id,
          answer_value,
          score
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          assessmentId,
          question.question_id,
          choiceId,
          answerValue,
          answerScore,
        ],
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        assessmentId,
        riskPercent: Number(riskPercent.toFixed(2)),
        riskLevel,
        recommendation:
          recommendation?.recommendation_text ??
          "ยังไม่มีคำแนะนำสำหรับระดับนี้",
      },
      { status: 201 },
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("POST Thai CVD error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "เกิดข้อผิดพลาดในการบันทึกผลประเมิน",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}