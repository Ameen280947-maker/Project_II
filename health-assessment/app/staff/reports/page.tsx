"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download, FileText, Lock } from "lucide-react";
import { downloadCsv, staffFetch } from "@/lib/staff/client";
import { Card, Empty, ErrorBox, PageHeader, Segmented, StatCard, btnGhost, btnPrimary, inputCls } from "../components/ui";
import DateRangePicker, { rangeText, useDateRange } from "../components/DateRangePicker";
import {
  AgeBars,
  BarLegend,
  C_BAR,
  Funnel,
  HATCH,
  RankedBars,
  TrendBars,
  fmt,
  type AgePoint,
  type FunnelStep,
  type TrendPoint,
} from "../components/reports/ReportCharts";

/* =========================================================
   TYPES (ตรงกับ /api/staff/reports)
   ค่า null = กลุ่มเล็กกว่าเกณฑ์ ไม่แสดงตัวเลขเพื่อป้องกันการระบุตัวบุคคล
========================================================= */

type Bucket = "day" | "week" | "month";

type Report = {
  minGroup: number;
  range: { from: string; to: string; prevFrom: string; prevTo: string; days: number; bucket: Bucket; current: boolean };
  filters: { types: { id: number; label: string }[]; ageGroups: { key: string; label: string }[] };
  kpi: {
    assessments: { cur: number; prev: number; changePct: number | null };
    users: { cur: number; perUser: number | null };
    high: { pct: number | null; n: number | null };
    onTime: { pct: number | null; change: number | null };
  };
  trend: TrendPoint[];
  usage: {
    newUsers: { cur: number; prev: number; changePct: number | null };
    improved: { repeaters: number; pct: number | null };
    funnel: FunnelStep[];
  };
  byAge: AgePoint[];
  topIssues: { label: string; pct: number }[];
  summary: { label: string; count: number; users: number | null; highPct: number | null; change: number | null; onTime: number | null }[];
};

type Metric = "total" | "highPct";

const BUCKET_TEXT: Record<Bucket, { title: string; unit: string; partial: string }> = {
  month: { title: "แนวโน้มรายเดือน", unit: "เดือน", partial: "เดือนปัจจุบันซึ่งยังไม่ครบเดือน" },
  week: { title: "แนวโน้มรายสัปดาห์", unit: "สัปดาห์", partial: "สัปดาห์ปัจจุบันซึ่งยังไม่ครบสัปดาห์" },
  day: { title: "แนวโน้มรายวัน", unit: "วัน", partial: "วันนี้ซึ่งยังไม่สิ้นสุดวัน" },
};

const num = (n: number) => n.toLocaleString("th-TH");

// ▲ +12.5% / ▼ 3% / 0% · suffix เช่น "%" หรือ " จุด"
const delta = (v: number | null, suffix = "%") =>
  v === null ? null : v > 0 ? `▲ +${num(v)}${suffix}` : v < 0 ? `▼ ${num(Math.abs(v))}${suffix}` : `0${suffix}`;

/* =========================================================
   PAGE
========================================================= */

