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

/* =========================================================
   สำรองข้อมูล (JSON)

   GET  /api/admin/backup
        → ประวัติการสำรอง 50 ครั้งล่าสุด

   POST /api/admin/backup
        → สำรองทุกตาราง ส่งไฟล์ JSON กลับไปให้ดาวน์โหลด และบันทึกลง backup_history
          ไม่รวมข้อมูลลับ (รหัสผ่านที่เข้ารหัส, token รีเซ็ตรหัสผ่าน)
========================================================= */

// ตารางที่ไม่สำรอง และคอลัมน์ที่ตัดออกจากไฟล์
const SKIP_TABLES = new Set(["password_reset_tokens"]);
const SECRET_COLUMNS: Record<string, string[]> = {
  users: ["password_hash"],
};

// GET: คืนประวัติการสำรองข้อมูล 50 รายการล่าสุด (เฉพาะแอดมิน)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

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

// POST: สำรองข้อมูลทุกตาราง (ตัดคอลัมน์ลับ) เป็นไฟล์ JSON ให้ดาวน์โหลด และบันทึกประวัติ
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request).catch((error) => {
    console.error(error);
    return null;
  });
  if (!auth) return serverError("ตรวจสิทธิ์ไม่สำเร็จ", "auth failed");
  if (!auth.ok) return auth.response;

  const selected = (await listPublicTables()).filter((t) => !SKIP_TABLES.has(t));

  // ชื่อไฟล์ใช้เวลาไทย ให้ตรงกับเวลาที่แสดงในประวัติ
  const stamp = new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const fileName = `health-backup-${stamp}.json`;
  const note = null;

  // ใช้ REPEATABLE READ ให้ทุกตารางเป็นภาพเดียวกัน ณ เวลาเดียว
  const client = await pool.connect();
  try {
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

    const sizeBytes = Buffer.byteLength(payload, "utf8");

    await pool.query(
      `
      INSERT INTO backup_history
        (created_by, file_name, tables, total_rows, file_size_bytes, status, note)
      VALUES ($1, $2, $3, $4, $5, 'success', $6)
      `,
      [auth.admin.user_id, fileName, selected, totalRows, sizeBytes, note],
    );

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
