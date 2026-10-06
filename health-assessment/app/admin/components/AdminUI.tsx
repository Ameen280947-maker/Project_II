"use client";

import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

/* =========================================================
   ชิ้นส่วน UI ที่ใช้ร่วมกันในหน้า Admin (โทนน้ำเงินเข้ม)
========================================================= */

export function PageHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#1e3a8a] to-[#172554] text-white shadow-[0_12px_28px_rgba(23,37,84,0.25)]">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">{title}</h1>
          <p className="mt-0.5 text-sm text-[#64748b]">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-[#e3e8f2] bg-white p-6 shadow-[0_10px_30px_rgba(23,37,84,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e8eefc] text-[#1e3a8a]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-[#64748b]">{label}</p>
        <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
        {hint && <p className="truncate text-xs text-[#94a3b8]">{hint}</p>}
      </div>
    </Card>
  );
}

export type Status = "ok" | "warning" | "error";

const STATUS_STYLE: Record<Status, { cls: string; text: string; Icon: typeof CheckCircle2 }> = {
  ok: { cls: "bg-[#e7f6ee] text-[#15803d]", text: "ปกติ", Icon: CheckCircle2 },
  warning: { cls: "bg-[#fef5e2] text-[#b45309]", text: "ควรตรวจสอบ", Icon: AlertTriangle },
  error: { cls: "bg-[#fdecec] text-[#b91c1c]", text: "มีปัญหา", Icon: XCircle },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}
    >
      <s.Icon size={14} />
      {label ?? s.text}
    </span>
  );
}

export function PrimaryButton({
  children,
  loading,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#1e3a8a] to-[#172554] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_22px_rgba(23,37,84,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-[#c7d2fe] bg-white px-4 py-2.5 text-sm font-semibold text-[#1e3a8a] transition hover:bg-[#eef2ff] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
        kind === "success"
          ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"
          : "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
      }`}
    >
      {children}
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-[#64748b]">
      <Loader2 className="animate-spin" size={20} /> กำลังโหลด...
    </div>
  );
}
