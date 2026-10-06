import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  loadActiveChoices,
  readJsonObject,
  resolveChoiceAnswers,
  toId,
  userExists,
} from "../_lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_2Q = 13;
const TYPE_9Q = 14;

const REC_2Q_NO_RISK = 59;
const REC_2Q_RISK = 60;

const REC_9Q = {
  NO_RISK: 61,
  MILD: 62,
  MODERATE: 63,
  SEVERE: 64,
};

type Answer = {
  question_id: number;
  choice_id: number;
};

/* หน้าเว็บ 2Q/9Q อ่านข้อความผิดพลาดจาก key "error" จึงส่งทั้ง error และ message */
function fail(message: string, status = 400) {
  return NextResponse.json(
    { success: false, error: message, message },
    { status }
  );
}

/* ตรวจ session แล้วแปลงคำตอบ 401/403 ให้มี key "error" ด้วย */
async function authorize(request: NextRequest, claimedUserId?: unknown) {
  const auth = requireUser(request, claimedUserId);
  if (auth.ok) return { ok: true as const, userId: auth.userId };

  const data = (await auth.response.json()) as { message?: string };
  return {
    ok: false as const,
    response: fail(data.message ?? "กรุณาเข้าสู่ระบบใหม่", auth.response.status),
  };
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(request: NextRequest) {
  const rawStage = request.nextUrl.searchParams.get("stage");
  const assessmentIdParam = request.nextUrl.searchParams.get("assessmentId");

  // ดูผลการประเมินได้เฉพาะของตัวเอง (?userId= ถ้าส่งมาต้องตรงกับ session)
  let sessionUserId: number | null = null;

  if (assessmentIdParam) {
    const auth = await authorize(request, request.nextUrl.searchParams.get("userId"));
    if (!auth.ok) return auth.response;
    sessionUserId = auth.userId;
  }

  const client = await pool.connect();

  try {
    /* -----------------------------------------------------
       1. กรณีขอผลการประเมิน (Result / Recommendation)
    ----------------------------------------------------- */
    if (assessmentIdParam) {
      const assessmentId = Number(assessmentIdParam);

      if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
        return NextResponse.json(
          {
            error: "Assessment ID ไม่ถูกต้อง",
          },
          { status: 400 }
        );
      }

      const sql = `
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
        JOIN assessment_types t
          ON t.assessment_type_id = a.assessment_type_id
        LEFT JOIN recommendation r
          ON r.rec_id = a.recommendation_id
        WHERE a.assessment_id = $1
          AND a.assessment_type_id IN ($2, $3)
          AND a.user_id = $4
      `;

      const result = await client.query(sql, [
        assessmentId,
        TYPE_2Q,
        TYPE_9Q,
        sessionUserId,
      ]);

      if (result.rows.length === 0) {
        return NextResponse.json(
          {
            error: "ไม่พบผลการประเมิน",
          },
          { status: 404 }
        );
      }

      const assessment = result.rows[0];
      const detectedStage =
        Number(assessment.assessment_type_id) === TYPE_9Q ? "9q" : "2q";

      /* ถ้า recommendation_text เป็น null ให้หาจากตาราง recommendation ตาม risk_level */
      let recommendationText = assessment.recommendation_text;
      if (!recommendationText) {
        const fallbackRec = await client.query(
          `
          SELECT recommendation_text
          FROM recommendation
          WHERE assessment_type_id = $1
            AND (risk_level = $2 OR rec_id = $3)
          LIMIT 1
          `,
          [
            assessment.assessment_type_id,
            assessment.risk_level,
            assessment.recommendation_id,
          ]
        );
        if (fallbackRec.rows.length > 0) {
          recommendationText = fallbackRec.rows[0].recommendation_text;
        }
      }

      /* ดึงคำตอบทั้งหมด */
      const answersResult = await client.query(
        `
        SELECT
          aa.answer_id,
          aa.question_id,
          q.question_text,
          q.display_order,
          aa.choice_id,
          qc.choice_text,
          aa.answer_value,
          aa.score
        FROM assessment_answers aa
        JOIN questions q
          ON q.question_id = aa.question_id
        LEFT JOIN question_choices qc
          ON qc.choice_id = aa.choice_id
        WHERE aa.assessment_id = $1
        ORDER BY q.display_order ASC, aa.answer_id ASC
        `,
        [assessmentId]
      );

      /* ตรวจข้อทำร้ายตนเองของ 9Q */
      let needsUrgentAttention = false;
      if (detectedStage === "9q") {
        needsUrgentAttention = answersResult.rows.some((answer) => {
          const text = String(answer.question_text || "");
          const isHarmQuestion =
            text.includes("ทำร้ายตนเอง") ||
            text.includes("ตาย") ||
            Number(answer.display_order) === 9;
          return isHarmQuestion && Number(answer.score) > 0;
        });
      }

      return NextResponse.json({
        success: true,
        stage: detectedStage,
        assessment_id: assessment.assessment_id,
        user_id: assessment.user_id,
        assessment_type_id: assessment.assessment_type_id,
        assessment_name: assessment.assessment_name,
        total_score: Number(assessment.total_score ?? 0),
        risk_level: assessment.risk_level,
        recommendation_id: assessment.recommendation_id,
        recommendation_text: recommendationText ?? "",
        assessed_at: assessment.assessed_at,
        answers: answersResult.rows,
        needs_urgent_attention: needsUrgentAttention,
      });
    }

    /* -----------------------------------------------------
       2. กรณีโหลดคำถาม (Questions & Choices)
    ----------------------------------------------------- */
    const stage = rawStage === "9q" ? "9q" : "2q";
    const assessmentTypeId = stage === "9q" ? TYPE_9Q : TYPE_2Q;

    const questionsResult = await client.query(
      `
      SELECT
        q.question_id,
        q.question_text,
        q.question_type,
        q.display_order,
        q.is_required
      FROM questions q
      WHERE q.assessment_type_id = $1
        AND q.is_active = TRUE
      ORDER BY q.display_order ASC, q.question_id ASC
      `,
      [assessmentTypeId]
    );

    const questionIds = questionsResult.rows.map((q) => q.question_id);

    if (questionIds.length === 0) {
      return NextResponse.json({
        success: true,
        stage,
        assessment_type_id: assessmentTypeId,
        questions: [],
      });
    }

    const choicesResult = await client.query(
      `
      SELECT
        qc.choice_id,
        qc.question_id,
        qc.choice_text,
        qc.score,
        qc.display_order
      FROM question_choices qc
      WHERE qc.question_id = ANY($1::int[])
        AND qc.is_active = TRUE
      ORDER BY
        qc.question_id ASC,
        qc.display_order ASC,
        qc.choice_id ASC
      `,
      [questionIds]
    );

    const questions = questionsResult.rows.map((question) => ({
      ...question,
      choices: choicesResult.rows.filter(
        (choice) => choice.question_id === question.question_id
      ),
    }));

    return NextResponse.json({
      success: true,
      stage,
      assessment_type_id: assessmentTypeId,
      questions,
    });
  } catch (error) {
    console.error("Depression GET error:", error);

    return fail("ไม่สามารถโหลดแบบประเมินได้", 500);
  } finally {
    client.release();
  }
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);
  if (!body) return fail("รูปแบบข้อมูลไม่ถูกต้อง");

  // ผู้ใช้มาจาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
  const auth = await authorize(request, body.userId ?? body.user_id);
  if (!auth.ok) return auth.response;
  const numericUserId = auth.userId;

  const stage = body.stage;
  const answers = body.answers as Answer[] | undefined;
  const previousAssessmentId = body.previousAssessmentId;

  if (stage !== "2q" && stage !== "9q") {
    return fail("Stage ไม่ถูกต้อง (ต้องเป็น 2q หรือ 9q)");
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    return fail("กรุณาระบุคำตอบให้ครบถ้วน");
  }

  const client = await pool.connect();
  let inTransaction = false;

  try {
    if (!(await userExists(client, numericUserId))) {
      return fail("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
    }

    const assessmentTypeId = stage === "2q" ? TYPE_2Q : TYPE_9Q;

    /* -----------------------------------------------------
       โหลดคำถามที่ active ทั้งหมดของประเภทนี้
    ----------------------------------------------------- */
    const questionsResult = await client.query(
      `
      SELECT
        q.question_id,
        q.question_text,
        q.display_order,
        q.is_required
      FROM questions q
      WHERE q.assessment_type_id = $1
        AND q.is_active = TRUE
      ORDER BY q.display_order ASC, q.question_id ASC
      `,
      [assessmentTypeId]
    );

    const questions = questionsResult.rows;

    if (questions.length === 0) {
      return fail("ไม่พบคำถามในฐานข้อมูล");
    }

    /* -----------------------------------------------------
       ตรวจ choices และคำนวณคะแนนจากฐานข้อมูล
       - ต้องตอบครบทุกข้อ ข้อละ 1 คำตอบ (เดิมตอบซ้ำได้ ทำให้คะแนนเกินเต็ม)
       - ตัวเลือกต้องเป็นของคำถามนั้นในแบบประเมินนี้
    ----------------------------------------------------- */
    const resolved = resolveChoiceAnswers(
      await loadActiveChoices(client, assessmentTypeId),
      answers.map((answer) => ({
        questionId: answer?.question_id,
        choiceId: answer?.choice_id ?? null,
      }))
    );

    if (!resolved.ok) {
      return fail(resolved.message);
    }

    const totalScore = resolved.total;

    const validatedAnswers = resolved.picked.map((choice) => ({
      question_id: choice.question_id,
      choice_id: choice.choice_id,
      answer_value: choice.choice_text,
      score: choice.score,
    }));

    /* -----------------------------------------------------
       STAGE: 2Q
    ----------------------------------------------------- */
    if (stage === "2q") {
      const isRisk = totalScore > 0;

      // ตามมาตรฐาน DB rec_id 59 & 60
      const riskLevel = isRisk
        ? "มีความเสี่ยงหรือมีแนวโน้มเป็นโรคซึมเศร้า"
        : "ไม่เป็นโรคซึมเศร้า";

      const recommendationId = isRisk ? REC_2Q_RISK : REC_2Q_NO_RISK;

      await client.query("BEGIN");
      inTransaction = true;

      const assessmentResult = await client.query(
        `
        INSERT INTO assessment (
          user_id,
          total_score,
          risk_level,
          assessment_type_id,
          recommendation_id,
          assessed_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING assessment_id
        `,
        [
          numericUserId,
          totalScore,
          riskLevel,
          TYPE_2Q,
          recommendationId,
        ]
      );

      const assessmentId = assessmentResult.rows[0].assessment_id;

      for (const answer of validatedAnswers) {
        await client.query(
          `
          INSERT INTO assessment_answers (
            assessment_id,
            question_id,
            answer_value,
            choice_id,
            score
          )
          VALUES ($1, $2, $3, $4, $5)
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

      await client.query("COMMIT");
      inTransaction = false;

      /* ถ้า 2Q เสี่ยง → แนะนำให้ทำ 9Q ต่อ */
      if (isRisk) {
        return NextResponse.json({
          success: true,
          stage: "2q",
          assessment_id: assessmentId,
          total_score: totalScore,
          risk_level: riskLevel,
          is_risk: true,
          next_step: "9q",
          next_path: `/assessment_depression_9q?previousAssessmentId=${assessmentId}`,
        });
      }

      /* ถ้า 2Q ไม่เสี่ยง → ไปหน้าผลการประเมิน 2Q */
      return NextResponse.json({
        success: true,
        stage: "2q",
        assessment_id: assessmentId,
        total_score: totalScore,
        risk_level: riskLevel,
        is_risk: false,
        next_step: "comment",
        next_path: `/recommendation_depression_2q?assessmentId=${assessmentId}`,
      });
    }

    /* -----------------------------------------------------
       STAGE: 9Q
    ----------------------------------------------------- */
    if (stage === "9q") {
      /* ตรวจสอบ previousAssessmentId ถ้ามีส่งมา */
      if (
        previousAssessmentId !== undefined &&
        previousAssessmentId !== null &&
        previousAssessmentId !== ""
      ) {
        const prevId = toId(previousAssessmentId);

        if (prevId === null) {
          return fail("รหัสผลการประเมิน 2Q ไม่ถูกต้อง");
        }

        const previousResult = await client.query(
          `
          SELECT
            assessment_id,
            user_id,
            assessment_type_id,
            risk_level,
            total_score
          FROM assessment
          WHERE assessment_id = $1
            AND assessment_type_id = $2
          `,
          [prevId, TYPE_2Q]
        );

        if (previousResult.rows.length === 0) {
          return fail("ไม่พบผลการประเมิน 2Q ที่เกี่ยวข้อง");
        }

        const previous = previousResult.rows[0];

        if (Number(previous.user_id) !== numericUserId) {
          return fail("ไม่สามารถใช้ผลการประเมินของผู้ใช้อื่นได้", 403);
        }

        const has2QRisk =
          Number(previous.total_score) > 0 ||
          String(previous.risk_level).includes("เสี่ยง");

        if (!has2QRisk) {
          return fail(
            "ผลประเมิน 2Q ของท่านไม่พบความเสี่ยงภาวะซึมเศร้า ไม่จำเป็นต้องประเมิน 9Q"
          );
        }
      }

      /* แปลผลคะแนน 9Q ตามเกณฑ์กรมสุขภาพจิต */
      let riskLevel = "";
      let recommendationId = 0;

      if (totalScore <= 6) {
        riskLevel = "ไม่มีอาการซึมเศร้าหรือมีน้อยมาก";
        recommendationId = REC_9Q.NO_RISK;
      } else if (totalScore <= 12) {
        riskLevel = "มีอาการซึมเศร้าระดับน้อย";
        recommendationId = REC_9Q.MILD;
      } else if (totalScore <= 18) {
        riskLevel = "มีอาการซึมเศร้าระดับปานกลาง";
        recommendationId = REC_9Q.MODERATE;
      } else {
        riskLevel = "มีอาการซึมเศร้าระดับรุนแรง";
        recommendationId = REC_9Q.SEVERE;
      }

      await client.query("BEGIN");
      inTransaction = true;

      const assessmentResult = await client.query(
        `
        INSERT INTO assessment (
          user_id,
          total_score,
          risk_level,
          assessment_type_id,
          recommendation_id,
          assessed_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING assessment_id
        `,
        [
          numericUserId,
          totalScore,
          riskLevel,
          TYPE_9Q,
          recommendationId,
        ]
      );

      const assessmentId = assessmentResult.rows[0].assessment_id;

      for (const answer of validatedAnswers) {
        await client.query(
          `
          INSERT INTO assessment_answers (
            assessment_id,
            question_id,
            answer_value,
            choice_id,
            score
          )
          VALUES ($1, $2, $3, $4, $5)
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

      await client.query("COMMIT");
      inTransaction = false;

      /* ตรวจข้อ 9 คิดทำร้ายตนเอง หรือคิดว่าถ้าตายไปคงจะดี */
      const needsUrgentAttention = validatedAnswers.some((answer) => {
        const question = questions.find(
          (q) => Number(q.question_id) === Number(answer.question_id)
        );
        const text = String(question?.question_text || "");
        const isHarm =
          text.includes("ทำร้ายตนเอง") ||
          text.includes("ตาย") ||
          Number(question?.display_order) === 9;
        return isHarm && answer.score > 0;
      });

      return NextResponse.json({
        success: true,
        stage: "9q",
        assessment_id: assessmentId,
        total_score: totalScore,
        risk_level: riskLevel,
        recommendation_id: recommendationId,
        needs_urgent_attention: needsUrgentAttention,
        next_step: "comment",
        next_path: `/recommendation_depression_9q?assessmentId=${assessmentId}`,
      });
    }

    return NextResponse.json(
      {
        error: "ไม่สามารถประมวลผลได้",
      },
      { status: 400 }
    );
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Depression POST error:", error);

    return fail("ไม่สามารถบันทึกผลการประเมินได้", 500);
  } finally {
    client.release();
  }
}