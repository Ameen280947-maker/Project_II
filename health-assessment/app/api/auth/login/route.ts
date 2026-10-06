import {
  NextRequest,
  NextResponse,
} from "next/server";

import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json();

    const username = String(
      body.username || "",
    ).trim();

    const password = String(
      body.password || "",
    );

    /* =========================
       Validation
    ========================= */

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

    /* =========================
       หา User

       1) ตรงตัวพิมพ์ก่อน
       2) ไม่เจอ → เทียบแบบไม่สนตัวพิมพ์
          ใช้ได้เฉพาะเมื่อเจอบัญชีเดียว
          (กันกรณีบัญชีเก่ามีชื่อซ้ำกันต่างแค่ตัวพิมพ์)
    ========================= */

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

    const user =
      result.rows[0];

    /* =========================
       ตรวจ Password
    ========================= */

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

    /* =========================
       บัญชีถูกระงับโดยเจ้าหน้าที่
    ========================= */

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

    /* =========================
       ตรวจ Health Profile

       จุดสำคัญของระบบ
    ========================= */

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

    /* =========================
       Login สำเร็จ
    ========================= */

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

        /*
          สำคัญ

          true  = เคยกรอกข้อมูลทั่วไปแล้ว
          false = ยังไม่เคยกรอก
        */
        hasProfile,

        /*
          หน้าแรกหลังเข้าสู่ระบบตามบทบาท
          3 = staff → /staff
        */
        homePath:
          user.role_id === 3
            ? "/staff"
            : null,
      },
    });

    // ตั้ง session cookie (HttpOnly) ให้ API ใช้ระบุตัวผู้ใช้
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