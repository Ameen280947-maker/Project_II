"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, FileText, Lock } from "lucide-react";
import { downloadCsv, staffFetch } from "@/lib/staff/client";
import { Card, Empty, ErrorBox, Legend, PageHeader, Segmented, btnGhost, btnPrimary, inputCls } from "../components/ui";

/* =========================================================
   TYPES (ตรงกับ /api/staff/reports)
   ค่า null = กลุ่มเล็กกว่าเกณฑ์ ไม่แสดงตัวเลขเพื่อป้องกันการระบุตัวบุคคล
========================================================= */

type Report = {
  minGroup: number;
  filters: { types: { id: number; label: string }[]; ageGroups: { key: string; label: string }[] };
  totals: { assessments: number; users: number };
  trend: { label: string; total: number; highPct: number | null; partial: boolean }[];
  byAge: { label: string; physical: { pct: number | null; n: number }; mental: { pct: number | null; n: number } }[];
  topIssues: { label: string; pct: number }[];
  summary: { label: string; count: number; users: number | null; highPct: number | null; change: number | null; onTime: number | null }[];
};

type Metric = "total" | "highPct";

// สีชุดข้อมูลกราฟ (ผ่านการตรวจความต่างสี/ตาบอดสีแล้ว)
const C_PHYSICAL = "#0a9a8c";
const C_MENTAL = "#9a7cf0";

const fmt = (v: number | null, suffix = "%") => (v === null ? "–" : `${v.toLocaleString("th-TH")}${suffix}`);

/* =========================================================
   PAGE
========================================================= */

