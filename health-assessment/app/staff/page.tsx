"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { relativeTime, staffFetch } from "@/lib/staff/client";
import { ErrorBox, Legend, PageHeader, Segmented, StatCard, btnPrimary, inputCls } from "./components/ui";
import OverviewDetail, { type DetailKind } from "./components/OverviewDetail";

/* =========================================================
   TYPES (ตรงกับ /api/staff/overview)
========================================================= */

type Overview = {
  from: string;
  to: string;
  bucket: "hour" | "day" | "week" | "month";
  kpi: {
    totalUsers: number;
    newUsers: number;
    assessments: number;
    highRisk: number;
    activeUsers: number;
    waiting: number;
    overdue: number;
  };
  chart: { label: string; total: number; high: number }[];
  urgent: {
    caseId: number;
    username: string;
    assessment: string;
    riskLevel: string;
    severity: number;
    createdAt: string;
  }[];
  distribution: { name: string; total: number; ok: number; mid: number; high: number }[];
  activity: { type: "assessment" | "high" | "note"; text: string; at: string }[];
};

/* ---------- ช่วงเวลา (ตามเวลาไทย) ---------- */

type RangeKey = "today" | "week" | "month" | "quarter" | "year" | "custom";

// days = จำนวนวันย้อนหลังรวมวันนี้
const RANGES: { key: RangeKey; label: string; noun: string; days?: number }[] = [
  { key: "today", label: "วันนี้", noun: "วันนี้", days: 1 },
  { key: "week", label: "7 วัน", noun: "7 วันที่ผ่านมา", days: 7 },
  { key: "month", label: "30 วัน", noun: "30 วันที่ผ่านมา", days: 30 },
  { key: "quarter", label: "3 เดือน", noun: "3 เดือนที่ผ่านมา", days: 90 },
  { key: "year", label: "1 ปี", noun: "1 ปีที่ผ่านมา", days: 365 },
  { key: "custom", label: "กำหนดเอง", noun: "ช่วงที่เลือก" },
];

const todayInBangkok = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

const shiftDate = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const formatThaiDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/* =========================================================
   PAGE
========================================================= */

