import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireStaff, USER_ROLE_ID } from "@/lib/staff/auth";
import { EXCLUDED_TYPES, severityOf, typeLabel } from "@/lib/staff/riskLevels";
import { loadCustomSeverities } from "@/lib/customAssessments";
import { getNotificationRule } from "@/lib/notificationRules";
import { logSystemError } from "@/lib/errorLogger";

/* =========================================================
   GET /api/staff/reports?months=3|6|12&type=all|<id>&gender=all|male|female&age=all|18-24|25-39|40-59|60+
   รายงานภาพรวมแบบไม่ระบุตัวตน
   - กลุ่มที่มีผู้ใช้น้อยกว่า MIN_GROUP คน จะส่งค่า null (หน้าเว็บแสดง "–")
========================================================= */

const MIN_GROUP = 5;
const GRACE_DAYS = 7; // ประเมินซ้ำช้ากว่ากำหนดไม่เกิน 7 วัน ยังนับว่าตามรอบ
const MENTAL = new Set(["Stress", "9Q", "PHQ-2", "Sleep"]);
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const AGE_GROUPS: { key: string; label: string; min: number; max: number }[] = [
  { key: "18-24", label: "18–24 ปี", min: 0, max: 24 },
  { key: "25-39", label: "25–39 ปี", min: 25, max: 39 },
  { key: "40-59", label: "40–59 ปี", min: 40, max: 59 },
  { key: "60+", label: "60+ ปี", min: 60, max: 200 },
];

type Row = {
  user_id: number;
  type_id: number;
  name: string;
  risk_level: string;
  assessed_at: Date;
  gender: string | null;
  age: number | null;
};

const pct = (n: number, d: number) => (d >= MIN_GROUP ? Math.round((n / d) * 1000) / 10 : null);

