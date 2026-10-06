import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/* =========================================================
   ตรวจสิทธิ์ Staff ฝั่งเซิร์ฟเวอร์
   ทุก API ของ Staff ต้องเรียกฟังก์ชันนี้ก่อน
   - อ่าน id จาก header "x-staff-id" (ส่งมาจาก staffFetch)
   - เช็ค role ในฐานข้อมูลจริง ไม่เชื่อค่าจากเบราว์เซอร์อย่างเดียว
========================================================= */

export const STAFF_ROLE_ID = 3; // ตาราง roles: 1 = system_admin, 2 = user, 3 = staff
export const USER_ROLE_ID = 2;

export type StaffUser = { userId: number; username: string };

export async function requireStaff(
  request: NextRequest
): Promise<{ staff: StaffUser; error?: never } | { staff?: never; error: NextResponse }> {
  const id = Number(request.headers.get("x-staff-id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: NextResponse.json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  }

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

// บันทึกการเข้าถึงข้อมูลรายบุคคล (PDPA) ถ้าบันทึกไม่ได้ไม่ให้ทั้งคำขอพัง
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
