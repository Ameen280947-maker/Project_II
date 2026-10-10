"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Search, X } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import { Avatar, ErrorBox, RiskPill, inputCls, thDate } from "./ui";

/* =========================================================
   หน้าต่างรายละเอียดของกล่องตัวเลขในหน้า "ภาพรวม"
   ข้อมูลจาก /api/staff/overview/details ตามช่วงเวลาที่เลือก
========================================================= */

export type DetailKind = "users" | "assessments" | "waiting" | "active";

type Item = {
  userId?: number;
  assessmentId?: number;
  caseId?: number;
  username: string;
  at: string;
  isNew?: boolean;
  consent?: boolean;
  assessment?: string;
  riskLevel?: string | null;
  severity?: number | null;
  count?: number;
};

const META: Record<DetailKind, { title: string; link: { href: string; label: string } }> = {
  users: { title: "ผู้ใช้งานทั้งหมด", link: { href: "/staff/users", label: "ไปหน้าผู้ใช้งาน" } },
  assessments: { title: "การประเมิน", link: { href: "/staff/reports", label: "ไปหน้ารายงานและสถิติ" } },
  waiting: { title: "ผู้มีความเสี่ยงสูงรอติดตาม", link: { href: "/staff/follow-up", label: "ไปหน้าติดตามผู้มีความเสี่ยง" } },
  active: { title: "ผู้ใช้ที่ทำแบบประเมิน", link: { href: "/staff/users", label: "ไปหน้าผู้ใช้งาน" } },
};

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export default function OverviewDetail({
  kind,
  from,
  to,
  rangeText,
  onClose,
}: {
  kind: DetailKind;
  from: string;
  to: string;
  rangeText: string;
  onClose: () => void;
}) {
  const url = `/api/staff/overview/details?kind=${kind}&from=${from}&to=${to}`;
  // เก็บผลพร้อม url ที่โหลด: url เปลี่ยน = กำลังโหลดใหม่
  const [result, setResult] = useState<{ url: string; items?: Item[]; truncated?: boolean; error?: string } | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    staffFetch<{ items: Item[]; truncated: boolean }>(url)
      .then((d) => !cancelled && setResult({ url, items: d.items, truncated: d.truncated }))
      .catch((e) => !cancelled && setResult({ url, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  // ปิดด้วยปุ่ม Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loading = result?.url !== url;
  const items = (!loading && result?.items) || [];
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.username.toLowerCase().includes(q)) : items;
  const meta = META[kind];
  const subtitle = kind === "waiting" ? "สถานะปัจจุบัน" : kind === "users" ? `ยอด ณ สิ้นสุดช่วง · ${rangeText}` : rangeText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="overview-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-[26px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.2)] sm:rounded-[26px]"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-staff-line px-6 py-5">
          <div className="min-w-0">
            <h2 id="overview-detail-title" className="text-lg font-bold">
              {meta.title}
              {!loading && result?.items && <span className="ml-2 text-staff-muted">({items.length}{result.truncated ? "+" : ""})</span>}
            </h2>
            <p className="text-sm text-staff-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-staff-muted transition hover:bg-staff-bg"
          >
            <X size={20} />
          </button>
        </div>

        {/* search */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-staff-muted" />
            <input
              className={`${inputCls} pl-10`}
              placeholder="ค้นหาชื่อผู้ใช้"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {result?.error && !loading && <ErrorBox message={result.error} />}
          {loading && <p className="py-10 text-center text-sm text-staff-muted">กำลังโหลด...</p>}
          {!loading && !result?.error && shown.length === 0 && (
            <p className="py-10 text-center text-sm text-staff-muted">{q ? "ไม่พบผู้ใช้ที่ค้นหา" : "ไม่มีข้อมูลในช่วงนี้"}</p>
          )}

          <ul className="flex flex-col gap-2">
            {shown.map((item, i) => (
              <li key={`${item.caseId ?? item.assessmentId ?? item.userId}-${i}`}>
                <Row kind={kind} item={item} />
              </li>
            ))}
          </ul>

          {!loading && result?.truncated && (
            <p className="pt-3 text-center text-xs text-staff-muted">แสดง 500 รายการล่าสุด</p>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-staff-line px-6 py-4">
          <p className="text-xs text-staff-muted">
            {kind === "assessments" && "ผลการประเมินแสดงเฉพาะผู้ที่ยินยอมให้เจ้าหน้าที่ดู"}
          </p>
          <Link href={meta.link.href} className="shrink-0 text-sm font-semibold text-staff-600 hover:underline">
            {meta.link.label} →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ kind, item }: { kind: DetailKind; item: Item }) {
  const box = "flex items-center gap-3 rounded-2xl border border-staff-bg bg-staff-soft px-3 py-2.5";

  if (kind === "waiting") {
    const wait = daysSince(item.at);
    return (
      <Link href={`/staff/follow-up?case=${item.caseId}`} className={`${box} transition hover:border-staff-200`}>
        <Avatar name={item.username} tone="danger" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.username}</span>
          <span className="block truncate text-[13px] text-staff-muted">{item.assessment}</span>
        </span>
        <RiskPill severity={item.severity ?? 2}>{item.riskLevel}</RiskPill>
        <span className={`w-16 shrink-0 text-right text-xs font-semibold ${wait >= 3 ? "text-risk-high" : "text-staff-muted"}`}>
          {wait === 0 ? "วันนี้" : `รอ ${wait} วัน`}
        </span>
      </Link>
    );
  }

  if (kind === "assessments") {
    return (
      <div className={box}>
        <Avatar name={item.username} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.username}</span>
          <span className="block truncate text-[13px] text-staff-muted">
            {item.assessment} · {thDate(item.at, true)}
          </span>
        </span>
        {item.consent && item.riskLevel ? (
          <RiskPill severity={item.severity ?? 0}>{item.riskLevel}</RiskPill>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-staff-muted">
            <Lock size={12} /> ไม่ได้ยินยอม
          </span>
        )}
      </div>
    );
  }

  if (kind === "active") {
    return (
      <div className={box}>
        <Avatar name={item.username} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.username}</span>
          <span className="block truncate text-[13px] text-staff-muted">ล่าสุด {thDate(item.at, true)}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold">{item.count} ครั้ง</span>
      </div>
    );
  }

  // users
  return (
    <div className={box}>
      <Avatar name={item.username} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{item.username}</span>
        <span className="block truncate text-[13px] text-staff-muted">สมัครเมื่อ {thDate(item.at)}</span>
      </span>
      {item.isNew && (
        <span className="shrink-0 rounded-full bg-[#e8f7ed] px-2.5 py-1 text-xs font-semibold text-[#21733f]">ใหม่ในช่วงนี้</span>
      )}
    </div>
  );
}
