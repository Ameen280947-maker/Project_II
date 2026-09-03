import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =====================================================
   CONSTANT
===================================================== */

const ASSESSMENT_TYPE_ID = 10;
const ASSESSMENT_NAME = "Diet";

/* =====================================================
   TYPES
===================================================== */

type Choice = {
  choice_id: number;
  choice_text: string;
  option_score: number;
};

type Question = {
  question_id: number;
  question_text: string;
  question_order: number;
  choices: Choice[];
};

type AnswerMap = Record<string | number, number>;

/* =====================================================
   DEFAULT QUESTIONS (FALLBACK)
===================================================== */

const DEFAULT_QUESTIONS: Question[] = [
  {
    question_id: 1,
    question_text: "ท่านรับประทานผักสดหรือผักต้มสุก เป็นประจำเพียงใด (1 ทัพพี ประมาณ 1 อุ้งมือ)",
    question_order: 1,
    choices: [
      { choice_id: 101, choice_text: "ทานทุกวัน วันละ 4 ทัพพีขึ้นไป", option_score: 4 },
      { choice_id: 102, choice_text: "ทานเกือบทุกวัน วันละ 2 - 3 ทัพพี", option_score: 3 },
      { choice_id: 103, choice_text: "ทาน 3 - 4 วันต่อสัปดาห์ วันละ 1 - 2 ทัพพี", option_score: 2 },
      { choice_id: 104, choice_text: "นานๆ ครั้ง หรือแทบไม่ได้รับประทานเลย", option_score: 1 },
    ],
  },
  {
    question_id: 2,
    question_text: "ท่านดื่มเครื่องดื่มรสหวาน น้ำอัดลม ชาเขียว ชานมไข่มุก หรือกาแฟใส่น้ำตาล/นมข้นหวาน บ่อยเพียงใด",
    question_order: 2,
    choices: [
      { choice_id: 201, choice_text: "ไม่ดื่ม หรือนานๆ ครั้ง (น้อยกว่า 1 ครั้งต่อสัปดาห์)", option_score: 4 },
      { choice_id: 202, choice_text: "1 - 2 ครั้งต่อสัปดาห์", option_score: 3 },
      { choice_id: 203, choice_text: "3 - 5 ครั้งต่อสัปดาห์", option_score: 2 },
      { choice_id: 204, choice_text: "ดื่มทุกวัน หรือวันละหลายครั้ง", option_score: 1 },
    ],
  },
  {
    question_id: 3,
    question_text: "ท่านรับประทานขนมหวาน ขนมเบเกอรี่ หรือของหวานไทย บ่อยเพียงใด",
    question_order: 3,
    choices: [
      { choice_id: 301, choice_text: "ไม่ทาน หรือนานๆ ครั้ง (น้อยกว่า 1 ครั้งต่อสัปดาห์)", option_score: 4 },
      { choice_id: 302, choice_text: "1 - 2 ครั้งต่อสัปดาห์", option_score: 3 },
      { choice_id: 303, choice_text: "3 - 5 ครั้งต่อสัปดาห์", option_score: 2 },
      { choice_id: 304, choice_text: "ทานทุกวัน", option_score: 1 },
    ],
  },
  {
    question_id: 4,
    question_text: "ท่านรับประทานผลไม้รสหวานจัด เช่น ทุเรียน ลำไย ขนุน มะม่วงสุก บ่อยเพียงใด",
    question_order: 4,
    choices: [
      { choice_id: 401, choice_text: "ไม่ทาน หรือนานๆ ครั้ง", option_score: 4 },
      { choice_id: 402, choice_text: "1 - 2 ครั้งต่อสัปดาห์", option_score: 3 },
      { choice_id: 403, choice_text: "3 - 5 ครั้งต่อสัปดาห์", option_score: 2 },
      { choice_id: 404, choice_text: "ทานทุกวัน", option_score: 1 },
    ],
  },
  {
    question_id: 5,
    question_text: "ท่านรับประทานอาหารทอด อาหารมัน หนังไก่/หมูติดมัน หรือแกงกะทิ บ่อยเพียงใด",
    question_order: 5,
    choices: [
      { choice_id: 501, choice_text: "นานๆ ครั้ง หรือแทบไม่ทาน", option_score: 4 },
      { choice_id: 502, choice_text: "1 - 2 ครั้งต่อสัปดาห์", option_score: 3 },
      { choice_id: 503, choice_text: "3 - 5 ครั้งต่อสัปดาห์", option_score: 2 },
      { choice_id: 504, choice_text: "ทานทุกวันเป็นประจำ", option_score: 1 },
    ],
  },
  {
    question_id: 6,
    question_text: "ท่านรับประทานอาหารแปรรูป อาหารหมักดอง เช่น ไส้กรอก กุนเชียง บะหมี่กึ่งสำเร็จรูป บ่อยเพียงใด",
    question_order: 6,
    choices: [
      { choice_id: 601, choice_text: "ไม่ทาน หรือนานๆ ครั้ง", option_score: 4 },
      { choice_id: 602, choice_text: "1 - 2 ครั้งต่อสัปดาห์", option_score: 3 },
      { choice_id: 603, choice_text: "3 - 5 ครั้งต่อสัปดาห์", option_score: 2 },
      { choice_id: 604, choice_text: "ทานทุกวัน หรือเกือบทุกวัน", option_score: 1 },
    ],
  },
  {
    question_id: 7,
    question_text: "ท่านจิ้มน้ำจิ้ม หรือราดซอสปรุงรสในปริมาณมากเป็นประจำหรือไม่",
    question_order: 7,
    choices: [
      { choice_id: 701, choice_text: "ไม่จิ้มเลย หรือจิ้มน้อยมาก", option_score: 4 },
      { choice_id: 702, choice_text: "จิ้มเล็กน้อยพอมีรสชาติ", option_score: 3 },
      { choice_id: 703, choice_text: "จิ้มค่อนข้างบ่อย", option_score: 2 },
      { choice_id: 704, choice_text: "จิ้มทุกคำ ชุ่มทุกมื้อ", option_score: 1 },
    ],
  },
  {
    question_id: 8,
    question_text: "เวลาท่านรับประทานก๋วยเตี๋ยวหรืออาหารประเภทน้ำ ท่านซดน้ำซุปจนหมดชามหรือไม่",
    question_order: 8,
    choices: [
      { choice_id: 801, choice_text: "ไม่ซดน้ำซุป หรือซดเพียง 1-2 ช้อน", option_score: 4 },
      { choice_id: 802, choice_text: "ซดประมาณครึ่งชาม", option_score: 3 },
      { choice_id: 803, choice_text: "ซดเกือบหมดชาม", option_score: 2 },
      { choice_id: 804, choice_text: "ซดจนหมดเกลี้ยงทุกครั้ง", option_score: 1 },
    ],
  },
  {
    question_id: 9,
    question_text: "ท่านชอบเติมเครื่องปรุง (น้ำปลา ซีอิ๊ว พริกน้ำปลา เกลือ) เพิ่มก่อนชิมหรือไม่",
    question_order: 9,
    choices: [
      { choice_id: 901, choice_text: "ไม่เคยเติมเลย ชิมก่อนทุกครั้ง", option_score: 4 },
      { choice_id: 902, choice_text: "ชิมก่อน แล้วเติมเฉพาะที่จำเป็น", option_score: 3 },
      { choice_id: 903, choice_text: "เติมก่อนชิมเป็นบางครั้ง", option_score: 2 },
      { choice_id: 904, choice_text: "เติมก่อนชิมเป็นประจำทุกมื้อ", option_score: 1 },
    ],
  },
];

