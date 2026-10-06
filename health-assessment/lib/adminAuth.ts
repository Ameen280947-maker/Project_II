import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureAdminTables } from "@/lib/adminSchema";

/* =========================================================
   ตรวจสิทธิ์ System Admin สำหรับ API /api/admin/*

   ฝั่งหน้าเว็บส่ง header  x-user-id  (ค่าจาก localStorage "userId")
   ฝั่ง server จะเช็กกับฐานข้อมูลอีกครั้งว่า role_name = 'system_admin'
   ถ้าไม่ใช่ จะตอบ 403 กลับไป

   หมายเหตุ: ระบบ login ปัจจุบันยังไม่ได้ใช้ session/JWT
   การเช็กนี้จึงกันได้ระดับหนึ่ง ถ้าจะใช้งานจริงควรเปลี่ยนเป็น session cookie
========================================================= */

export const ADMIN_ROLE = "system_admin";

export type AdminUser = {
  user_id: number;
  username: string;
};

type AdminCheck =
  | { ok: true; admin: AdminUser }
  | { ok: false; response: NextResponse };

export async function requireAdmin(request: NextRequest): Promise<AdminCheck> {
  const userId = Number(request.headers.get("x-user-id"));

  if (!Number.isInteger(userId) || userId <= 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "กรุณาเข้าสู่ระบบก่อน" },
        { status: 401 },
      ),
    };
  }

  const result = await pool.query(
    `
    SELECT u.user_id, u.username, r.role_name
    FROM users u
    LEFT JOIN roles r ON r.role_id = u.role_id
    WHERE u.user_id = $1
    LIMIT 1
    `,
    [userId],
  );

  const user = result.rows[0];

  if (!user || user.role_name !== ADMIN_ROLE) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "ไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ" },
        { status: 403 },
      ),
    };
  }

  await ensureAdminTables();

  return {
    ok: true,
    admin: { user_id: user.user_id, username: user.username },
  };
}

/* ตอบ error 500 แบบเดียวกันทุก API */
export function serverError(message: string, error: unknown) {
  return NextResponse.json(
    {
      success: false,
      message,
      error: error instanceof Error ? error.message : String(error),
    },
    { status: 500 },
  );
}

/* รายชื่อตารางจริงใน schema public (ใช้ตรวจชื่อตารางก่อนนำไปต่อ SQL) */
export async function listPublicTables(): Promise<string[]> {
  const result = await pool.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
    `,
  );
  return result.rows.map((row) => String(row.table_name));
}

/* ใส่ "..." ครอบชื่อตาราง กัน SQL injection (ใช้คู่กับ listPublicTables) */
export function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}
