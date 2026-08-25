import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

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

    if (password.length < 8) {
      return NextResponse.json(
        {
          message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        },
        { status: 400 }
      );
    }

    // ตรวจสอบ username/email ซ้ำ
    const existingUser = await pool.query(
      `
      SELECT user_id
      FROM users
      WHERE username = $1
         OR email = $2
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
    console.error("Register error:", error);

    return NextResponse.json(
      {
        message: "เกิดข้อผิดพลาดในการสมัครสมาชิก",
      },
      { status: 500 }
    );
  }
}