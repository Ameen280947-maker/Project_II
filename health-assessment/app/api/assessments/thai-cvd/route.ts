import pool from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, requireUser } from "@/lib/session";
import {
  badRequest,
  readJsonObject,
  toId,
  toIntInRange,
  toNumberInRange,
  userExists,
} from "../_lib/validate";

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
  answerValue?: unknown;
  choiceId?: unknown;
};

/*
  ช่วงค่าที่ยอมรับ (ตาม display_order ของคำถาม)
  ข้อ 2-4 (เพศ / สูบบุหรี่ / เบาหวาน) ต้องเป็นตัวเลือกที่มีคะแนน 0 หรือ 1
*/
const NUMBER_RULES: Record<
  number,
  { min: number; max: number; integer: boolean; message: string }
> = {
  1: { min: 18, max: 100, integer: true, message: "อายุต้องเป็นจำนวนเต็ม 18-100 ปี" },
  5: { min: 60, max: 250, integer: false, message: "ค่าความดันตัวบนต้องอยู่ระหว่าง 60-250 mmHg" },
  6: { min: 40, max: 200, integer: false, message: "รอบเอวต้องอยู่ระหว่าง 40-200 ซม." },
  7: { min: 120, max: 230, integer: false, message: "ส่วนสูงต้องอยู่ระหว่าง 120-230 ซม." },
};

const BOOLEAN_ORDERS = new Set([2, 3, 4]);

/* =========================================================
   GET
   1. ไม่มี assessmentId = ดึงคำถามและ Profile
   2. มี assessmentId = ดึงผลประเมินและคำแนะนำ
========================================================= */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const assessmentIdParam = url.searchParams.get("assessmentId");

    if (assessmentIdParam !== null) {
      const auth = requireUser(request);
      if (!auth.ok) return auth.response;

      const assessmentId = toId(assessmentIdParam);

      if (assessmentId === null) {
        return badRequest("assessmentId ไม่ถูกต้อง");
      }

      return getAssessmentResult(assessmentId, auth.userId);
    }

    /*
      Profile ใช้ผู้ใช้จาก session เท่านั้น
      ถ้าส่ง ?userId= มาต้องตรงกับ session (ไม่งั้น 403)
      ไม่มี session และไม่ได้ส่ง userId = ได้แค่คำถาม ไม่มี profile
    */
    const claimedUserId = url.searchParams.get("userId");
    let profileUserId: number | null = null;

    if (claimedUserId !== null || getSession(request)) {
      const auth = requireUser(request, claimedUserId);
      if (!auth.ok) return auth.response;
      profileUserId = auth.userId;
    }

    return getAssessmentQuestions(profileUserId);
  } catch (error) {
    console.error("GET Thai CVD error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "ไม่สามารถโหลดแบบประเมินได้",
      },
      { status: 500 },
    );
  }
}

/* =========================================================
   ดึงคำถามและข้อมูล Profile
========================================================= */