/* =====================================================
   DOMAIN RISK LEVEL MAPPINGS (MATCHING DB recommendation TABLE)
===================================================== */

function getVegetableRisk(score: number): { key: string; level: string } {
  if (score >= 4) return { key: "ผัก-ปริมาณสูงมาก", level: "สูงมาก" };
  if (score === 3) return { key: "ผัก-ปริมาณสูง", level: "สูง" };
  if (score === 2) return { key: "ผัก-ปริมาณปานกลาง", level: "ปานกลาง" };
  return { key: "ผัก-ปริมาณน้อย", level: "น้อย" };
}

function getSugarRisk(score: number): { key: string; level: string } {
  if (score >= 11) return { key: "น้ำตาล-ปริมาณน้อย", level: "ต่ำ" };
  if (score >= 8) return { key: "น้ำตาล-ระดับปานกลาง", level: "ปานกลาง" };
  if (score >= 4) return { key: "น้ำตาล-ระดับสูง", level: "สูง" };
  return { key: "น้ำตาล-ระดับสูงมาก", level: "สูงมาก" };
}

function getFatRisk(score: number): { key: string; level: string } {
  if (score >= 4) return { key: "ไขมัน-ปริมาณน้อย", level: "ต่ำ" };
  if (score === 3) return { key: "ไขมัน-ระดับปานกลาง", level: "ปานกลาง" };
  if (score === 2) return { key: "ไขมัน-ระดับสูง", level: "สูง" };
  return { key: "ไขมัน-ระดับสูงมาก", level: "สูงมาก" };
}

