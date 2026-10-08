import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureAdminTables } from "@/lib/adminSchema";
import { getSession } from "@/lib/session";

/* =========================================================
   ตรวจสิทธิ์ System Admin สำหรับ API /api/admin/*

   อ่านผู้ใช้จาก session cookie (ตั้งตอน login, ลงลายเซ็น HMAC)
   แล้วเช็กกับฐานข้อมูลอีกครั้งว่า role_name = 'system_admin'
   - ไม่มี session → 401
   - ไม่ใช่ admin  → 403
   ไม่เชื่อ header / userId ที่หน้าเว็บส่งมา
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
  const session = getSession(request, "admin");
  const userId = session?.userId ?? 0;

  if (!session || !Number.isInteger(userId) || userId <= 0) {
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
