import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureAdminTables } from "@/lib/adminSchema";
import { getSession } from "@/lib/session";

// ชื่อ role ของผู้ดูแลระบบในตาราง roles
export const ADMIN_ROLE = "system_admin";

// ข้อมูลผู้ดูแลระบบที่ผ่านการตรวจสิทธิ์
export type AdminUser = {
  user_id: number;
  username: string;
};

// ผลการตรวจสิทธิ์: ผ่าน (ได้ admin) หรือไม่ผ่าน (ได้ response error)
type AdminCheck =
  | { ok: true; admin: AdminUser }
  | { ok: false; response: NextResponse };

// ตรวจ session admin และ role system_admin จากตาราง users/roles คืน 401/403 ถ้าไม่ผ่าน
// ผ่านแล้วสร้างตารางของ admin (ถ้ายังไม่มี) และคืนข้อมูล admin
export async function requireAdmin(request: NextRequest): Promise<AdminCheck> {
  // ตรวจว่ามี session admin ที่ถูกต้อง
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

  // ดึงผู้ใช้และ role จาก DB แล้วตรวจว่าเป็น system_admin
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

  // เตรียมตารางของระบบผู้ดูแลก่อนใช้งาน
  await ensureAdminTables();

  return {
    ok: true,
    admin: { user_id: user.user_id, username: user.username },
  };
}

// สร้าง response 500 พร้อมข้อความและรายละเอียด error
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

// ดึงรายชื่อตารางทั้งหมดใน schema public ของฐานข้อมูล
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

// ครอบชื่อตาราง/คอลัมน์ด้วยเครื่องหมายคำพูดเพื่อใช้ใน SQL อย่างปลอดภัย
export function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}
