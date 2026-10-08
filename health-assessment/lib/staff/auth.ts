import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSession } from "@/lib/session";

/* =========================================================
   ตรวจสิทธิ์ Staff ฝั่งเซิร์ฟเวอร์
   ทุก API ของ Staff ต้องเรียกฟังก์ชันนี้ก่อน
   - อ่านตัวตนจาก cookie "session_staff" (ตั้งตอน login, ลงลายเซ็น HMAC)
   - header "x-staff-id" จาก staffFetch ต้องตรงกับ cookie ถ้าส่งมา
   - เช็ค role ในฐานข้อมูลจริงอีกชั้น
========================================================= */

export const STAFF_ROLE_ID = 3; // ตาราง roles: 1 = system_admin, 2 = user, 3 = staff
export const USER_ROLE_ID = 2;

export type StaffUser = { userId: number; username: string };

export async function requireStaff(
  request: NextRequest
): Promise<{ staff: StaffUser; error?: never } | { staff?: never; error: NextResponse }> {
  const session = getSession(request, "staff");
  if (!session) {
    return { error: NextResponse.json({ success: false, message: "กรุณาเข้าสู่ระบบ" }, { status: 401 }) };
  }
  const id = session.userId;
  const claimed = request.headers.get("x-staff-id");
  if (claimed && Number(claimed) !== id) {
    return { error: NextResponse.json({ success: false, message: "บัญชีในแท็บนี้ไม่ตรงกับที่เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่" }, { status: 403 }) };
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
