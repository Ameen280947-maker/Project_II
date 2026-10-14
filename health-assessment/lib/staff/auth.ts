import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSession } from "@/lib/session";

// role_id ของเจ้าหน้าที่และผู้ใช้ทั่วไป
export const STAFF_ROLE_ID = 3;
export const USER_ROLE_ID = 2;

// ข้อมูลเจ้าหน้าที่ที่ผ่านการตรวจสิทธิ์
export type StaffUser = { userId: number; username: string };

// ตรวจ session staff, header x-staff-id ต้องตรงกัน และบัญชีต้องเป็น role staff ที่ยังใช้งานอยู่
export async function requireStaff(
  request: NextRequest
): Promise<{ staff: StaffUser; error?: never } | { staff?: never; error: NextResponse }> {
  // ตรวจ session และ header x-staff-id ของแท็บนี้
  const session = getSession(request, "staff");
  if (!session) {
    return { error: NextResponse.json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  }
  const id = session.userId;
  const claimed = request.headers.get("x-staff-id");
  if (claimed && Number(claimed) !== id) {
    return { error: NextResponse.json({ success: false, message: "บัญชีในแท็บนี้ไม่ตรงกับที่เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่" }, { status: 403 }) };
  }

  // ตรวจจาก DB ว่ายังเป็นเจ้าหน้าที่ที่เปิดใช้งานอยู่
  const { rows } = await pool.query(
    "SELECT user_id, username, role_id, is_active FROM users WHERE user_id = $1",
    [id]
  );
  const u = rows[0];
  if (!u || u.role_id !== STAFF_ROLE_ID || u.is_active === false) {
    return { error: NextResponse.json({ success: false, message: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 }) };
  }
  return { staff: { userId: u.user_id, username: u.username } };
}

// บันทึกการกระทำของเจ้าหน้าที่ลงตาราง access_logs (ถ้าล้มเหลวแค่ log ใน console)
export async function logAccess(staffId: number, targetUserId: number | null, action: string, detail?: string) {
  try {
    await pool.query(
      "INSERT INTO access_logs (staff_id, target_user_id, action, detail) VALUES ($1, $2, $3, $4)",
      [staffId, targetUserId, action, detail ?? null]
    );
  } catch (e) {
    console.error("access log error:", e);
  }
}
