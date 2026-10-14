import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  listPublicTables,
  quoteIdent,
  requireAdmin,
  serverError,
} from "@/lib/adminAuth";
import { logSystemError } from "@/lib/errorLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ตารางที่ไม่ต้องสำรอง (token รีเซ็ตรหัสผ่าน)
const SKIP_TABLES = new Set(["password_reset_tokens"]);
// คอลัมน์ลับที่ต้องตัดออกจากไฟล์สำรอง แยกตามตาราง
const SECRET_COLUMNS: Record<string, string[]> = {
  users: ["password_hash"],
};

// API: ดึงประวัติการสำรองข้อมูล 50 รายการล่าสุดจากตาราง backup_history (เฉพาะ Admin)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    // ดึงประวัติล่าสุดพร้อมชื่อผู้สั่งสำรอง
    const historyRes = await pool.query(
      `
      SELECT b.*, u.username AS created_by_name
      FROM backup_history b
      LEFT JOIN users u ON u.user_id = b.created_by
      ORDER BY b.created_at DESC
      LIMIT 50
      `,
    );

    return NextResponse.json({ success: true, history: historyRes.rows });
  } catch (error) {
    console.error("ADMIN BACKUP GET ERROR:", error);
    return serverError("โหลดประวัติการสำรองข้อมูลไม่สำเร็จ", error);
  }
}

// API: ดึงข้อมูลทุกตาราง (ตัดคอลัมน์ลับ) ออกเป็นไฟล์ JSON ให้ดาวน์โหลด และบันทึกประวัติการสำรอง
export async function POST(request: NextRequest) {
  // ตรวจสิทธิ์ Admin
  const auth = await requireAdmin(request).catch((error) => {
    console.error(error);
    return null;
  });
  if (!auth) return serverError("ตรวจสิทธิ์ไม่สำเร็จ", "auth failed");
  if (!auth.ok) return auth.response;

  // เลือกตารางที่จะสำรอง และตั้งชื่อไฟล์ตามเวลาไทย
  const selected = (await listPublicTables()).filter((t) => !SKIP_TABLES.has(t));

  const stamp = new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const fileName = `health-backup-${stamp}.json`;
  const note = null;

  const client = await pool.connect();
  try {
    // อ่านข้อมูลทุกตารางใน transaction แบบอ่านอย่างเดียว (snapshot เดียวกัน) และตัดคอลัมน์ลับ
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

    const data: Record<string, unknown[]> = {};
    const rowCounts: Record<string, number> = {};
    let totalRows = 0;

    for (const table of selected) {
      const r = await client.query(`SELECT * FROM ${quoteIdent(table)}`);
      const secrets = SECRET_COLUMNS[table] ?? [];
      data[table] = secrets.length
        ? r.rows.map((row) => {
            const copy = { ...row };
            for (const col of secrets) delete copy[col];
            return copy;
          })
        : r.rows;
      rowCounts[table] = r.rows.length;
      totalRows += r.rows.length;
    }

    await client.query("COMMIT");

    // สร้างเนื้อหาไฟล์ JSON (meta + data)
    const payload = JSON.stringify(
      {
        meta: {
          app: "health-assessment",
          format: "json-backup-v1",
          createdAt: new Date().toISOString(),
          createdBy: auth.admin.username,
          tables: selected,
          rowCounts,
          totalRows,
          note,
        },
        data,
      },
      null,
      2,
    );

    // บันทึกประวัติการสำรองสำเร็จลง backup_history
    const sizeBytes = Buffer.byteLength(payload, "utf8");

    await pool.query(
      `
      INSERT INTO backup_history
        (created_by, file_name, tables, total_rows, file_size_bytes, status, note)
      VALUES ($1, $2, $3, $4, $5, 'success', $6)
      `,
      [auth.admin.user_id, fileName, selected, totalRows, sizeBytes, note],
    );

    // ส่งไฟล์กลับเป็น attachment ให้ browser ดาวน์โหลด
    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Backup-File-Name": fileName,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // จัดการ error: rollback บันทึก log และบันทึกประวัติว่าล้มเหลว
    await client.query("ROLLBACK").catch(() => {});
    console.error("ADMIN BACKUP POST ERROR:", error);
    await logSystemError("POST /api/admin/backup", error);

    await pool
      .query(
        `
        INSERT INTO backup_history
          (created_by, file_name, tables, total_rows, file_size_bytes, status, note)
        VALUES ($1, $2, $3, 0, 0, 'failed', $4)
        `,
        [
          auth.admin.user_id,
          fileName,
          selected,
          error instanceof Error ? error.message.slice(0, 500) : "failed",
        ],
      )
      .catch(() => {});

    return serverError("สำรองข้อมูลไม่สำเร็จ", error);
  } finally {
    client.release();
  }
}