export default function ReportsPage() {
  const dr = useDateRange();
  const { range } = dr;
  const [type, setType] = useState("all");
  const [gender, setGender] = useState("all");
  const [age, setAge] = useState("all");
  const [metric, setMetric] = useState<Metric>("total");
  const [data, setData] = useState<Report | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");

  const qs = new URLSearchParams({ from: range.from, to: range.to, type, gender, age }).toString();
  const loading = !range.invalid && loadedKey !== qs;

  useEffect(() => {
    if (range.invalid) return;
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
  }, [qs, range.invalid]);

  const typeText = type === "all" ? "ทุกแบบประเมิน" : (data?.filters.types.find((t) => String(t.id) === type)?.label ?? "-");
  const genderText = { all: "ทุกเพศ", male: "ชาย", female: "หญิง" }[gender] ?? "-";
  const ageText = age === "all" ? "ทุกช่วงอายุ" : (data?.filters.ageGroups.find((g) => g.key === age)?.label ?? "-");
  const periodText = data ? rangeText(data.range.from, data.range.to) : rangeText(range.from, range.to);
  const prevText = data ? rangeText(data.range.prevFrom, data.range.prevTo) : "";

  const exportCsv = () => {
    if (!data) return;
    const { kpi, usage, range: r } = data;
    const bt = BUCKET_TEXT[r.bucket];
    const dash = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v);
    downloadCsv(`report_${r.from}_${r.to}.csv`, [
      [`ช่วงข้อมูล ${rangeText(r.from, r.to)} (${r.from} ถึง ${r.to})`],
      ["รายงานและสถิติ (ไม่ระบุตัวตน)"],
      ["ช่วงเวลา", `${r.from} ถึง ${r.to}`, "ช่วงก่อน (เทียบ)", `${r.prevFrom} ถึง ${r.prevTo}`],
      ["แบบประเมิน", typeText, "เพศ", genderText, "ช่วงอายุ", ageText],
      [],
      ["ตัวชี้วัดหลัก", "ค่า", "ช่วงก่อน", "เปลี่ยนแปลง"],
      ["การประเมินทั้งหมด (ครั้ง)", kpi.assessments.cur, kpi.assessments.prev, kpi.assessments.changePct === null ? "–" : `${kpi.assessments.changePct}%`],
      ["ผู้ใช้ที่ประเมิน (คน)", kpi.users.cur, "", ""],
      ["เฉลี่ยครั้งต่อคน", dash(kpi.users.perUser), "", ""],
      ["ผลล่าสุดอยู่ระดับสูง (%)", dash(kpi.high.pct), "", ""],
      ["ผลล่าสุดอยู่ระดับสูง (คน)", dash(kpi.high.n), "", ""],
      ["ประเมินซ้ำตามรอบที่แนะนำ (%)", dash(kpi.onTime.pct), "", kpi.onTime.change === null ? "–" : `${kpi.onTime.change} จุด`],
      [],
      [bt.title],
      [bt.unit, "จำนวนการประเมิน", "ความเสี่ยงสูง (%)", "หมายเหตุ"],
      ...data.trend.map((t) => [t.key, t.total, dash(t.highPct), t.partial ? "ยังไม่ครบช่วง" : ""]),
      [],
      ["การใช้งานของผู้ใช้", "ค่า", "ช่วงก่อน", "เปลี่ยนแปลง"],
      ["ผู้ใช้ใหม่ในช่วงนี้ (คน)", usage.newUsers.cur, usage.newUsers.prev, usage.newUsers.changePct === null ? "–" : `${usage.newUsers.changePct}%`],
      ["ผลดีขึ้นเมื่อประเมินซ้ำ (% ของผู้ที่ทำซ้ำ)", dash(usage.improved.pct), "", ""],
      [],
      ["เส้นทางผู้ใช้ (ช่วงที่เลือก)", "จำนวน (คน)", "ร้อยละของผู้สมัคร"],
      ...usage.funnel.map((f) => [f.label, f.n, dash(f.pct)]),
      [],
      ["ความเสี่ยงสูง แยกตามช่วงอายุ", "สุขภาพกาย (%)", "สุขภาพจิต (%)"],
      ...data.byAge.map((a) => [a.label, dash(a.physical.pct), dash(a.mental.pct)]),
      [],
      ["ปัญหาสุขภาพที่พบมากที่สุด", "% ผู้ใช้ที่ผลล่าสุดระดับควรระวังขึ้นไป"],
      ...data.topIssues.map((t) => [t.label, t.pct]),
      [],
      ["สรุปรายแบบประเมิน"],
      ["แบบประเมิน", "จำนวนครั้ง", "ผู้ใช้", "ความเสี่ยงสูง (%)", "เทียบช่วงก่อน (จุด%)", "ประเมินซ้ำตามรอบ (%)"],
      ...data.summary.map((s) => [s.label, s.count, dash(s.users), dash(s.highPct), dash(s.change), dash(s.onTime)]),
      [],
      [`นับเฉพาะผู้ใช้ที่ยินยอมให้ประมวลผลข้อมูลสุขภาพ · กลุ่มที่มีผู้ใช้น้อยกว่า ${data.minGroup} คนแสดงเป็น –`],
    ]);
  };

  const bt = BUCKET_TEXT[data?.range.bucket ?? "month"];
  const trendEmpty = !!data && data.trend.every((t) => (metric === "total" ? t.total === 0 : t.highPct === null));
  const hasPartial = !!data?.trend.some((t) => t.partial);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="REPORTS"
        title="รายงานและ"
        highlight="สถิติ"
        desc="สรุปผลภาพรวมแบบไม่ระบุตัวตน สำหรับวางแผนและรายงานผู้บริหาร"
        actions={
          <>
            <button type="button" onClick={exportCsv} disabled={!data} className={btnGhost} title="เปิดใน Excel ได้ทันที">
              <Download size={17} /> ส่งออก CSV
            </button>
            <button type="button" onClick={() => window.print()} disabled={!data} className={btnPrimary}>
              <FileText size={17} /> พิมพ์ / บันทึก PDF
            </button>
          </>
        }
      />

      {/* FILTERS */}
      <Card className="staff-no-print !py-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[auto_repeat(3,minmax(0,1fr))] lg:items-start">
          <div className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-staff-muted sm:col-span-3 lg:col-span-1 [&>div]:items-start">
            ช่วงเวลา
            <DateRangePicker state={dr} />
          </div>
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

      {/* ตัวกรองที่ใช้ (แสดงเฉพาะตอนพิมพ์) */}
      <p className="hidden text-sm text-staff-muted print:block">
        ช่วงเวลา {periodText} (เทียบกับ {prevText}) · {typeText} · {genderText} · {ageText}
      </p>

      <ErrorBox message={error} />

      <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
        {/* KPI */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="การประเมินทั้งหมด"
            value={data ? num(data.kpi.assessments.cur) : undefined}
            note={data ? <DeltaNote text={delta(data.kpi.assessments.changePct)} fallback="ไม่มีข้อมูลช่วงก่อนให้เทียบ" /> : null}
          />
          <StatCard
            label="ผู้ใช้ที่ประเมิน"
            value={data ? num(data.kpi.users.cur) : undefined}
            note={data ? (data.kpi.users.perUser === null ? "ยังไม่มีการประเมิน" : `เฉลี่ย ${num(data.kpi.users.perUser)} ครั้งต่อคน`) : null}
          />
          <StatCard
            label="ผลล่าสุดอยู่ระดับสูง"
            tone="danger"
            value={data ? fmt(data.kpi.high.pct) : undefined}
            note={data ? (data.kpi.high.n === null ? `ผู้ใช้น้อยกว่า ${data.minGroup} คน` : `${num(data.kpi.high.n)} คน`) : null}
          />
          <StatCard
            label="ประเมินซ้ำตามรอบที่แนะนำ"
            value={data ? fmt(data.kpi.onTime.pct) : undefined}
            note={data ? <DeltaNote text={delta(data.kpi.onTime.change, " จุด")} fallback="ยังไม่มีข้อมูลพอสำหรับเทียบ" /> : null}
          />
        </div>

        {/* TREND */}
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{bt.title}</h2>
              <p className="text-xs text-staff-muted">
                {rangeText(range.from, range.to)} · {metric === "total" ? "จำนวนการประเมิน (ครั้ง)" : "% ผู้ใช้ที่ผลล่าสุดอยู่ระดับสูง"}
              </p>
            </div>
            <div className="staff-no-print max-w-full overflow-x-auto">
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
          {/* ระหว่างโหลดช่วงใหม่ ไม่แสดงแท่งของช่วงเดิม (กันกราฟไม่ตรงกับช่วงที่เลือก) */}
          {loading ? (
            <div className="h-56 animate-pulse rounded-2xl bg-staff-soft" />
          ) : (
            data && (trendEmpty ? <Empty>ยังไม่มีข้อมูลในช่วงเวลานี้</Empty> : <TrendBars data={data.trend} metric={metric} />)
          )}
          {data && !loading && !trendEmpty && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-staff-muted">
              {hasPartial && (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[3px]" style={{ background: HATCH, boxShadow: `inset 0 0 0 1.5px ${C_BAR}` }} />
                  แท่งลายเส้น ={" "}
                  {data.range.bucket === "month"
                    ? "เดือนที่ข้อมูลไม่ครบเดือน (ถูกตัดตามช่วงวันที่ที่เลือก หรือเป็นเดือนปัจจุบัน)"
                    : data.range.current
                      ? bt.partial
                      : `${bt.unit}ที่ถูกตัดตามวันที่เลือก (ไม่ครบ${bt.unit})`}
                </span>
              )}
              {metric === "highPct" && <span>– = ผู้ใช้น้อยกว่า {data.minGroup} คน จึงไม่แสดงตัวเลข</span>}
            </div>
          )}
        </Card>

        {/* USAGE */}
        <Card>
          <h2 className="mb-4 text-lg font-bold">การใช้งานของผู้ใช้</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat
              label="ผู้ใช้ใหม่ในช่วงนี้"
              value={data ? `${num(data.usage.newUsers.cur)} คน` : "–"}
              note={data ? <DeltaNote text={delta(data.usage.newUsers.changePct)} fallback="ไม่มีข้อมูลช่วงก่อนให้เทียบ" /> : null}
            />
            <MiniStat
              label="ผลดีขึ้นเมื่อประเมินซ้ำ"
              value={!data ? "–" : data.usage.improved.repeaters === 0 ? null : fmt(data.usage.improved.pct)}
              note="ของผู้ที่ทำซ้ำ (ภาพรวม)"
            />
          </div>

          <h3 className="mb-3 mt-6 text-sm font-bold">เส้นทางผู้ใช้ (ช่วงที่เลือก)</h3>
          {data &&
            (data.usage.funnel[0]?.n ? (
              <Funnel steps={data.usage.funnel} />
            ) : (
              <Empty>ยังไม่มีผู้สมัครสมาชิกใหม่ในช่วงเวลานี้</Empty>
            ))}
          <p className="mt-3 text-xs text-staff-muted">
            นับจากผู้ที่สมัครสมาชิกในช่วงนี้ · ร้อยละเทียบกับจำนวนผู้สมัคร · ทำซ้ำตามรอบ = กลับมาทำแบบเดิมภายในรอบที่แนะนำ (ผ่อนผัน 7 วัน) อย่างน้อย 1 ครั้ง
          </p>
        </Card>

        <div className="flex flex-wrap gap-4">
          {/* BY AGE */}
          <Card className="flex-[3_1_480px]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">ความเสี่ยงสูง แยกตามช่วงอายุ</h2>
              <div className="flex gap-4 text-sm text-staff-muted">
                <BarLegend fill={C_BAR} label="สุขภาพกาย" />
                <BarLegend fill={HATCH} label="สุขภาพจิต" />
              </div>
            </div>
            {data && <AgeBars data={data.byAge} />}
            <p className="mt-3 text-xs text-staff-muted">ร้อยละของผู้ใช้ในแต่ละช่วงอายุที่ผลล่าสุดอยู่ระดับสูง · – = ผู้ใช้น้อยกว่า {data?.minGroup ?? 5} คน</p>
          </Card>

          {/* TOP ISSUES */}
          <Card className="flex-[2_1_320px]">
            <h2 className="mb-4 text-lg font-bold">ปัญหาสุขภาพที่พบมากที่สุด</h2>
            {data && (data.topIssues.length ? <RankedBars items={data.topIssues} /> : <Empty>ข้อมูลยังไม่พอสำหรับสรุป</Empty>)}
            <p className="mt-4 text-xs text-staff-muted">ร้อยละของผู้ใช้ที่ผลล่าสุดอยู่ในระดับควรระวังขึ้นไป</p>
          </Card>
        </div>

        {/* SUMMARY TABLE */}
        <Card>
          <h2 className="mb-3 text-lg font-bold">สรุปรายแบบประเมิน</h2>
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-staff-line text-xs text-staff-muted">
                  <th className="py-3 pr-3 text-left font-semibold">แบบประเมิน</th>
                  <th className="px-3 text-right font-semibold">จำนวนครั้ง</th>
                  <th className="px-3 text-right font-semibold">ผู้ใช้</th>
                  <th className="px-3 text-right font-semibold" title="ร้อยละของผู้ใช้ที่ผลล่าสุดในช่วงนี้อยู่ระดับสูง">
                    ความเสี่ยงสูง*
                  </th>
                  <th className="px-3 text-right font-semibold">เทียบช่วงก่อน</th>
                  <th className="pl-3 text-right font-semibold">ประเมินซ้ำตามรอบ</th>
                </tr>
              </thead>
              <tbody>
                {data?.summary.map((s) => (
                  <tr key={s.label} className="border-b border-staff-line/70 last:border-0">
                    <td className="py-3 pr-3 font-semibold">{s.label}</td>
                    <td className="px-3 text-right tabular-nums">{num(s.count)}</td>
                    <td className="px-3 text-right tabular-nums">{fmt(s.users, "")}</td>
                    <td className="px-3 text-right font-bold tabular-nums">{fmt(s.highPct)}</td>
                    <td
                      className={`px-3 text-right font-semibold tabular-nums ${
                        s.change === null || s.change === 0 ? "text-staff-muted" : s.change > 0 ? "text-risk-crit" : "text-[#21733f]"
                      }`}
                      title="ส่วนต่างจุดร้อยละของความเสี่ยงสูง เทียบช่วงก่อน"
                    >
                      {s.change === null ? "–" : delta(s.change)}
                    </td>
                    <td className="pl-3 text-right tabular-nums">{fmt(s.onTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-staff-muted">
            * ร้อยละของผู้ใช้ที่ผลล่าสุดในช่วงนี้อยู่ระดับสูง · กลุ่มที่มีผู้ใช้น้อยกว่า {data?.minGroup ?? 5} คนแสดงเป็น “–” เพื่อป้องกันการระบุตัวบุคคล
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-staff-muted">
            <Lock size={13} className="shrink-0" /> รายงานนับเฉพาะผู้ใช้ที่ยินยอมให้ประมวลผลข้อมูลสุขภาพ และแสดงเฉพาะข้อมูลรวม
            {prevText && ` · ช่วงก่อนที่ใช้เทียบ: ${prevText}`}
          </p>
        </Card>
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-staff-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} h-12 font-medium`}>
        {children}
      </select>
    </label>
  );
}

// ป้ายเปลี่ยนแปลงเทียบช่วงก่อน (ตัวอักษรสีเข้ม ใช้ลูกศรบอกทิศ)
function DeltaNote({ text, fallback }: { text: string | null; fallback: string }) {
  if (!text) return <>{fallback}</>;
  return (
    <>
      <b className="font-semibold text-staff-ink">{text}</b> เทียบช่วงก่อน
    </>
  );
}

// value = null → ยังไม่มีข้อมูล (เช่น ข้อมูลการเปิดทำแบบประเมินเพิ่งเริ่มเก็บ)
function MiniStat({ label, value, note }: { label: string; value: string | null; note: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-staff-line bg-staff-soft px-4 py-3.5">
      <span className="text-sm font-medium text-staff-muted">{label}</span>
      {value === null ? (
        <span className="py-1 text-base font-bold text-staff-400">ยังไม่มีข้อมูล</span>
      ) : (
        <span className="text-2xl font-extrabold leading-tight">{value}</span>
      )}
      <span className="text-xs text-staff-muted">{note}</span>
    </div>
  );
}
