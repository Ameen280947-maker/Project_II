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
   ดูแลฐานข้อมูล

   GET  /api/admin/database
        → รายการตาราง (จำนวนแถว, ขนาด, dead rows, vacuum/analyze ล่าสุด)
        → ผลตรวจความถูกต้องของข้อมูล (ข้อมูลกำพร้า)

   POST /api/admin/database
        body: { action: "analyze" | "vacuum", table?: string }
              { action: "fix_integrity", check: string }
========================================================= */

/* ข้อมูลกำพร้า = แถวที่อ้างถึงข้อมูลแม่ที่ถูกลบไปแล้ว */
const INTEGRITY_CHECKS: {
  key: string;
  label: string;
  countSql: string;
  fixSql: string[];
}[] = [
  {
    key: "answers_without_assessment",
    label: "คำตอบ (assessment_answers) ที่ไม่มีผลการประเมินแม่",
    countSql: `SELECT COUNT(*)::int AS n FROM assessment_answers aa
               WHERE NOT EXISTS (SELECT 1 FROM assessment a WHERE a.assessment_id = aa.assessment_id)`,
    fixSql: [
      `DELETE FROM assessment_answers aa
       WHERE NOT EXISTS (SELECT 1 FROM assessment a WHERE a.assessment_id = aa.assessment_id)`,
    ],
  },
  {
    key: "assessment_without_user",
    label: "ผลการประเมิน (assessment) ที่ไม่มีผู้ใช้",
    countSql: `SELECT COUNT(*)::int AS n FROM assessment a
               WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = a.user_id)`,
    fixSql: [
      `DELETE FROM assessment_answers WHERE assessment_id IN (
         SELECT a.assessment_id FROM assessment a
         WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = a.user_id))`,
      `DELETE FROM assessment a
       WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = a.user_id)`,
    ],
  },
  {
    key: "profile_without_user",
    label: "ข้อมูลสุขภาพ (health_profile) ที่ไม่มีผู้ใช้",
    countSql: `SELECT COUNT(*)::int AS n FROM health_profile h
               WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = h.user_id)`,
    fixSql: [
      `DELETE FROM health_profile h
       WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = h.user_id)`,
    ],
  },
  {
    key: "users_without_role",
    label: "ผู้ใช้ที่ไม่มีบทบาท (role) หรือ role ไม่ถูกต้อง",
    countSql: `SELECT COUNT(*)::int AS n FROM users u
               WHERE u.role_id IS NULL
                  OR NOT EXISTS (SELECT 1 FROM roles r WHERE r.role_id = u.role_id)`,
    // ตั้งเป็น role ผู้ใช้ทั่วไป
    fixSql: [
      `UPDATE users SET role_id = (SELECT role_id FROM roles WHERE role_name = 'user' LIMIT 1)
       WHERE role_id IS NULL
          OR NOT EXISTS (SELECT 1 FROM roles r WHERE r.role_id = users.role_id)`,
    ],
  },
];

