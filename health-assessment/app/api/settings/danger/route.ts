import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { clearSessionCookie, requireUser } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

// ชุดคำสั่ง SQL ลบประวัติการประเมินทั้งหมดของผู้ใช้
const CLEAR_HISTORY_SQL = [
  `DELETE FROM assessment_answers
     WHERE assessment_id IN (SELECT assessment_id FROM assessment WHERE user_id = $1)`,
  `DELETE FROM user_notifications WHERE user_id = $1`,
  `DELETE FROM log_dashboard WHERE user_id = $1`,
  `DELETE FROM user_risk_summary WHERE user_id = $1`,
  `DELETE FROM assessment WHERE user_id = $1`,
];

// ชุดคำสั่ง SQL ลบบัญชี: ลบประวัติ + โปรไฟล์ + token + settings แล้วลบผู้ใช้
const DELETE_ACCOUNT_SQL = [
  ...CLEAR_HISTORY_SQL,
  `DELETE FROM health_profile WHERE user_id = $1`,
  `DELETE FROM password_reset_tokens WHERE user_id = $1`,
  `DELETE FROM user_settings WHERE user_id::text = $1::text`,
  `UPDATE questions SET created_by = NULL WHERE created_by = $1`,
  `UPDATE questions SET updated_by = NULL WHERE updated_by = $1`,
  `DELETE FROM users WHERE user_id = $1`,
];

// API: ยืนยันรหัสผ่านแล้วล้างประวัติการประเมิน (action=clear) หรือลบบัญชีผู้ใช้ทั้งหมดใน transaction
export async function POST(request: NextRequest) {
  let body: { userId?: string | number; password?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  // ตรวจสิทธิ์และตรวจข้อมูลที่ส่งมา (รหัสผ่าน + action)
  const auth = requireUser(request, body.userId);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;
  const { password, action } = body;
  if (!password) {
    return NextResponse.json({ success: false, message: "กรุณากรอกรหัสผ่าน" }, { status: 400 });
  }
  if (action !== "clear" && action !== "delete") {
    return NextResponse.json({ success: false, message: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // เริ่ม transaction และยืนยันรหัสผ่านด้วย bcrypt
    await client.query("BEGIN");

    const userRes = await client.query("SELECT password_hash FROM users WHERE user_id = $1 FOR UPDATE", [userId]);
    if (userRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, message: "ไม่พบผู้ใช้" }, { status: 404 });
    }
    const ok = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!ok) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    // รันชุดคำสั่งลบตาม action แล้ว commit (ลบบัญชีจะล้าง session cookie ด้วย)
    const statements = action === "clear" ? CLEAR_HISTORY_SQL : DELETE_ACCOUNT_SQL;
    for (const sql of statements) {
      await client.query(sql, [userId]);
    }

    await client.query("COMMIT");

    const response = NextResponse.json({
      success: true,
      message: action === "clear" ? "ล้างประวัติการประเมินเรียบร้อยแล้ว" : "ลบบัญชีเรียบร้อยแล้ว",
    });
    if (action === "delete") clearSessionCookie(response);
    return response;
  } catch (error) {
    void logSystemError("POST /api/settings/danger", error);
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/settings/danger error:", error);
    return NextResponse.json({ success: false, message: "ดำเนินการไม่สำเร็จ ข้อมูลยังไม่ถูกลบ" }, { status: 500 });
  } finally {
    client.release();
  }
}