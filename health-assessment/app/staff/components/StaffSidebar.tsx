"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldPlus,
  Users,
  X,
} from "lucide-react";
import { clearStaffSession } from "@/lib/staff/client";

// รายการเมนูของเจ้าหน้าที่ (ลิงก์ ชื่อ ไอคอน)
const MENU: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/staff", label: "ภาพรวมระบบ", icon: <LayoutDashboard size={21} /> },
  { href: "/staff/users", label: "ผู้ใช้งาน", icon: <Users size={21} /> },
  { href: "/staff/assessments", label: "แบบประเมิน", icon: <ClipboardList size={21} /> },
  { href: "/staff/reports", label: "รายงานและสถิติ", icon: <BarChart3 size={21} /> },
];

// แถบเมนูด้านข้างของเจ้าหน้าที่ (ลิงก์เมนู ชื่อผู้ใช้ ปุ่มออกจากระบบ รองรับมือถือ)
export default function StaffSidebar() {
  // state: ชื่อเจ้าหน้าที่ และสถานะเปิดเมนูบนมือถือ
  const pathname = usePathname();
  const router = useRouter();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  // อ่านชื่อเจ้าหน้าที่จาก localStorage ตอนเปิดหน้า
  useEffect(() => {
    setName(localStorage.getItem("staffUsername") || "เจ้าหน้าที่");
  }, []);

  // ตรวจว่าเมนูนี้ตรงกับหน้าปัจจุบันหรือไม่ (รวมหน้าย่อย)
  const isActive = (href: string) =>
    href === "/staff" ? pathname === "/staff" : pathname === href || pathname.startsWith(href + "/");

  // ออกจากระบบเจ้าหน้าที่: เรียก /api/auth/logout?role=staff ล้าง session แล้วไปหน้า login
  const logout = async () => {
    await fetch("/api/auth/logout?role=staff", { method: "POST" }).catch(() => {});
    clearStaffSession();
    router.replace("/login");
  };

  // ส่วนประกอบที่ใช้ซ้ำทั้งบนมือถือและเดสก์ท็อป: โลโก้ เมนู และกล่องบัญชี/ออกจากระบบ
  const brand = (
    <Link href="/staff" className="flex items-center gap-3 px-2">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br from-[#3a3936] to-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
        <ShieldPlus size={24} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-staff-ink">Health Risk</p>
        <p className="text-xs font-semibold tracking-[0.2em] text-staff-500">STAFF PORTAL</p>
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
                ? "bg-staff-900 font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
                : "text-staff-muted hover:bg-staff-bg hover:text-staff-ink"
            }`}
          >
            <span className={`shrink-0 ${active ? "text-white" : ""}`}>{m.icon}</span>
            <span className="min-w-0 flex-1 truncate">{m.label}</span>
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
      {/* แถบบนสำหรับมือถือ + ปุ่มเปิดเมนู */}
      <header className="staff-no-print sticky top-0 z-30 flex items-center justify-between border-b border-staff-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="relative grid h-11 w-11 place-items-center rounded-xl border border-staff-line text-staff-ink"
        >
          <Menu size={20} />
        </button>
      </header>
      {/* เมนูแบบลิ้นชักบนมือถือ */}
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

      {/* แถบเมนูด้านข้างบนเดสก์ท็อป */}
      <aside className="staff-no-print sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-staff-line bg-white px-4 py-7 lg:flex">
        {brand}
        {nav}
        {account}
      </aside>
    </>
  );
}
