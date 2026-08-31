import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type SubmitBody = {
    userId?: number;
    user_id?: number;

    answers: Array<{
        questionId: number;
        optionId: number;
        answer: string;
        score: number;
    }>;
};

/* =========================================================
   HELPER
   หา assessment type ของ Stress
========================================================= */

async function getStressAssessmentTypeId() {
    const result = await pool.query(
        `
      SELECT assessment_type_id, assessment_name
      FROM assessment_types
      WHERE
        LOWER(assessment_name) = LOWER('Stress')
        OR assessment_name ILIKE '%ความเครียด%'
        OR assessment_name ILIKE '%stress%'
      ORDER BY assessment_type_id
      LIMIT 1
    `,
    );

    return result.rows[0]?.assessment_type_id ?? null;
}

/* =========================================================
   GET
========================================================= */

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const assessmentIdParam =
            searchParams.get("assessmentId") ||
            searchParams.get("recordId");

        /* -----------------------------------------------------
           หา assessment_type_id ของ Stress
        ----------------------------------------------------- */

        const stressTypeId = await getStressAssessmentTypeId();

        if (!stressTypeId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ไม่พบประเภทแบบประเมินความเครียดใน assessment_types",
                },
                { status: 404 },
            );
        }

        /* =====================================================
           CASE 1
           ดึงผลการประเมิน
        ===================================================== */

        if (assessmentIdParam) {
            const assessmentId = Number(assessmentIdParam);

            if (
                !Number.isInteger(assessmentId) ||
                assessmentId <= 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "assessmentId ไม่ถูกต้อง",
                    },
                    { status: 400 },
                );
            }

            /* ---------------------------------------------------
               ดึง Assessment
            --------------------------------------------------- */

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

          LEFT JOIN recommendation r
            ON r.rec_id = a.recommendation_id

          WHERE a.assessment_id = $1
            AND a.assessment_type_id = $2

          LIMIT 1
        `,
                [assessmentId, stressTypeId],
            );

            if (assessmentResult.rowCount === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "ไม่พบผลการประเมินความเครียด",
                    },
                    { status: 404 },
                );
            }

            const assessmentRow = assessmentResult.rows[0];

            /* ---------------------------------------------------
               ดึงคำตอบ
            --------------------------------------------------- */

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

          ORDER BY
            q.display_order ASC,
            aa.question_id ASC
        `,
                [assessmentId],
            );

            /* ---------------------------------------------------
               แปลงคำแนะนำจาก Database
            --------------------------------------------------- */

            const recommendations =
                assessmentRow.recommendation_text
                    ? assessmentRow.recommendation_text
                        .split("\n")
                        .filter(
                            (text: string) =>
                                text.trim().length > 0,
                        )
                    : [];

            /* ---------------------------------------------------
               สีตามระดับความเครียด
            --------------------------------------------------- */

            let color = "#65A85B";

            if (assessmentRow.risk_level === "เครียดปานกลาง") {
                color = "#D1BD00";
            }

            if (assessmentRow.risk_level === "เครียดมาก") {
                color = "#FF6B35";
            }

            if (
                assessmentRow.risk_level ===
                "เครียดมากที่สุด"
            ) {
                color = "#FF321A";
            }

            return NextResponse.json({
                success: true,

                data: {
                    id: assessmentRow.assessment_id,

                    user_id: assessmentRow.user_id,

                    score: Number(
                        assessmentRow.total_score,
                    ),

                    interpretation:
                        assessmentRow.risk_level,

                    answers: answersResult.rows.map(
                        (row) => ({
                            question_id: row.question_id,
                            question_text:
                                row.question_text,
                            display_order:
                                row.display_order,
                            answer_value:
                                row.answer_value,
                            choice_text:
                                row.choice_text ??
                                row.answer_value,
                            score: Number(row.score),
                        }),
                    ),

                    createdAt:
                        assessmentRow.assessed_at,

                    recommendation: {
                        id:
                            assessmentRow.recommendation_id ??
                            0,

                        score: Number(
                            assessmentRow.total_score,
                        ),

                        interpretation:
                            assessmentRow.risk_level,

                        title:
                            assessmentRow.risk_level,

                        description: null,

                        recommendations,

                        color,
                    },
                },
            });
        }

        /* =====================================================
           CASE 2
           ดึงคำถาม ST-5
        ===================================================== */

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

        WHERE q.assessment_type_id = $1
          AND q.is_active = true
          AND qc.is_active = true

        ORDER BY
          q.display_order ASC,
          q.question_id ASC,
          qc.display_order ASC,
          qc.score ASC
      `,
            [stressTypeId],
        );

        /* -----------------------------------------------------
           รวม Question + Choices
        ----------------------------------------------------- */

        const questionMap = new Map<
            number,
            {
                id: number;
                questionNo: number;
                question: string;
                options: {
                    id: number;
                    optionText: string;
                    score: number;
                }[];
            }
        >();

        for (const row of questionsResult.rows) {
            if (!questionMap.has(row.question_id)) {
                questionMap.set(row.question_id, {
                    id: row.question_id,

                    questionNo:
                        row.display_order,

                    question:
                        row.question_text,

                    options: [],
                });
            }

            questionMap
                .get(row.question_id)!
                .options.push({
                    id: row.choice_id,

                    optionText:
                        row.choice_text,

                    score: Number(row.score),
                });
        }

        return NextResponse.json({
            success: true,

            questions:
                Array.from(questionMap.values()),
        });
    } catch (error) {
        console.error(
            "GET STRESS ASSESSMENT ERROR:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "ไม่สามารถโหลดแบบประเมินความเครียดได้",
            },
            { status: 500 },
        );
    }
}

/* =========================================================
   POST
   บันทึกผลการประเมิน ST-5
========================================================= */

export async function POST(
    request: NextRequest,
) {
    const client = await pool.connect();

    try {
        const body =
            (await request.json()) as SubmitBody;

        /* -----------------------------------------------------
           User ID
        ----------------------------------------------------- */

        const rawUserId =
            body.userId ?? body.user_id;

        const userId = Number(rawUserId);

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ไม่พบข้อมูลผู้ใช้งานที่ถูกต้อง",
                },
                { status: 400 },
            );
        }

        /* -----------------------------------------------------
           Answers
        ----------------------------------------------------- */

        const answers = body.answers;

        if (
            !Array.isArray(answers) ||
            answers.length !== 5
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "กรุณาตอบแบบประเมินให้ครบทั้ง 5 ข้อ",
                },
                { status: 400 },
            );
        }

        /* -----------------------------------------------------
           ตรวจสอบคำตอบ
        ----------------------------------------------------- */

        for (const item of answers) {
            if (
                !Number.isInteger(
                    Number(item.questionId),
                ) ||
                !Number.isInteger(
                    Number(item.optionId),
                )
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "ข้อมูลคำตอบไม่ถูกต้อง",
                    },
                    { status: 400 },
                );
            }
        }

        /* -----------------------------------------------------
           คำนวณคะแนน
        ----------------------------------------------------- */

        let totalScore = 0;

        const answersToInsert: Array<{
            question_id: number;
            choice_id: number | null;
            answer_value: string;
            score: number;
        }> = [];

        for (const item of answers) {
            const score = Number(item.score);

            if (
                !Number.isFinite(score) ||
                score < 0 ||
                score > 3
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "คะแนนคำตอบไม่ถูกต้อง",
                    },
                    { status: 400 },
                );
            }

            totalScore += score;

            answersToInsert.push({
                question_id:
                    Number(item.questionId),

                choice_id:
                    Number(item.optionId),

                answer_value:
                    item.answer,

                score,
            });
        }

        /* -----------------------------------------------------
           ST-5 Interpretation
    
           0 - 4   เครียดน้อย
           5 - 7   เครียดปานกลาง
           8 - 9   เครียดมาก
           10 -15  เครียดมากที่สุด
        ----------------------------------------------------- */

        let riskLevel = "เครียดน้อย";

        if (
            totalScore >= 5 &&
            totalScore <= 7
        ) {
            riskLevel = "เครียดปานกลาง";
        } else if (
            totalScore >= 8 &&
            totalScore <= 9
        ) {
            riskLevel = "เครียดมาก";
        } else if (totalScore >= 10) {
            riskLevel = "เครียดมากที่สุด";
        }

        /* -----------------------------------------------------
           หา Assessment Type
        ----------------------------------------------------- */

        const stressTypeResult =
            await client.query(
                `
          SELECT assessment_type_id
          FROM assessment_types
          WHERE
            LOWER(assessment_name) =
              LOWER('Stress')
            OR assessment_name ILIKE '%ความเครียด%'
            OR assessment_name ILIKE '%stress%'
          ORDER BY assessment_type_id
          LIMIT 1
        `,
            );

        const stressTypeId =
            stressTypeResult.rows[0]
                ?.assessment_type_id;

        if (!stressTypeId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "ไม่พบประเภทแบบประเมินความเครียด",
                },
                { status: 404 },
            );
        }

        /* -----------------------------------------------------
           หา Recommendation
        ----------------------------------------------------- */

        const recResult =
            await client.query(
                `
          SELECT rec_id
          FROM recommendation
          WHERE assessment_type_id = $1
            AND risk_level = $2
          LIMIT 1
        `,
                [
                    stressTypeId,
                    riskLevel,
                ],
            );

        const recommendationId =
            recResult.rows[0]?.rec_id ?? null;

        /* -----------------------------------------------------
           BEGIN TRANSACTION
        ----------------------------------------------------- */

        await client.query("BEGIN");

        /* -----------------------------------------------------
           Insert Assessment
        ----------------------------------------------------- */

        const insertAssessmentResult =
            await client.query(
                `
          INSERT INTO assessment (
            user_id,
            assessment_type_id,
            recommendation_id,
            total_score,
            risk_level,
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

          RETURNING assessment_id
        `,
                [
                    userId,
                    stressTypeId,
                    recommendationId,
                    totalScore,
                    riskLevel,
                ],
            );

        const newAssessmentId =
            insertAssessmentResult
                .rows[0]
                .assessment_id;

        /* -----------------------------------------------------
           Insert Answers
        ----------------------------------------------------- */

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

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            NOW()
          )
        `,
                [
                    newAssessmentId,
                    item.question_id,
                    item.choice_id,
                    item.answer_value,
                    item.score,
                ],
            );
        }

        /* -----------------------------------------------------
           COMMIT
        ----------------------------------------------------- */

        await client.query("COMMIT");

        return NextResponse.json({
            success: true,

            assessment_id:
                newAssessmentId,

            recordId:
                newAssessmentId,

            total_score:
                totalScore,

            risk_level:
                riskLevel,

            recommendation_id:
                recommendationId,
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error(
            "POST STRESS ASSESSMENT ERROR:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "ไม่สามารถบันทึกผลการประเมินความเครียดได้",
            },
            { status: 500 },
        );
    } finally {
        client.release();
    }
}