function getSodiumRisk(score: number): { key: string; level: string } {
  if (score >= 15) return { key: "โซเดียม-ปริมาณน้อย", level: "ต่ำ" };
  if (score >= 9) return { key: "โซเดียม-ระดับปานกลาง", level: "ปานกลาง" };
  if (score >= 5) return { key: "โซเดียม-ระดับสูง", level: "สูง" };
  return { key: "โซเดียม-ระดับสูงมาก", level: "สูงมาก" };
}

/* =====================================================
   FETCH RECOMMENDATIONS FROM DATABASE
===================================================== */

async function fetchDietRecommendationsFromDB(keys: string[]): Promise<{
  recommendationMap: Map<string, { rec_id: number; text: string }>;
  combinedText: string;
  firstRecId: number | null;
}> {
  const recommendationMap = new Map<string, { rec_id: number; text: string }>();

  try {
    const res = await pool.query<{
      rec_id: number;
      risk_level: string;
      recommendation_text: string;
    }>(
      `
      SELECT rec_id, risk_level, recommendation_text
      FROM recommendation
      WHERE assessment_type_id = $1
        AND risk_level = ANY($2::text[])
      ORDER BY rec_id ASC
      `,
      [ASSESSMENT_TYPE_ID, keys]
    );

    res.rows.forEach((row) => {
      recommendationMap.set(row.risk_level, {
        rec_id: row.rec_id,
        text: row.recommendation_text,
      });
    });

    const orderedTexts = keys
      .map((key) => recommendationMap.get(key)?.text)
      .filter((t): t is string => Boolean(t));

    const combinedText = orderedTexts.length > 0
      ? orderedTexts.map((text) => `• ${text}`).join("\n\n")
      : "พฤติกรรมการรับประทานอาหารของคุณอยู่ในเกณฑ์ที่ควรดูแลสุขภาพอย่างต่อเนื่อง";

    const firstRecId = res.rows[0]?.rec_id ?? null;

    return {
      recommendationMap,
      combinedText,
      firstRecId,
    };
  } catch (err) {
    console.error("FETCH RECOMMENDATION FROM DB ERROR:", err);
    return {
      recommendationMap,
      combinedText: "ควรรับประทานอาหารให้หลากหลาย ถูกหลักโภชนาการ และดูแลสุขภาพอย่างต่อเนื่อง",
      firstRecId: null,
    };
  }
}

/* =====================================================
   GET
   1) GET /api/assessments/diet -> ดึงรายการคำถาม
   2) GET /api/assessments/diet?assessmentId=123 -> ดึงผลการประเมิน
===================================================== */

