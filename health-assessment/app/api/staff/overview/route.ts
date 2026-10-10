import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireStaff, USER_ROLE_ID } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, severityOf, riskLabel, typeLabel } from "@/lib/staff/riskLevels";
import { syncFollowUpCases } from "@/lib/staff/syncFollowUps";
import { logSystemError } from "@/lib/errorLogger";
import {
  KEY_FORMAT,
  LOCAL_ASSESSED,
  bucketFor,
  bucketLabel,
  inRange,
  localOf,
  parseRange,
  spanDays,
} from "@/lib/staff/overviewRange";

/* =========================================================
   GET /api/staff/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
   ข้อมูลหน้า "ภาพรวม" ของ Staff ทั้งหมดคำนวณจากตารางจริง
   - from / to เป็นวันที่ตามเวลาไทย (รวมทั้งสองวัน)
   - ทุกส่วนคิดตามช่วงเวลานี้ ยกเว้นเคสรอติดตาม ซึ่งเป็นสถานะปัจจุบัน
   - ยังรับ ?range=week|month|quarter แบบเดิมได้ (นับย้อนจากวันนี้)
========================================================= */

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const parsed = parseRange(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ success: false, message: parsed.error }, { status: 400 });
  }

  const { from, to } = parsed;
  const days = spanDays(from, to);
  const bucket = bucketFor(days);
  const keyFormat = KEY_FORMAT[bucket];
  const multiYear = from.slice(0, 4) !== to.slice(0, 4);

  try {
    await syncFollowUpCases();

    const [usersRes, activeRes, bucketRes, slotsRes, latestRes, urgentRes, waitingRes, recentRes, notesRes] = await Promise.all([
      // ผู้ใช้ทั้งหมด ณ สิ้นสุดช่วง และผู้ใช้ใหม่ในช่วง
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE ${localOf("created_at")} < $3::date + 1)::int AS total,
                COUNT(*) FILTER (WHERE ${inRange(localOf("created_at"), "$2", "$3")})::int AS new_in_range
           FROM users WHERE role_id = $1`,
        [USER_ROLE_ID, from, to]
      ),
      // ผู้ใช้ที่ทำแบบประเมินในช่วง
      pool.query(
        `SELECT COUNT(DISTINCT a.user_id)::int AS n
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $1 AND ${inRange(LOCAL_ASSESSED, "$2", "$3")}
            AND NOT (t.assessment_name = ANY($4))`,
        [USER_ROLE_ID, from, to, EXCLUDED_TYPES]
      ),
      // จำนวนการประเมินแยกช่วงเวลา + ระดับ
      pool.query(
        `SELECT to_char(date_trunc($1, ${LOCAL_ASSESSED}), $2) AS b,
                t.assessment_name, a.risk_level, COUNT(*)::int AS n
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $3
            AND ${inRange(LOCAL_ASSESSED, "$4", "$5")}
            AND NOT (t.assessment_name = ANY($6))
          GROUP BY 1, 2, 3`,
        [bucket, keyFormat, USER_ROLE_ID, from, to, EXCLUDED_TYPES]
      ),
      // ช่องเวลาทั้งหมดในช่วง (ให้ช่วงที่ไม่มีการประเมินแสดงเป็น 0)
      pool.query(
        `SELECT to_char(g, $2) AS b
           FROM generate_series(
                  date_trunc($1, $3::date::timestamp),
                  date_trunc($1, $4::date::timestamp + INTERVAL '1 day' - INTERVAL '1 second'),
                  ('1 ' || $1)::interval) AS g`,
        [bucket, keyFormat, from, to]
      ),
      // ผลล่าสุดในช่วงของแต่ละคน/แต่ละแบบประเมิน (ใช้คิดสัดส่วนความเสี่ยง)
      pool.query(
        `SELECT DISTINCT ON (a.user_id, a.assessment_type_id) t.assessment_name, a.risk_level
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $1 AND NOT (t.assessment_name = ANY($2))
            AND ${inRange(LOCAL_ASSESSED, "$3", "$4")}
          ORDER BY a.user_id, a.assessment_type_id, a.assessed_at DESC`,
        [USER_ROLE_ID, EXCLUDED_TYPES, from, to]
      ),
      // เคสรอติดตาม (สถานะปัจจุบัน เฉพาะผู้ที่ยินยอมให้เจ้าหน้าที่ติดตาม)
      pool.query(
        `SELECT c.case_id, c.severity, c.created_at, u.username, t.assessment_name, a.risk_level, a.total_score
           FROM follow_up_cases c
           JOIN users u ON u.user_id = c.user_id
           JOIN assessment a ON a.assessment_id = c.assessment_id
           JOIN assessment_types t ON t.assessment_type_id = c.assessment_type_id
           JOIN user_settings s ON s.user_id::text = c.user_id::text
          WHERE c.status = 'waiting' AND s.consent_staff IS TRUE
          ORDER BY c.severity DESC, c.created_at ASC
          LIMIT 5`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS waiting,
                COUNT(*) FILTER (WHERE c.created_at < NOW() - INTERVAL '3 days')::int AS overdue
           FROM follow_up_cases c
           JOIN user_settings s ON s.user_id::text = c.user_id::text
          WHERE c.status = 'waiting' AND s.consent_staff IS TRUE`
      ),
      // การประเมินล่าสุดในช่วง
      pool.query(
        `SELECT u.username, t.assessment_name, a.risk_level, a.assessed_at
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $1 AND NOT (t.assessment_name = ANY($2))
            AND ${inRange(LOCAL_ASSESSED, "$3", "$4")}
          ORDER BY a.assessed_at DESC LIMIT 6`,
        [USER_ROLE_ID, EXCLUDED_TYPES, from, to]
      ),
      // บันทึกการติดตามล่าสุดในช่วง (created_at เป็น timestamptz)
      pool.query(
        `SELECT s.username AS staff, u.username AS target, n.status, n.created_at
           FROM follow_up_notes n
           JOIN follow_up_cases c ON c.case_id = n.case_id
           JOIN users u ON u.user_id = c.user_id
           LEFT JOIN users s ON s.user_id = n.staff_id
          WHERE ${inRange("(n.created_at AT TIME ZONE 'Asia/Bangkok')", "$1", "$2")}
          ORDER BY n.created_at DESC LIMIT 4`,
        [from, to]
      ),
    ]);

    /* ---------- chart ---------- */
    const chartMap = new Map<string, { label: string; total: number; high: number }>(
      slotsRes.rows.map((r) => [r.b, { label: bucketLabel(r.b, bucket, days, multiYear), total: 0, high: 0 }])
    );
    let assessmentsInRange = 0;
    let highInRange = 0;
    for (const r of bucketRes.rows) {
      const slot = chartMap.get(r.b);
      if (!slot) continue;
      slot.total += r.n;
      if (severityOf(r.assessment_name, r.risk_level) >= 2) {
        slot.high += r.n;
        highInRange += r.n;
      }
      assessmentsInRange += r.n;
    }

    /* ---------- distribution ---------- */
    const dist = new Map<string, { ok: number; mid: number; high: number }>();
    for (const r of latestRes.rows) {
      const d = dist.get(r.assessment_name) ?? { ok: 0, mid: 0, high: 0 };
      const s = severityOf(r.assessment_name, r.risk_level);
      if (s === 0) d.ok++;
      else if (s === 1) d.mid++;
      else d.high++;
      dist.set(r.assessment_name, d);
    }
    const distribution = Array.from(dist.entries())
      .map(([name, d]) => {
        const total = d.ok + d.mid + d.high;
        const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
        return { name: typeLabel(name), total, ok: pct(d.ok), mid: pct(d.mid), high: pct(d.high) };
      })
      .sort((a, b) => b.high - a.high || b.total - a.total);

    /* ---------- activity ---------- */
    const activity = [
      ...recentRes.rows.map((r) => ({
        type: severityOf(r.assessment_name, r.risk_level) >= 2 ? "high" : "assessment",
        text: `${r.username} ทำแบบประเมิน${typeLabel(r.assessment_name)} ผล: ${riskLabel(r.assessment_name, r.risk_level)}`,
        at: r.assessed_at,
      })),
      ...notesRes.rows.map((r) => ({
        type: "note",
        text: `${r.staff ?? "เจ้าหน้าที่"} บันทึกการติดตาม ${r.target}`,
        at: r.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 7);

    return NextResponse.json({
      success: true,
      from,
      to,
      bucket,
      kpi: {
        totalUsers: usersRes.rows[0].total,
        newUsers: usersRes.rows[0].new_in_range,
        assessments: assessmentsInRange,
        highRisk: highInRange,
        activeUsers: activeRes.rows[0].n,
        waiting: waitingRes.rows[0].waiting,
        overdue: waitingRes.rows[0].overdue,
      },
      chart: Array.from(chartMap.values()),
      urgent: urgentRes.rows.map((r) => ({
        caseId: r.case_id,
        username: r.username,
        assessment: typeLabel(r.assessment_name),
        riskLevel: riskLabel(r.assessment_name, r.risk_level),
        score: r.total_score,
        severity: r.severity,
        createdAt: r.created_at,
      })),
      distribution,
      activity,
    });
  } catch (error) {
    void logSystemError("GET /api/staff/overview", error);
    console.error("GET /api/staff/overview error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดข้อมูลภาพรวมได้" }, { status: 500 });
  }
}
