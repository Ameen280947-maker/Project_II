import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
// ต้องมีโดเมนท้าย เช่น .com .ac.th
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    // ตรวจสอบข้อมูล
    if (!username || !email || !password) {
      return NextResponse.json(
        {
          message: "กรุณากรอกข้อมูลให้ครบ",
        },
        { status: 400 }
      );
    }

    // กติกาเดียวกับ /api/settings/account
    if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return NextResponse.json(
        {
          message: `ชื่อผู้ใช้ต้องมี ${USERNAME_MIN}-${USERNAME_MAX} ตัวอักษร`,
        },
        { status: 400 }
      );
    }

    // หน้าเข้าสู่ระบบตัดช่องว่างหัวท้าย จึงไม่ให้มีช่องว่างในชื่อ
    if (/\s/.test(username)) {
      return NextResponse.json(
        {
          message: "ชื่อผู้ใช้ต้องไม่มีช่องว่าง",
        },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        {
          message: "รูปแบบอีเมลไม่ถูกต้อง",
        },
        { status: 400 }
      );
    }

    if (!password.trim()) {
      return NextResponse.json(
        {
          message: "รหัสผ่านต้องไม่เป็นช่องว่างทั้งหมด",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        },
        { status: 400 }
      );
    }

    // ตรวจสอบ username/email ซ้ำ (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
    const existingUser = await pool.query(
      `
      SELECT user_id
      FROM users
      WHERE LOWER(username) = LOWER($1)
         OR LOWER(email) = $2
      LIMIT 1
      `,
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          message: "ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว",
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // User ที่สมัครเองจะเป็น role_id = 2
    const roleId = 2;

    // บันทึกลง Database
    const result = await pool.query(
      `
      INSERT INTO users (
        username,
        password_hash,
        email,
        role_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING user_id, username, email, role_id, created_at
      `,
      [username, passwordHash, email, roleId]
    );

    return NextResponse.json(
      {
        message: "สมัครสมาชิกสำเร็จ",
        user: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    // กันกรณีสมัครชื่อ/อีเมลเดียวกันพร้อมกัน (unique constraint)
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        {
          message: "ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว",
        },
        { status: 409 }
      );
    }

    console.error("Register error:", error);

    return NextResponse.json(
      {
        message: "เกิดข้อผิดพลาดในการสมัครสมาชิก",
      },
      { status: 500 }
    );
  }
}