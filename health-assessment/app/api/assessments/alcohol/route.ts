import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  badRequest,
  readJsonObject,
  toIntInRange,
  userExists,
} from "../_lib/validate";
import { logSystemError } from "@/lib/errorLogger";
import { rejectIfAssessmentClosed } from "../_lib/assessmentStatus";
import { rejectIfNoHealthConsent } from "../_lib/healthConsent";
import { markAssessmentSaved } from "../_lib/assessmentVersion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ตัวเลือกคำตอบหนึ่งข้อ: ค่า ข้อความ และคะแนน
type AlcoholOption = {
  value: number;
  text: string;
  score: number;
};

// คำถามหนึ่งข้อพร้อมตัวเลือก
type AlcoholQuestion = {
  id: number;
  text: string;
  options: AlcoholOption[];
};

// รหัสแบบประเมินแอลกอฮอล์ในตาราง assessment_types
const ASSESSMENT_TYPE_ID = 7;

// ชุดคำถามคัดกรองการดื่มแอลกอฮอล์ 7 ข้อ พร้อมคะแนนของแต่ละตัวเลือก
const QUESTIONS: AlcoholQuestion[] = [
  {
    id: 1,
    text: "ตลอดชีวิตที่ผ่านมา คุณเคยดื่มเครื่องดื่มแอลกอฮอล์หรือไม่ หรือเคยดื่มแต่หยุดดื่มมาแล้ว 1 ปีขึ้นไป",
    options: [
      { value: 1, text: "ไม่เคย", score: 0 },
      { value: 2, text: "เคยดื่มแต่หยุดดื่มมาแล้ว 1 ปีขึ้นไป", score: 0 },
      { value: 3, text: "เคยดื่มในช่วง 3 เดือน", score: 0 },
    ],
  },
  {
    id: 2,
    text: "ในช่วง 3 เดือนที่ผ่านมา คุณดื่มเครื่องดื่มแอลกอฮอล์บ่อยเพียงไร",
    options: [
      { value: 1, text: "ไม่เคย", score: 0 },
      { value: 2, text: "ครั้งสองครั้ง", score: 2 },
      { value: 3, text: "ทุกเดือน", score: 3 },
      { value: 4, text: "ทุกสัปดาห์", score: 4 },
      { value: 5, text: "เกือบทุกวัน", score: 6 },
    ],
  },
  {
    id: 3,
    text: "ในช่วง 3 เดือนที่ผ่านมา คุณเคยรู้สึกอยากดื่มเครื่องดื่มแอลกอฮอล์อย่างมาก บ่อยเพียงไร",
    options: [
      { value: 1, text: "ไม่เคย", score: 0 },
      { value: 2, text: "ครั้งสองครั้ง", score: 3 },
      { value: 3, text: "ทุกเดือน", score: 4 },
      { value: 4, text: "ทุกสัปดาห์", score: 5 },
      { value: 5, text: "เกือบทุกวัน", score: 6 },
    ],
  },
  {
    id: 4,
    text: "ในช่วง 3 เดือนที่ผ่านมา การดื่มแอลกอฮอล์ทำให้คุณเกิดปัญหาสุขภาพ ครอบครัว สังคม กฎหมาย หรือการเงิน บ่อยเพียงไร",
    options: [
      { value: 1, text: "ไม่เคย", score: 0 },
      { value: 2, text: "ครั้งสองครั้ง", score: 4 },
      { value: 3, text: "ทุกเดือน", score: 5 },
      { value: 4, text: "ทุกสัปดาห์", score: 6 },
      { value: 5, text: "เกือบทุกวัน", score: 7 },
    ],
  },
  {
    id: 5,
    text: "ในช่วง 3 เดือนที่ผ่านมา คุณไม่สามารถทำกิจกรรมที่คุณควรจะทำได้ตามปกติเนื่องจากดื่มแอลกอฮอล์ บ่อยเพียงไร",
    options: [
      { value: 1, text: "ไม่เคย", score: 0 },
      { value: 2, text: "ครั้งสองครั้ง", score: 5 },
      { value: 3, text: "ทุกเดือน", score: 6 },
      { value: 4, text: "ทุกสัปดาห์", score: 7 },
      { value: 5, text: "เกือบทุกวัน", score: 8 },
    ],
  },
  {
    id: 6,
    text: "ตลอดชีวิตที่ผ่านมา เพื่อนฝูง ญาติ หรือคนอื่นเคยแสดงความกังวลหรือตักเตือนคุณเกี่ยวกับการดื่มแอลกอฮอล์ของคุณหรือไม่",
    options: [
      { value: 1, text: "ไม่เคย", score: 0 },
      { value: 2, text: "เคยในช่วง 3 เดือนที่ผ่านมา", score: 6 },
      { value: 3, text: "เคยก่อน 3 เดือนที่ผ่านมา", score: 3 },
    ],
  },
  {
    id: 7,
    text: "ตลอดชีวิตที่ผ่านมา คุณเคยพยายามหยุดหรือลดการดื่มเครื่องดื่มแอลกอฮอล์ให้น้อยลง แต่ไม่สำเร็จหรือไม่",
    options: [
      { value: 1, text: "ไม่เคย", score: 0 },
      { value: 2, text: "เคยในช่วง 3 เดือนที่ผ่านมา", score: 6 },
      { value: 3, text: "เคยก่อน 3 เดือนที่ผ่านมา", score: 3 },
    ],
  },
];

