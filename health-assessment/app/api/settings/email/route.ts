import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

// รูปแบบอีเมลที่ยอมรับ
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// API: เปลี่ยนอีเมลหลังยืนยันรหัสผ่าน และตรวจไม่ให้อีเมลซ้ำกับผู้อื่น
export async function PATCH(request: NextRequest) {
  let body: { userId?: string | number; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const auth = requireUser(request, body.userId);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  // ตรวจข้อมูลที่ส่งมา: รูปแบบอีเมลและต้องมีรหัสผ่าน
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ success: false, message: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ success: false, message: "กรุณากรอกรหัสผ่านเพื่อยืนยัน" }, { status: 400 });
  }

  try {
    // ยืนยันรหัสผ่าน และตรวจว่าไม่ใช่อีเมลเดิม
    const userRes = await pool.query("SELECT password_hash, email FROM users WHERE user_id = $1", [userId]);
    if (userRes.rowCount === 0) {
      return NextResponse.json({ success: false, message: "ไม่พบผู้ใช้" }, { status: 404 });
    }

    const ok = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!ok) {
      return NextResponse.json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    if (String(userRes.rows[0].email ?? "").toLowerCase() === email) {
      return NextResponse.json({ success: false, message: "อีเมลนี้เป็นอีเมลปัจจุบันอยู่แล้ว" }, { status: 400 });
    }

    // ตรวจอีเมลซ้ำ แล้วอัปเดตอีเมลใน users
    const duplicate = await pool.query(
      "SELECT 1 FROM users WHERE LOWER(email) = $1 AND user_id <> $2 LIMIT 1",
      [email, userId]
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return NextResponse.json({ success: false, message: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const { rows } = await pool.query(
      "UPDATE users SET email = $1 WHERE user_id = $2 RETURNING user_id, username, email, created_at",
      [email, userId]
    );

    return NextResponse.json({ success: true, message: "เปลี่ยนอีเมลเรียบร้อยแล้ว", user: rows[0] });
  } catch (error) {
    void logSystemError("PATCH /api/settings/email", error);
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ success: false, message: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }
    console.error("PATCH /api/settings/email error:", error);
    return NextResponse.json({ success: false, message: "เปลี่ยนอีเมลไม่สำเร็จ" }, { status: 500 });
  }
}
