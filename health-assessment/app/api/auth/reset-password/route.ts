import {
  NextRequest,
  NextResponse,
} from "next/server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ResetPasswordBody = {
  email?: string;

  resetToken?: string;

  newPassword?: string;
};

/* =========================================================
   POST /api/auth/reset-password
========================================================= */

export async function POST(
  request: NextRequest,
) {
  const client =
    await pool.connect();

  let transactionStarted =
    false;

  try {
    /* =====================================================
       BODY
    ===================================================== */

    const body =
      (await request.json()) as ResetPasswordBody;

    const email =
      String(
        body.email ?? "",
      )
        .trim()
        .toLowerCase();

    const resetToken =
      String(
        body.resetToken ?? "",
      ).trim();

    const newPassword =
      String(
        body.newPassword ?? "",
      );

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (
      !email ||
      !resetToken ||
      !newPassword
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "ข้อมูลสำหรับเปลี่ยนรหัสผ่านไม่ครบ กรุณาเริ่มใหม่",
        },
        {
          status: 400,
        },
      );
    }

    if (
      newPassword.length < 8
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        },
        {
          status: 400,
        },
      );
    }

    /*
      resetToken ที่เราสร้างจาก

      crypto.randomBytes(32).toString("hex")

      จะเป็น hexadecimal 64 ตัวอักษร
    */

    if (
      !/^[a-f0-9]{64}$/i.test(
        resetToken,
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "ข้อมูลยืนยันสำหรับเปลี่ยนรหัสผ่านไม่ถูกต้อง",
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
        username: string;
        email: string;
      }>(
        `
        SELECT
          user_id,
          username,
          email

        FROM users

        WHERE LOWER(email) = LOWER($1)

        LIMIT 1

        FOR UPDATE
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
       HASH RESET TOKEN

       หน้า verify-otp เก็บใน DB เป็น SHA256
       ดังนั้นตรงนี้ต้อง hash แบบเดียวกัน
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
       CHECK RESET TOKEN

       ต้อง:
       - เป็นของ user คนนี้
       - token hash ตรง
       - ยังไม่ถูกใช้
       - ยังไม่หมดอายุ
    ===================================================== */

    const tokenResult =
      await client.query<{
        reset_id: number;
        expires_at: string;
        used: boolean;
      }>(
        `
        SELECT
          reset_id,
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
          resetTokenHash,
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
            "สิทธิ์สำหรับเปลี่ยนรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอ OTP ใหม่",
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
       HASH PASSWORD ใหม่

       ห้ามเก็บ Password เป็นข้อความธรรมดา
    ===================================================== */

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12,
      );

    /* =====================================================
       UPDATE PASSWORD
    ===================================================== */

    const updateResult =
      await client.query<{
        user_id: number;
        username: string;
        email: string;
      }>(
        `
        UPDATE users

        SET
          password_hash = $1

        WHERE user_id = $2

        RETURNING
          user_id,
          username,
          email
        `,
        [
          passwordHash,
          userId,
        ],
      );

    if (
      (updateResult.rowCount ??
        0) === 0
    ) {
      throw new Error(
        "ไม่สามารถอัปเดตรหัสผ่านได้",
      );
    }

    /* =====================================================
       MARK RESET TOKEN AS USED

       Token นี้ใช้ได้ครั้งเดียว
    ===================================================== */

    await client.query(
      `
      UPDATE password_reset_tokens

      SET
        used = TRUE

      WHERE reset_id = $1
      `,
      [resetId],
    );

    /* =====================================================
       INVALIDATE RESET TOKENS อื่นของ USER

       ป้องกัน Token เก่ากลับมาใช้ต่อ
    ===================================================== */

    await client.query(
      `
      UPDATE password_reset_tokens

      SET
        used = TRUE

      WHERE user_id = $1
        AND used = FALSE
      `,
      [userId],
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
       SUCCESS
    ===================================================== */

    console.log(
      "====================================",
    );

    console.log(
      "PASSWORD RESET SUCCESS",
    );

    console.log(
      "User ID:",
      userId,
    );

    console.log(
      "Email:",
      email,
    );

    console.log(
      "====================================",
    );

    return NextResponse.json({
      success: true,

      message:
        "เปลี่ยนรหัสผ่านสำเร็จ",

      user: {
        user_id:
          updateResult.rows[0]
            .user_id,

        username:
          updateResult.rows[0]
            .username,

        email:
          updateResult.rows[0]
            .email,
      },
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
          "RESET PASSWORD ROLLBACK ERROR:",
          rollbackError,
        );
      }
    }

    console.error(
      "RESET PASSWORD API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน",
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}