// ผลล่าสุดของแต่ละคน/แต่ละแบบ ภายในชุดข้อมูลที่ให้มา
function latestPerUserType(rows: Row[]) {
  const m = new Map<string, Row>();
  for (const r of rows) {
    const k = `${r.user_id}:${r.type_id}`;
    const cur = m.get(k);
    if (!cur || r.assessed_at > cur.assessed_at) m.set(k, r);
  }
  return Array.from(m.values());
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const p = new URL(request.url).searchParams;

  const months = [3, 6, 12].includes(Number(p.get("months"))) ? Number(p.get("months")) : 6;
  const typeParam = p.get("type") ?? "all";
  const gender = ["male", "female"].includes(p.get("gender") ?? "") ? (p.get("gender") as string) : "all";
  const ageGroup = AGE_GROUPS.find((g) => g.key === p.get("age")) ?? null;

  try {
    await loadCustomSeverities();
    const typesRes = await pool.query(
      "SELECT assessment_type_id, assessment_name FROM assessment_types WHERE NOT (assessment_name = ANY($1)) ORDER BY assessment_type_id",
      [EXCLUDED_TYPES]
    );

    // ดึงข้อมูล 2 เท่าของช่วงเวลา เพื่อเทียบกับช่วงก่อนหน้า
    const { rows } = await pool.query<Row>(
      `SELECT a.user_id, a.assessment_type_id AS type_id, t.assessment_name AS name, a.risk_level, a.assessed_at,
              hp.gender, hp.age
         FROM assessment a
         JOIN assessment_types t USING (assessment_type_id)
         JOIN users u ON u.user_id = a.user_id
         LEFT JOIN health_profile hp ON hp.user_id = a.user_id
        WHERE u.role_id = $1
          AND NOT (t.assessment_name = ANY($2))
          AND a.assessed_at >= date_trunc('month', NOW()) - make_interval(months => $3)
          AND ($4 = 'all' OR t.assessment_type_id::text = $4)
          AND ($5 = 'all' OR hp.gender = $5)
          AND ($6::int IS NULL OR hp.age BETWEEN $6 AND $7)`,
      [USER_ROLE_ID, EXCLUDED_TYPES, months * 2 - 1, typeParam, gender, ageGroup?.min ?? null, ageGroup?.max ?? null]
    );

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - (months * 2 - 1), 1);
    const cur = rows.filter((r) => r.assessed_at >= start);
    const prev = rows.filter((r) => r.assessed_at >= prevStart && r.assessed_at < start);
    const high = (r: Row) => severityOf(r.name, r.risk_level) >= 2;

    /* ---------- แนวโน้มรายเดือน ---------- */
    const trend = Array.from({ length: months }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const inMonth = cur.filter((r) => r.assessed_at.getFullYear() === d.getFullYear() && r.assessed_at.getMonth() === d.getMonth());
      // % ผู้ใช้ที่มีผลล่าสุดของเดือนนั้นอยู่ระดับสูงอย่างน้อย 1 แบบ (นิยามเดียวกับหน้าภาพรวม)
      const latestInMonth = latestPerUserType(inMonth);
      const users = new Set(latestInMonth.map((r) => r.user_id));
      const highUsers = new Set(latestInMonth.filter(high).map((r) => r.user_id));
      return {
        label: TH_MONTHS[d.getMonth()],
        total: inMonth.length,
        highPct: pct(highUsers.size, users.size),
        partial: i === months - 1,
      };
    });

    /* ---------- สัดส่วนเสี่ยงสูงตามช่วงอายุ (ใช้ผลล่าสุดของแต่ละคน) ---------- */
    const latest = latestPerUserType(cur);
    const byAge = AGE_GROUPS.map((g) => {
      const inGroup = latest.filter((r) => r.age !== null && r.age >= g.min && r.age <= g.max);
      const calc = (mental: boolean) => {
        const rs = inGroup.filter((r) => MENTAL.has(r.name) === mental);
        const users = new Set(rs.map((r) => r.user_id));
        const hi = new Set(rs.filter(high).map((r) => r.user_id));
        return { pct: pct(hi.size, users.size), n: users.size };
      };
      return { label: g.label, physical: calc(false), mental: calc(true) };
    });

    /* ---------- ปัญหาที่พบมาก: % ผู้ใช้ที่ผลล่าสุด "ควรระวัง" ขึ้นไป ---------- */
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

    /* ---------- สรุปรายแบบประเมิน ---------- */
    const summary = typesRes.rows
      .filter((t) => typeParam === "all" || String(t.assessment_type_id) === typeParam)
      .map((t) => {
        const c = cur.filter((r) => r.type_id === t.assessment_type_id);
        const pv = prev.filter((r) => r.type_id === t.assessment_type_id);
        const users = new Set(c.map((r) => r.user_id)).size;
        const prevUsers = new Set(pv.map((r) => r.user_id)).size;
        // % ผู้ใช้ที่ผลล่าสุดในช่วงนั้นอยู่ระดับสูง (นิยามเดียวกับหน้าภาพรวม)
        const highPct = pct(latestPerUserType(c).filter(high).length, users);
        const prevHigh = pct(latestPerUserType(pv).filter(high).length, prevUsers);
        return {
          label: typeLabel(t.assessment_name),
          count: c.length,
          users: users >= MIN_GROUP ? users : null,
          highPct,
          change: highPct !== null && prevHigh !== null ? Math.round((highPct - prevHigh) * 10) / 10 : null,
          onTime: onTimeRate(rows, t.assessment_type_id, start),
        };
      })
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      minGroup: MIN_GROUP,
      filters: {
        types: typesRes.rows.map((t) => ({ id: t.assessment_type_id, label: typeLabel(t.assessment_name) })),
        ageGroups: AGE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
      },
      totals: { assessments: cur.length, users: new Set(cur.map((r) => r.user_id)).size },
      trend,
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

// อัตราประเมินซ้ำตามรอบ: จากผลที่ครบกำหนดประเมินซ้ำแล้วในช่วงนี้ มีกี่ % ที่ผู้ใช้กลับมาทำภายในกำหนด (+GRACE_DAYS)
function onTimeRate(rows: Row[], typeId: number, start: Date) {
  const byUser = new Map<number, Row[]>();
  for (const r of rows) {
    if (r.type_id !== typeId) continue;
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }
  let due = 0;
  let ok = 0;
  const users = new Set<number>();
  const now = Date.now();
  for (const [uid, list] of byUser) {
    list.sort((a, b) => +a.assessed_at - +b.assessed_at);
    list.forEach((r, i) => {
      const dueAt = +r.assessed_at + getNotificationRule(typeId, r.risk_level).intervalDays * 86_400_000;
      if (dueAt < +start || dueAt + GRACE_DAYS * 86_400_000 > now) return; // ยังไม่ถึงกำหนด หรืออยู่นอกช่วง
      due++;
      users.add(uid);
      const next = list[i + 1];
      if (next && +next.assessed_at <= dueAt + GRACE_DAYS * 86_400_000) ok++;
    });
  }
  return pct(ok, users.size >= MIN_GROUP ? due : 0);
}
