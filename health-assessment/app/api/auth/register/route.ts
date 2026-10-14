import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

// เงื่อนไขความยาวชื่อผู้ใช้ และรูปแบบอีเมลที่ยอมรับ
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// API: สมัครสมาชิก ตรวจข้อมูล/ความยินยอม hash รหัสผ่าน แล้วสร้าง users และ user_settings
export async function POST(request: NextRequest) {
  try {
    // ตรวจข้อมูลที่ส่งมา: ครบ ยินยอม ชื่อผู้ใช้ อีเมล และรหัสผ่าน
    const body = await request.json();

    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const consentHealth = body.consentHealth === true;

    if (!username || !email || !password) {
      return NextResponse.json(
        {
          message: "กรุณากรอกข้อมูลให้ครบ",
        },
        { status: 400 }
      );
    }

    if (!consentHealth) {
      return NextResponse.json(
        {
          message: "กรุณายินยอมให้เก็บและประมวลผลข้อมูลสุขภาพ เพื่อใช้งานการประเมิน",
        },
        { status: 400 }
      );
    }

    if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return NextResponse.json(
        {
          message: `ชื่อผู้ใช้ต้องมี ${USERNAME_MIN}-${USERNAME_MAX} ตัวอักษร`,
        },
        { status: 400 }
      );
    }

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

    // ตรวจว่าชื่อผู้ใช้หรืออีเมลถูกใช้ไปแล้วหรือไม่
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

    // hash รหัสผ่าน แล้วสร้าง users + user_settings (ความยินยอม) ใน transaction
    const passwordHash = await bcrypt.hash(password, 12);

    const roleId = 2;

    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");

      result = await client.query(
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

      await client.query(
        `
        INSERT INTO user_settings (
          user_id,
          consent_health, consent_health_at
        )
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE
          SET consent_health = EXCLUDED.consent_health,
              consent_health_at = EXCLUDED.consent_health_at,
              updated_at = NOW()
        `,
        [result.rows[0].user_id, consentHealth]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json(
      {
        message: "สมัครสมาชิกสำเร็จ",
        user: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    // จัดการ error: ข้อมูลซ้ำ (23505) → 409 อื่น ๆ → 500
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