export async function GET(request: NextRequest) {
  try {
    const assessmentIdParam = request.nextUrl.searchParams.get("assessmentId");

    /* -------------------------------------------------
       CASE 1: ดึงผลการประเมินจาก assessmentId
    -------------------------------------------------- */
    if (assessmentIdParam) {
      const assessmentId = Number(assessmentIdParam);

      if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Assessment ID ไม่ถูกต้อง",
          },
          { status: 400 }
        );
      }

      // 1) ดึง Assessment
      const assessmentResult = await pool.query(
        `
        SELECT
          a.assessment_id,
          a.user_id,
          a.assessment_type_id,
          a.total_score,
          a.risk_level,
          a.recommendation_id,
          a.assessed_at
        FROM assessment a
        WHERE a.assessment_id = $1
        LIMIT 1
        `,
        [assessmentId]
      );

      if (assessmentResult.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "ไม่พบผลการประเมินนี้",
          },
          { status: 404 }
        );
      }

      const assessmentRow = assessmentResult.rows[0];

      // 2) ดึง Answers
      const answersResult = await pool.query(
        `
        SELECT
          aa.answer_id,
          aa.assessment_id,
          aa.question_id,
          q.question_text,
          COALESCE(q.display_order, aa.question_id) AS question_order,
          aa.choice_id,
          qc.choice_text,
          aa.answer_value,
          aa.score AS answer_score
        FROM assessment_answers aa
        LEFT JOIN questions q ON q.question_id = aa.question_id
        LEFT JOIN question_choices qc ON qc.choice_id = aa.choice_id
        WHERE aa.assessment_id = $1
        ORDER BY COALESCE(q.display_order, aa.question_id) ASC, aa.answer_id ASC
        `,
        [assessmentId]
      );

      const answers = answersResult.rows;

      // 3) คำนวณคะแนนแต่ละ Domain
      let vegetableScore = 0;
      let sugarScore = 0;
      let fatScore = 0;
      let sodiumScore = 0;

      answers.forEach((ans, index) => {
        const order = Number(ans.question_order ?? index + 1);
        const score = Number(ans.answer_score ?? 0);

        if (order === 1) {
          vegetableScore += score;
        } else if (order >= 2 && order <= 4) {
          sugarScore += score;
        } else if (order === 5) {
          fatScore += score;
        } else if (order >= 6 && order <= 9) {
          sodiumScore += score;
        }
      });

      const vegRisk = getVegetableRisk(vegetableScore);
      const sugarRisk = getSugarRisk(sugarScore);
      const fatRisk = getFatRisk(fatScore);
      const sodiumRisk = getSodiumRisk(sodiumScore);

      // 4) ดึงคำแนะนำสุขภาพจากฐานข้อมูลตาราง recommendation โดยตรง
      const dbRec = await fetchDietRecommendationsFromDB([
        vegRisk.key,
        sugarRisk.key,
        fatRisk.key,
        sodiumRisk.key,
      ]);

      return NextResponse.json({
        success: true,
        assessment: {
          assessment_id: assessmentRow.assessment_id,
          total_score: Number(assessmentRow.total_score ?? 0),
          risk_level: assessmentRow.risk_level,
          recommendation_text: dbRec.combinedText,
          assessed_at: assessmentRow.assessed_at,
        },
        domains: {
          vegetable: { score: vegetableScore, level: vegRisk.level },
          sugar: { score: sugarScore, level: sugarRisk.level },
          fat: { score: fatScore, level: fatRisk.level },
          sodium: { score: sodiumScore, level: sodiumRisk.level },
        },
        answers: answers.map((ans, idx) => ({
          answer_id: ans.answer_id,
          question_id: ans.question_id ?? idx + 1,
          question_text: ans.question_text ?? "",
          choice_text: ans.choice_text ?? String(ans.answer_value ?? ""),
          answer_score: Number(ans.answer_score ?? 0),
        })),
      });
    }

    /* -------------------------------------------------
       CASE 2: ดึงรายการคำถามสำหรับทำแบบประเมิน
    -------------------------------------------------- */
    const questionsResult = await pool.query(
      `
      SELECT
        q.question_id,
        q.question_text,
        q.display_order AS question_order,
        qc.choice_id,
        qc.choice_text,
        qc.score AS option_score,
        qc.display_order AS choice_order
      FROM questions q
      INNER JOIN question_choices qc ON qc.question_id = q.question_id
      WHERE q.assessment_type_id = $1
        AND q.is_active = true
        AND qc.is_active = true
      ORDER BY q.display_order ASC, q.question_id ASC, qc.display_order ASC, qc.choice_id ASC
      `,
      [ASSESSMENT_TYPE_ID]
    );

    if (questionsResult.rowCount && questionsResult.rowCount > 0) {
      const questionMap = new Map<number, Question>();

      for (const row of questionsResult.rows) {
        if (!questionMap.has(row.question_id)) {
          questionMap.set(row.question_id, {
            question_id: row.question_id,
            question_text: row.question_text,
            question_order: row.question_order ?? row.question_id,
            choices: [],
          });
        }

        questionMap.get(row.question_id)!.choices.push({
          choice_id: row.choice_id,
          choice_text: row.choice_text,
          option_score: Number(row.option_score ?? 0),
        });
      }

      return NextResponse.json({
        success: true,
        assessment_type_id: ASSESSMENT_TYPE_ID,
        assessment_name: ASSESSMENT_NAME,
        questions: Array.from(questionMap.values()),
      });
    }

    // Fallback ถ้าใน DB ยังไม่มีข้อมูลคำถาม
    return NextResponse.json({
      success: true,
      assessment_type_id: ASSESSMENT_TYPE_ID,
      assessment_name: ASSESSMENT_NAME,
      questions: DEFAULT_QUESTIONS,
    });
  } catch (error) {
    console.error("GET DIET ASSESSMENT ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "ไม่สามารถโหลดแบบประเมินได้",
      },
      { status: 500 }
    );
  }
}

