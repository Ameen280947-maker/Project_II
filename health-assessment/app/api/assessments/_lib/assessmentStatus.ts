import pool from "@/lib/db";
import { NextResponse } from "next/server";

/* =========================================================
   สถานะเปิด/ปิดของแบบประเมิน (assessment_types.is_active)
   staff ปิดแบบประเมินได้จากหน้าจัดการแบบประเมิน
========================================================= */

export const ASSESSMENT_CLOSED_MESSAGE =
  "แบบประเมินนี้ปิดให้บริการชั่วคราว กรุณาเลือกทำแบบประเมินอื่น หรือกลับมาใหม่ภายหลัง";

/* ใช้ใน POST ของแต่ละแบบประเมิน: ถ้าปิดอยู่คืน response 403 ให้ส่งกลับทันที */
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
    // เช็กสถานะไม่ได้ ปล่อยให้ขั้นตอนบันทึกจัดการ error ตามปกติ
    console.error("CHECK ASSESSMENT STATUS ERROR:", error);
  }

  return null;
}
