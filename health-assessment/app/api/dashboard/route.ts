import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { riskLevelOf } from "@/lib/riskLevel";
import { requireUser } from "@/lib/session";

// แบบประเมิน 9Q (ข้อสุดท้าย = คิดทำร้ายตนเอง)
const TYPE_9Q = 14;

/* =========================================================
   GET DASHBOARD
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ใช้ผู้ใช้จาก session (userId ที่ส่งมาต้องตรงกับ session)
    const auth = requireUser(request, searchParams.get("userId"));
    if (!auth.ok) return auth.response;

    const userIdNumber = auth.userId;

    /* =====================================================
       ดึงข้อมูลการประเมินของผู้ใช้คนนี้
    ===================================================== */

    const result = await pool.query(
      `
      SELECT
        a.assessment_id,
        a.assessment_type_id,
        t.assessment_name,
        a.total_score,
        a.risk_level,
        a.assessed_at,
        r.recommendation_text,

        -- Blood Pressure ไม่ได้เก็บค่าไว้ใน total_score
        -- ค่าความดันอยู่ใน assessment_answers (ข้อ 1 = ตัวบน, ข้อ 2 = ตัวล่าง)
        bp.systolic,
        bp.diastolic,

        -- 9Q: ตอบข้อคิดทำร้ายตนเอง (ข้อสุดท้าย) คะแนน > 0 หรือไม่
        (
          a.assessment_type_id = $2
          AND EXISTS (
            SELECT 1
            FROM assessment_answers aa
            JOIN questions q
              ON q.question_id = aa.question_id
            WHERE aa.assessment_id = a.assessment_id
              AND q.assessment_type_id = $2
              AND q.display_order = (
                SELECT MAX(q2.display_order)
                FROM questions q2
                WHERE q2.assessment_type_id = $2
              )
              AND COALESCE(aa.score, 0) > 0
          )
        ) AS self_harm_flag

      FROM assessment a

      LEFT JOIN LATERAL (
        SELECT
          MAX(aa.answer_value) FILTER (WHERE q.display_order = 1)::numeric AS systolic,
          MAX(aa.answer_value) FILTER (WHERE q.display_order = 2)::numeric AS diastolic
        FROM assessment_answers aa
        JOIN questions q
          ON q.question_id = aa.question_id
        WHERE aa.assessment_id = a.assessment_id
          AND aa.answer_value ~ '^[0-9]+(\\.[0-9]+)?$'
      ) bp ON a.assessment_type_id = (
        SELECT assessment_type_id
        FROM assessment_types
        WHERE assessment_name = 'Blood Pressure'
      )

      INNER JOIN assessment_types t
        ON t.assessment_type_id = a.assessment_type_id

      LEFT JOIN recommendation r
        ON r.rec_id = a.recommendation_id

      WHERE a.user_id = $1

      ORDER BY a.assessed_at DESC, a.assessment_id DESC
      `,
      [userIdNumber, TYPE_9Q]
    );

    const assessments = result.rows;

    /* =====================================================
       SUMMARY
    ===================================================== */

    const totalAssessments = assessments.length;

    const assessmentTypes = new Set(
      assessments.map(
        (item) => item.assessment_type_id
      )
    );

    const totalTypes = assessmentTypes.size;

    const latestAssessment =
      assessments.length > 0
        ? assessments[0]
        : null;

    /* =====================================================
       นับผลที่มีความเสี่ยง
    ===================================================== */

    const riskAssessments = assessments.filter(
      (item) => {
        // 9Q ที่ตอบข้อคิดทำร้ายตนเอง ถือเป็นความเสี่ยงเสมอ
        if (item.self_harm_flag) return true;

        // ใช้เกณฑ์เดียวกับหน้า Dashboard (lib/riskLevel.ts)
        const level = riskLevelOf(
          item.assessment_name,
          item.risk_level
        );

        return (
          level === "mid" ||
          level === "high"
        );
      }
    ).length;

    /* =====================================================
       เอาผลล่าสุดของแต่ละประเภท
    ===================================================== */

    const latestByTypeMap = new Map();

    for (const item of assessments) {
      if (
        !latestByTypeMap.has(
          item.assessment_type_id
        )
      ) {
        latestByTypeMap.set(
          item.assessment_type_id,
          item
        );
      }
    }

    const latestByType =
      Array.from(latestByTypeMap.values());

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      summary: {
        totalAssessments,
        totalTypes,
        riskAssessments,
        latestAssessment,
      },

      latestByType,

      assessments,
    });
  } catch (error) {
    console.error(
      "Dashboard API Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "ไม่สามารถโหลดข้อมูล Dashboard ได้",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}