import {
  NextRequest,
  NextResponse,
} from "next/server";

import bcrypt from "bcryptjs";
import pool from "@/lib/db";

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
    ========================= */

    const result =
      await pool.query(
        `
        SELECT
          u.user_id,
          u.username,
          u.email,
          u.password_hash,
          u.role_id,
          r.role_name

        FROM users u

        LEFT JOIN roles r
          ON r.role_id = u.role_id

        WHERE u.username = $1

        LIMIT 1
        `,
        [username],
      );

    if (
      (result.rowCount ?? 0) ===
      0
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

    return NextResponse.json({
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
      },
    });
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