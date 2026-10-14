import pool from "@/lib/db";
import { NextResponse } from "next/server";

export const NO_HEALTH_CONSENT_MESSAGE =
  "คุณถอนความยินยอมให้เก็บข้อมูลสุขภาพไว้ จึงไม่สามารถบันทึกผลประเมินได้ เปิดความยินยอมได้ที่หน้าการตั้งค่า > ความเป็นส่วนตัวและข้อมูลของฉัน";

// คืน response 403 ถ้าผู้ใช้ถอนความยินยอมเก็บข้อมูลสุขภาพ (consent_health = false) ไม่งั้นคืน null
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
