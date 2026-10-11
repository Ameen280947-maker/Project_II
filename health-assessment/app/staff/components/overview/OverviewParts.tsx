"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Legend } from "../ui";
import type { Overview } from "./types";

/* =========================================================
   ชิ้นส่วนของหน้า "ภาพรวมระบบ" (กราฟ / การ์ดส่วนต่าง ๆ / รายการงานค้าง)
   สีผล: ปกติ = risk-ok, ควรระวัง = risk-mid, เสี่ยงสูง = risk-high (ตามโทน staff)
========================================================= */

const fmt = (n: number) => n.toLocaleString("th-TH");

// ลายทแยงสำหรับแท่งที่ยังไม่ครบช่วง (เดือนปัจจุบัน)
const HATCH = "repeating-linear-gradient(135deg, var(--color-staff-600) 0 2px, var(--color-staff-200) 2px 6px)";

/* ---------- กราฟจำนวนการประเมินต่อช่วงเวลา (ช่วงนี้ vs ช่วงก่อน) ---------- */

export function UsageChart({ chart }: { chart: Overview["chart"] }) {
  const max = Math.max(1, ...chart.map((c) => Math.max(c.value, c.prev ?? 0)));
  const n = chart.length;
  // แท่งเยอะ แสดงป้ายเว้นช่วง ไม่ให้ตัวหนังสือซ้อนกัน
  const labelStep = Math.max(1, Math.ceil(n / 7));
  const showAllValues = n <= 14;
  // แท่งเยอะ: แสดงตัวเลขเฉพาะแท่งที่สูงที่สุด
  const peak = Math.max(0, ...chart.map((c) => c.value));
  const gap = n > 20 ? "gap-[2px]" : n > 10 ? "gap-1.5" : "gap-3";

  return (
    <div>
      <div className={`flex h-56 items-end border-b border-staff-line ${gap}`}>
        {chart.map((c, i) => (
          <div
            key={i}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            title={`${c.label}: ช่วงนี้ ${fmt(c.value)} ครั้ง${c.prev !== null ? ` · ช่วงก่อน ${fmt(c.prev)} ครั้ง` : ""}`}
          >
            {(showAllValues || (c.value > 0 && c.value === peak)) && (
              <span className="mb-1 text-[11px] font-semibold tabular-nums text-staff-ink">{fmt(c.value)}</span>
            )}
            <div
              className="w-full max-w-[40px] rounded-t-[4px] bg-staff-600 transition-all group-hover:bg-staff-500"
              style={{ height: `${(c.value / max) * 82}%`, minHeight: c.value > 0 ? 2 : 0 }}
            />
            {c.prev !== null && c.prev > 0 && (
              <span
                aria-hidden
                className="absolute left-1/2 w-full max-w-[40px] -translate-x-1/2 border-t-2 border-dashed border-staff-400"
                style={{ bottom: `${(c.prev / max) * 82}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className={`mt-2 flex ${gap}`}>
        {chart.map((c, i) => (
          <span key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-staff-muted">
            {i % labelStep === 0 ? c.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function UsageLegend() {
  return (
    <div className="flex gap-4 text-sm text-staff-muted">
      <Legend color="bg-staff-600" label="ช่วงนี้" />
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-dashed border-staff-400" />
        ช่วงก่อน
      </span>
    </div>
  );
}

/* ---------- ผลการประเมินโดยรวม (แท่งซ้อนแนวนอน) ---------- */

export function OutcomeBreakdown({ outcome, minGroup }: { outcome: Overview["outcome"]; minGroup: number }) {
  const c = outcome.counts;
  const total = c ? c.ok + c.mid + c.high : 0;
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const rows = [
    { key: "ok", label: "ปกติ", color: "bg-risk-ok", v: c?.ok ?? 0 },
    { key: "mid", label: "ควรระวัง", color: "bg-risk-mid", v: c?.mid ?? 0 },
    { key: "high", label: "เสี่ยงสูง", color: "bg-risk-high", v: c?.high ?? 0 },
  ];

  if (!c || total === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-4 rounded-full bg-staff-bg" />
        <p className="text-sm text-staff-muted">
          {outcome.total === 0
            ? "ยังไม่มีผลการประเมินที่นำมาคิดสถิติได้ในช่วงนี้"
            : `ข้อมูลยังน้อยเกินไป (ผู้ยินยอมน้อยกว่า ${minGroup} คน) จึงไม่แสดงสัดส่วนเพื่อปกป้องความเป็นส่วนตัว`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full bg-staff-bg">
        {rows
          .filter((r) => r.v > 0)
          .map((r) => (
            <span key={r.key} className={r.color} style={{ width: `${(r.v / total) * 100}%` }} title={`${r.label} ${pct(r.v)}% (${fmt(r.v)} ครั้ง)`} />
          ))}
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${r.color}`} />
            <span className="flex-1 font-medium">{r.label}</span>
            <span className="tabular-nums text-staff-muted">{fmt(r.v)} ครั้ง</span>
            <span className="w-12 text-right font-bold tabular-nums">{pct(r.v)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- การ์ด "ส่วนต่าง ๆ ของระบบ" ---------- */

export function SystemCard({
  icon,
  title,
  subtitle,
  href,
  linkText,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  href: string;
  linkText: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[22px] border border-staff-line bg-white p-6 shadow-[0_1px_2px_rgba(20,20,19,0.04)]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-staff-100 text-staff-700">{icon}</span>
        <div className="min-w-0">
          <h3 className="font-bold">{title}</h3>
          <p className="text-[13px] text-staff-muted">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-1 flex-col gap-4">{children}</div>
      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-1.5 border-t border-staff-line pt-4 text-sm font-semibold text-staff-ink hover:underline"
      >
        {linkText}
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}

export function MiniStat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-staff-soft px-3 py-2.5">
      <p className="truncate text-xs text-staff-muted">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold leading-tight tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-staff-muted">{note}</p>}
    </div>
  );
}

/* ---------- แท่งแนวนอน (แบบประเมินยอดนิยม) ---------- */

export function HBars({ items }: { items: { key: string | number; label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it) => (
        <li key={it.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate" title={it.label}>
              {it.label}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{fmt(it.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-staff-bg">
            <div className="h-2 rounded-full bg-staff-600" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- แท่งรายเดือนขนาดเล็ก (เดือนปัจจุบันเป็นลายทแยง = ยังไม่ครบเดือน) ---------- */

export function MonthlyBars({ months }: { months: Overview["reports"]["monthly"] }) {
  const max = Math.max(1, ...months.map((m) => m.value));
  return (
    <div>
      <div className="flex h-24 items-end gap-2 border-b border-staff-line">
        {months.map((m) => (
          <div
            key={m.label}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            title={`${m.label}: ${fmt(m.value)} ครั้ง${m.current ? " (ยังไม่ครบเดือน)" : ""}`}
          >
            <span className="mb-0.5 text-[10px] font-semibold tabular-nums text-staff-muted">{m.value > 0 ? fmt(m.value) : ""}</span>
            <div
              className="w-full max-w-[28px] rounded-t-[4px] bg-staff-300"
              style={{ height: `${(m.value / max) * 75}%`, minHeight: m.value > 0 ? 2 : 0, ...(m.current ? { background: HATCH } : {}) }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {months.map((m) => (
          <span key={m.label} className={`min-w-0 flex-1 text-center text-[11px] ${m.current ? "font-semibold text-staff-ink" : "text-staff-muted"}`}>
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- รายการงานค้าง ---------- */

export function TaskItem({
  title,
  count,
  href,
  children,
}: {
  title: string;
  count: number;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-staff-bg bg-staff-soft px-4 py-3 transition hover:border-staff-300"
    >
      <span className="mt-0.5 grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-staff-600 px-2 text-xs font-bold tabular-nums text-white">
        {count}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] text-staff-muted">{children}</span>
      </span>
      <ArrowRight size={18} className="mt-1 shrink-0 text-staff-400 transition group-hover:translate-x-0.5 group-hover:text-staff-ink" />
    </Link>
  );
}
