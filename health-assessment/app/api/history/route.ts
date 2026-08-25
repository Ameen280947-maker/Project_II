import pool from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const userId = Number(
      url.searchParams.get("userId"),
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "userId ไม่ถูกต้อง",
        },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `
      SELECT
        a.assessment_id,
        a.user_id,
        a.total_score,
        a.risk_level,
        a.assessed_at,

        t.assessment_type_id,
        t.assessment_name,

        r.rec_id AS recommendation_id,
        r.recommendation_text

      FROM assessment a

      JOIN assessment_types t
        ON t.assessment_type_id =
           a.assessment_type_id

      LEFT JOIN recommendation r
        ON r.rec_id =
           a.recommendation_id

      WHERE a.user_id = $1

      ORDER BY
        a.assessed_at DESC,
        a.assessment_id DESC
      `,
      [userId],
    );

    return NextResponse.json({
      success: true,
      total: result.rows.length,
      history: result.rows,
    });
  } catch (error) {
    console.error(
      "GET ASSESSMENT HISTORY ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถโหลดประวัติการประเมินได้",
      },
      { status: 500 },
    );
  }
}