/* =========================================================
   GET
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const tablesRes = await pool.query(
      `
      SELECT
        s.relname                                   AS table_name,
        s.n_live_tup::bigint                        AS row_estimate,
        s.n_dead_tup::bigint                        AS dead_rows,
        pg_total_relation_size(s.relid)             AS total_bytes,
        pg_size_pretty(pg_total_relation_size(s.relid)) AS size,
        GREATEST(s.last_vacuum, s.last_autovacuum)  AS last_vacuum,
        GREATEST(s.last_analyze, s.last_autoanalyze) AS last_analyze
      FROM pg_stat_user_tables s
      WHERE s.schemaname = 'public'
      ORDER BY pg_total_relation_size(s.relid) DESC
      `,
    );

    // จำนวนแถวจริง (n_live_tup เป็นค่าประมาณ) — นับจริงเฉพาะตารางไม่ใหญ่มาก
    const tables = await Promise.all(
      tablesRes.rows.map(async (row) => {
        let rows = Number(row.row_estimate);
        if (rows < 200_000) {
          try {
            const c = await pool.query(
              `SELECT COUNT(*)::int AS n FROM ${quoteIdent(row.table_name)}`,
            );
            rows = c.rows[0].n;
          } catch {
            /* ใช้ค่าประมาณแทน */
          }
        }
        return {
          table_name: row.table_name as string,
          rows,
          dead_rows: Number(row.dead_rows),
          size: row.size as string,
          total_bytes: Number(row.total_bytes),
          last_vacuum: row.last_vacuum,
          last_analyze: row.last_analyze,
        };
      }),
    );

    const integrity = await Promise.all(
      INTEGRITY_CHECKS.map(async (check) => {
        try {
          const r = await pool.query(check.countSql);
          return { key: check.key, label: check.label, count: r.rows[0].n as number, error: null };
        } catch (error) {
          return {
            key: check.key,
            label: check.label,
            count: null,
            error: error instanceof Error ? error.message : "ตรวจไม่ได้",
          };
        }
      }),
    );

    const sizeRes = await pool.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
    );

    return NextResponse.json({
      success: true,
      databaseSize: sizeRes.rows[0].size,
      tables,
      integrity,
    });
  } catch (error) {
    console.error("ADMIN DATABASE GET ERROR:", error);
    return serverError("โหลดข้อมูลฐานข้อมูลไม่สำเร็จ", error);
  }
}

/* =========================================================
   POST
========================================================= */

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      table?: string;
      check?: string;
    };

    /* ---------- ANALYZE / VACUUM ---------- */
    if (body.action === "analyze" || body.action === "vacuum") {
      const allTables = await listPublicTables();
      let targets = allTables;

      if (body.table) {
        if (!allTables.includes(body.table)) {
          return NextResponse.json(
            { success: false, message: "ไม่พบตารางนี้" },
            { status: 400 },
          );
        }
        targets = [body.table];
      }

      const command = body.action === "vacuum" ? "VACUUM (ANALYZE)" : "ANALYZE";
      const failed: string[] = [];

      // VACUUM รันใน transaction ไม่ได้ จึงใช้ pool.query ทีละตาราง
      for (const table of targets) {
        try {
          await pool.query(`${command} ${quoteIdent(table)}`);
        } catch (error) {
          failed.push(table);
          await logSystemError(`admin ${command} ${table}`, error, "warning");
        }
      }

      const label = body.action === "vacuum" ? "VACUUM" : "ANALYZE";
      return NextResponse.json({
        success: failed.length === 0,
        message:
          failed.length === 0
            ? `${label} ${targets.length === 1 ? targets[0] : `ทั้งหมด ${targets.length} ตาราง`} เรียบร้อย`
            : `${label} ไม่สำเร็จ ${failed.length} ตาราง: ${failed.join(", ")} (อาจไม่มีสิทธิ์ owner)`,
      });
    }

    /* ---------- แก้ไขข้อมูลกำพร้า ---------- */
    if (body.action === "fix_integrity") {
      const check = INTEGRITY_CHECKS.find((c) => c.key === body.check);
      if (!check) {
        return NextResponse.json(
          { success: false, message: "ไม่พบรายการตรวจนี้" },
          { status: 400 },
        );
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let affected = 0;
        for (const sql of check.fixSql) {
          const r = await client.query(sql);
          affected += r.rowCount ?? 0;
        }
        await client.query("COMMIT");
        return NextResponse.json({
          success: true,
          message: `แก้ไขแล้ว ${affected} แถว`,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        await logSystemError(`admin fix_integrity ${check.key}`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    return NextResponse.json(
      { success: false, message: "คำสั่งไม่ถูกต้อง" },
      { status: 400 },
    );
  } catch (error) {
    console.error("ADMIN DATABASE POST ERROR:", error);
    return serverError("ดำเนินการกับฐานข้อมูลไม่สำเร็จ", error);
  }
}
