import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import {
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
        → รายการตาราง (จำนวนแถว, ขนาด)
        → ผลตรวจความถูกต้องของข้อมูล (ข้อมูลกำพร้า)

   POST /api/admin/database
        body: { action: "fix_integrity", check: string }

   ทุก query รันทีละตัว ไม่แย่ง connection กับผู้ใช้
   (Supabase session pooler รับได้จำกัด)
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
    label: "คำตอบแบบประเมินที่ผลการประเมินถูกลบไปแล้ว",
    countSql: `SELECT COUNT(*)::int AS n FROM assessment_answers aa
               WHERE NOT EXISTS (SELECT 1 FROM assessment a WHERE a.assessment_id = aa.assessment_id)`,
    fixSql: [
      `DELETE FROM assessment_answers aa
       WHERE NOT EXISTS (SELECT 1 FROM assessment a WHERE a.assessment_id = aa.assessment_id)`,
    ],
  },
  {
    key: "assessment_without_user",
    label: "ผลการประเมินของผู้ใช้ที่ถูกลบไปแล้ว",
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
    label: "ข้อมูลสุขภาพของผู้ใช้ที่ถูกลบไปแล้ว",
    countSql: `SELECT COUNT(*)::int AS n FROM health_profile h
               WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = h.user_id)`,
    fixSql: [
      `DELETE FROM health_profile h
       WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = h.user_id)`,
    ],
  },
  {
    key: "users_without_role",
    label: "ผู้ใช้ที่ไม่ได้กำหนดสิทธิ์ (ผู้ใช้ / Staff / Admin)",
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
        pg_total_relation_size(s.relid)             AS total_bytes
      FROM pg_stat_user_tables s
      WHERE s.schemaname = 'public'
      ORDER BY pg_total_relation_size(s.relid) DESC
      `,
    );
    const tableNames: string[] = tablesRes.rows.map((r) => r.table_name);

    // นับจำนวนแถวจริงทุกตารางใน query เดียว (ใช้ connection เดียว)
    const counts: number[] = [];
    if (tableNames.length) {
      const countRes = await pool.query(
        tableNames
          .map((t, i) => `SELECT ${i} AS i, COUNT(*)::int AS n FROM ${quoteIdent(t)}`)
          .join(" UNION ALL "),
      );
      for (const r of countRes.rows) counts[r.i] = r.n;
    }

    const tables = tablesRes.rows.map((row, i) => ({
      table_name: row.table_name as string,
      rows: counts[i] ?? 0,
      total_bytes: Number(row.total_bytes),
    }));

    // ตรวจข้อมูลกำพร้าทีละรายการ
    const integrity = [];
    for (const check of INTEGRITY_CHECKS) {
      try {
        const r = await pool.query(check.countSql);
        integrity.push({ key: check.key, label: check.label, count: r.rows[0].n as number, error: null });
      } catch (error) {
        integrity.push({
          key: check.key,
          label: check.label,
          count: null,
          error: error instanceof Error ? error.message : "ตรวจไม่ได้",
        });
      }
    }

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
      check?: string;
    };

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
