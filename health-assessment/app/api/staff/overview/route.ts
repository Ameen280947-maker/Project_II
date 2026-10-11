import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireStaff, USER_ROLE_ID } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, severityOf, typeLabel } from "@/lib/staff/riskLevels";
import { loadCustomSeverities } from "@/lib/customAssessments";
import { getNotificationRule } from "@/lib/notificationRules";
import { logSystemError } from "@/lib/errorLogger";
import {
  KEY_FORMAT,
  LOCAL_ASSESSED,
  addDays,
  bucketFor,
  bucketLabel,
  inRange,
  localOf,
  parseRange,
  spanDays,
} from "@/lib/staff/overviewRange";

/* =========================================================
   GET /api/staff/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
   ข้อมูลหน้า "ภาพรวมระบบ" ของ Staff (from / to เป็นวันที่ตามเวลาไทย รวมทั้งสองวัน)
   - ตัวเลขการใช้งาน (ผู้ใช้ / จำนวนครั้ง / แบบประเมิน) นับทุกคน
   - สถิติผลสุขภาพ (สัดส่วนผล ปัญหาที่พบมาก ประเมินซ้ำตามรอบ) นับเฉพาะผู้ที่ยินยอม
     ให้ประมวลผลข้อมูลสุขภาพ (user_settings.consent_health ไม่มีแถว = ยินยอม) และซ่อนกลุ่มที่น้อยกว่า 5 คน
   - ไม่มีผลประเมินรายบุคคลในข้อมูลที่ส่งกลับ
========================================================= */

const MIN_GROUP = 5;
const GRACE_DAYS = 7; // ประเมินซ้ำช้ากว่ากำหนดไม่เกิน 7 วัน ยังนับว่าตามรอบ (เหมือนหน้ารายงาน)
const DAY_MS = 86_400_000;
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// กิจกรรมที่ไม่แสดงในฟีด (การเปิดดูข้อมูล / ระบบติดตามเดิมที่ยกเลิกแล้ว)
const HIDDEN_ACTIONS = ["view_user_detail", "view_follow_up_case"];

type ResultRow = { user_id: number; type_id: number; name: string; risk_level: string; t: number; in_range: boolean };

