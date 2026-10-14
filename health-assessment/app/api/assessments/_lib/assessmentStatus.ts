import pool from "@/lib/db";
import { NextResponse } from "next/server";

export const ASSESSMENT_CLOSED_MESSAGE =
  "แบบประเมินนี้ปิดให้บริการชั่วคราว กรุณาเลือกทำแบบประเมินอื่น หรือกลับมาใหม่ภายหลัง";

// คืน response 403 ถ้าแบบประเมินนี้ถูกปิด (assessment_types.is_active = false) ไม่งั้นคืน null
export async function rejectIfAssessmentClosed(assessmentTypeId: number): Promise<NextResponse | null> {
  try {
    const { rows } = await pool.query<{ is_active: boolean | null }>(
      "SELECT is_active FROM assessment_types WHERE assessment_type_id = $1",
      [assessmentTypeId],
    );

    if (rows[0] && rows[0].is_active === false) {
      return NextResponse.json(
        { success: false, closed: true, message: ASSESSMENT_CLOSED_MESSAGE },
        { status: 403 },
      );
    }
  } catch (error) {
    console.error("CHECK ASSESSMENT STATUS ERROR:", error);
  }

  return null;
}
