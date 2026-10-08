import { NextRequest, NextResponse } from "next/server";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

/* =========================================================
   GET
   1) ถ้ามี assessmentId -> ดึงผลการประเมินและคำตอบ
   2) ถ้าไม่มี assessmentId -> ดึงรายการคำถามและตัวเลือก
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentIdParam = searchParams.get("assessmentId");

    /* -----------------------------------------------------
       CASE 1: ดึงผลการประเมินจาก assessmentId
    ----------------------------------------------------- */
    if (assessmentIdParam) {
      const auth = requireUser(request);
      if (!auth.ok) return auth.response;

      const assessmentId = Number(assessmentIdParam);

      if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "assessmentId ไม่ถูกต้อง",
          },
          { status: 400 }
        );
      }

      // ดึงข้อมูล Assessment
      const assessmentResult = await pool.query(
        `
        SELECT
          a.assessment_id,
          a.user_id,
          a.assessment_type_id,
          t.assessment_name,
          a.total_score,
          a.risk_level,
          a.recommendation_id,
          r.recommendation_text,
          a.assessed_at
        FROM assessment a
        INNER JOIN assessment_types t
          ON t.assessment_type_id = a.assessment_type_id
        -- คำแนะนำฉบับที่ใช้อยู่ตอนทำแบบประเมิน (staff แก้ภายหลังไม่กระทบผลเก่า)
        LEFT JOIN LATERAL recommendation_at(a.recommendation_id, a.assessed_at) r
          ON TRUE
        WHERE a.assessment_id = $1
          AND a.user_id = $2
          AND t.assessment_name = 'Smoking'
        LIMIT 1
        `,
        [assessmentId, auth.userId]
      );

      if (assessmentResult.rowCount === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "ไม่พบผลการประเมินการสูบบุหรี่",
          },
          { status: 404 }
        );
      }

      const assessmentRow = assessmentResult.rows[0];

      // ดึงข้อมูลคำตอบ
      const answersResult = await pool.query(
        `
        SELECT
          aa.question_id,
          q.display_order,
          q.question_text,
          aa.answer_value,
          qc.choice_text,
          aa.score
        FROM assessment_answers aa
        INNER JOIN questions q
          ON q.question_id = aa.question_id
        LEFT JOIN question_choices qc
          ON qc.choice_id = aa.choice_id
        WHERE aa.assessment_id = $1
        ORDER BY q.display_order ASC, aa.question_id ASC
        `,
        [assessmentId]
      );

      return NextResponse.json({
        success: true,
        assessment: {
          assessment_id: assessmentRow.assessment_id,
          user_id: assessmentRow.user_id,
          total_score: assessmentRow.total_score,
          risk_level: assessmentRow.risk_level,
          assessment_type_id: assessmentRow.assessment_type_id,
          assessment_name: assessmentRow.assessment_name,
          assessed_at: assessmentRow.assessed_at,
          recommendation_text: assessmentRow.recommendation_text,
        },
        answers: answersResult.rows.map((row) => ({
          question_id: row.question_id,
          question_text: row.question_text,
          display_order: row.display_order,
          answer_value: row.answer_value,
          choice_text: row.choice_text ?? row.answer_value,
          score: row.score,
        })),
      });
    }

    /* -----------------------------------------------------
       CASE 2: ดึงรายการคำถามสำหรับทำแบบประเมิน
    ----------------------------------------------------- */
    const questionsResult = await pool.query(
      `
      SELECT
        q.question_id,
        q.question_text,
        q.display_order,
        qc.choice_id,
        qc.choice_text,
        qc.score,
        qc.display_order AS choice_order
      FROM questions q
      INNER JOIN question_choices qc
        ON qc.question_id = q.question_id
      WHERE q.assessment_type_id = 6
        AND q.is_active = true
        AND qc.is_active = true
      ORDER BY q.display_order ASC, q.question_id ASC, qc.display_order ASC, qc.score ASC
      `
    );

    const questionMap = new Map<
      number,
      {
        id: number;
        question: string;
        options: string[];
      }
    >();

    for (const row of questionsResult.rows) {
      if (!questionMap.has(row.question_id)) {
        questionMap.set(row.question_id, {
          id: row.question_id,
          question: row.question_text,
          options: [],
        });
      }

      questionMap.get(row.question_id)!.options.push(row.choice_text);
    }

    return NextResponse.json({
      success: true,
      questions: Array.from(questionMap.values()),
    });
  } catch (error) {
    void logSystemError("GET /api/assessments/smoking", error);
    console.error("GET SMOKING ASSESSMENT ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "ไม่สามารถโหลดแบบประเมินการสูบบุหรี่ได้",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST
   บันทึกผลการประเมินการสูบบุหรี่
========================================================= */

export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);
  if (!body) return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");

  // ผู้ใช้มาจาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
  const auth = requireUser(request, body.userId ?? body.user_id);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  // รูปแบบเดิม: { [question_id]: ข้อความตัวเลือก }
  const answers = body.answers;

  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return badRequest("ไม่พบคำตอบแบบประเมิน");
  }

  const client = await pool.connect();

  try {
    if (!(await userExists(client, userId))) {
      return badRequest("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
    }

    // ตัวเลือกและคะแนนของคำถามสูบบุหรี่ (assessment_type_id = 6)
    const choicesRows = await loadActiveChoices(client, 6);

    /*
      เอกสารอ้างอิงคิดคะแนนรวมจากข้อ 1-4 จึงต้องตอบครบทุกข้อ
      ด้วยข้อความตัวเลือกที่มีอยู่จริง (คะแนนดึงจากฐานข้อมูล)
    */
    const resolved = resolveChoiceAnswers(
      choicesRows,
      Object.entries(answers as Record<string, unknown>).map(
        ([questionId, choiceText]) => ({
          questionId,
          choiceText: typeof choiceText === "string" ? choiceText : null,
        }),
      ),
    );

    if (!resolved.ok) {
      return badRequest(resolved.message);
    }

    const totalScore = resolved.total;
    const answersToInsert = resolved.picked.map((choice) => ({
      question_id: choice.question_id,
      choice_id: choice.choice_id,
      answer_value: choice.choice_text,
      score: choice.score,
    }));

    /*
     * การแปลผลตามเอกสารอ้างอิง ตารางที่ 14 (คะแนนรวมข้อ 1-4):
     * 0 คะแนน: เสี่ยงต่ำ
     * 1-4 คะแนน: เสี่ยงปานกลาง
     * 5-8 คะแนน: เสี่ยงสูง
     */
    let riskLevel = "เสี่ยงต่ำ";
    if (totalScore >= 5) {
      riskLevel = "เสี่ยงสูง";
    } else if (totalScore >= 1) {
      riskLevel = "เสี่ยงปานกลาง";
    }

    // ดึง recommendation_id ที่ตรงกับระดับความเสี่ยง
    const recResult = await client.query(
      `
      SELECT rec_id
      FROM recommendation
      WHERE assessment_type_id = 6
        AND risk_level = $1
      LIMIT 1
      `,
      [riskLevel]
    );

    const recommendationId = recResult.rows[0]?.rec_id ?? null;

    await client.query("BEGIN");

    // บันทึก assessment
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
      VALUES ($1, 6, $2, $3, $4, NOW())
      RETURNING assessment_id
      `,
      [userId, recommendationId, totalScore, riskLevel]
    );

    const newAssessmentId = insertAssessmentResult.rows[0].assessment_id;

    // บันทึกคำตอบใน assessment_answers
    for (const item of answersToInsert) {
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
        [
          newAssessmentId,
          item.question_id,
          item.choice_id,
          item.answer_value,
          item.score,
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      assessment_id: newAssessmentId,
      total_score: totalScore,
      risk_level: riskLevel,
    });
  } catch (error) {
    void logSystemError("POST /api/assessments/smoking", error);
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST SMOKING ASSESSMENT ERROR:", error);

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