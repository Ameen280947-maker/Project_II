import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs"; // ⬅️ ถ้าโปรเจคใช้แพ็กเกจ "bcrypt" ให้เปลี่ยนเป็น import bcrypt from "bcrypt"
import pool from "@/lib/db";
import { clearSessionCookie, requireUser } from "@/lib/session";

/* =========================================================
   POST /api/settings/danger
   body: { userId, password, action: "clear" | "delete" }

   clear  → ลบประวัติการประเมินทั้งหมดของผู้ใช้ (บัญชียังอยู่)
   delete → ลบบัญชีและข้อมูลทั้งหมดของผู้ใช้

   ทำทุกอย่างใน transaction เดียว ถ้าขั้นไหนพัง จะย้อนกลับทั้งหมด
   และต้องยืนยันรหัสผ่านก่อนทุกครั้ง
========================================================= */

// ลำดับสำคัญ: ต้องลบตารางลูก (ที่มี foreign key ชี้มา) ก่อนตารางแม่
const CLEAR_HISTORY_SQL = [
  `DELETE FROM assessment_answers
     WHERE assessment_id IN (SELECT assessment_id FROM assessment WHERE user_id = $1)`,
  `DELETE FROM user_notifications WHERE user_id = $1`,
  `DELETE FROM log_dashboard WHERE user_id = $1`,
  `DELETE FROM user_risk_summary WHERE user_id = $1`,
  `DELETE FROM assessment WHERE user_id = $1`,
];

const DELETE_ACCOUNT_SQL = [
  ...CLEAR_HISTORY_SQL,
  `DELETE FROM health_profile WHERE user_id = $1`,
  `DELETE FROM password_reset_tokens WHERE user_id = $1`,
  `DELETE FROM user_settings WHERE user_id::text = $1::text`,
  // คำถามที่ผู้ใช้คนนี้เคยสร้าง/แก้ไข (กรณีเป็นแอดมิน) ให้เก็บคำถามไว้ แต่ล้างชื่อผู้สร้าง
  `UPDATE questions SET created_by = NULL WHERE created_by = $1`,
  `UPDATE questions SET updated_by = NULL WHERE updated_by = $1`,
  `DELETE FROM users WHERE user_id = $1`,
];

export async function POST(request: NextRequest) {
  let body: { userId?: string | number; password?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  // ใช้ผู้ใช้จาก session (userId ที่ส่งมาต้องตรงกับ session)
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
    await client.query("BEGIN");

    // 1) ยืนยันรหัสผ่าน
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

    // 2) ลบข้อมูลตามคำสั่ง
    const statements = action === "clear" ? CLEAR_HISTORY_SQL : DELETE_ACCOUNT_SQL;
    for (const sql of statements) {
      await client.query(sql, [userId]);
    }

    await client.query("COMMIT");

    const response = NextResponse.json({
      success: true,
      message: action === "clear" ? "ล้างประวัติการประเมินเรียบร้อยแล้ว" : "ลบบัญชีเรียบร้อยแล้ว",
    });
    // ลบบัญชีแล้ว → ลบ session ด้วย
    if (action === "delete") clearSessionCookie(response);
    return response;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/settings/danger error:", error);
    return NextResponse.json({ success: false, message: "ดำเนินการไม่สำเร็จ ข้อมูลยังไม่ถูกลบ" }, { status: 500 });
  } finally {
    client.release();
  }
}