async function getAssessmentQuestions(userId: number | null) {
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

  if (userId !== null) {
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

async function getAssessmentResult(assessmentId: number, userId: number) {
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
      AND a.user_id = $3
    LIMIT 1
    `,
    [assessmentId, "Thai CVD", userId],
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
  const body = await readJsonObject(request);
  if (!body) return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");

  // ผู้ใช้มาจาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
  const auth = requireUser(request, body.userId ?? body.user_id);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  if (!Array.isArray(body.answers)) {
    return badRequest("ข้อมูลที่ส่งมาไม่ถูกต้อง");
  }

  const submittedAnswers = body.answers as SubmittedAnswer[];

  const client = await pool.connect();

  try {
    if (!(await userExists(client, userId))) {
      return badRequest("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
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

    // ตัวเลือกทั้งหมดของคำถาม Thai CVD (ใช้หาคะแนนจากฐานข้อมูล)
    const choiceResult = await client.query<{
      choice_id: number;
      question_id: number;
      score: number;
    }>(
      `
      SELECT qc.choice_id, qc.question_id, qc.score
      FROM question_choices qc
      INNER JOIN questions q
        ON q.question_id = qc.question_id
      WHERE q.assessment_type_id = $1
        AND q.is_active = TRUE
        AND qc.is_active = TRUE
      `,
      [assessmentTypeId],
    );

    const validQuestionIds = new Set(
      questionResult.rows.map((question) => question.question_id),
    );

    const answerMap = new Map<number, SubmittedAnswer>();

    for (const answer of submittedAnswers) {
      const questionId =
        answer && typeof answer === "object" ? toId(answer.questionId) : null;

      if (questionId === null || !validQuestionIds.has(questionId)) {
        return badRequest("มีคำตอบที่ไม่ใช่คำถามของ Thai CVD");
      }

      if (answerMap.has(questionId)) {
        return badRequest("มีคำตอบซ้ำสำหรับคำถามข้อเดียวกัน");
      }

      answerMap.set(questionId, answer);
    }

    // ทุกข้อใช้ในสูตร จึงต้องตอบครบทุกข้อ
    const missingQuestion = questionResult.rows.find(
      (question) => !answerMap.has(question.question_id),
    );

    if (missingQuestion) {
      return badRequest(`กรุณาตอบคำถาม: ${missingQuestion.question_text}`);
    }

    /*
      ค่าที่ใช้คำนวณ (key = display_order) และค่าที่จะบันทึก (key = question_id)
    */
    const normalizedValues = new Map<number, number>();
    const answersToSave = new Map<
      number,
      { choiceId: number | null; answerValue: string | null; score: number }
    >();

    for (const question of questionResult.rows) {
      const answer = answerMap.get(question.question_id)!;

      if (question.question_type === "choice") {
        const choiceId = toId(answer.choiceId);
        const choice =
          choiceId === null
            ? undefined
            : choiceResult.rows.find(
                (c) =>
                  c.choice_id === choiceId &&
                  c.question_id === question.question_id,
              );

        if (!choice) {
          return badRequest(
            `ตัวเลือกไม่ตรงกับคำถาม "${question.question_text}"`,
          );
        }

        const score = Number(choice.score);

        normalizedValues.set(question.display_order, score);
        answersToSave.set(question.question_id, {
          choiceId: choice.choice_id,
          answerValue: null,
          score,
        });
      } else {
        const rule = NUMBER_RULES[question.display_order];
        const value = rule
          ? rule.integer
            ? toIntInRange(answer.answerValue, rule.min, rule.max)
            : toNumberInRange(answer.answerValue, rule.min, rule.max)
          : toNumberInRange(answer.answerValue, -1e9, 1e9);

        if (value === null) {
          return badRequest(
            rule?.message ??
              `ค่าของคำถาม "${question.question_text}" ไม่ถูกต้อง`,
          );
        }

        normalizedValues.set(question.display_order, value);
        answersToSave.set(question.question_id, {
          choiceId: null,
          answerValue: String(value),
          score: 0,
        });
      }

      // เพศ / สูบบุหรี่ / เบาหวาน ในสูตรต้องเป็น 0 หรือ 1 เท่านั้น
      if (
        BOOLEAN_ORDERS.has(question.display_order) &&
        ![0, 1].includes(normalizedValues.get(question.display_order)!)
      ) {
        return badRequest(
          `คำตอบของคำถาม "${question.question_text}" ต้องเป็นใช่หรือไม่ใช่`,
        );
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
      // คำถามในฐานข้อมูลไม่ครบ 7 ข้อ (ไม่ใช่ความผิดของผู้ใช้)
      throw new Error("คำถาม Thai CVD ในฐานข้อมูลไม่ครบ");
    }

    await client.query("BEGIN");

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
          Math.exp(fullScore - 7.720484),
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
        userId,
        assessmentTypeId,
        recommendation?.rec_id ?? null,
        Number(riskPercent.toFixed(2)),
        riskLevel,
      ],
    );

    const assessmentId =
      assessmentResult.rows[0].assessment_id;

    for (const [questionId, saved] of answersToSave) {
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
          questionId,
          saved.choiceId,
          saved.answerValue,
          saved.score,
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
    await client.query("ROLLBACK").catch(() => {});

    console.error("POST Thai CVD error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "เกิดข้อผิดพลาดในการบันทึกผลประเมิน",
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}