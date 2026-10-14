import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireStaff, USER_ROLE_ID } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, severityOf, typeLabel } from "@/lib/staff/riskLevels";
import { bucketLabel, localOf, parseRange, spanDays, type Bucket } from "@/lib/staff/overviewRange";
import { loadCustomSeverities } from "@/lib/customAssessments";
import { getNotificationRule } from "@/lib/notificationRules";
import { logSystemError } from "@/lib/errorLogger";

// ค่าคงที่ของรายงาน: กลุ่มขั้นต่ำ วันผ่อนผัน รอบประเมินสูงสุด เวลา และชุดแบบประเมินด้านสุขภาพจิต
const MIN_GROUP = 5;
const GRACE_DAYS = 7;
const MAX_INTERVAL_DAYS = 740;
const DAY_MS = 86_400_000;
const BKK_OFFSET_MS = 7 * 3_600_000;
const MENTAL = new Set(["Stress", "9Q", "PHQ-2", "Sleep"]);
// ช่วงกลุ่มอายุที่ใช้กรองและแบ่งกลุ่มในรายงาน
const AGE_GROUPS: { key: string; label: string; min: number; max: number }[] = [
  { key: "18-24", label: "18–24 ปี", min: 0, max: 24 },
  { key: "25-39", label: "25–39 ปี", min: 25, max: 39 },
  { key: "40-59", label: "40–59 ปี", min: 40, max: 59 },
  { key: "60+", label: "60+ ปี", min: 60, max: 200 },
];

// นิพจน์ SQL แปลงเวลาประเมิน/สมัครเป็นเวลาไทย
const LOCAL_ASSESSED = localOf("a.assessed_at");
const LOCAL_CREATED = localOf("u.created_at");

// สร้าง SQL JOIN ผู้ใช้ที่ยินยอมให้ใช้ข้อมูลสุขภาพ พร้อมโปรไฟล์สุขภาพล่าสุด
const CONSENT_JOIN = (userCol: string) => `
  JOIN users u ON u.user_id = ${userCol}
  JOIN LATERAL (SELECT COALESCE((SELECT consent_health FROM user_settings WHERE user_id::text = ${userCol}::text), TRUE) AS ok) hc ON hc.ok
  LEFT JOIN LATERAL (SELECT * FROM health_profile WHERE user_id = ${userCol} ORDER BY profile_id DESC LIMIT 1) hp ON TRUE`;
// เงื่อนไข SQL กรองผู้ใช้ตามบทบาท เพศ และช่วงอายุ
const PROFILE_FILTER = `u.role_id = $1 AND ($2 = 'all' OR hp.gender = $2) AND ($3::int IS NULL OR hp.age BETWEEN $3 AND $4)`;

// แถวผลประเมินพร้อมเพศ/อายุของผู้ใช้ (ts = มิลลิวินาที, day = วันที่ไทย)
type Row = {
  user_id: number;
  type_id: number;
  name: string;
  risk_level: string;
  ts: number;
  day: string;
  gender: string | null;
  age: number | null;
};

// คำนวณร้อยละ (ทศนิยม 1 ตำแหน่ง) คืน null ถ้ากลุ่มเล็กกว่า MIN_GROUP
const pct = (n: number, d: number) => (d >= MIN_GROUP ? Math.round((n / d) * 1000) / 10 : null);
// คำนวณอัตราการเติบโต (%) เทียบช่วงก่อนหน้า
const growth = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
// คำนวณผลต่างเป็นจุดเปอร์เซ็นต์ระหว่างสองค่า
const diffPts = (a: number | null, b: number | null) => (a !== null && b !== null ? Math.round((a - b) * 10) / 10 : null);

// บวก/ลบจำนวนวันให้วันที่รูปแบบ YYYY-MM-DD
const addDays = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

// คืนวันสุดท้ายของเดือน m ปี y
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
// คืนวันแรกของเดือนที่เลื่อนจากเดือน m ไป n เดือน
const monthStart = (y: number, m: number, n: number) => new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);

// หาวันเริ่มของช่วงก่อนหน้าเพื่อเปรียบเทียบ (รองรับช่วงเดือน/ไตรมาส/ปีเต็ม)
function previousPeriodStart(from: string, to: string, days: number) {
  const [y, m, d] = from.split("-").map(Number);
  if (d === 1) {
    if (m === 1 && to === `${y}-12-31`) return `${y - 1}-01-01`;
    if ((m - 1) % 3 === 0 && to === lastDayOf(y, m + 2)) return monthStart(y, m, -3);
    if (to === lastDayOf(y, m)) return monthStart(y, m, -1);
  }
  return addDays(from, -days);
}

// แปลงวันที่เป็น timestamp เที่ยงคืนตามเวลากรุงเทพฯ
const bkkMidnight = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - BKK_OFFSET_MS;
};
// คืนวันที่วันนี้ (YYYY-MM-DD) ตามเขตเวลากรุงเทพฯ
const todayInBangkok = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

