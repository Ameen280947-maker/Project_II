import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdmin, serverError, ADMIN_ROLE } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   GET /api/admin/system   → ตรวจสอบระบบ
   คืนค่า: รายการตรวจ (checks) + สถิติ (stats)
========================================================= */

type CheckStatus = "ok" | "warning" | "error";

type Check = {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

const REQUIRED_TABLES = [
  "users",
  "roles",
  "health_profile",
  "assessment",
  "assessment_types",
  "assessment_answers",
  "questions",
  "recommendation",
  "system_error_logs",
  "backup_history",
];

// เริ่มต้นวันนี้ตามเวลาไทย แปลงเป็น UTC (คอลัมน์เวลาเก็บเป็น timestamp UTC)
const THAI_TODAY_START = `((date_trunc('day', NOW() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'UTC')`;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const checks: Check[] = [];

    /* ---------- 1) การเชื่อมต่อฐานข้อมูล ---------- */
    const started = Date.now();
    const ping = await pool.query(`SHOW server_version`);
    const latencyMs = Date.now() - started;
    // เช่น "17.6" หรือ "17.6 (Ubuntu ...)" → เอาเฉพาะเลขเวอร์ชัน
    const dbVersion = String(ping.rows[0]?.server_version ?? "").split(" ")[0];

    checks.push({
      key: "db",
      label: "การเชื่อมต่อฐานข้อมูล",
      status: latencyMs > 1000 ? "warning" : "ok",
      detail: `PostgreSQL ${dbVersion} · ตอบสนองใน ${latencyMs} ms`,
    });

    /* ---------- 2) ตารางที่จำเป็น ---------- */
    const tableRes = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );
    const found = new Set(tableRes.rows.map((r) => r.table_name));
    const missing = REQUIRED_TABLES.filter((t) => !found.has(t));

    checks.push({
      key: "tables",
      label: "ตารางหลักของระบบ",
      status: missing.length ? "error" : "ok",
      detail: missing.length
        ? `ไม่พบตาราง: ${missing.join(", ")}`
        : `ครบทั้ง ${REQUIRED_TABLES.length} ตาราง`,
    });

    /* ---------- 3) สถิติผู้ใช้ / การประเมิน ---------- */
    const [rolesRes, assessRes, errorRes, backupRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(r.role_name, 'ไม่ระบุ') AS role_name, COUNT(*)::int AS total
         FROM users u LEFT JOIN roles r ON r.role_id = u.role_id
         GROUP BY r.role_name ORDER BY total DESC`,
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE assessed_at >= NOW() - INTERVAL '7 days')::int AS last7,
                COUNT(*) FILTER (WHERE assessed_at >= ${THAI_TODAY_START})::int AS today
         FROM assessment`,
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open,
                COUNT(*) FILTER (WHERE status = 'open' AND created_at >= NOW() - INTERVAL '1 day')::int AS last24h
         FROM system_error_logs`,
      ),
      pool.query(
        `SELECT created_at FROM backup_history
         WHERE status = 'success' ORDER BY created_at DESC LIMIT 1`,
      ),
    ]);

    const usersByRole = rolesRes.rows as { role_name: string; total: number }[];
    const totalUsers = usersByRole.reduce((sum, r) => sum + r.total, 0);
    const adminCount =
      usersByRole.find((r) => r.role_name === ADMIN_ROLE)?.total ?? 0;

    checks.push({
      key: "admin",
      label: "บัญชีผู้ดูแลระบบ",
      status: adminCount > 0 ? "ok" : "warning",
      detail: `มีผู้ดูแลระบบ ${adminCount} บัญชี`,
    });

    /* ---------- 4) ข้อผิดพลาดที่ยังไม่แก้ ---------- */
    const openErrors: number = errorRes.rows[0].open;
    checks.push({
      key: "errors",
      label: "ข้อผิดพลาดที่ยังไม่แก้ไข",
      status: openErrors === 0 ? "ok" : openErrors > 10 ? "error" : "warning",
      detail:
        openErrors === 0
          ? "ไม่มีข้อผิดพลาดค้างอยู่"
          : `ค้างอยู่ ${openErrors} รายการ (เกิดใหม่ใน 24 ชม. ${errorRes.rows[0].last24h})`,
    });

    /* ---------- 5) การสำรองข้อมูลล่าสุด ---------- */
    const lastBackup: Date | null = backupRes.rows[0]?.created_at ?? null;
    const backupAgeDays = lastBackup
      ? (Date.now() - new Date(lastBackup).getTime()) / 86_400_000
      : null;

    checks.push({
      key: "backup",
      label: "การสำรองข้อมูล",
      status:
        backupAgeDays === null ? "error" : backupAgeDays > 7 ? "warning" : "ok",
      detail:
        backupAgeDays === null
          ? "ยังไม่เคยสำรองข้อมูล"
          : backupAgeDays < 1
            ? "สำรองล่าสุดภายใน 24 ชั่วโมง"
            : `สำรองล่าสุดเมื่อ ${Math.floor(backupAgeDays)} วันก่อน`,
    });

    const overall: CheckStatus = checks.some((c) => c.status === "error")
      ? "error"
      : checks.some((c) => c.status === "warning")
        ? "warning"
        : "ok";

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      overall,
      checks,
      stats: {
        totalUsers,
        usersByRole,
        assessments: assessRes.rows[0],
        openErrors,
        lastBackup,
      },
    });
  } catch (error) {
    console.error("ADMIN SYSTEM CHECK ERROR:", error);
    return serverError("ตรวจสอบระบบไม่สำเร็จ", error);
  }
}
