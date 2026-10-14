import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import pool from "@/lib/db";
import {
  isMailerConfigured,
  OTP_VALID_MINUTES,
  sendOtpEmail,
} from "@/lib/mailer";
import { otpRateLimits } from "@/lib/rateLimit";
import { logSystemError } from "@/lib/errorLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// รูปแบบ body ที่รับจากหน้าลืมรหัสผ่าน
type ForgotPasswordBody = {
  email?: string;
};

// สุ่มรหัส OTP 6 หลักด้วย crypto
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

// API: สร้าง OTP รีเซ็ตรหัสผ่าน เก็บ hash ใน password_reset_tokens แล้วส่งทางอีเมล
export async function POST(request: NextRequest) {
  if (!isMailerConfigured()) {
    console.error("FORGOT PASSWORD: ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD");

    return NextResponse.json(
      {
        success: false,
        message: "ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อเจ้าหน้าที่",
      },
      {
        status: 503,
      },
    );
  }

  const client = await pool.connect();

  try {

    // ตรวจข้อมูลที่ส่งมา: อีเมลต้องมีและรูปแบบถูกต้อง
    const body = (await request.json()) as ForgotPasswordBody;

    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message: "กรุณากรอกอีเมล",
        },
        {
          status: 400,
        },
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "รูปแบบอีเมลไม่ถูกต้อง",
        },
        {
          status: 400,
        },
      );
    }

    // จำกัดความถี่การขอ OTP ต่ออีเมล
    if (otpRateLimits.forgotPassword.isLimited(email)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ขอรหัส OTP บ่อยเกินไป กรุณารอประมาณ 15 นาทีแล้วลองใหม่อีกครั้ง",
        },
        {
          status: 429,
        },
      );
    }

    otpRateLimits.forgotPassword.hit(email);

    // ค้นหาผู้ใช้จากอีเมล (ไม่พบก็ตอบสำเร็จเพื่อไม่เปิดเผยว่ามีบัญชีหรือไม่)
    const userResult = await client.query(
      `
        SELECT
          user_id,
          email
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email],
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        {
          success: true,
          message:
            "หากอีเมลนี้เชื่อมกับบัญชีในระบบ เราจะส่งรหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ให้คุณ",
        },
        {
          status: 200,
        },
      );
    }

    const user = userResult.rows[0];

    const userId = Number(user.user_id);

    // สร้าง OTP และ hash แล้วแทนที่ token เดิมใน password_reset_tokens
    const otp = generateOtp();

    const expiresAt = new Date(Date.now() + OTP_VALID_MINUTES * 60 * 1000);

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    await client.query("BEGIN");

    await client.query(
      `
        DELETE FROM password_reset_tokens
        WHERE user_id = $1
      `,
      [userId],
    );

    await client.query(
      `
        INSERT INTO password_reset_tokens
        (
          user_id,
          token_hash,
          expires_at,
          used,
          created_at
        )
        VALUES
        (
          $1,
          $2,
          $3,
          FALSE,
          NOW()
        )
      `,
      [userId, otpHash, expiresAt],
    );

    await client.query("COMMIT");

    otpRateLimits.verifyOtpFailures.reset(email);

    // ส่ง OTP ทางอีเมล
    try {
      await sendOtpEmail(email, otp);
    } catch (mailError) {
      void logSystemError("POST /api/auth/forgot-password", mailError);
      console.error("FORGOT PASSWORD SEND EMAIL ERROR:", mailError);

      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่สามารถส่งอีเมลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
        },
        {
          status: 502,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "เราได้ส่งรหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว",
      },
      {
        status: 200,
      },
    );
  } catch (error) {

    try {
      await client.query("ROLLBACK");
    } catch {
    }

    console.error("FORGOT PASSWORD API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "เกิดข้อผิดพลาดในการดำเนินการ กรุณาลองใหม่อีกครั้ง",
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}