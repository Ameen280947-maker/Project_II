import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

/* =========================================================
   DATABASE
========================================================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
});

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

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

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

    /* =====================================================
       7. ส่ง Email

       ตอนนี้ยังไม่ได้เชื่อม Email Provider

       สำหรับ Development ให้ดู OTP
       ใน Terminal ของ Next.js ก่อน
    ===================================================== */

    if (process.env.NODE_ENV !== "production") {
      console.log("====================================");
      console.log("PASSWORD RESET OTP");
      console.log("------------------------------------");
      console.log("User ID :", userId);
      console.log("Email   :", email);
      console.log("OTP     :", otp);
      console.log("Expire  :", expiresAt);
      console.log("====================================");
    }

    /*
      ภายหลังสามารถเพิ่มการส่ง Email จริงตรงนี้

      เช่น:
      - Resend
      - Nodemailer
      - SendGrid

      ห้ามส่ง OTP กลับ Frontend ใน Production
    */

    /* =====================================================
       8. Response
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "เราได้ส่งรหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว",

        /*
          DEV ONLY

          เอาไว้ทดสอบระบบก่อนมี Email Provider

          Production จะไม่ส่ง OTP ออกไป
        */

        ...(process.env.NODE_ENV !== "production"
          ? {
              devOtp: otp,
            }
          : {}),
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