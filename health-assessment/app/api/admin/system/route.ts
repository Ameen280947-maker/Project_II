import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdmin, serverError, ADMIN_ROLE } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   GET /api/admin/system   → ตรวจสอบระบบ
   คืนค่า: รายการตรวจ (checks) + สถิติ (stats) + ข้อมูลเซิร์ฟเวอร์
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const checks: Check[] = [];

    /* ---------- 1) การเชื่อมต่อฐานข้อมูล ---------- */
    const started = Date.now();
    const ping = await pool.query(
      `SELECT version() AS version,
              pg_database_size(current_database()) AS db_size,
              current_database() AS db_name,
              NOW() - pg_postmaster_start_time() AS db_uptime`,
    );
    const latencyMs = Date.now() - started;
    const db = ping.rows[0];

    checks.push({
      key: "db",
      label: "การเชื่อมต่อฐานข้อมูล",
      status: latencyMs > 1000 ? "warning" : "ok",
      detail: `ตอบสนองใน ${latencyMs} ms`,
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
                COUNT(*) FILTER (WHERE assessed_at >= NOW() - INTERVAL '1 day')::int AS today
         FROM assessment`,
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')::int AS last24h
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
          : `ค้างอยู่ ${openErrors} รายการ (24 ชม. ล่าสุด ${errorRes.rows[0].last24h})`,
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

    /* ---------- 6) Connection pool ---------- */
    checks.push({
      key: "pool",
      label: "Connection Pool",
      status: pool.waitingCount > 0 ? "warning" : "ok",
      detail: `ใช้งาน ${pool.totalCount - pool.idleCount} / ว่าง ${pool.idleCount} / รอคิว ${pool.waitingCount}`,
    });

    /* ---------- 7) หน่วยความจำของ Node ---------- */
    const mem = process.memoryUsage();
    const heapPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
    checks.push({
      key: "memory",
      label: "หน่วยความจำเซิร์ฟเวอร์",
      status: heapPct > 90 ? "warning" : "ok",
      detail: `Heap ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)} (${heapPct}%)`,
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
      server: {
        dbName: db.db_name,
        dbVersion: String(db.version).split(",")[0],
        dbSize: formatBytes(Number(db.db_size)),
        dbUptime: formatInterval(db.db_uptime),
        nodeVersion: process.version,
        serverUptime: formatSeconds(process.uptime()),
        platform: `${process.platform} ${process.arch}`,
        rss: formatBytes(mem.rss),
      },
    });
  } catch (error) {
    console.error("ADMIN SYSTEM CHECK ERROR:", error);
    return serverError("ตรวจสอบระบบไม่สำเร็จ", error);
  }
}

/* =========================================================
   HELPERS
========================================================= */

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatSeconds(total: number) {
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  return d > 0 ? `${d} วัน ${h} ชม.` : h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

// pg คืน INTERVAL เป็น object { days, hours, minutes, ... }
function formatInterval(value: unknown) {
  if (!value || typeof value !== "object") return String(value ?? "-");
  const v = value as Record<string, number>;
  const seconds =
    (v.days ?? 0) * 86400 +
    (v.hours ?? 0) * 3600 +
    (v.minutes ?? 0) * 60 +
    (v.seconds ?? 0);
  return formatSeconds(seconds);
}