/* =====================================================
   POST
   บันทึกผลการประเมิน Diet
===================================================== */

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = (await request.json()) as {
      user_id?: number;
      userId?: number;
      answers?: AnswerMap;
    };

    const userId = Number(body.user_id ?? body.userId);
    const answers = body.answers ?? {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ไม่พบ User ID ที่ถูกต้อง กรุณาเข้าสู่ระบบใหม่",
        },
        { status: 401 }
      );
    }

    if (!answers || Object.keys(answers).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "กรุณาตอบแบบประเมินให้ครบทุกข้อ",
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------
       LOAD QUESTIONS & CHOICES
    ------------------------------------------------ */
    const dbQuestionsResult = await client.query(
      `
      SELECT
        q.question_id,
        q.question_text,
        q.display_order AS question_order,
        qc.choice_id,
        qc.choice_text,
        qc.score AS option_score
      FROM questions q
      LEFT JOIN question_choices qc ON qc.question_id = q.question_id AND qc.is_active = true
      WHERE q.assessment_type_id = $1 AND q.is_active = true
      ORDER BY q.display_order ASC, q.question_id ASC
      `,
      [ASSESSMENT_TYPE_ID]
    );

    let activeQuestions: Question[] = [];

    if (dbQuestionsResult.rowCount && dbQuestionsResult.rowCount > 0) {
      const qMap = new Map<number, Question>();
      for (const row of dbQuestionsResult.rows) {
        if (!qMap.has(row.question_id)) {
          qMap.set(row.question_id, {
            question_id: row.question_id,
            question_text: row.question_text,
            question_order: row.question_order ?? row.question_id,
            choices: [],
          });
        }
        if (row.choice_id) {
          qMap.get(row.question_id)!.choices.push({
            choice_id: row.choice_id,
            choice_text: row.choice_text,
            option_score: Number(row.option_score ?? 0),
          });
        }
      }
      activeQuestions = Array.from(qMap.values());
    }

    if (activeQuestions.length === 0) {
      activeQuestions = DEFAULT_QUESTIONS;
    }

    /* -----------------------------------------------
       CALCULATE SCORES & VALIDATE
    ------------------------------------------------ */
    let totalScore = 0;
    const answerRows: Array<{
      question_id: number;
      question_order: number;
      question_text: string;
      choice_id: number | null;
      choice_text: string;
      answer_value: number;
      score: number;
    }> = [];

    for (let i = 0; i < activeQuestions.length; i++) {
      const q = activeQuestions[i];
      const selectedChoiceId = Number(answers[String(q.question_id)] ?? answers[q.question_id] ?? answers[String(i + 1)]);

      if (!selectedChoiceId) {
        return NextResponse.json(
          {
            success: false,
            message: `กรุณาตอบคำถามข้อที่ ${q.question_order ?? i + 1}`,
          },
          { status: 400 }
        );
      }

      const selectedChoice = q.choices.find(
        (c) => c.choice_id === selectedChoiceId || c.option_score === selectedChoiceId
      );

      const score = selectedChoice ? Number(selectedChoice.option_score) : 0;
      totalScore += score;

      answerRows.push({
        question_id: q.question_id,
        question_order: q.question_order ?? i + 1,
        question_text: q.question_text,
        choice_id: selectedChoice?.choice_id ?? (selectedChoiceId > 10 ? selectedChoiceId : null),
        choice_text: selectedChoice?.choice_text ?? `ตัวเลือก ${selectedChoiceId}`,
        answer_value: selectedChoiceId,
        score,
      });
    }

    /* -----------------------------------------------
       DOMAIN SCORES
       Q1 = ผัก
       Q2-Q4 = น้ำตาล
       Q5 = ไขมัน
       Q6-Q9 = โซเดียม
    ------------------------------------------------ */
    let vegetableScore = 0;
    let sugarScore = 0;
    let fatScore = 0;
    let sodiumScore = 0;

    answerRows.forEach((ans) => {
      const order = ans.question_order;
      if (order === 1) {
        vegetableScore += ans.score;
      } else if (order >= 2 && order <= 4) {
        sugarScore += ans.score;
      } else if (order === 5) {
        fatScore += ans.score;
      } else if (order >= 6 && order <= 9) {
        sodiumScore += ans.score;
      }
    });

    const vegRisk = getVegetableRisk(vegetableScore);
    const sugarRisk = getSugarRisk(sugarScore);
    const fatRisk = getFatRisk(fatScore);
    const sodiumRisk = getSodiumRisk(sodiumScore);

    const levels = [vegRisk.level, sugarRisk.level, fatRisk.level, sodiumRisk.level];

    const overallRisk = levels.includes("สูงมาก")
      ? "ควรปรับพฤติกรรมมาก"
      : levels.includes("สูง")
        ? "ควรปรับพฤติกรรม"
        : levels.includes("ปานกลาง")
          ? "ควรใส่ใจ"
          : "พฤติกรรมเหมาะสม";

    /* -----------------------------------------------
       FETCH RECOMMENDATION FROM DB (MATCHING RISK KEYS)
    ------------------------------------------------ */
    const dbRec = await fetchDietRecommendationsFromDB([
      vegRisk.key,
      sugarRisk.key,
      fatRisk.key,
      sodiumRisk.key,
    ]);

    /* -----------------------------------------------
       START TRANSACTION
    ------------------------------------------------ */
    await client.query("BEGIN");

    // 1) INSERT INTO assessment
    const insertAssessmentResult = await client.query(
      `
      INSERT INTO assessment (
        user_id,
        assessment_type_id,
        recommendation_id,
        total_score,
        risk_level,
        assessed_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING assessment_id
      `,
      [userId, ASSESSMENT_TYPE_ID, dbRec.firstRecId, totalScore, overallRisk]
    );

    const newAssessmentId = insertAssessmentResult.rows[0].assessment_id;

    // 2) INSERT INTO assessment_answers
    for (const ans of answerRows) {
      await client.query(
        `
        INSERT INTO assessment_answers (
          assessment_id,
          question_id,
          choice_id,
          answer_value,
          score,
          answered_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        `,
        [newAssessmentId, ans.question_id, ans.choice_id, ans.choice_text, ans.score]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      assessment_id: newAssessmentId,
      total_score: totalScore,
      risk_level: overallRisk,
      recommendation_text: dbRec.combinedText,
      domain_scores: {
        vegetable: { score: vegetableScore, level: vegRisk.level },
        sugar: { score: sugarScore, level: sugarRisk.level },
        fat: { score: fatScore, level: fatRisk.level },
        sodium: { score: sodiumScore, level: sodiumRisk.level },
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("POST DIET ASSESSMENT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "ไม่สามารถบันทึกผลการประเมินได้",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}