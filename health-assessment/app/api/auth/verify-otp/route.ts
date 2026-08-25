import {
  NextRequest,
  NextResponse,
} from "next/server";

import crypto from "crypto";

import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyOtpBody = {
  email?: string;
  otp?: string;
};

/* =========================================================
   POST /api/auth/verify-otp
========================================================= */

export async function POST(
  request: NextRequest,
) {
  const client =
    await pool.connect();

  let transactionStarted =
    false;

  try {
    const body =
      (await request.json()) as VerifyOtpBody;

    /* =====================================================
       NORMALIZE
    ===================================================== */

    const email =
      String(
        body.email ?? "",
      )
        .trim()
        .toLowerCase();

    const otp =
      String(
        body.otp ?? "",
      ).trim();

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (
      !email ||
      !otp
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณากรอกอีเมลและรหัส OTP",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !/^\d{6}$/.test(
        otp,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "OTP ต้องเป็นตัวเลข 6 หลัก",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       START TRANSACTION
    ===================================================== */

    await client.query(
      "BEGIN",
    );

    transactionStarted =
      true;

    /* =====================================================
       FIND USER
    ===================================================== */

    const userResult =
      await client.query<{
        user_id: number;
        email: string;
      }>(
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

    if (
      (userResult.rowCount ??
        0) === 0
    ) {
      await client.query(
        "ROLLBACK",
      );

      transactionStarted =
        false;

      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบข้อมูลผู้ใช้งาน",
        },
        {
          status: 404,
        },
      );
    }

    const userId =
      Number(
        userResult.rows[0]
          .user_id,
      );

    /* =====================================================
       HASH OTP

       ต้องใช้วิธีเดียวกับ forgot-password
    ===================================================== */

    const otpHash =
      crypto
        .createHash(
          "sha256",
        )
        .update(
          otp,
        )
        .digest(
          "hex",
        );

    /* =====================================================
       FIND VALID OTP
    ===================================================== */

    const tokenResult =
      await client.query<{
        reset_id: number;
        user_id: number;
        token_hash: string;
        expires_at: string;
        used: boolean;
      }>(
        `
        SELECT
          reset_id,
          user_id,
          token_hash,
          expires_at,
          used
        FROM password_reset_tokens
        WHERE user_id = $1
          AND token_hash = $2
          AND used = FALSE
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
        `,
        [
          userId,
          otpHash,
        ],
      );

    if (
      (tokenResult.rowCount ??
        0) === 0
    ) {
      await client.query(
        "ROLLBACK",
      );

      transactionStarted =
        false;

      return NextResponse.json(
        {
          success: false,
          message:
            "OTP ไม่ถูกต้องหรือหมดอายุแล้ว",
        },
        {
          status: 400,
        },
      );
    }

    const resetId =
      Number(
        tokenResult.rows[0]
          .reset_id,
      );

    /* =====================================================
       CREATE RESET TOKEN

       สร้าง Token ใหม่สำหรับขั้นตอนเปลี่ยน Password
       ไม่ส่ง OTP ต่อไปโดยตรง
    ===================================================== */

    const resetToken =
      crypto
        .randomBytes(
          32,
        )
        .toString(
          "hex",
        );

    /* =====================================================
       HASH RESET TOKEN

       เก็บ hash เท่านั้นใน Database
    ===================================================== */

    const resetTokenHash =
      crypto
        .createHash(
          "sha256",
        )
        .update(
          resetToken,
        )
        .digest(
          "hex",
        );

    /* =====================================================
       UPDATE TOKEN RECORD

       เปลี่ยน token_hash จาก OTP hash
       เป็น resetToken hash

       และต่ออายุให้ reset password ได้อีก 10 นาที
    ===================================================== */

    await client.query(
      `
      UPDATE password_reset_tokens
      SET
        token_hash = $1,
        expires_at =
          NOW() + INTERVAL '10 minutes'
      WHERE reset_id = $2
      `,
      [
        resetTokenHash,
        resetId,
      ],
    );

    /* =====================================================
       COMMIT
    ===================================================== */

    await client.query(
      "COMMIT",
    );

    transactionStarted =
      false;

    /* =====================================================
       RETURN RESET TOKEN

       ส่ง token จริงกลับ Frontend
       Database เก็บแค่ hash
    ===================================================== */

    return NextResponse.json({
      success: true,

      message:
        "ยืนยัน OTP สำเร็จ",

      resetToken,
    });
  } catch (error) {
    /* =====================================================
       ROLLBACK
    ===================================================== */

    if (
      transactionStarted
    ) {
      try {
        await client.query(
          "ROLLBACK",
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "VERIFY OTP ROLLBACK ERROR:",
          rollbackError,
        );
      }
    }

    console.error(
      "VERIFY OTP ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "ไม่สามารถตรวจสอบ OTP ได้",
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}