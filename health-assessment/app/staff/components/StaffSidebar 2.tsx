"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  ShieldPlus,
  Users,
  X,
} from "lucide-react";
import { staffFetch, FOLLOW_UP_UPDATED_EVENT } from "@/lib/staff/client";

/* =========================================================
   SIDEBAR ฝั่ง Staff (โทนเทอร์ควอยซ์)
   - จอใหญ่: แถบด้านซ้าย / จอเล็ก: แถบบน + เมนูเลื่อนออก
========================================================= */

const MENU: { href: string; label: string; icon: ReactNode; badge?: boolean }[] = [
  { href: "/staff", label: "ภาพรวม", icon: <LayoutDashboard size={21} /> },
  { href: "/staff/follow-up", label: "ติดตามผู้มีความเสี่ยง", icon: <Activity size={21} />, badge: true },
  { href: "/staff/users", label: "ผู้ใช้งาน", icon: <Users size={21} /> },
  { href: "/staff/assessments", label: "แบบประเมิน", icon: <ClipboardList size={21} /> },
  { href: "/staff/recommendations", label: "คำแนะนำสุขภาพ", icon: <MessageSquareText size={21} /> },
  { href: "/staff/reports", label: "รายงานและสถิติ", icon: <BarChart3 size={21} /> },
];

export default function StaffSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("");
  const [waiting, setWaiting] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem("username") || "เจ้าหน้าที่");
  }, []);

  // จำนวนเคสรอติดตาม (ตัวเลขแดงข้างเมนู)
  useEffect(() => {
    const load = () =>
      staffFetch<{ waiting: number }>("/api/staff/follow-up?summary=1")
        .then((d) => setWaiting(d.waiting))
        .catch(() => {});
    load();
    window.addEventListener(FOLLOW_UP_UPDATED_EVENT, load);
    return () => window.removeEventListener(FOLLOW_UP_UPDATED_EVENT, load);
  }, []);

  const isActive = (href: string) =>
    href === "/staff" ? pathname === "/staff" : pathname === href || pathname.startsWith(href + "/");

  const logout = () => {
    ["userId", "username", "email", "roleId", "role", "user", "hasProfile", "rememberLogin"].forEach((k) =>
      localStorage.removeItem(k)
    );
    router.replace("/login");
  };

  const brand = (
    <Link href="/staff" className="flex items-center gap-3 px-2">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br from-staff-400 to-staff-600 text-white shadow-[0_12px_28px_rgba(10,168,152,0.3)]">
        <ShieldPlus size={24} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-staff-ink">Health Risk</p>
        <p className="text-xs font-semibold tracking-wider text-staff-600">STAFF PORTAL</p>
      </div>
    </Link>
  );

  const nav = (
    <nav aria-label="เมนูเจ้าหน้าที่" className="mt-10 space-y-1.5">
      {MENU.map((m) => {
        const active = isActive(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={`flex min-h-12 items-center gap-3.5 rounded-2xl px-4 font-medium transition ${
              active
                ? "bg-staff-100 font-semibold text-staff-800"
                : "text-staff-muted hover:bg-staff-bg hover:text-staff-ink"
            }`}
          >
            <span className={`shrink-0 ${active ? "text-staff-600" : ""}`}>{m.icon}</span>
            <span className="min-w-0 flex-1 truncate">{m.label}</span>
            {m.badge && waiting > 0 && (
              <span className="rounded-full bg-risk-high px-2 py-0.5 text-xs font-bold text-white" aria-label={`รอติดตาม ${waiting} ราย`}>
                {waiting}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="mt-auto flex items-center gap-3 rounded-2xl bg-staff-bg p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-staff-200 font-bold text-staff-800">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-staff-muted">เจ้าหน้าที่ (Staff)</p>
      </div>
      <button
        type="button"
        onClick={logout}
        aria-label="ออกจากระบบ"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-staff-muted transition hover:text-risk-high"
      >
        <LogOut size={18} />
      </button>
    </div>
  );

  return (
    <>
      {/* จอเล็ก */}
      <header className="staff-no-print sticky top-0 z-30 flex items-center justify-between border-b border-staff-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="relative grid h-11 w-11 place-items-center rounded-xl border border-staff-line text-staff-ink"
        >
          <Menu size={20} />
          {waiting > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-risk-high" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนูเจ้าหน้าที่">
          <button type="button" aria-label="ปิดเมนู" className="absolute inset-0 bg-staff-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-white px-4 py-7 shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิดเมนู"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl text-staff-muted"
            >
              <X size={20} />
            </button>
            {brand}
            {nav}
            {account}
          </aside>
        </div>
      )}

      {/* จอใหญ่ */}
      <aside className="staff-no-print sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-staff-line bg-white px-4 py-7 lg:flex">
        {brand}
        {nav}
        {account}
      </aside>
    </>
  );
}
