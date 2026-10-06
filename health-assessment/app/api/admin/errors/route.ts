import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdmin, serverError } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   แก้ไขข้อผิดพลาด

   GET    /api/admin/errors?status=open|resolved|ignored|all&q=คำค้น
   POST   /api/admin/errors   { source, message, level }       → บันทึกปัญหาเอง
   PATCH  /api/admin/errors   { logId, status, note }          → เปลี่ยนสถานะ
   DELETE /api/admin/errors   { scope: "resolved" }            → ล้างรายการที่แก้แล้ว
========================================================= */

const STATUSES = ["open", "resolved", "ignored"] as const;
const LEVELS = ["error", "warning", "info"] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "open";
    const q = (url.searchParams.get("q") ?? "").trim();

    const where: string[] = [];
    const params: unknown[] = [];

    if (status !== "all" && (STATUSES as readonly string[]).includes(status)) {
      params.push(status);
      where.push(`e.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(e.source ILIKE $${params.length} OR e.message ILIKE $${params.length})`);
    }

    const [listRes, countRes] = await Promise.all([
      pool.query(
        `
        SELECT e.*, u.username AS resolved_by_name
        FROM system_error_logs e
        LEFT JOIN users u ON u.user_id = e.resolved_by
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY e.created_at DESC, e.log_id DESC
        LIMIT 200
        `,
        params,
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS total FROM system_error_logs GROUP BY status`,
      ),
    ]);

    const counts: Record<string, number> = { open: 0, resolved: 0, ignored: 0 };
    for (const row of countRes.rows) counts[row.status] = row.total;

    return NextResponse.json({ success: true, counts, logs: listRes.rows });
  } catch (error) {
    console.error("ADMIN ERRORS GET ERROR:", error);
    return serverError("โหลดรายการข้อผิดพลาดไม่สำเร็จ", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const source = String(body.source ?? "").trim();
    const message = String(body.message ?? "").trim();
    const level = (LEVELS as readonly string[]).includes(body.level) ? body.level : "error";

    if (!source || !message) {
      return NextResponse.json(
        { success: false, message: "กรุณากรอกตำแหน่งที่พบและรายละเอียดปัญหา" },
        { status: 400 },
      );
    }

    await pool.query(
      `INSERT INTO system_error_logs (source, message, level) VALUES ($1, $2, $3)`,
      [source.slice(0, 200), message.slice(0, 5000), level],
    );

    return NextResponse.json({ success: true, message: "บันทึกปัญหาเรียบร้อย" });
  } catch (error) {
    console.error("ADMIN ERRORS POST ERROR:", error);
    return serverError("บันทึกปัญหาไม่สำเร็จ", error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const logId = Number(body.logId);
    const status = String(body.status ?? "");
    const note = String(body.note ?? "").trim() || null;

    if (!Number.isInteger(logId) || !(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { success: false, message: "ข้อมูลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const isOpen = status === "open";

    const result = await pool.query(
      `
      UPDATE system_error_logs
      SET status = $2,
          resolution_note = $3,
          resolved_by = $4,
          resolved_at = ${isOpen ? "NULL" : "NOW()"}
      WHERE log_id = $1
      `,
      [logId, status, isOpen ? null : note, isOpen ? null : auth.admin.user_id],
    );

    if (!result.rowCount) {
      return NextResponse.json(
        { success: false, message: "ไม่พบรายการนี้" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "อัปเดตสถานะเรียบร้อย" });
  } catch (error) {
    console.error("ADMIN ERRORS PATCH ERROR:", error);
    return serverError("อัปเดตสถานะไม่สำเร็จ", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const result = await pool.query(
      `DELETE FROM system_error_logs WHERE status IN ('resolved', 'ignored')`,
    );

    return NextResponse.json({
      success: true,
      message: `ล้างรายการที่ปิดแล้ว ${result.rowCount ?? 0} รายการ`,
    });
  } catch (error) {
    console.error("ADMIN ERRORS DELETE ERROR:", error);
    return serverError("ล้างรายการไม่สำเร็จ", error);
  }
}
