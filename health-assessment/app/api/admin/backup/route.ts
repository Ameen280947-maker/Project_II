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
        → รายชื่อตาราง + ประวัติการสำรอง 50 ครั้งล่าสุด

   POST /api/admin/backup   { tables?: string[], note?: string }
        → ส่งไฟล์ JSON กลับไปให้ดาวน์โหลด และบันทึกลง backup_history
          (ไม่ส่ง tables = สำรองทุกตาราง)
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const [tables, historyRes] = await Promise.all([
      listPublicTables(),
      pool.query(
        `
        SELECT b.*, u.username AS created_by_name
        FROM backup_history b
        LEFT JOIN users u ON u.user_id = b.created_by
        ORDER BY b.created_at DESC
        LIMIT 50
        `,
      ),
    ]);

    return NextResponse.json({ success: true, tables, history: historyRes.rows });
  } catch (error) {
    console.error("ADMIN BACKUP GET ERROR:", error);
    return serverError("โหลดประวัติการสำรองข้อมูลไม่สำเร็จ", error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request).catch((error) => {
    console.error(error);
    return null;
  });
  if (!auth) return serverError("ตรวจสิทธิ์ไม่สำเร็จ", "auth failed");
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    tables?: string[];
    note?: string;
  };

  const allTables = await listPublicTables();
  const selected =
    Array.isArray(body.tables) && body.tables.length > 0
      ? body.tables.filter((t) => allTables.includes(t))
      : allTables;

  if (selected.length === 0) {
    return NextResponse.json(
      { success: false, message: "กรุณาเลือกตารางที่ต้องการสำรอง" },
      { status: 400 },
    );
  }

  // ชื่อไฟล์ใช้เวลาไทย ให้ตรงกับเวลาที่แสดงในประวัติ
  const stamp = new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const fileName = `health-backup-${stamp}.json`;
  const note = String(body.note ?? "").trim().slice(0, 500) || null;

  // ใช้ REPEATABLE READ ให้ทุกตารางเป็นภาพเดียวกัน ณ เวลาเดียว
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

    const data: Record<string, unknown[]> = {};
    const rowCounts: Record<string, number> = {};
    let totalRows = 0;

    for (const table of selected) {
      const r = await client.query(`SELECT * FROM ${quoteIdent(table)}`);
      data[table] = r.rows;
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
