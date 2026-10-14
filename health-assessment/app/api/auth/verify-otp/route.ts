import {
  NextRequest,
  NextResponse,
} from "next/server";

import crypto from "crypto";

import pool from "@/lib/db";
import { otpRateLimits } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// รูปแบบ body: อีเมลและรหัส OTP
type VerifyOtpBody = {
  email?: string;
  otp?: string;
};

// ข้อความแจ้งเมื่อ OTP ผิด/หมดอายุ และเมื่อกรอกผิดเกินกำหนด
const INVALID_OTP_MESSAGE =
  "OTP ไม่ถูกต้องหรือหมดอายุแล้ว";

const TOO_MANY_ATTEMPTS_MESSAGE =
  "กรอก OTP ผิดเกินจำนวนครั้งที่กำหนด รหัสนี้ถูกยกเลิกแล้ว กรุณาขอรหัส OTP ใหม่";

// ปิดใช้ OTP ที่ยังไม่ถูกใช้ทั้งหมดของอีเมลนี้ (used = TRUE)
async function invalidateLatestOtp(
  email: string,
) {
  await pool.query(
    `
    UPDATE password_reset_tokens t
    SET used = TRUE
    FROM users u
    WHERE u.user_id = t.user_id
      AND LOWER(u.email) = LOWER($1)
      AND t.used = FALSE
    `,
    [email],
  );
}

// สร้าง response 429 เมื่อกรอก OTP ผิดเกินจำนวนครั้งที่กำหนด
function tooManyAttemptsResponse() {
  return NextResponse.json(
    {
      success: false,
      message:
        TOO_MANY_ATTEMPTS_MESSAGE,
    },
    {
      status: 429,
    },
  );
}

// นับครั้งที่ OTP ผิด ถ้าครบ 5 ครั้งยกเลิก OTP และตอบ 429 ไม่งั้นแจ้งว่า OTP ไม่ถูกต้อง
async function failedAttemptResponse(
  email: string,
) {
  const failures =
    otpRateLimits.verifyOtpFailures.hit(
      email,
    );

  if (failures >= 5) {
    await invalidateLatestOtp(email);

    return tooManyAttemptsResponse();
  }

  return NextResponse.json(
    {
      success: false,
      message:
        INVALID_OTP_MESSAGE,
    },
    {
      status: 400,
    },
  );
}

// API: ตรวจรหัส OTP กับ password_reset_tokens (หมดอายุ/ถูกใช้แล้ว) และจำกัดจำนวนครั้งที่ลองผิด
export async function POST(
  request: NextRequest,
) {
  const client =
    await pool.connect();

  let transactionStarted =
    false;

  try {
    // ตรวจข้อมูลที่ส่งมา: ต้องมีอีเมล และ OTP เป็นตัวเลข 6 หลัก
    const body =
      (await request.json()) as VerifyOtpBody;

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

    // ถ้าลองผิดเกินกำหนดแล้ว ยกเลิก OTP และตอบ 429
    if (
      otpRateLimits.verifyOtpFailures.isLimited(
        email,
      )
    ) {
      await invalidateLatestOtp(email);

      return tooManyAttemptsResponse();
    }

    // เริ่ม transaction และค้นหาผู้ใช้จากอีเมล
    await client.query(
      "BEGIN",
    );

    transactionStarted =
      true;

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

      return failedAttemptResponse(
        email,
      );
    }

    const userId =
      Number(
        userResult.rows[0]
          .user_id,
      );

    // hash OTP แล้วหา token ที่ตรงกัน ยังไม่ใช้ และยังไม่หมดอายุ
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

      return failedAttemptResponse(
        email,
      );
    }

    const resetId =
      Number(
        tokenResult.rows[0]
          .reset_id,
      );

    // OTP ถูกต้อง: สร้าง resetToken ใหม่ (อายุ 10 นาที) แทน hash เดิม แล้ว commit
    const resetToken =
      crypto
        .randomBytes(
          32,
        )
        .toString(
          "hex",
        );

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

    await client.query(
      "COMMIT",
    );

    transactionStarted =
      false;

    otpRateLimits.verifyOtpFailures.reset(
      email,
    );

    return NextResponse.json({
      success: true,

      message:
        "ยืนยัน OTP สำเร็จ",

      resetToken,
    });
  } catch (error) {

    // จัดการ error: rollback ถ้า transaction ค้างอยู่ แล้วคืน 500
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