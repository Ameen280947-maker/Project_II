import {
  NextRequest,
  NextResponse,
} from "next/server";

import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { setSessionCookie } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

export const runtime = "nodejs";

// API: ตรวจ username/รหัสผ่านด้วย bcrypt บันทึกเวลาเข้าสู่ระบบ แล้วตั้ง session cookie ตามบทบาท
export async function POST(
  request: NextRequest,
) {
  try {
    // ตรวจข้อมูลที่ส่งมา: ต้องมี username และรหัสผ่าน
    const body =
      await request.json();

    const username = String(
      body.username || "",
    ).trim();

    const password = String(
      body.password || "",
    );

    if (
      !username ||
      !password
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน",
        },
        {
          status: 400,
        },
      );
    }

    // ค้นหาผู้ใช้จาก username (ตรงตัวก่อน แล้วค่อยลองแบบไม่สนตัวพิมพ์)
    const userSelect = `
        SELECT
          u.user_id,
          u.username,
          u.email,
          u.password_hash,
          u.role_id,
          u.is_active,
          r.role_name

        FROM users u

        LEFT JOIN roles r
          ON r.role_id = u.role_id
    `;

    let result =
      await pool.query(
        `${userSelect}
        WHERE u.username = $1
        LIMIT 1
        `,
        [username],
      );

    if ((result.rowCount ?? 0) === 0) {
      const caseInsensitive =
        await pool.query(
          `${userSelect}
          WHERE LOWER(u.username) = LOWER($1)
          LIMIT 2
          `,
          [username],
        );

      if ((caseInsensitive.rowCount ?? 0) === 1) {
        result = caseInsensitive;
      }
    }

    if (
      (result.rowCount ?? 0) !==
      1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        },
        {
          status: 401,
        },
      );
    }

    // ตรวจรหัสผ่านด้วย bcrypt และสถานะบัญชีที่ถูกระงับ
    const user =
      result.rows[0];

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password_hash,
      );

    if (!passwordMatch) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        },
        {
          status: 401,
        },
      );
    }

    if (user.is_active === false) {
      return NextResponse.json(
        {
          success: false,
          message:
            "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่",
        },
        {
          status: 403,
        },
      );
    }

    // เช็กว่ามีโปรไฟล์สุขภาพแล้วหรือยัง และบันทึกเวลาเข้าสู่ระบบล่าสุด
    const profileResult =
      await pool.query(
        `
        SELECT profile_id
        FROM health_profile
        WHERE user_id = $1
        LIMIT 1
        `,
        [user.user_id],
      );

    const hasProfile =
      (profileResult.rowCount ??
        0) > 0;

    await pool
      .query(
        `UPDATE users SET last_login_at = NOW() WHERE user_id = $1`,
        [user.user_id],
      )
      .catch((error) => {
        console.error("UPDATE last_login_at ERROR:", error);
      });

    // ตอบข้อมูลผู้ใช้กลับและตั้ง session cookie
    const response = NextResponse.json({
      success: true,

      message:
        "เข้าสู่ระบบสำเร็จ",

      user: {
        user_id:
          user.user_id,

        username:
          user.username,

        email:
          user.email,

        role_id:
          user.role_id,

        role_name:
          user.role_name,

        hasProfile,

        homePath:
          user.role_id === 3
            ? "/staff"
            : null,
      },
    });

    setSessionCookie(response, {
      userId: Number(user.user_id),
      roleId:
        user.role_id === null ||
        user.role_id === undefined
          ? null
          : Number(user.role_id),
    });

    return response;
  } catch (error) {
    void logSystemError("POST /api/auth/login", error);
    console.error(
      "LOGIN API ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
      },
      {
        status: 500,
      },
    );
  }
}
