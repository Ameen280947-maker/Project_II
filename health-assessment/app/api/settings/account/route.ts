import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireUser } from "@/lib/session";

/* =========================================================
   PATCH /api/settings/account
   body: { userId, username }

   เปลี่ยนชื่อผู้ใช้ (ใช้เข้าสู่ระบบ) ต้องไม่ซ้ำกับบัญชีอื่น
========================================================= */

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;

export async function PATCH(request: NextRequest) {
  let body: { userId?: string | number; username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  // ใช้ผู้ใช้จาก session (userId ที่ส่งมาต้องตรงกับ session)
  const auth = requireUser(request, body.userId);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;
  const username = String(body.username ?? "").trim();
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return NextResponse.json(
      { success: false, message: `ชื่อผู้ใช้ต้องมี ${USERNAME_MIN}-${USERNAME_MAX} ตัวอักษร` },
      { status: 400 }
    );
  }
  // หน้าเข้าสู่ระบบตัดช่องว่างหัวท้ายและเทียบทั้งคำ จึงไม่ให้มีช่องว่างในชื่อ
  if (/\s/.test(username)) {
    return NextResponse.json({ success: false, message: "ชื่อผู้ใช้ต้องไม่มีช่องว่าง" }, { status: 400 });
  }

  try {
    const duplicate = await pool.query(
      "SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND user_id <> $2 LIMIT 1",
      [username, userId]
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return NextResponse.json({ success: false, message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const { rows } = await pool.query(
      "UPDATE users SET username = $1 WHERE user_id = $2 RETURNING user_id, username, email, created_at",
      [username, userId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "ไม่พบผู้ใช้" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "เปลี่ยนชื่อผู้ใช้เรียบร้อยแล้ว", user: rows[0] });
  } catch (error) {
    // กันกรณีมีคนใช้ชื่อเดียวกันพร้อมกัน (unique constraint)
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ success: false, message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" }, { status: 409 });
    }
    console.error("PATCH /api/settings/account error:", error);
    return NextResponse.json({ success: false, message: "เปลี่ยนชื่อผู้ใช้ไม่สำเร็จ" }, { status: 500 });
  }
}
