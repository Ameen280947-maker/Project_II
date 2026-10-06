import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import pool from "@/lib/db";
import {
  isMailerConfigured,
  OTP_VALID_MINUTES,
  sendOtpEmail,
} from "@/lib/mailer";
import { otpRateLimits } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ForgotPasswordBody = {
  email?: string;
};

/* =========================================================
   HELPER
========================================================= */

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/* =========================================================
   POST /api/auth/forgot-password
========================================================= */

export async function POST(request: NextRequest) {
  /*
    Production ต้องตั้งค่า Gmail ก่อน
    ตรวจก่อนค้นหา user เพื่อให้ตอบเหมือนกันทุกอีเมล
  */
  const mailerReady = isMailerConfigured();

  if (!mailerReady && process.env.NODE_ENV === "production") {
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
    /* =====================================================
       1. รับ Email
    ===================================================== */

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

    /* =====================================================
       2. ตรวจรูปแบบ Email
    ===================================================== */

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

    /* =====================================================
       2.1 จำกัดจำนวนครั้ง: 3 ครั้ง / อีเมล / 15 นาที

       นับทุกคำขอ รวมถึงอีเมลที่ไม่มีในระบบ
       เพื่อไม่ให้ใช้ความต่างของคำตอบเดาว่าใครมีบัญชี
    ===================================================== */

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

    /* =====================================================
       3. ค้นหา User จาก Database
    ===================================================== */

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

    /*
      เพื่อความปลอดภัย

      ไม่ควรบอกผู้ใช้ว่า
      "ไม่มีอีเมลนี้ในระบบ"

      เพราะคนอื่นสามารถใช้ endpoint นี้
      เช็กได้ว่าใครมีบัญชีอยู่ในระบบ
    */

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

    /* =====================================================
       4. สร้าง OTP 6 หลัก
    ===================================================== */

    const otp = generateOtp();

    /*
      OTP ใช้ได้ 10 นาที
    */

    const expiresAt = new Date(Date.now() + OTP_VALID_MINUTES * 60 * 1000);

    /* =====================================================
       5. Hash OTP ก่อนเก็บ Database

       ไม่เก็บ OTP จริงลง Database
    ===================================================== */

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    /* =====================================================
       6. Transaction
    ===================================================== */

    await client.query("BEGIN");

    /*
      ลบรหัส Reset เก่าที่ยังมีอยู่ของ User นี้

      เพื่อให้มี OTP ล่าสุดเพียงตัวเดียว
    */

    await client.query(
      `
        DELETE FROM password_reset_tokens
        WHERE user_id = $1
      `,
      [userId],
    );

    /*
      บันทึก OTP ใหม่
    */

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

    // OTP ใหม่ → เริ่มนับการกรอกผิดใหม่
    otpRateLimits.verifyOtpFailures.reset(email);

    /* =====================================================
       7. ส่ง Email (Gmail SMTP)

       ยังไม่ได้ตั้งค่า Gmail และไม่ใช่ production
       → แสดง OTP ใน Terminal และส่ง devOtp กลับไปให้ทดสอบ
       ตั้งค่า Gmail แล้ว → ส่งอีเมลจริงเท่านั้น ไม่ส่ง OTP กลับ Frontend
    ===================================================== */

    if (!mailerReady) {
      console.log("====================================");
      console.log("PASSWORD RESET OTP (DEV: ยังไม่ได้ตั้งค่า Gmail)");
      console.log("------------------------------------");
      console.log("User ID :", userId);
      console.log("Email   :", email);
      console.log("OTP     :", otp);
      console.log("Expire  :", expiresAt);
      console.log("====================================");

      return NextResponse.json(
        {
          success: true,

          message:
            "เราได้ส่งรหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว",

          // DEV ONLY: ใช้ทดสอบเมื่อยังไม่ได้ตั้งค่า Gmail
          devOtp: otp,
        },
        {
          status: 200,
        },
      );
    }

    try {
      await sendOtpEmail(email, otp);
    } catch (mailError) {
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

    /* =====================================================
       8. Response
    ===================================================== */

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
    /* =====================================================
       Rollback
    ===================================================== */

    try {
      await client.query("ROLLBACK");
    } catch {
      // ไม่มี transaction ที่ต้อง rollback
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