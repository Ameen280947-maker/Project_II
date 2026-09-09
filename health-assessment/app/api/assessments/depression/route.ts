import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

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

/* =========================================================
   GET
   ========================================================= */

export async function GET(request: NextRequest) {
  const client = await pool.connect();

  try {
    const rawStage = request.nextUrl.searchParams.get("stage");
    const assessmentIdParam = request.nextUrl.searchParams.get("assessmentId");
    const userId = request.nextUrl.searchParams.get("userId");

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

      let sql = `
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
      `;

      const params: any[] = [assessmentId, TYPE_2Q, TYPE_9Q];

      if (userId) {
        const numericUserId = Number(userId);
        if (Number.isInteger(numericUserId) && numericUserId > 0) {
          sql += ` AND a.user_id = $4`;
          params.push(numericUserId);
        }
      }

      const result = await client.query(sql, params);

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

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ไม่สามารถโหลดแบบประเมินได้",
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

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  let inTransaction = false;

  try {
    const body = await request.json();

    const {
      userId,
      stage,
      answers,
      previousAssessmentId,
    }: {
      userId: string | number;
      stage: "2q" | "9q";
      answers: Answer[];
      previousAssessmentId?: number | null;
    } = body;

    const numericUserId = Number(userId);
    if (!numericUserId || !Number.isInteger(numericUserId) || numericUserId <= 0) {
      return NextResponse.json(
        {
          error: "User ID ไม่ถูกต้อง กรุณาเข้าสู่ระบบก่อนทำแบบประเมิน",
        },
        { status: 400 }
      );
    }

    if (stage !== "2q" && stage !== "9q") {
      return NextResponse.json(
        {
          error: "Stage ไม่ถูกต้อง (ต้องเป็น 2q หรือ 9q)",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        {
          error: "กรุณาระบุคำตอบให้ครบถ้วน",
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          error: "ไม่พบคำถามในฐานข้อมูล",
        },
        { status: 400 }
      );
    }

    /* ตรวจว่าตอบครบทุกข้อที่จำเป็น */
    const answeredQuestionIds = new Set(
      answers.map((answer) => Number(answer.question_id))
    );

    const missingQuestions = questions.filter(
      (question) =>
        question.is_required &&
        !answeredQuestionIds.has(Number(question.question_id))
    );

    if (missingQuestions.length > 0) {
      return NextResponse.json(
        {
          error: `กรุณาตอบคำถามให้ครบ ${missingQuestions.length} ข้อ`,
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       ตรวจ choices และคำนวณคะแนนอย่างปลอดภัย
    ----------------------------------------------------- */
    const questionIds = questions.map((question) => question.question_id);

    const choicesResult = await client.query(
      `
      SELECT
        choice_id,
        question_id,
        choice_text,
        score
      FROM question_choices
      WHERE question_id = ANY($1::int[])
        AND is_active = TRUE
      `,
      [questionIds]
    );

    let totalScore = 0;

    const validatedAnswers = answers.map((answer) => {
      const questionId = Number(answer.question_id);
      const choiceId = Number(answer.choice_id);

      const question = questions.find(
        (q) => Number(q.question_id) === questionId
      );

      if (!question) {
        throw new Error(`ไม่พบข้อคำถามรหัส ${questionId}`);
      }

      const choice = choicesResult.rows.find(
        (c) =>
          Number(c.question_id) === questionId &&
          Number(c.choice_id) === choiceId
      );

      if (!choice) {
        throw new Error(
          `ไม่พบตัวเลือกรหัส ${choiceId} ของคำถามข้อที่ ${question.display_order ?? questionId}`
        );
      }

      const score = Number(choice.score ?? 0);
      totalScore += score;

      return {
        question_id: questionId,
        choice_id: choiceId,
        answer_value: choice.choice_text,
        score,
      };
    });

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
      if (previousAssessmentId) {
        const prevId = Number(previousAssessmentId);
        if (Number.isInteger(prevId) && prevId > 0) {
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
            return NextResponse.json(
              {
                error: "ไม่พบผลการประเมิน 2Q ที่เกี่ยวข้อง",
              },
              { status: 400 }
            );
          }

          const previous = previousResult.rows[0];

          if (Number(previous.user_id) !== numericUserId) {
            return NextResponse.json(
              {
                error: "ไม่สามารถใช้ผลการประเมินของผู้ใช้อื่นได้",
              },
              { status: 403 }
            );
          }

          const has2QRisk =
            Number(previous.total_score) > 0 ||
            String(previous.risk_level).includes("เสี่ยง");

          if (!has2QRisk) {
            return NextResponse.json(
              {
                error:
                  "ผลประเมิน 2Q ของท่านไม่พบความเสี่ยงภาวะซึมเศร้า ไม่จำเป็นต้องประเมิน 9Q",
              },
              { status: 400 }
            );
          }
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

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ไม่สามารถบันทึกผลการประเมินได้",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}