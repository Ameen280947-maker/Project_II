import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireStaff, USER_ROLE_ID } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, severityOf, riskLabel, typeLabel } from "@/lib/staff/riskLevels";
import { syncFollowUpCases } from "@/lib/staff/syncFollowUps";

/* =========================================================
   GET /api/staff/overview?range=week|month|quarter
   ข้อมูลหน้า "ภาพรวม" ของ Staff ทั้งหมดคำนวณจากตารางจริง
========================================================= */

const RANGES = {
  week: { days: 7, bucket: "day" },
  month: { days: 30, bucket: "week" },
  quarter: { days: 90, bucket: "month" },
} as const;

type RangeKey = keyof typeof RANGES;

const TH_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// แปลง key ของช่วงเวลา (มาจาก SQL) เป็นป้ายภาษาไทย
function bucketLabel(key: string, bucket: string) {
  const [y, m, d] = key.split("-").map(Number);
  if (bucket === "month") return TH_MONTHS[m - 1];
  const date = new Date(y, m - 1, d);
  return bucket === "day" ? TH_DAYS[date.getDay()] : `${d} ${TH_MONTHS[m - 1]}`;
}

// เวลาในฐานข้อมูลเป็น UTC แปลงเป็นเวลาไทยก่อนแบ่งช่วง
const LOCAL_TS = "((a.assessed_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')";
const LOCAL_NOW = "(NOW() AT TIME ZONE 'Asia/Bangkok')";

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;

  const rangeParam = new URL(request.url).searchParams.get("range") as RangeKey | null;
  const range: RangeKey = rangeParam && rangeParam in RANGES ? rangeParam : "week";
  const { days, bucket } = RANGES[range];
  const keyFormat = bucket === "month" ? "YYYY-MM" : "YYYY-MM-DD";

  try {
    await syncFollowUpCases();

    const [usersRes, activeRes, bucketRes, slotsRes, latestRes, urgentRes, waitingRes, recentRes, notesRes] = await Promise.all([
      // ผู้ใช้ทั้งหมด และผู้ใช้ใหม่ในช่วงเวลา
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE created_at >= NOW() - make_interval(days => $2))::int AS new_in_range
           FROM users WHERE role_id = $1`,
        [USER_ROLE_ID, days]
      ),
      // ผู้ใช้ที่ทำแบบประเมินใน 30 วัน
      pool.query(
        `SELECT COUNT(DISTINCT a.user_id)::int AS n
           FROM assessment a JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $1 AND a.assessed_at >= NOW() - INTERVAL '30 days'`,
        [USER_ROLE_ID]
      ),
      // จำนวนการประเมินแยกช่วงเวลา + ระดับ
      pool.query(
        `SELECT to_char(date_trunc($1, ${LOCAL_TS}), $2) AS b,
                t.assessment_name, a.risk_level, COUNT(*)::int AS n
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $3
            AND ${LOCAL_TS} >= date_trunc($1, ${LOCAL_NOW} - make_interval(days => $4))
            AND NOT (t.assessment_name = ANY($5))
          GROUP BY 1, 2, 3`,
        [bucket, keyFormat, USER_ROLE_ID, days - 1, EXCLUDED_TYPES]
      ),
      // ช่องเวลาทั้งหมดในช่วง (ให้ช่วงที่ไม่มีการประเมินแสดงเป็น 0)
      pool.query(
        `SELECT to_char(g, $2) AS b
           FROM generate_series(
                  date_trunc($1, ${LOCAL_NOW} - make_interval(days => $3)),
                  date_trunc($1, ${LOCAL_NOW}),
                  ('1 ' || $1)::interval) AS g`,
        [bucket, keyFormat, days - 1]
      ),
      // ผลล่าสุดของแต่ละคน/แต่ละแบบประเมิน (ใช้คิดสัดส่วนความเสี่ยง)
      pool.query(
        `SELECT DISTINCT ON (a.user_id, a.assessment_type_id) t.assessment_name, a.risk_level
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $1 AND NOT (t.assessment_name = ANY($2))
          ORDER BY a.user_id, a.assessment_type_id, a.assessed_at DESC`,
        [USER_ROLE_ID, EXCLUDED_TYPES]
      ),
      // เคสรอติดตาม (เฉพาะผู้ที่ยินยอมให้เจ้าหน้าที่ติดตาม)
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
      // การประเมินล่าสุด
      pool.query(
        `SELECT u.username, t.assessment_name, a.risk_level, a.assessed_at
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $1 AND NOT (t.assessment_name = ANY($2))
          ORDER BY a.assessed_at DESC LIMIT 6`,
        [USER_ROLE_ID, EXCLUDED_TYPES]
      ),
      // บันทึกการติดตามล่าสุด
      pool.query(
        `SELECT s.username AS staff, u.username AS target, n.status, n.created_at
           FROM follow_up_notes n
           JOIN follow_up_cases c ON c.case_id = n.case_id
           JOIN users u ON u.user_id = c.user_id
           LEFT JOIN users s ON s.user_id = n.staff_id
          ORDER BY n.created_at DESC LIMIT 4`
      ),
    ]);

    /* ---------- chart ---------- */
    const chartMap = new Map<string, { label: string; total: number; high: number }>(
      slotsRes.rows.map((r) => [r.b, { label: bucketLabel(r.b, bucket), total: 0, high: 0 }])
    );
    let assessmentsInRange = 0;
    for (const r of bucketRes.rows) {
      const slot = chartMap.get(r.b);
      if (!slot) continue;
      slot.total += r.n;
      if (severityOf(r.assessment_name, r.risk_level) >= 2) slot.high += r.n;
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
      range,
      kpi: {
        totalUsers: usersRes.rows[0].total,
        newUsers: usersRes.rows[0].new_in_range,
        assessments: assessmentsInRange,
        activeUsers30d: activeRes.rows[0].n,
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
    console.error("GET /api/staff/overview error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดข้อมูลภาพรวมได้" }, { status: 500 });
  }
}
