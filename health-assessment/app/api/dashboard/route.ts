import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

/* =========================================================
   DATABASE
   ใช้ DATABASE_URL เดิมของโปรเจกต์
========================================================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

/* =========================================================
   GET DASHBOARD
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        {
          message: "ไม่พบข้อมูลผู้ใช้",
        },
        { status: 400 }
      );
    }

    const userIdNumber = Number(userId);

    if (!Number.isInteger(userIdNumber)) {
      return NextResponse.json(
        {
          message: "User ID ไม่ถูกต้อง",
        },
        { status: 400 }
      );
    }

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
        r.recommendation_text

      FROM assessment a

      INNER JOIN assessment_types t
        ON t.assessment_type_id = a.assessment_type_id

      LEFT JOIN recommendation r
        ON r.rec_id = a.recommendation_id

      WHERE a.user_id = $1

      ORDER BY a.assessed_at DESC, a.assessment_id DESC
      `,
      [userIdNumber]
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
        const risk = String(
          item.risk_level || ""
        ).toLowerCase();

        return (
          risk.includes("สูง") ||
          risk.includes("เสี่ยง") ||
          risk.includes("อันตราย") ||
          risk.includes("ไม่เพียงพอ") ||
          risk.includes("ไม่มี")
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