export default function StaffOverviewPage() {
  const today = todayInBangkok();
  const [range, setRange] = useState<RangeKey>("week");
  // ช่วงที่กำหนดเอง (ค่าเริ่มต้น 7 วันล่าสุด)
  const [customFrom, setCustomFrom] = useState(() => shiftDate(todayInBangkok(), -6));
  const [customTo, setCustomTo] = useState(() => todayInBangkok());
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  // กล่องที่กดดูรายละเอียดอยู่
  const [detail, setDetail] = useState<DetailKind | null>(null);

  useEffect(() => {
    setName(localStorage.getItem("staffUsername") || "");
  }, []);

  const preset = RANGES.find((r) => r.key === range);
  const from = range === "custom" ? customFrom : shiftDate(today, -((preset?.days ?? 7) - 1));
  const to = range === "custom" ? customTo : today;
  const customInvalid = range === "custom" && (!customFrom || !customTo || customFrom > customTo);

  useEffect(() => {
    if (customInvalid) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    staffFetch<Overview>(`/api/staff/overview?from=${from}&to=${to}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to, customInvalid]);

  const rangeNoun = preset?.noun ?? "";
  const rangeText = from === to ? formatThaiDate(from) : `${formatThaiDate(from)} – ${formatThaiDate(to)}`;
  const maxBar = Math.max(1, ...(data?.chart.map((c) => c.total) ?? [1]));
  // แท่งเยอะ (เช่น 30 วัน / รายชั่วโมง) แสดงป้ายเว้นช่วง ไม่ให้ตัวหนังสือซ้อนกัน
  const chartLen = data?.chart.length ?? 0;
  const labelStep = Math.max(1, Math.ceil(chartLen / 12));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Staff Dashboard"
        title="ภาพรวม"
        highlight="ระบบ"
        desc={`สวัสดี ${name} · ข้อมูลช่วง ${rangeText}`}
        actions={
          <>
            <Segmented label="ช่วงเวลา" items={RANGES} value={range} onChange={setRange} />
            <Link href="/staff/reports" className={btnPrimary}>
              <Download size={18} />
              ส่งออกรายงาน
            </Link>
          </>
        }
      />

      {range === "custom" && (
        <div className="flex flex-wrap items-end gap-3 rounded-[22px] border border-staff-line bg-white p-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            ตั้งแต่วันที่
            <input
              type="date"
              className={inputCls}
              value={customFrom}
              max={customTo || today}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            ถึงวันที่
            <input
              type="date"
              className={inputCls}
              value={customTo}
              min={customFrom}
              max={today}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
          {customInvalid && <p className="pb-2.5 text-sm text-risk-crit">กรุณาเลือกวันเริ่มต้นที่ไม่อยู่หลังวันสิ้นสุด</p>}
        </div>
      )}

      <ErrorBox message={error} />

      {/* KPI */}
      <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
        <StatCard
          label="ผู้ใช้งานทั้งหมด"
          value={data?.kpi.totalUsers}
          note={`+${data?.kpi.newUsers ?? 0} คน ใน ${rangeNoun}`}
          onClick={() => setDetail("users")}
        />
        <StatCard
          label={`การประเมินใน ${rangeNoun}`}
          value={data?.kpi.assessments}
          note={`ผลความเสี่ยงสูง ${data?.kpi.highRisk ?? 0} ครั้ง`}
          onClick={() => setDetail("assessments")}
        />
        <StatCard
          label="ผู้มีความเสี่ยงสูงรอติดตาม (ปัจจุบัน)"
          value={data?.kpi.waiting}
          note={data?.kpi.overdue ? `${data.kpi.overdue} รายรอเกิน 3 วัน` : "ไม่มีเคสค้างเกิน 3 วัน"}
          tone={data?.kpi.waiting ? "danger" : "brand"}
          onClick={() => setDetail("waiting")}
        />
        <StatCard
          label={`ผู้ใช้ที่ประเมินใน ${rangeNoun}`}
          value={data?.kpi.activeUsers}
          note={`จาก ${data?.kpi.totalUsers ?? 0} คน`}
          onClick={() => setDetail("active")}
        />
      </section>

      {/* CHART + URGENT */}
      <section className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[3_1_520px] rounded-[22px] border border-staff-line bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              จำนวนการประเมิน
              <span className="ml-2 text-sm font-medium text-staff-muted">
                {data?.bucket === "hour" ? "รายชั่วโมง" : data?.bucket === "week" ? "รายสัปดาห์" : data?.bucket === "month" ? "รายเดือน" : "รายวัน"}
              </span>
            </h2>
            <div className="flex gap-4 text-sm text-staff-muted">
              <Legend color="bg-staff-200" label="ทั้งหมด" />
              <Legend color="bg-risk-high" label="ผลความเสี่ยงสูง" />
            </div>
          </div>
          <div className={`flex h-56 items-end border-b border-staff-line px-1 ${chartLen > 14 ? "gap-1" : "gap-3"}`}>
            {(data?.chart ?? []).map((c, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                {(chartLen <= 14 || c.total > 0) && (
                  <span className="text-[11px] font-semibold text-staff-muted">{c.total}</span>
                )}
                <div
                  className="flex w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-t-lg bg-staff-200 transition-all"
                  style={{ height: `${(c.total / maxBar) * 85}%` }}
                  title={`${c.label}: ทั้งหมด ${c.total} · ความเสี่ยงสูง ${c.high}`}
                >
                  <div className="bg-risk-high" style={{ height: c.total ? `${(c.high / c.total) * 100}%` : 0 }} />
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-2 flex px-1 ${chartLen > 14 ? "gap-1" : "gap-3"}`}>
            {(data?.chart ?? []).map((c, i) => (
              <span key={i} className="flex-1 whitespace-nowrap text-center text-xs text-staff-muted">
                {i % labelStep === 0 ? c.label : ""}
              </span>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-2.5 rounded-[22px] border border-staff-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">ต้องติดตามด่วน</h2>
            <Link href="/staff/follow-up" className="py-2 text-sm font-semibold text-staff-600 hover:underline">
              ดูทั้งหมด →
            </Link>
          </div>
          {data && data.urgent.length === 0 && (
            <p className="py-8 text-center text-sm text-staff-muted">ไม่มีเคสรอติดตาม</p>
          )}
          {data?.urgent.map((u) => {
            const wait = daysSince(u.createdAt);
            return (
              <Link
                key={u.caseId}
                href={`/staff/follow-up?case=${u.caseId}`}
                className="flex items-center gap-3 rounded-2xl border border-staff-bg bg-staff-soft px-3 py-2.5 transition hover:border-staff-200"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fde6e7] text-sm font-bold text-risk-crit">
                  {u.username.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{u.username}</span>
                  <span className="block truncate text-[13px] text-staff-muted">
                    {u.assessment} · {u.riskLevel}
                  </span>
                </span>
                <span className={`whitespace-nowrap text-xs font-semibold ${wait >= 3 ? "text-risk-high" : "text-staff-muted"}`}>
                  {wait === 0 ? "วันนี้" : `รอ ${wait} วัน`}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* DISTRIBUTION + ACTIVITY */}
      <section className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[3_1_520px] rounded-[22px] border border-staff-line bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">สัดส่วนระดับความเสี่ยงตามแบบประเมิน</h2>
            <div className="flex gap-4 text-sm text-staff-muted">
              <Legend color="bg-risk-ok" label="ปกติ" />
              <Legend color="bg-risk-mid" label="ควรระวัง" />
              <Legend color="bg-risk-high" label="สูง" />
            </div>
          </div>
          <p className="-mt-2 mb-4 text-xs text-staff-muted">คิดจากผลล่าสุดของผู้ใช้แต่ละคนใน{rangeNoun}</p>
          <div className="flex flex-col gap-3">
            {(data?.distribution ?? []).map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-sm font-medium" title={d.name}>
                  {d.name}
                </span>
                <div className="flex h-3.5 flex-1 overflow-hidden rounded-full bg-staff-bg" title={`${d.total} คน`}>
                  <span className="bg-risk-ok" style={{ width: `${d.ok}%` }} />
                  <span className="bg-risk-mid" style={{ width: `${d.mid}%` }} />
                  <span className="bg-risk-high" style={{ width: `${d.high}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-risk-crit">สูง {d.high}%</span>
              </div>
            ))}
            {data && data.distribution.length === 0 && (
              <p className="py-6 text-center text-sm text-staff-muted">ไม่มีผลการประเมินในช่วงนี้</p>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-[2_1_340px] rounded-[22px] border border-staff-line bg-white p-6">
          <h2 className="mb-2 text-lg font-bold">กิจกรรมล่าสุด</h2>
          {data && data.activity.length === 0 && (
            <p className="py-6 text-center text-sm text-staff-muted">ไม่มีกิจกรรมในช่วงนี้</p>
          )}
          <div className="divide-y divide-staff-bg">
            {(data?.activity ?? []).map((a, i) => (
              <div key={i} className="flex gap-3 py-2.5">
                <span
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                    a.type === "high" ? "bg-risk-high" : a.type === "note" ? "bg-staff-600" : "bg-staff-300"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm">{a.text}</p>
                  <p className="text-xs text-staff-muted">{relativeTime(a.at)}</p>
                </div>
              </div>
            ))}
          </div>
          {data && data.activity.length > 0 && (
            <Link href="/staff/follow-up" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-staff-600">
              ไปหน้าติดตาม <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </section>
      {detail && !customInvalid && (
        <OverviewDetail kind={detail} from={from} to={to} rangeText={rangeText} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