export default function ReportsPage() {
  const [months, setMonths] = useState("6");
  const [type, setType] = useState("all");
  const [gender, setGender] = useState("all");
  const [age, setAge] = useState("all");
  const [metric, setMetric] = useState<Metric>("total");
  const [data, setData] = useState<Report | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");

  const qs = new URLSearchParams({ months, type, gender, age }).toString();
  const loading = loadedKey !== qs;

  useEffect(() => {
    let cancelled = false;
    staffFetch<Report>(`/api/staff/reports?${qs}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError("");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadedKey(qs));
    return () => {
      cancelled = true;
    };
  }, [qs]);

  const exportCsv = () => {
    if (!data) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`staff-report-${stamp}.csv`, [
      ["สรุปรายแบบประเมิน", `ช่วง ${months} เดือนล่าสุด`],
      ["แบบประเมิน", "จำนวนครั้ง", "ผู้ใช้", "ความเสี่ยงสูง (%)", "เทียบช่วงก่อน (จุด%)", "ประเมินซ้ำตามรอบ (%)"],
      ...data.summary.map((s) => [s.label, s.count, s.users ?? "–", s.highPct ?? "–", s.change ?? "–", s.onTime ?? "–"]),
      [],
      ["แนวโน้มรายเดือน"],
      ["เดือน", "จำนวนการประเมิน", "ความเสี่ยงสูง (%)"],
      ...data.trend.map((t) => [t.label, t.total, t.highPct ?? "–"]),
      [],
      ["สัดส่วนผู้มีความเสี่ยงสูงแยกตามช่วงอายุ"],
      ["ช่วงอายุ", "สุขภาพกาย (%)", "สุขภาพจิต (%)"],
      ...data.byAge.map((a) => [a.label, a.physical.pct ?? "–", a.mental.pct ?? "–"]),
      [],
      ["ปัญหาสุขภาพที่พบมากที่สุด", "% ผู้ใช้ที่ผลล่าสุดระดับควรระวังขึ้นไป"],
      ...data.topIssues.map((t) => [t.label, t.pct]),
      [],
      [`กลุ่มที่มีผู้ใช้น้อยกว่า ${data.minGroup} คนแสดงเป็น –`],
    ]);
  };

  const peak = useMemo(() => {
    const full = data?.trend.filter((t) => !t.partial) ?? [];
    return full.length ? full.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reports"
        title="รายงานและ"
        highlight="สถิติ"
        desc="สรุปผลภาพรวมแบบไม่ระบุตัวตน สำหรับวางแผนและรายงานผู้บริหาร"
        actions={
          <>
            <button type="button" onClick={() => window.print()} disabled={!data} className={btnPrimary}>
              <FileText size={17} /> PDF
            </button>
            <button type="button" onClick={exportCsv} disabled={!data} className={btnGhost} title="เปิดใน Excel ได้ทันที">
              <Download size={17} /> Excel / CSV
            </button>
          </>
        }
      />

      <Card className="staff-no-print !py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label="ช่วงเวลา" value={months} onChange={setMonths}>
            <option value="3">3 เดือนล่าสุด</option>
            <option value="6">6 เดือนล่าสุด</option>
            <option value="12">12 เดือนล่าสุด</option>
          </Filter>
          <Filter label="แบบประเมิน" value={type} onChange={setType}>
            <option value="all">ทุกแบบประเมิน</option>
            {data?.filters.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Filter>
          <Filter label="เพศ" value={gender} onChange={setGender}>
            <option value="all">ทั้งหมด</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
          </Filter>
          <Filter label="ช่วงอายุ" value={age} onChange={setAge}>
            <option value="all">ทุกช่วงอายุ</option>
            {data?.filters.ageGroups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </Filter>
        </div>
      </Card>

      <ErrorBox message={error} />

      <div className={`flex flex-col gap-4 ${loading ? "opacity-60" : ""}`}>
        {/* TREND */}
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">แนวโน้มรายเดือน</h2>
            <div className="staff-no-print">
              <Segmented
                label="ตัวชี้วัด"
                value={metric}
                onChange={setMetric}
                items={[
                  { key: "total", label: "จำนวนการประเมิน" },
                  { key: "highPct", label: "% ความเสี่ยงสูง" },
                ]}
              />
            </div>
          </div>
          {data && <TrendChart data={data.trend} metric={metric} />}
          {data && (
            <p className="mt-2 text-sm text-staff-muted">
              รวม {data.totals.assessments.toLocaleString("th-TH")} ครั้ง จากผู้ใช้ {data.totals.users.toLocaleString("th-TH")} คน
              {peak && peak.total > 0 ? ` · สูงสุดในเดือน ${peak.label} (${peak.total} ครั้ง)` : ""} · ข้อมูลเดือนล่าสุดยังไม่ครบเดือน
            </p>
          )}
        </Card>

        <div className="flex flex-wrap gap-4">
          {/* BY AGE */}
          <Card className="flex-[3_1_480px]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">สัดส่วนผู้มีความเสี่ยงสูง แยกตามช่วงอายุ</h2>
              <div className="flex gap-4 text-sm text-staff-muted">
                <Legend color="bg-[#0a9a8c]" label="สุขภาพกาย" />
                <Legend color="bg-[#9a7cf0]" label="สุขภาพจิต" />
              </div>
            </div>
            {data && <AgeChart data={data.byAge} />}
          </Card>

          {/* TOP ISSUES */}
          <Card className="flex-[2_1_320px]">
            <h2 className="mb-4 text-lg font-bold">ปัญหาสุขภาพที่พบมากที่สุด</h2>
            <ol className="flex flex-col gap-3.5">
              {data?.topIssues.map((t, i) => (
                <li key={t.label} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-staff-100 text-sm font-bold text-staff-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-semibold">{t.label}</span>
                      <span className="font-semibold">{t.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-staff-bg">
                      <div className="h-full rounded-full bg-staff-500" style={{ width: `${t.pct}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {data && data.topIssues.length === 0 && <Empty>ข้อมูลยังไม่พอสำหรับสรุป</Empty>}
            <p className="mt-4 text-xs text-staff-muted">ร้อยละของผู้ใช้ที่ผลล่าสุดอยู่ในระดับควรระวังขึ้นไป</p>
          </Card>
        </div>

        {/* SUMMARY TABLE */}
        <Card>
          <h2 className="mb-3 text-lg font-bold">สรุปรายแบบประเมิน</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-staff-line text-xs text-staff-muted">
                  <th className="py-3 pr-3 text-left font-semibold">แบบประเมิน</th>
                  <th className="px-3 text-right font-semibold">จำนวนครั้ง</th>
                  <th className="px-3 text-right font-semibold">ผู้ใช้</th>
                  <th className="px-3 text-right font-semibold">ความเสี่ยงสูง</th>
                  <th className="px-3 text-right font-semibold">เทียบช่วงก่อน</th>
                  <th className="pl-3 text-right font-semibold">ประเมินซ้ำตามรอบ</th>
                </tr>
              </thead>
              <tbody>
                {data?.summary.map((s) => (
                  <tr key={s.label} className="border-b border-staff-line/70 last:border-0">
                    <td className="py-3 pr-3 font-semibold">{s.label}</td>
                    <td className="px-3 text-right">{s.count.toLocaleString("th-TH")}</td>
                    <td className="px-3 text-right">{fmt(s.users, "")}</td>
                    <td className="px-3 text-right font-bold">{fmt(s.highPct)}</td>
                    <td className={`px-3 text-right font-semibold ${s.change === null || s.change === 0 ? "text-staff-muted" : s.change > 0 ? "text-risk-crit" : "text-staff-700"}`}>
                      {s.change === null ? "–" : `${s.change > 0 ? "▲ +" : s.change < 0 ? "▼ " : ""}${s.change}%`}
                    </td>
                    <td className="pl-3 text-right">{fmt(s.onTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-staff-muted">
            <Lock size={13} /> รายงานแสดงเฉพาะข้อมูลรวม กลุ่มที่มีผู้ใช้น้อยกว่า {data?.minGroup ?? 5} คนจะไม่แสดงตัวเลข (–) เพื่อป้องกันการระบุตัวบุคคล
          </p>
        </Card>
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-staff-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} font-medium`}>
        {children}
      </select>
    </label>
  );
}

/* =========================================================
   กราฟเส้นแนวโน้ม (SVG + เส้นชี้/กล่องข้อมูลเมื่อชี้)
========================================================= */

function TrendChart({ data, metric }: { data: Report["trend"]; metric: Metric }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 240;
  const pad = { l: 40, r: 16, t: 16, b: 30 };
  const vals = data.map((d) => (metric === "total" ? d.total : d.highPct));
  const maxRaw = Math.max(1, ...vals.map((v) => v ?? 0));
  const step = niceStep(maxRaw);
  const max = Math.ceil(maxRaw / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const x = (i: number) => pad.l + (data.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const pts = vals.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)));
  const valid = pts.filter((p): p is readonly [number, number] => p !== null);
  const line = valid.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = valid.length > 1 ? `${line} L${valid[valid.length - 1][0]},${y(0)} L${valid[0][0]},${y(0)} Z` : "";
  const unit = metric === "total" ? " ครั้ง" : "%";

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="กราฟแนวโน้มรายเดือน" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e6efed" strokeDasharray={t ? "3 4" : undefined} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#557270">
              {t}
            </text>
          </g>
        ))}
        {area && <path d={area} fill="#0aa898" opacity="0.1" />}
        <path d={line} fill="none" stroke="#05827a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke="#98eee0" strokeWidth="1.5" />}
        {pts.map(
          (p, i) =>
            p && (
              <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 6 : 4.5} fill="white" stroke="#05827a" strokeWidth="2" strokeDasharray={data[i].partial ? "2 2" : undefined} />
            )
        )}
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#557270">
            {d.label}
          </text>
        ))}
        {/* พื้นที่รับการชี้ (กว้างกว่าจุด) */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - pad.l - pad.r) / Math.max(1, data.length - 1) / 2}
            y={0}
            width={(W - pad.l - pad.r) / Math.max(1, data.length - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-xl border border-staff-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="font-bold">
            {data[hover].label}
            {data[hover].partial ? " (ยังไม่ครบเดือน)" : ""}
          </p>
          <p className="text-staff-muted">
            {metric === "total" ? "จำนวนการประเมิน" : "ความเสี่ยงสูง"}: <b className="text-staff-ink">{fmt(vals[hover], unit)}</b>
          </p>
        </div>
      )}
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/* =========================================================
   กราฟแท่งช่วงอายุ (กาย / จิต)
========================================================= */

function AgeChart({ data }: { data: Report["byAge"] }) {
  const max = Math.max(10, ...data.flatMap((d) => [d.physical.pct ?? 0, d.mental.pct ?? 0]));
  const bar = (v: { pct: number | null; n: number }, color: string, kind: string, group: string) => (
    <div className="flex h-full w-full max-w-[44px] flex-col items-center justify-end gap-1" title={`${group} · ${kind}: ${fmt(v.pct)} (ผู้ใช้ ${v.n} คน)`}>
      <span className="text-xs font-semibold text-staff-ink">{fmt(v.pct)}</span>
      <div
        className="w-full rounded-t-[4px]"
        style={{ height: v.pct === null ? 2 : `${Math.max(2, (v.pct / max) * 80)}%`, background: v.pct === null ? "#dcebe8" : color }}
      />
    </div>
  );
  return (
    <div>
      <div className="flex h-52 items-end gap-4 border-b border-staff-line">
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 items-end justify-center gap-[2px]">
            {bar(d.physical, C_PHYSICAL, "สุขภาพกาย", d.label)}
            {bar(d.mental, C_MENTAL, "สุขภาพจิต", d.label)}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-xs text-staff-muted">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
