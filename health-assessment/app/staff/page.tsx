"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { relativeTime, staffFetch } from "@/lib/staff/client";
import { ErrorBox, Legend, PageHeader, Segmented, StatCard, btnPrimary } from "./components/ui";

/* =========================================================
   TYPES (ตรงกับ /api/staff/overview)
========================================================= */

type Overview = {
  range: "week" | "month" | "quarter";
  kpi: {
    totalUsers: number;
    newUsers: number;
    assessments: number;
    activeUsers30d: number;
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

const RANGES: { key: Overview["range"]; label: string; noun: string }[] = [
  { key: "week", label: "7 วัน", noun: "7 วันที่ผ่านมา" },
  { key: "month", label: "30 วัน", noun: "30 วันที่ผ่านมา" },
  { key: "quarter", label: "3 เดือน", noun: "3 เดือนที่ผ่านมา" },
];

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/* =========================================================
   PAGE
========================================================= */

export default function StaffOverviewPage() {
  const [range, setRange] = useState<Overview["range"]>("week");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    setName(localStorage.getItem("staffUsername") || "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    staffFetch<Overview>(`/api/staff/overview?range=${range}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const rangeNoun = RANGES.find((r) => r.key === range)?.noun ?? "";
  const maxBar = Math.max(1, ...(data?.chart.map((c) => c.total) ?? [1]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Staff Dashboard"
        title="ภาพรวม"
        highlight="ระบบ"
        desc={`สวัสดี ${name} · ข้อมูล ณ ${new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`}
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

      <ErrorBox message={error} />

      {/* KPI */}
      <section className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
        <StatCard label="ผู้ใช้งานทั้งหมด" value={data?.kpi.totalUsers} note={`+${data?.kpi.newUsers ?? 0} คน ใน ${rangeNoun}`} />
        <StatCard label={`การประเมินใน ${rangeNoun}`} value={data?.kpi.assessments} />
        <StatCard
          label="ผู้มีความเสี่ยงสูงรอติดตาม"
          value={data?.kpi.waiting}
          note={data?.kpi.overdue ? `${data.kpi.overdue} รายรอเกิน 3 วัน` : "ไม่มีเคสค้างเกิน 3 วัน"}
          tone={data?.kpi.waiting ? "danger" : "brand"}
        />
        <StatCard label="ผู้ใช้ที่ประเมินใน 30 วัน" value={data?.kpi.activeUsers30d} note={`จาก ${data?.kpi.totalUsers ?? 0} คน`} />
      </section>

      {/* CHART + URGENT */}
      <section className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[3_1_520px] rounded-[22px] border border-staff-line bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">จำนวนการประเมิน</h2>
            <div className="flex gap-4 text-sm text-staff-muted">
              <Legend color="bg-staff-200" label="ทั้งหมด" />
              <Legend color="bg-risk-high" label="ผลความเสี่ยงสูง" />
            </div>
          </div>
          <div className="flex h-56 items-end gap-3 border-b border-staff-line px-1">
            {(data?.chart ?? []).map((c, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold text-staff-muted">{c.total}</span>
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
          <div className="mt-2 flex gap-3 px-1">
            {(data?.chart ?? []).map((c, i) => (
              <span key={i} className="flex-1 text-center text-xs text-staff-muted">
                {c.label}
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
          <p className="-mt-2 mb-4 text-xs text-staff-muted">คิดจากผลล่าสุดของผู้ใช้แต่ละคน</p>
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
              <p className="py-6 text-center text-sm text-staff-muted">ยังไม่มีผลการประเมิน</p>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-[2_1_340px] rounded-[22px] border border-staff-line bg-white p-6">
          <h2 className="mb-2 text-lg font-bold">กิจกรรมล่าสุด</h2>
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
    </div>
  );
}