// API: ไม่มี assessmentId คืนชุดคำถาม AUDIT ดื่มแอลกอฮอล์ ถ้ามีคืนผลประเมินที่บันทึกไว้ของผู้ใช้
export async function GET(request: NextRequest) {
  try {
    const assessmentIdParam = request.nextUrl.searchParams.get("assessmentId");

    // ไม่มี assessmentId → คืนชุดคำถาม
    if (!assessmentIdParam) {
      return NextResponse.json({
        success: true,
        assessment_name: "Alcohol",
        assessment_type_id: ASSESSMENT_TYPE_ID,
        questions: QUESTIONS,
      });
    }

    // ตรวจสิทธิ์ผู้ใช้และตรวจ assessmentId
    const auth = requireUser(request);
    if (!auth.ok) return auth.response;

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

    // ตรวจว่าผลประเมินนี้เป็นของผู้ใช้คนนี้
    const ownerResult = await pool.query(
      `
      SELECT 1
      FROM assessment
      WHERE assessment_id = $1
        AND user_id = $2
        AND assessment_type_id = $3
      LIMIT 1
      `,
      [assessmentId, auth.userId, ASSESSMENT_TYPE_ID]
    );

    if (ownerResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ไม่พบผลการประเมิน",
        },
        { status: 404 }
      );
    }

    // ลองดึงผลจาก view v_assessment_alcohol ก่อน
    try {
      const viewResult = await pool.query(
        `
        SELECT
          answer_id,
          assessment_id,
          username,
          question_text,
          answer_value,
          choice_text,
          answer_score,
          assessment_total_score,
          risk_level,
          recommendation_text,
          assessed_at
        FROM v_assessment_alcohol
        WHERE assessment_id = $1
        ORDER BY answer_id ASC
        `,
        [assessmentId]
      );

      if (viewResult.rowCount && viewResult.rowCount > 0) {
        const rows = viewResult.rows;
        const firstRow = rows[0];

        return NextResponse.json({
          success: true,
          assessment: {
            assessment_id: firstRow.assessment_id,
            username: firstRow.username,
            assessment_type_id: ASSESSMENT_TYPE_ID,
            total_score: firstRow.assessment_total_score,
            risk_level: firstRow.risk_level,
            recommendation_text: firstRow.recommendation_text,
            assessed_at: firstRow.assessed_at,
          },
          answers: rows.map((row) => ({
            answer_id: row.answer_id,
            assessment_id: row.assessment_id,
            username: row.username,
            question_text: row.question_text,
            answer_value: row.answer_value,
            choice_text: row.choice_text ?? row.answer_value,
            answer_score: row.answer_score,
          })),
          questions: QUESTIONS,
        });
      }
    } catch (viewError) {
      console.warn("QUERY v_assessment_alcohol VIEW FAILED, FALLING BACK TO TABLES:", viewError);
    }

    // view ใช้ไม่ได้ → ดึงผลประเมินและคำแนะนำจากตารางโดยตรง
    const assessmentResult = await pool.query(
      `
      SELECT
        a.assessment_id,
        a.user_id,
        u.username,
        a.assessment_type_id,
        a.total_score,
        a.risk_level,
        r.recommendation_text,
        a.assessed_at
      FROM assessment a
      LEFT JOIN users u ON u.user_id = a.user_id
      LEFT JOIN LATERAL recommendation_at(a.recommendation_id, a.assessed_at) r ON TRUE
      WHERE a.assessment_id = $1
        AND a.user_id = $2
        AND a.assessment_type_id = $3
      LIMIT 1
      `,
      [assessmentId, auth.userId, ASSESSMENT_TYPE_ID]
    );

    if (assessmentResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "ไม่พบผลการประเมิน",
        },
        { status: 404 }
      );
    }

    const assessmentRow = assessmentResult.rows[0];

    // ดึงคำตอบรายข้อ แล้วคืนผลทั้งหมด
    const answersResult = await pool.query(
      `
      SELECT
        aa.answer_id,
        aa.assessment_id,
        aa.question_id,
        q.question_text,
        aa.choice_id,
        qc.choice_text,
        aa.answer_value,
        aa.score AS answer_score
      FROM assessment_answers aa
      LEFT JOIN questions q ON q.question_id = aa.question_id
      LEFT JOIN question_choices qc ON qc.choice_id = aa.choice_id
      WHERE aa.assessment_id = $1
      ORDER BY aa.answer_id ASC
      `,
      [assessmentId]
    );

    return NextResponse.json({
      success: true,
      assessment: {
        assessment_id: assessmentRow.assessment_id,
        user_id: assessmentRow.user_id,
        username: assessmentRow.username,
        assessment_type_id: assessmentRow.assessment_type_id,
        total_score: assessmentRow.total_score,
        risk_level: assessmentRow.risk_level,
        recommendation_text: assessmentRow.recommendation_text,
        assessed_at: assessmentRow.assessed_at,
      },
      answers: answersResult.rows.map((row) => ({
        answer_id: row.answer_id,
        assessment_id: row.assessment_id,
        question_id: row.question_id,
        question_text: row.question_text ?? "",
        answer_value: row.answer_value,
        choice_text: row.choice_text ?? row.answer_value,
        answer_score: row.answer_score,
      })),
      questions: QUESTIONS,
    });
  } catch (error) {
    // จัดการ error → บันทึก log และคืน 500
    void logSystemError("GET /api/assessments/alcohol", error);
    console.error("GET ALCOHOL ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "ไม่สามารถโหลดข้อมูลได้",
      },
      { status: 500 }
    );
  }
}