// หาวันเริ่มของช่วง (วัน/สัปดาห์เริ่มจันทร์/เดือน) ที่วันนั้นอยู่
function bucketStart(day: string, bucket: Bucket) {
  if (bucket === "month") return `${day.slice(0, 7)}-01`;
  if (bucket === "week") {
    const [y, m, d] = day.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return addDays(day, -((dow + 6) % 7));
  }
  return day;
}
// คืนวันเริ่มของช่วงถัดไปตามประเภทช่วง
function nextBucket(start: string, bucket: Bucket) {
  if (bucket === "month") {
    const [y, m] = start.split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }
  return addDays(start, bucket === "week" ? 7 : 1);
}
// สร้าง key ของช่วงสำหรับกราฟ (เดือนใช้ YYYY-MM)
const bucketKey = (start: string, bucket: Bucket) => (bucket === "month" ? start.slice(0, 7) : start);

// เลือกผลประเมินล่าสุดของแต่ละผู้ใช้ต่อแต่ละประเภทแบบประเมิน
function latestPerUserType(rows: Row[]) {
  const m = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.user_id}:${r.type_id}`;
    const cur = m.get(k);
    if (!cur || r.ts > cur.ts) m.set(k, r);
  }
  return Array.from(m.values());
}

// ตรวจว่าผลประเมินอยู่ในระดับความเสี่ยงสูง (severity >= 2)
const high = (r: Row) => severityOf(r.name, r.risk_level) >= 2;

// คำนวณสัดส่วนผู้ใช้ที่มีความเสี่ยงสูงจากผลล่าสุด
function highShare(rows: Row[]) {
  const latest = latestPerUserType(rows);
  const users = new Set(latest.map((r) => r.user_id));
  const hi = new Set(latest.filter(high).map((r) => r.user_id));
  return { users: users.size, high: hi.size, pct: pct(hi.size, users.size) };
}

// จัดกลุ่มผลประเมินตามผู้ใช้+ประเภท และเรียงตามเวลา
function seriesByUserType(rows: Row[]) {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.user_id}:${r.type_id}`;
    const list = m.get(k) ?? [];
    list.push(r);
    m.set(k, list);
  }
  for (const list of m.values()) list.sort((a, b) => a.ts - b.ts);
  return m;
}

// คำนวณอัตราการประเมินซ้ำตรงกำหนด (ตามกฎแจ้งเตือน + ช่วงผ่อนผัน) ในช่วงเวลา
function onTimeRate(series: Map<string, Row[]>, typeId: number | null, startMs: number, endMs: number, nowMs: number) {
  let due = 0;
  let ok = 0;
  const users = new Set<number>();
  for (const list of series.values()) {
    if (typeId !== null && list[0].type_id !== typeId) continue;
    list.forEach((r, i) => {
      const dueAt = r.ts + getNotificationRule(r.type_id, r.risk_level).intervalDays * DAY_MS;
      if (dueAt < startMs || dueAt >= endMs || dueAt + GRACE_DAYS * DAY_MS > nowMs) return;
      due++;
      users.add(r.user_id);
      const next = list[i + 1];
      if (next && next.ts <= dueAt + GRACE_DAYS * DAY_MS) ok++;
    });
  }
  return users.size >= MIN_GROUP ? pct(ok, due) : null;
}

