import pool from "@/lib/db";
import { NextResponse } from "next/server";

/* =========================================================
   ความยินยอมให้เก็บและประมวลผลข้อมูลสุขภาพ (user_settings.consent_health)
   ถอนความยินยอมได้ที่หน้าการตั้งค่า → ไม่รับผลประเมินใหม่จนกว่าจะยินยอมอีกครั้ง
   ผู้ใช้ที่ยังไม่มีแถวใน user_settings ถือว่ายินยอม (ค่าเริ่มต้นเดียวกับ /api/settings)
========================================================= */

export const NO_HEALTH_CONSENT_MESSAGE =
  "คุณถอนความยินยอมให้เก็บข้อมูลสุขภาพไว้ จึงไม่สามารถบันทึกผลประเมินได้ เปิดความยินยอมได้ที่หน้าการตั้งค่า > ความเป็นส่วนตัวและข้อมูลของฉัน";

/* ใช้ใน POST ของแต่ละแบบประเมิน: ถ้าไม่ยินยอมคืน response 403 ให้ส่งกลับทันที */
export async function rejectIfNoHealthConsent(userId: number | string): Promise<NextResponse | null> {
  const { rows } = await pool.query<{ consent_health: boolean | null }>(
    "SELECT consent_health FROM user_settings WHERE user_id::text = $1::text",
    [String(userId)],
  );

  if (rows[0] && rows[0].consent_health === false) {
    return NextResponse.json(
      { success: false, noConsent: true, message: NO_HEALTH_CONSENT_MESSAGE },
      { status: 403 },
    );
  }

  return null;
}