const pctOf = (n: number, d: number) => (d >= MIN_GROUP ? Math.round((n / d) * 1000) / 10 : null);

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
  // ช่วงก่อนหน้าที่ยาวเท่ากัน
  const prevFrom = addDays(from, -days);
  const prevTo = addDays(from, -1);

  const LOCAL_CREATED = localOf("u.created_at");
  const notExcluded = "NOT (t.assessment_name = ANY($2))";

  try {
    await loadCustomSeverities();

    const [
      usersRes,
      countsRes,
      slotsRes,
      activeRes,
      typesRes,
      resultsRes,
      monthlyRes,
      missingRes,
      draftsRes,
      logsRes,
      signupsRes,
    ] = await Promise.all([
      // ผู้ใช้: ทั้งหมด ณ สิ้นช่วง / ใหม่ในช่วง / สถานะบัญชีปัจจุบัน (นิยามเดียวกับหน้าผู้ใช้งาน)
      pool.query(
        `WITH x AS (
           SELECT u.user_id, u.created_at, COALESCE(u.is_active, TRUE) AS is_active,
                  ${LOCAL_CREATED} AS local_created,
                  GREATEST(MAX(a.assessed_at), u.created_at) AS last_seen
             FROM users u LEFT JOIN assessment a ON a.user_id = u.user_id
            WHERE u.role_id = $1
            GROUP BY u.user_id)
         SELECT COUNT(*) FILTER (WHERE local_created < $3::date + 1)::int AS total,
                COUNT(*) FILTER (WHERE ${inRange("local_created", "$2", "$3")})::int AS new_in_range,
                COUNT(*) FILTER (WHERE is_active AND last_seen >= NOW() - INTERVAL '30 days')::int AS active30,
                COUNT(*) FILTER (WHERE is_active AND last_seen < NOW() - INTERVAL '30 days')::int AS inactive30,
                COUNT(*) FILTER (WHERE NOT is_active)::int AS suspended
           FROM x`,
        [USER_ROLE_ID, from, to]
      ),
      // จำนวนการประเมินต่อช่วงเวลา ทั้งช่วงนี้และช่วงก่อนหน้า (ทุกคน)
      pool.query(
        `SELECT ${LOCAL_ASSESSED} >= $5::date AS cur,
                to_char(date_trunc($3, ${LOCAL_ASSESSED}), $4) AS b, COUNT(*)::int AS n
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
          WHERE u.role_id = $1 AND ${notExcluded}
            AND ${inRange(LOCAL_ASSESSED, "$6", "$7")}
          GROUP BY 1, 2`,
        [USER_ROLE_ID, EXCLUDED_TYPES, bucket, keyFormat, from, prevFrom, to]
      ),
      // ช่องเวลาทั้งหมดของช่วงนี้และช่วงก่อน (ช่องที่ไม่มีข้อมูลเป็น 0)
      pool.query(
        `SELECT p.cur, to_char(g, $2) AS b
           FROM (VALUES (TRUE, $3::date, $4::date), (FALSE, $5::date, $6::date)) AS p(cur, f, t)
           CROSS JOIN LATERAL generate_series(
                  date_trunc($1, p.f::timestamp),
                  date_trunc($1, p.t::timestamp + INTERVAL '1 day' - INTERVAL '1 second'),
                  ('1 ' || $1)::interval) AS g
          ORDER BY p.cur, g`,
        [bucket, keyFormat, from, to, prevFrom, prevTo]
      ),
      // ผู้ใช้ที่ใช้งานในช่วง = ทำแบบประเมินหรือสมัครในช่วง
      pool.query(
        `SELECT COUNT(DISTINCT user_id)::int AS n FROM (
           SELECT a.user_id
             FROM assessment a
             JOIN assessment_types t USING (assessment_type_id)
             JOIN users u ON u.user_id = a.user_id
            WHERE u.role_id = $1 AND ${notExcluded} AND ${inRange(LOCAL_ASSESSED, "$3", "$4")}
           UNION
           SELECT u.user_id FROM users u
            WHERE u.role_id = $1 AND ${inRange(LOCAL_CREATED, "$3", "$4")}
         ) x`,
        [USER_ROLE_ID, EXCLUDED_TYPES, from, to]
      ),
      // แบบประเมิน + จำนวนครั้งที่ถูกทำในช่วง (ทุกคน)
      pool.query(
        `SELECT t.assessment_type_id AS id, t.assessment_name AS name, COALESCE(t.is_active, TRUE) AS is_active,
                COUNT(x.assessment_id)::int AS n
           FROM assessment_types t
           LEFT JOIN (
             SELECT a.assessment_id, a.assessment_type_id
               FROM assessment a JOIN users u ON u.user_id = a.user_id
              WHERE u.role_id = $1 AND ${inRange(LOCAL_ASSESSED, "$3", "$4")}
           ) x ON x.assessment_type_id = t.assessment_type_id
          WHERE ${notExcluded}
          GROUP BY t.assessment_type_id
          ORDER BY n DESC, t.assessment_type_id`,
        [USER_ROLE_ID, EXCLUDED_TYPES, from, to]
      ),
      // ผลประเมินของผู้ที่ยินยอมให้ประมวลผลข้อมูลสุขภาพ (ใช้คิดสถิติผล ไม่ส่งออกรายบุคคล)
      // ย้อนหลังพอให้คิดรอบประเมินซ้ำ (รอบยาวสุด 1 ปี)
      pool.query<ResultRow>(
        `SELECT a.user_id, a.assessment_type_id AS type_id, t.assessment_name AS name, a.risk_level,
                (EXTRACT(EPOCH FROM a.assessed_at) * 1000)::float8 AS t,
                (${inRange(LOCAL_ASSESSED, "$3", "$4")}) AS in_range
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           JOIN users u ON u.user_id = a.user_id
           JOIN LATERAL (SELECT COALESCE((SELECT consent_health FROM user_settings WHERE user_id::text = a.user_id::text), TRUE) AS ok) hc ON hc.ok
          WHERE u.role_id = $1 AND ${notExcluded}
            AND (a.assessed_at >= NOW() - INTERVAL '800 days' OR ${inRange(LOCAL_ASSESSED, "$3", "$4")})`,
        [USER_ROLE_ID, EXCLUDED_TYPES, from, to]
      ),
      // จำนวนการประเมินรายเดือน 6 เดือนล่าสุด (ทุกคน)
      pool.query(
        `WITH m AS (
           SELECT generate_series(
                    date_trunc('month', (NOW() AT TIME ZONE 'Asia/Bangkok')) - INTERVAL '5 months',
                    date_trunc('month', (NOW() AT TIME ZONE 'Asia/Bangkok')),
                    INTERVAL '1 month') AS month)
         SELECT to_char(m.month, 'YYYY-MM') AS ym, COUNT(a.assessment_id)::int AS n
           FROM m
           LEFT JOIN (
             SELECT a.assessment_id, ${LOCAL_ASSESSED} AS local_at
               FROM assessment a
               JOIN assessment_types t USING (assessment_type_id)
               JOIN users u ON u.user_id = a.user_id
              WHERE u.role_id = $1 AND ${notExcluded}
           ) a ON date_trunc('month', a.local_at) = m.month
          GROUP BY m.month ORDER BY m.month`,
        [USER_ROLE_ID, EXCLUDED_TYPES]
      ),
      // ระดับผลของแบบประเมินที่เปิดใช้งาน แต่ยังไม่มีข้อความคำแนะนำ
      pool.query(
        `SELECT t.assessment_type_id AS id, t.assessment_name AS name, r.risk_level
           FROM recommendation r
           JOIN assessment_types t USING (assessment_type_id)
          WHERE COALESCE(t.is_active, TRUE) AND NOT (t.assessment_name = ANY($1))
            AND COALESCE(BTRIM(r.recommendation_text), '') = ''
          ORDER BY t.assessment_type_id, r.min_score NULLS LAST, r.rec_id`,
        [EXCLUDED_TYPES]
      ),
      // ฉบับร่างที่ยังไม่เผยแพร่
      pool.query(
        `SELECT v.assessment_type_id AS id, t.assessment_name AS name,
                (v.updated_at AT TIME ZONE 'UTC') AS updated_at, s.username AS updated_by
           FROM assessment_versions v
           LEFT JOIN assessment_types t ON t.assessment_type_id = v.assessment_type_id
           LEFT JOIN users s ON s.user_id = v.updated_by
          WHERE v.status = 'draft'
          ORDER BY v.updated_at DESC`
      ),
      // การดำเนินการของเจ้าหน้าที่ในช่วง (created_at เป็น timestamptz)
      pool.query(
        `SELECT l.action, l.detail, l.created_at, s.username AS staff, tu.username AS target_user,
                COALESCE(t.assessment_name, rt.assessment_name) AS type_name, r.risk_level AS rec_level
           FROM access_logs l
           LEFT JOIN users s ON s.user_id = l.staff_id
           LEFT JOIN users tu ON tu.user_id = l.target_user_id
           LEFT JOIN assessment_types t
                  ON t.assessment_type_id = NULLIF(SUBSTRING(l.detail FROM '^type ([0-9]+)'), '')::int
           LEFT JOIN recommendation r
                  ON r.rec_id = NULLIF(SUBSTRING(l.detail FROM '"recId":\\s*([0-9]+)'), '')::int
           LEFT JOIN assessment_types rt ON rt.assessment_type_id = r.assessment_type_id
          WHERE NOT (l.action = ANY($3))
            AND ${inRange("(l.created_at AT TIME ZONE 'Asia/Bangkok')", "$1", "$2")}
          ORDER BY l.created_at DESC
          LIMIT 8`,
        [from, to, HIDDEN_ACTIONS]
      ),
      // ผู้สมัครใหม่รายวันในช่วง
      pool.query(
        `SELECT to_char(${LOCAL_CREATED}, 'YYYY-MM-DD') AS d, COUNT(*)::int AS n,
                MAX(u.created_at AT TIME ZONE 'UTC') AS at
           FROM users u
          WHERE u.role_id = $1 AND ${inRange(LOCAL_CREATED, "$2", "$3")}
          GROUP BY 1 ORDER BY 1 DESC LIMIT 8`,
        [USER_ROLE_ID, from, to]
      ),
    ]);

    /* ---------- KPI ---------- */
    const u = usersRes.rows[0];
    const curSlots = slotsRes.rows.filter((r) => r.cur).map((r) => r.b as string);
    const prevSlots = slotsRes.rows.filter((r) => !r.cur).map((r) => r.b as string);
    const curCounts = new Map<string, number>();
    const prevCounts = new Map<string, number>();
    for (const r of countsRes.rows) (r.cur ? curCounts : prevCounts).set(r.b, r.n);
    const assessments = sum(curCounts.values());
    const prevAssessments = sum(prevCounts.values());

    const types = typesRes.rows;
    const activeTypes = types.filter((t) => t.is_active).length;

    /* ---------- กราฟรายช่วง (ช่องที่ i ของช่วงนี้เทียบกับช่องที่ i ของช่วงก่อน) ---------- */
    const chart = curSlots.map((b, i) => ({
      label: bucketLabel(b, bucket, days, multiYear),
      value: curCounts.get(b) ?? 0,
      prev: prevSlots[i] !== undefined ? prevCounts.get(prevSlots[i]) ?? 0 : null,
    }));

    /* ---------- สถิติผล (เฉพาะผู้ยินยอม) ---------- */
    const results = resultsRes.rows;
    const inRangeRows = results.filter((r) => r.in_range);
    const resultUsers = new Set(inRangeRows.map((r) => r.user_id)).size;
    const outcome = { ok: 0, mid: 0, high: 0 };
    for (const r of inRangeRows) {
      const s = severityOf(r.name, r.risk_level);
      if (s === 0) outcome.ok++;
      else if (s === 1) outcome.mid++;
      else outcome.high++;
    }

    // ปัญหาที่พบมากที่สุด: แบบประเมินที่ % ผู้ใช้ซึ่งผลล่าสุด "ควรระวัง" ขึ้นไปสูงสุด
    const latest = new Map<string, ResultRow>();
    for (const r of inRangeRows) {
      const k = `${r.user_id}:${r.type_id}`;
      const c = latest.get(k);
      if (!c || r.t > c.t) latest.set(k, r);
    }
    const issueMap = new Map<string, { users: number; risky: number }>();
    for (const r of latest.values()) {
      const v = issueMap.get(r.name) ?? { users: 0, risky: 0 };
      v.users++;
      if (severityOf(r.name, r.risk_level) >= 1) v.risky++;
      issueMap.set(r.name, v);
    }
    const topIssue =
      Array.from(issueMap.entries())
        .map(([name, v]) => ({ label: typeLabel(name), pct: pctOf(v.risky, v.users) }))
        .filter((x): x is { label: string; pct: number } => x.pct !== null)
        .sort((a, b) => b.pct - a.pct)[0] ?? null;

    // ประเมินซ้ำตามรอบ: 30 วันล่าสุดที่ตัดสินได้แล้ว เทียบกับ 30 วันก่อนหน้า
    const now = Date.now();
    const windowEnd = now - GRACE_DAYS * DAY_MS;
    const onTime = onTimeRate(results, windowEnd - 30 * DAY_MS, windowEnd);
    const onTimePrev = onTimeRate(results, windowEnd - 60 * DAY_MS, windowEnd - 30 * DAY_MS);

    /* ---------- งานค้าง ---------- */
    const missing = missingRes.rows.map((r) => ({ typeId: r.id as number, assessment: typeLabel(r.name), level: r.risk_level as string }));
    const drafts = draftsRes.rows.map((r) => ({
      typeId: r.id as number,
      assessment: r.name ? typeLabel(r.name) : `แบบประเมิน #${r.id}`,
      updatedAt: r.updated_at,
      updatedBy: r.updated_by as string | null,
    }));

    /* ---------- กิจกรรมล่าสุด ---------- */
    const activity = [
      ...logsRes.rows.map((r) => ({ kind: "staff" as const, text: describeLog(r), at: new Date(r.created_at).toISOString() })),
      ...signupsRes.rows.map((r) => ({ kind: "signup" as const, text: `ผู้ใช้สมัครใหม่ ${r.n} คน`, at: new Date(r.at).toISOString() })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6);

    return NextResponse.json({
      success: true,
      staffName: auth.staff.username,
      from,
      to,
      bucket,
      minGroup: MIN_GROUP,
      kpi: {
        totalUsers: u.total,
        newUsers: u.new_in_range,
        assessments,
        prevAssessments,
        activeUsers: activeRes.rows[0].n,
        activeTypes,
        totalTypes: types.length,
      },
      chart,
      outcome: {
        total: inRangeRows.length,
        users: resultUsers,
        // กลุ่มเล็กกว่า MIN_GROUP คน ไม่แสดงสัดส่วน
        counts: resultUsers >= MIN_GROUP ? outcome : null,
      },
      accounts: {
        newUsers: u.new_in_range,
        active30: u.active30,
        inactive30: u.inactive30,
        suspended: u.suspended,
      },
      topAssessments: types
        .filter((t) => t.n > 0)
        .slice(0, 5)
        .map((t) => ({ id: t.id, label: typeLabel(t.name), count: t.n })),
      reports: {
        topIssue,
        onTime,
        onTimeChange: onTime !== null && onTimePrev !== null ? Math.round((onTime - onTimePrev) * 10) / 10 : null,
        monthly: monthlyRes.rows.map((r, i, all) => ({
          label: TH_MONTHS[Number(r.ym.slice(5, 7)) - 1],
          value: r.n,
          current: i === all.length - 1,
        })),
      },
      tasks: { missing, drafts, suspended: u.suspended },
      activity,
    });
  } catch (error) {
    void logSystemError("GET /api/staff/overview", error);
    console.error("GET /api/staff/overview error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถโหลดข้อมูลภาพรวมได้" }, { status: 500 });
  }
}