// API (เจ้าหน้าที่): สร้างรายงานสถิติตามช่วงวันที่/เพศ/อายุ เทียบช่วงก่อนหน้า พร้อมแนวโน้มและความเสี่ยง
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const p = new URL(request.url).searchParams;

  // อ่านช่วงวันที่และตัวกรอง (ประเภท เพศ กลุ่มอายุ) จาก query
  const range = parseRange(p);
  if ("error" in range) return NextResponse.json({ success: false, message: range.error }, { status: 400 });
  const { from, to } = range;
  const days = spanDays(from, to);
  const prevTo = addDays(from, -1);
  const prevFrom = previousPeriodStart(from, to, days);
  const lookback = addDays(prevFrom, -MAX_INTERVAL_DAYS);

  const typeParam = /^\d+$/.test(p.get("type") ?? "") ? (p.get("type") as string) : "all";
  const gender = ["male", "female"].includes(p.get("gender") ?? "") ? (p.get("gender") as string) : "all";
  const ageGroup = AGE_GROUPS.find((g) => g.key === p.get("age")) ?? null;
  const base = [USER_ROLE_ID, gender, ageGroup?.min ?? null, ageGroup?.max ?? null];

  try {
    await loadCustomSeverities();
    // ดึงประเภทแบบประเมิน ผลประเมิน และผู้ใช้ที่สมัคร (เฉพาะผู้ยินยอม) จาก DB
    const [typesRes, rowsRes, usersRes] = await Promise.all([
      pool.query(
        "SELECT assessment_type_id, assessment_name FROM assessment_types WHERE NOT (assessment_name = ANY($1)) ORDER BY assessment_type_id",
        [EXCLUDED_TYPES]
      ),
      pool.query<Row>(
        `SELECT a.user_id, a.assessment_type_id AS type_id, t.assessment_name AS name, a.risk_level,
                (EXTRACT(EPOCH FROM a.assessed_at AT TIME ZONE 'UTC') * 1000)::float8 AS ts,
                to_char(${LOCAL_ASSESSED}, 'YYYY-MM-DD') AS day,
                hp.gender, hp.age
           FROM assessment a
           JOIN assessment_types t USING (assessment_type_id)
           ${CONSENT_JOIN("a.user_id")}
          WHERE ${PROFILE_FILTER}
            AND NOT (t.assessment_name = ANY($5))
            AND ${LOCAL_ASSESSED} >= $6::date AND ${LOCAL_ASSESSED} < $7::date + 1
            AND ($8 = 'all' OR t.assessment_type_id::text = $8)`,
        [...base, EXCLUDED_TYPES, lookback, to, typeParam]
      ),
      pool.query<{ user_id: number; day: string; has_profile: boolean }>(
        `SELECT u.user_id, to_char(${LOCAL_CREATED}, 'YYYY-MM-DD') AS day, hp.profile_id IS NOT NULL AS has_profile
           FROM users u
           JOIN LATERAL (SELECT COALESCE((SELECT consent_health FROM user_settings WHERE user_id::text = u.user_id::text), TRUE) AS ok) hc ON hc.ok
           LEFT JOIN LATERAL (SELECT * FROM health_profile WHERE user_id = u.user_id ORDER BY profile_id DESC LIMIT 1) hp ON TRUE
          WHERE ${PROFILE_FILTER}
            AND ${LOCAL_CREATED} >= $5::date AND ${LOCAL_CREATED} < $6::date + 1`,
        [...base, prevFrom, to]
      ),
    ]);

    // แยกผลช่วงปัจจุบัน/ก่อนหน้า แล้วคำนวณ KPI
    const rows = rowsRes.rows;
    const today = todayInBangkok();
    const nowMs = Date.now();
    const startMs = bkkMidnight(from);
    const endMs = bkkMidnight(addDays(to, 1));
    const prevStartMs = bkkMidnight(prevFrom);

    const cur = rows.filter((r) => r.day >= from && r.day <= to);
    const prev = rows.filter((r) => r.day >= prevFrom && r.day <= prevTo);
    const series = seriesByUserType(rows);

    const curUsers = new Set(cur.map((r) => r.user_id)).size;
    const curHigh = highShare(cur);
    const onTimeCur = onTimeRate(series, null, startMs, endMs, nowMs);
    const onTimePrev = onTimeRate(series, null, prevStartMs, startMs, nowMs);
    const kpi = {
      assessments: { cur: cur.length, prev: prev.length, changePct: growth(cur.length, prev.length) },
      users: { cur: curUsers, perUser: curUsers ? Math.round((cur.length / curUsers) * 10) / 10 : null },
      high: { pct: curHigh.pct, n: curHigh.pct === null ? null : curHigh.high },
      onTime: { pct: onTimeCur, change: diffPts(onTimeCur, onTimePrev) },
    };

    // สร้างกราฟแนวโน้มรายวัน/รายเดือน (จำนวนประเมิน + % เสี่ยงสูง)
    const bucket: Bucket = days <= 31 ? "day" : "month";
    const multiYear = from.slice(0, 4) !== to.slice(0, 4);
    const trend: { key: string; label: string; total: number; highPct: number | null; partial: boolean }[] = [];
    for (let s = bucketStart(from, bucket); s <= to; s = nextBucket(s, bucket)) {
      const end = nextBucket(s, bucket);
      const inBucket = cur.filter((r) => r.day >= s && r.day < end);
      const key = bucketKey(s, bucket);
      const first = s < from ? from : s;
      const last = addDays(end, -1) > to ? to : addDays(end, -1);
      const clipped = first !== s || last !== addDays(end, -1);
      const baseLabel = bucketLabel(key, bucket, days, multiYear);
      trend.push({
        key,
        label: bucket === "month" && clipped ? `${Number(first.slice(8))}–${Number(last.slice(8))} ${baseLabel}` : baseLabel,
        total: inBucket.length,
        highPct: highShare(inBucket).pct,
        partial: clipped || (s <= today && today < end),
      });
    }

    // สถิติการใช้งาน: ผู้สมัครใหม่ ผู้ที่ผลดีขึ้น และ funnel การใช้งาน
    const signups = usersRes.rows.filter((u) => u.day >= from && u.day <= to);
    const prevSignups = usersRes.rows.filter((u) => u.day >= prevFrom && u.day <= prevTo).length;

    const repeaters = new Set<number>();
    const improvedUsers = new Set<number>();
    for (const list of seriesByUserType(cur).values()) {
      if (list.length < 2) continue;
      const first = list[0];
      const last = list[list.length - 1];
      repeaters.add(first.user_id);
      if (severityOf(last.name, last.risk_level) < severityOf(first.name, first.risk_level)) improvedUsers.add(first.user_id);
    }

    const signupIds = new Set(signups.map((u) => u.user_id));
    const assessedIds = new Set(rows.filter((r) => signupIds.has(r.user_id)).map((r) => r.user_id));
    const onTimeIds = new Set<number>();
    for (const list of series.values()) {
      if (!signupIds.has(list[0].user_id)) continue;
      list.forEach((r, i) => {
        const next = list[i + 1];
        const dueAt = r.ts + getNotificationRule(r.type_id, r.risk_level).intervalDays * DAY_MS;
        if (next && next.ts <= dueAt + GRACE_DAYS * DAY_MS) onTimeIds.add(r.user_id);
      });
    }
    const funnelCounts = [
      { label: "สมัครสมาชิก", n: signups.length },
      { label: "กรอกข้อมูลสุขภาพ", n: signups.filter((u) => u.has_profile).length },
      { label: "ทำแบบประเมิน ≥ 1 ครั้ง", n: assessedIds.size },
      { label: "ทำซ้ำตามรอบ", n: onTimeIds.size },
    ];

    const usage = {
      newUsers: { cur: signups.length, prev: prevSignups, changePct: growth(signups.length, prevSignups) },
      improved: { repeaters: repeaters.size, pct: pct(improvedUsers.size, repeaters.size) },
      funnel: funnelCounts.map((f) => ({ ...f, pct: pct(f.n, signups.length) })),
    };

    // ความเสี่ยงสูงแยกตามกลุ่มอายุ (กาย/จิต)
    const latest = latestPerUserType(cur);
    const byAge = AGE_GROUPS.map((g) => {
      const inGroup = latest.filter((r) => r.age !== null && r.age >= g.min && r.age <= g.max);
      // คำนวณสัดส่วนความเสี่ยงสูงของกลุ่มอายุ แยกสุขภาพกาย/สุขภาพจิต
      const calc = (mental: boolean) => {
        const rs = inGroup.filter((r) => MENTAL.has(r.name) === mental);
        const users = new Set(rs.map((r) => r.user_id));
        const hi = new Set(rs.filter(high).map((r) => r.user_id));
        return { pct: pct(hi.size, users.size), n: users.size };
      };
      return { label: g.label, physical: calc(false), mental: calc(true) };
    });

    // ปัญหาสุขภาพที่พบความเสี่ยงมากที่สุด 5 อันดับ
    const issueMap = new Map<string, { users: number; risky: number }>();
    for (const r of latest) {
      const v = issueMap.get(r.name) ?? { users: 0, risky: 0 };
      v.users++;
      if (severityOf(r.name, r.risk_level) >= 1) v.risky++;
      issueMap.set(r.name, v);
    }
    const topIssues = Array.from(issueMap.entries())
      .map(([name, v]) => ({ label: typeLabel(name), pct: pct(v.risky, v.users) }))
      .filter((x): x is { label: string; pct: number } => x.pct !== null)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

    // ตารางสรุปรายแบบประเมิน เทียบกับช่วงก่อนหน้า
    const summary = typesRes.rows
      .filter((t) => typeParam === "all" || String(t.assessment_type_id) === typeParam)
      .map((t) => {
        const id = t.assessment_type_id as number;
        const c = cur.filter((r) => r.type_id === id);
        const pv = prev.filter((r) => r.type_id === id);
        const hs = highShare(c);
        return {
          label: typeLabel(t.assessment_name),
          count: c.length,
          users: hs.users >= MIN_GROUP ? hs.users : null,
          highPct: hs.pct,
          change: diffPts(hs.pct, highShare(pv).pct),
          onTime: onTimeRate(series, id, startMs, endMs, nowMs),
        };
      })
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      minGroup: MIN_GROUP,
      range: { from, to, prevFrom, prevTo, days, bucket, current: to === today },
      filters: {
        types: typesRes.rows.map((t) => ({ id: t.assessment_type_id, label: typeLabel(t.assessment_name) })),
        ageGroups: AGE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
      },
      kpi,
      trend,
      usage,
      byAge,
      topIssues,
      summary,
    });
  } catch (error) {
    void logSystemError("GET /api/staff/reports", error);
    console.error("GET /api/staff/reports error:", error);
    return NextResponse.json({ success: false, message: "ไม่สามารถสร้างรายงานได้" }, { status: 500 });
  }
}
