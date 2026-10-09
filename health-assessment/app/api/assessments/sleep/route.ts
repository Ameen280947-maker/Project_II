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
import { rejectIfAssessmentClosed } from "../_lib/assessmentStatus";

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
        const assessmentIdParam = searchParams.get("assessmentId") || searchParams.get("recordId");

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
          AND (t.assessment_name = 'Sleep' OR a.assessment_type_id = 9)
        LIMIT 1
        `,
                [assessmentId, auth.userId]
            );

            if (assessmentResult.rowCount === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "ไม่พบผลการประเมินการนอนหลับ",
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
                data: {
                    id: assessmentRow.assessment_id,
                    score: Number(assessmentRow.total_score),
                    interpretation: assessmentRow.risk_level,
                    answers: answersResult.rows.map((row) => ({
                        question_id: row.question_id,
                        question_text: row.question_text,
                        display_order: row.display_order,
                        answer_value: row.answer_value,
                        choice_text: row.choice_text ?? row.answer_value,
                        score: row.score,
                    })),
                    createdAt: assessmentRow.assessed_at,
                    recommendation: {
                        id: assessmentRow.recommendation_id ?? 0,
                        score: Number(assessmentRow.total_score),
                        interpretation: assessmentRow.risk_level,
                        title: null,
                        description: null,
                        recommendations: assessmentRow.recommendation_text
                            ? assessmentRow.recommendation_text.split('\n').filter((t: string) => t.trim().length > 0)
                            : [],
                        color: assessmentRow.risk_level === 'เสี่ยงสูง' ? '#FF321A' : (assessmentRow.risk_level === 'ไม่เพียงพอ' ? '#D1BD00' : '#65A85B')
                    }
                }
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
      WHERE q.assessment_type_id = 9
        AND q.is_active = true
        AND qc.is_active = true
      ORDER BY q.display_order ASC, q.question_id ASC, qc.display_order ASC, qc.score ASC
      `
        );

        const questionMap = new Map<
            number,
            {
                id: number;
                questionNo: number;
                question: string;
                options: { id: number; optionText: string; score: number }[];
            }
        >();

        for (const row of questionsResult.rows) {
            if (!questionMap.has(row.question_id)) {
                questionMap.set(row.question_id, {
                    id: row.question_id,
                    questionNo: row.display_order,
                    question: row.question_text,
                    options: [],
                });
            }

            questionMap.get(row.question_id)!.options.push({
                id: row.choice_id,
                optionText: row.choice_text,
                score: row.score,
            });
        }

        return NextResponse.json({
            success: true,
            questions: Array.from(questionMap.values()),
        });
    } catch (error) {
      void logSystemError("GET /api/assessments/sleep", error);
        console.error("GET SLEEP ASSESSMENT ERROR:", error);
        return NextResponse.json(
            {
                success: false,
                message: "ไม่สามารถโหลดแบบประเมินการนอนหลับได้",
            },
            { status: 500 }
        );
    }
}

/* =========================================================
   POST
   บันทึกผลการประเมินการนอนหลับ
========================================================= */

export async function POST(request: NextRequest) {
    const body = await readJsonObject(request);
    if (!body) return badRequest("รูปแบบข้อมูลไม่ถูกต้อง");

    // ผู้ใช้มาจาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
    const auth = requireUser(request, body.userId ?? body.user_id);
    if (!auth.ok) return auth.response;

    // staff ปิดแบบประเมินนี้อยู่ ไม่รับผลใหม่
    const closed = await rejectIfAssessmentClosed(9);
    if (closed) return closed;
    const userId = auth.userId;

    const answers = body.answers;

    if (!Array.isArray(answers) || answers.length === 0) {
        return badRequest("ไม่พบคำตอบแบบประเมิน");
    }

    const client = await pool.connect();

    try {
        if (!(await userExists(client, userId))) {
            return badRequest("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        }

        /*
          คะแนนดึงจาก question_choices ตาม optionId
          ไม่ใช้ score ที่หน้าเว็บส่งมา (เดิมรวมคะแนนจากเบราว์เซอร์ และอาจต่อเป็นข้อความ)
        */
        const resolved = resolveChoiceAnswers(
            await loadActiveChoices(client, 9),
            answers.map((item) => ({
                questionId: item?.questionId,
                choiceId: item?.optionId ?? null,
            })),
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

        let riskLevel = "เสี่ยงสูง";
        if (totalScore >= 3) {
            riskLevel = "เพียงพอ";
        } else if (totalScore === 2) {
            riskLevel = "ไม่เพียงพอ";
        }

        // ดึง recommendation_id ที่ตรงกับระดับความเสี่ยง
        const recResult = await client.query(
            `
      SELECT rec_id
      FROM recommendation
      WHERE assessment_type_id = 9
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
      VALUES ($1, 9, $2, $3, $4, NOW())
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
            recordId: newAssessmentId,
            total_score: totalScore,
            risk_level: riskLevel,
        });
    } catch (error) {
      void logSystemError("POST /api/assessments/sleep", error);
        await client.query("ROLLBACK").catch(() => {});
        console.error("POST SLEEP ASSESSMENT ERROR:", error);

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