function sum(values: Iterable<number>) {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/* อัตราประเมินซ้ำตามรอบ (ตรรกะเดียวกับหน้ารายงาน แต่รวมทุกแบบประเมิน)
   จากผลที่ครบกำหนดประเมินซ้ำในช่วง [start, end) มีกี่ % ที่ผู้ใช้กลับมาทำภายในกำหนด (+GRACE_DAYS) */
function onTimeRate(rows: ResultRow[], start: number, end: number) {
  const groups = new Map<string, ResultRow[]>();
  for (const r of rows) {
    const k = `${r.user_id}:${r.type_id}`;
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }
  let due = 0;
  let ok = 0;
  const users = new Set<number>();
  for (const list of groups.values()) {
    list.sort((a, b) => a.t - b.t);
    list.forEach((r, i) => {
      const dueAt = r.t + getNotificationRule(r.type_id, r.risk_level).intervalDays * DAY_MS;
      if (dueAt < start || dueAt >= end) return;
      due++;
      users.add(r.user_id);
      const next = list[i + 1];
      if (next && next.t <= dueAt + GRACE_DAYS * DAY_MS) ok++;
    });
  }
  return users.size >= MIN_GROUP ? pctOf(ok, due) : null;
}

/* ---------- ข้อความกิจกรรมของเจ้าหน้าที่ ---------- */

type LogRow = {
  action: string;
  detail: string | null;
  staff: string | null;
  target_user: string | null;
  type_name: string | null;
  rec_level: string | null;
};

function describeLog(r: LogRow) {
  const who = r.staff ?? "เจ้าหน้าที่";
  const detail = r.detail ?? "";
  // ชื่อแบบประเมิน: จาก "type <id>" ใน detail หรือข้อความหลัง "·" (กรณีถูกลบไปแล้ว)
  const afterDot = detail.includes("·") ? detail.split("·").slice(1).join("·").trim() : "";
  const typeName = r.type_name ? typeLabel(r.type_name) : afterDot || null;
  const q = (s: string | null | undefined) => (s ? ` “${s}”` : "");
  const version = detail.match(/(?:version|เวอร์ชัน|v)\s*(\d+)/i)?.[1];

  switch (r.action) {
    case "suspend_user":
      return `${who} ระงับบัญชีผู้ใช้${q(r.target_user)}`;
    case "activate_user":
      return `${who} เปิดใช้งานบัญชีผู้ใช้${q(r.target_user)}คืน`;
    case "publish_assessment":
      return `${who} เผยแพร่แบบประเมิน${q(typeName)}${version ? ` เป็นเวอร์ชัน ${version}` : ""}`;
    case "save_assessment_draft":
      return `${who} บันทึกฉบับร่างแบบประเมิน${q(typeName)}`;
    case "discard_assessment_draft":
      return `${who} ยกเลิกฉบับร่างแบบประเมิน${q(typeName)}`;
    case "enable_assessment":
      return `${who} เปิดใช้งานแบบประเมิน${q(typeName)}`;
    case "disable_assessment":
      return `${who} ปิดใช้งานแบบประเมิน${q(typeName)}`;
    case "create_assessment":
      return `${who} สร้างแบบประเมินใหม่${q(r.type_name ? typeLabel(r.type_name) : detail)}`;
    case "create_assessment_category":
      return `${who} สร้างหมวดหมู่แบบประเมินใหม่${q(afterDot || detail)}`;
    case "update_assessment_category":
      return `${who} แก้ไขหมวดหมู่แบบประเมิน${q(afterDot || detail)}`;
    case "delete_assessment_category":
      return `${who} ลบหมวดหมู่แบบประเมิน${q(detail.split("·")[1]?.trim() || detail)}`;
    case "change_assessment_category":
      return `${who} ย้ายแบบประเมิน${q(r.type_name ? typeLabel(r.type_name) : detail.split("·")[1]?.trim())} ไปหมวด${q(detail.match(/หมวด (.+)$/)?.[1])}`;
    case "delete_assessment":
      return `${who} ลบแบบประเมิน${q(detail.split("·")[1]?.trim() || typeName)}`;
    case "save_assessment_levels":
      return `${who} แก้ไขเกณฑ์ระดับผลของแบบประเมิน${q(typeName)}`;
    case "edit_recommendation":
      return `${who} แก้ไขคำแนะนำ${q(typeName)}${r.rec_level ? ` ระดับ ${r.rec_level}` : ""}`;
    default:
      return `${who} ดำเนินการในระบบ (${r.action.replace(/_/g, " ")})`;
  }
}
