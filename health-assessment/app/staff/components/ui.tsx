"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/* =========================================================
   ชิ้นส่วน UI ที่ใช้ร่วมกันทุกหน้าของ Staff (โทน staff-* ใน globals.css)
========================================================= */

export function PageHeader({
  eyebrow,
  title,
  highlight,
  desc,
  actions,
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  desc?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-staff-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
          {title}
          <span className="bg-linear-to-r from-staff-500 to-staff-400 bg-clip-text text-transparent">{highlight}</span>
        </h1>
        {desc && <p className="mt-1 text-staff-muted">{desc}</p>}
      </div>
      {actions && <div className="staff-no-print flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-[22px] border border-staff-line bg-white p-6 shadow-[0_1px_2px_rgba(16,43,41,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  tone = "brand",
}: {
  label: string;
  value?: ReactNode;
  note?: ReactNode;
  tone?: "brand" | "danger" | "warn" | "ok";
}) {
  const dot = { brand: "bg-staff-400", danger: "bg-risk-high", warn: "bg-risk-mid", ok: "bg-risk-ok" }[tone];
  const num = { brand: "text-staff-ink", danger: "text-risk-high", warn: "text-staff-ink", ok: "text-staff-600" }[tone];
  return (
    <div className="flex flex-col gap-1.5 rounded-[22px] border border-staff-line bg-white px-6 py-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-staff-muted">{label}</span>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      </div>
      <p className={`text-4xl font-extrabold leading-tight ${num}`}>{value ?? "–"}</p>
      {note && <p className={`text-[13px] ${tone === "danger" ? "font-semibold text-risk-crit" : "text-staff-muted"}`}>{note}</p>}
    </div>
  );
}

// ป้ายระดับความเสี่ยงตาม severity 0–3
const SEV_PILL = [
  "bg-[#e8f7ed] text-[#21733f]",
  "bg-[#fff3dc] text-[#8a5a00]",
  "bg-[#fde6e7] text-[#a61e28]",
  "bg-[#fbd9dc] text-[#8e1b25]",
];

export function RiskPill({ severity, children }: { severity: number; children: ReactNode }) {
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEV_PILL[severity] ?? SEV_PILL[0]}`}>
      {children}
    </span>
  );
}

export function Avatar({ name, tone = "brand", size = 36 }: { name: string; tone?: "brand" | "danger"; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-full text-sm font-bold ${
        tone === "danger" ? "bg-[#fde6e7] text-[#a61e28]" : "bg-staff-100 text-staff-700"
      }`}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function Chips<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
              on
                ? "border-staff-600 bg-staff-600 text-white shadow-[0_6px_16px_rgba(5,130,122,0.25)]"
                : "border-staff-line bg-white text-staff-muted hover:border-staff-300 hover:text-staff-ink"
            }`}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-white/25" : "bg-staff-bg"}`}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-2xl border border-staff-line bg-white p-1">
      {items.map((r) => (
        <button
          key={r.key}
          type="button"
          role="tab"
          aria-selected={value === r.key}
          onClick={() => onChange(r.key)}
          className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${
            value === r.key ? "bg-staff-600 text-white" : "text-staff-muted hover:bg-staff-bg"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700" role="alert">
      <AlertTriangle size={18} className="shrink-0" />
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-staff-muted">{children}</p>;
}

export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[3px] ${color}`} />
      {label}
    </span>
  );
}

export const inputCls =
  "w-full rounded-xl border border-staff-line bg-staff-soft px-3.5 py-2.5 text-sm text-staff-ink outline-none transition placeholder:text-[#93aaa7] focus:border-staff-400 focus:bg-white focus:ring-4 focus:ring-staff-100";

export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-staff-600 px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(5,130,122,0.22)] transition hover:bg-staff-700 disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-staff-line bg-white px-4 text-sm font-semibold text-staff-ink transition hover:border-staff-300 hover:bg-staff-soft disabled:opacity-50";

export const thDate = (iso?: string | null, withTime = false) =>
  iso
    ? new Date(iso).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      })
    : "-";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-staff-500" : "bg-[#cfd9d7]"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}
