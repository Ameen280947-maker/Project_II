"use client";

import { useState } from "react";

/* =========================================================
   กราฟของหน้า "รายงานและสถิติ" (HTML ล้วน ยืดตามความกว้างการ์ด ไม่ต้องเลื่อนบนมือถือ)
   - โทนเทา-ดำของ Staff · แยกชุดข้อมูลด้วยลวดลาย (ทึบ / เส้นทแยง) แทนสี
   - ค่า null = กลุ่มเล็กกว่าเกณฑ์ แสดง "–"
========================================================= */

export const C_BAR = "#2b2a28";
export const HATCH = `repeating-linear-gradient(135deg, ${C_BAR} 0 2px, #ffffff 2px 6px)`;
const HATCH_SOFT = "repeating-linear-gradient(135deg, #77746d 0 2px, #ffffff 2px 6px)";

export const fmt = (v: number | null | undefined, suffix = "%") =>
  v === null || v === undefined ? "–" : `${v.toLocaleString("th-TH")}${suffix}`;

export type TrendPoint = { key: string; label: string; total: number; highPct: number | null; partial: boolean };
export type AgePoint = { label: string; physical: { pct: number | null; n: number }; mental: { pct: number | null; n: number } };
export type FunnelStep = { label: string; n: number; pct: number | null };

/* ---------- แนวโน้ม: กราฟแท่งตามช่วงย่อย ---------- */

export function TrendBars({ data, metric }: { data: TrendPoint[]; metric: "total" | "highPct" }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = data.map((d) => (metric === "total" ? d.total : d.highPct));
  const max = Math.max(metric === "total" ? 1 : 10, ...vals.map((v) => v ?? 0));
  const unit = metric === "total" ? "" : "%";
  // ช่วงย่อยเยอะ (เช่น รายวัน 30 วัน) → ซ่อนตัวเลขบนแท่งที่เป็น 0 และแสดงป้ายแกนเว้นระยะ
  const dense = data.length > 14;
  const labelEvery = data.length > 20 ? Math.ceil(data.length / 10) : 1;

  return (
    <div className="relative">
      <div className="flex h-56 items-end gap-[2px] border-b border-staff-line sm:gap-1.5" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const v = vals[i];
          const showLabel = v !== null && (!dense || v > 0);
          return (
            <div
              key={d.key}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              onMouseEnter={() => setHover(i)}
              title={`${d.label}${d.partial ? " (ยังไม่ครบช่วง)" : ""}: ${fmt(v, metric === "total" ? " ครั้ง" : "%")}`}
            >
              {showLabel && v !== null ? (
                <span className={`max-w-full truncate font-semibold text-staff-ink ${dense ? "text-[9px] sm:text-[10px]" : "text-[11px] sm:text-xs"}`}>
                  {v.toLocaleString("th-TH")}
                  {unit}
                </span>
              ) : v === null ? (
                <span className="text-xs font-bold text-staff-400">–</span>
              ) : null}
              <div
                className={`w-full max-w-[56px] rounded-t-[4px] transition-opacity ${hover !== null && hover !== i ? "opacity-60" : ""}`}
                style={{
                  height: v ? `${Math.max(2, (v / max) * 85)}%` : 2,
                  background: !v ? "#e6e4df" : d.partial ? HATCH : C_BAR,
                  boxShadow: v && d.partial ? `inset 0 0 0 1.5px ${C_BAR}` : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px] sm:gap-1.5">
        {data.map((d, i) => (
          <span key={d.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-staff-muted sm:text-xs">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- ความเสี่ยงสูงตามช่วงอายุ: แท่งคู่ กาย (ทึบ) / จิต (เส้นทแยง) ---------- */

export function AgeBars({ data }: { data: AgePoint[] }) {
  const max = Math.max(10, ...data.flatMap((d) => [d.physical.pct ?? 0, d.mental.pct ?? 0]));
  const bar = (v: { pct: number | null; n: number }, fill: string, kind: string, group: string) => (
    <div
      className="flex h-full w-full max-w-[44px] flex-col items-center justify-end gap-1"
      title={`${group} · ${kind}: ${fmt(v.pct)}${v.pct === null ? " (ผู้ใช้น้อยกว่าเกณฑ์)" : ""}`}
    >
      <span className={`text-[11px] font-semibold sm:text-xs ${v.pct === null ? "text-staff-400" : "text-staff-ink"}`}>{fmt(v.pct)}</span>
      <div
        className="w-full rounded-t-[4px]"
        style={{
          height: v.pct ? `${Math.max(2, (v.pct / max) * 80)}%` : 2,
          background: !v.pct ? "#e6e4df" : fill,
          boxShadow: v.pct ? `inset 0 0 0 1.5px ${C_BAR}` : undefined,
        }}
      />
    </div>
  );
  return (
    <div>
      <div className="flex h-52 items-end gap-3 border-b border-staff-line sm:gap-4">
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-[2px]">
            {bar(d.physical, C_BAR, "สุขภาพกาย", d.label)}
            {bar(d.mental, HATCH, "สุขภาพจิต", d.label)}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 sm:gap-4">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 text-center text-xs text-staff-muted">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarLegend({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[3px]" style={{ background: fill, boxShadow: `inset 0 0 0 1.5px ${C_BAR}` }} />
      {label}
    </span>
  );
}

/* ---------- อันดับปัญหาสุขภาพ ---------- */

export function RankedBars({ items }: { items: { label: string; pct: number }[] }) {
  return (
    <ol className="flex flex-col gap-3.5">
      {items.map((t, i) => (
        <li key={t.label} className="flex items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-staff-100 text-sm font-bold text-staff-700">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2 text-sm">
              <span className="truncate font-semibold">{t.label}</span>
              <span className="shrink-0 font-semibold">{fmt(t.pct)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-staff-bg">
              <div className="h-full rounded-full bg-staff-500" style={{ width: `${Math.min(100, t.pct)}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- เส้นทางผู้ใช้ (funnel) ---------- */

export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const base = Math.max(1, steps[0]?.n ?? 0);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={s.label} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <span className="truncate text-sm font-semibold">
            <span className="mr-1.5 text-staff-400">{i + 1}.</span>
            {s.label}
          </span>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-7 min-w-0 flex-1 overflow-hidden rounded-lg bg-staff-bg">
              <div
                className="h-full rounded-lg"
                style={{ width: `${(s.n / base) * 100}%`, background: i === 0 ? C_BAR : i === steps.length - 1 ? HATCH_SOFT : "#77746d" }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
              {s.n.toLocaleString("th-TH")} <span className="font-normal text-staff-muted">({fmt(s.pct)})</span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