// API: ตรวจคำตอบแบบประเมินแอลกอฮอล์ คำนวณคะแนน/ระดับความเสี่ยง แล้วบันทึกผลลงฐานข้อมูล
export async function POST(request: NextRequest) {
  // อ่าน body ตรวจสิทธิ์ผู้ใช้ สถานะแบบประเมิน และความยินยอม
  const body = await readJsonObject(request);
  if (!body) return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");

  const auth = requireUser(request, body.userId ?? body.user_id);
  if (!auth.ok) return auth.response;

  const closed = await rejectIfAssessmentClosed(7);
  if (closed) return closed;
  const noConsent = await rejectIfNoHealthConsent(auth.userId);
  if (noConsent) return noConsent;
  const userId = auth.userId;

  // ตรวจคำตอบที่ส่งมา: ต้องเป็นคำถามของชุดนี้และตัวเลือกถูกต้อง
  const rawAnswers = body.answers;

  if (!rawAnswers || typeof rawAnswers !== "object" || Array.isArray(rawAnswers)) {
    return badRequest("ไม่พบคำตอบแบบประเมิน");
  }

  const answerEntries = Object.entries(rawAnswers as Record<string, unknown>);

  if (answerEntries.some(([key]) => !QUESTIONS.some((q) => String(q.id) === key))) {
    return badRequest("มีคำตอบที่ไม่ใช่คำถามของแบบประเมินนี้");
  }

  const answers = new Map<number, AlcoholOption>();

  for (const [key, value] of answerEntries) {
    const question = QUESTIONS.find((q) => String(q.id) === key)!;
    const selected = toIntInRange(value, 1, question.options.length);
    const option = question.options.find((opt) => opt.value === selected);

    if (!option) {
      return badRequest(`ตัวเลือกของคำถามข้อที่ ${question.id} ไม่ถูกต้อง`);
    }

    answers.set(question.id, option);
  }

  // ข้อ 1 บังคับตอบ ถ้าเคยดื่มใน 3 เดือน (ตัวเลือก 3) ต้องตอบข้อ 2–7 ครบ
  const q1 = answers.get(1)?.value;

  if (q1 === undefined) {
    return badRequest("กรุณาตอบคำถามข้อที่ 1");
  }

  if (q1 === 3) {
    for (let i = 2; i <= 7; i++) {
      if (!answers.has(i)) {
        return badRequest(`กรุณาตอบคำถามข้อที่ ${i}`);
      }
    }
  }

  const client = await pool.connect();

  try {
    if (!(await userExists(client, userId))) {
      return badRequest("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
    }

    // คำนวณคะแนน/ระดับความเสี่ยงและคำแนะนำเริ่มต้น (ไม่เคยดื่ม / หยุดแล้ว / รวมคะแนนข้อ 2–7)
    let totalScore = 0;
    let riskLevel = "";
    let defaultRecText = "";

    if (q1 === 1) {
      totalScore = 0;
      riskLevel = "ไม่เคยดื่ม";
      defaultRecText =
        "ยินดีด้วย คุณปลอดภัยจากโทษของเครื่องดื่มแอลกอฮอล์ เช่น อุบัติเหตุ โรคตับ และโรคไม่ติดต่ออื่นๆ การที่คุณไม่เคยเข้าไปยุ่งเกี่ยวกับเครื่องดื่มแอลกอฮอล์เป็นสิ่งที่ดี และขอให้คุณทำต่อไป เพราะจะเป็นผลดีทั้งทางร่างกายและจิตใจของคุณเป็นอย่างมาก";
    } else if (q1 === 2) {
      totalScore = 0;
      riskLevel = "หยุดดื่มแล้ว";
      defaultRecText =
        "ขอชื่นชมคุณที่สามารถหยุดดื่มได้ เราขอเป็นกำลังใจในการหยุดดื่มเครื่องดื่มแอลกอฮอล์ต่อไป การเลิกดื่มเครื่องดื่มแอลกอฮอล์ไม่ใช่เรื่องง่าย แต่คุณสามารถทำได้ ประโยชน์ของการไม่ดื่มเครื่องดื่มแอลกอฮอล์มีอยู่มากมาย เช่น ทำให้คุณมีสุขภาพแข็งแรง มีเงินออมมากขึ้น และมีเวลาเพื่ออยู่กับครอบครัวและคนที่คุณรักมากยิ่งขึ้น";
    } else {
      for (let i = 2; i <= 7; i++) {
        const question = QUESTIONS.find((item) => item.id === i);
        if (!question) continue;

        const option = answers.get(question.id);

        if (option) {
          totalScore += option.score;
        }
      }

      if (totalScore <= 10) {
        riskLevel = "ความเสี่ยงต่ำ";
        defaultRecText =
          "คุณยังคงมีความเสี่ยงต่อการติดเครื่องดื่มแอลกอฮอล์ ซึ่งหมายถึงว่าคุณมีความเสี่ยงต่อการเกิดโทษภัยจากเครื่องดื่มแอลกอฮอล์ แม้ว่าจะอยู่ในระดับเสี่ยงต่ำ แต่ไม่ได้แปลว่าคุณไม่มีความเสี่ยงจากการดื่ม เพราะหากในอนาคตมีการเพิ่มปริมาณการดื่ม จะเป็นการเพิ่มความเสี่ยงต่อการติดสุรา เกิดอุบัติเหตุ บาดเจ็บ และปัญหาสุขภาพอื่นๆ ตามมาได้";
      } else if (totalScore <= 26) {
        riskLevel = "ความเสี่ยงปานกลาง";
        defaultRecText =
          "คุณมีความเสี่ยงต่อการติดเครื่องดื่มแอลกอฮอล์ระดับปานกลาง ซึ่งหมายถึงเริ่มมีสัญญาณอันตรายจากการดื่ม หากยังดื่มมากอย่างนี้ต่อไป อาจทำให้เกิดโรคต่างๆ เช่น ความดันโลหิตสูง อัมพาต ตับแข็ง หรือเกิดอุบัติเหตุ บาดเจ็บ ปัญหาทางการเงิน การทำงาน และปัญหาภายในครอบครัว เราขอแนะนำให้ลดปริมาณการดื่มหรือเลิกดื่ม โดยตั้งเป้าหมายและปรับเปลี่ยนสิ่งแวดล้อมรอบตัว หากต้องการคำแนะนำเพิ่มเติม สามารถเข้ารับบริการจากเจ้าหน้าที่สาธารณสุขในสถานพยาบาลใกล้บ้าน";
      } else {
        riskLevel = "ความเสี่ยงสูง";
        defaultRecText =
          "คุณมีความเสี่ยงสูงมากต่อการเสพติดเครื่องดื่มแอลกอฮอล์ และเสี่ยงสูงต่อการเกิดโรคภัย หากยังดื่มในลักษณะนี้ต่อไป ปัญหาต่างๆ จากการดื่มเครื่องดื่มแอลกอฮอล์อาจรุนแรงและแก้ไขได้ยากขึ้น ขอแนะนำให้ไปพบเจ้าหน้าที่สาธารณสุขในสถานพยาบาลใกล้บ้านเพื่อเข้ารับการบำบัด และลดปริมาณการดื่มหรือเลิกดื่ม";
      }
    }

    // หาคำแนะนำจากตาราง recommendation ตามระดับความเสี่ยง (ถ้าไม่มีใช้ข้อความเริ่มต้น)
    let recommendationId: number | null = null;
    let finalRecText = defaultRecText;

    const recResult = await client.query(
      `
      SELECT rec_id, recommendation_text
      FROM recommendation
      WHERE assessment_type_id = $1
        AND (risk_level = $2 OR risk_level ILIKE $3)
      LIMIT 1
      `,
      [ASSESSMENT_TYPE_ID, riskLevel, `%${riskLevel}%`]
    );

    if (recResult.rowCount && recResult.rowCount > 0) {
      recommendationId = recResult.rows[0].rec_id;
      if (recResult.rows[0].recommendation_text) {
        finalRecText = recResult.rows[0].recommendation_text;
      }
    }

    // ดึงคำถามและตัวเลือกใน DB เพื่อจับคู่ question_id/choice_id
    const dbQuestionsResult = await client.query(
      `
      SELECT
        q.question_id,
        q.display_order,
        qc.choice_id,
        qc.choice_text,
        qc.score
      FROM questions q
      LEFT JOIN question_choices qc ON qc.question_id = q.question_id AND qc.is_active = true
      WHERE q.assessment_type_id = $1
        AND q.is_active = true
      ORDER BY q.display_order ASC, q.question_id ASC
      `,
      [ASSESSMENT_TYPE_ID]
    );

    const dbQuestions = dbQuestionsResult.rows as Array<{
      question_id: number;
      display_order: number;
      choice_id: number | null;
      choice_text: string | null;
      score: number | null;
    }>;

    // บันทึกผลประเมินลงตาราง assessment (ใน transaction)
    await client.query("BEGIN");

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
      [userId, ASSESSMENT_TYPE_ID, recommendationId, totalScore, riskLevel]
    );

    const newAssessmentId = insertAssessmentResult.rows[0].assessment_id;

    // บันทึกคำตอบรายข้อลง assessment_answers (ไม่เคยดื่ม/หยุดแล้ว บันทึกแค่ข้อ 1)
    const questionsToSave = QUESTIONS.filter((question) => {
      if (q1 === 1 || q1 === 2) {
        return question.id === 1;
      }
      return true;
    });

    for (const q of questionsToSave) {
      const matchedOption = answers.get(q.id)!;

      const optionText = matchedOption.text;
      const score = matchedOption.score;

      const matchingDbQuestionRows = dbQuestions.filter(
        (dq) => dq.display_order === q.id
      );

      if (matchingDbQuestionRows.length === 0) {
        throw new Error(`ไม่พบคำถามแอลกอฮอล์ข้อที่ ${q.id} ในฐานข้อมูล`);
      }

      const dbQuestionId = matchingDbQuestionRows[0].question_id;

      const matchedChoiceRow = matchingDbQuestionRows.find(
        (dq) => dq.choice_text?.trim() === optionText.trim()
      );

      const choiceId = matchedChoiceRow?.choice_id ?? null;

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
        [newAssessmentId, dbQuestionId, choiceId, optionText, score]
      );
    }

    // commit ผูกเวอร์ชันแบบประเมิน แล้วคืนผลลัพธ์
    await client.query("COMMIT");

    await markAssessmentSaved(client, { userId, typeId: ASSESSMENT_TYPE_ID, assessmentId: newAssessmentId });

    return NextResponse.json({
      success: true,
      assessment_id: newAssessmentId,
      total_score: totalScore,
      risk_level: riskLevel,
      recommendation_text: finalRecText,
    });
  } catch (error) {
    // จัดการ error → rollback บันทึก log และคืน 500
    void logSystemError("POST /api/assessments/alcohol", error);
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST ALCOHOL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "ไม่สามารถบันทึกผลการประเมินได้",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}