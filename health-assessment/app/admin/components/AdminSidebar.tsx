"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bug,
  Database,
  HardDriveDownload,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";

/* =========================================================
   SIDEBAR สำหรับ System Admin (โทนน้ำเงินเข้ม)
========================================================= */

// short = ชื่อสั้นสำหรับแถบเมนูบนมือถือ (4 ช่องต้องพอดีจอ)
const MENU: { href: string; label: string; short: string; icon: ReactNode }[] = [
  { href: "/admin", label: "ตรวจสอบระบบ", short: "ตรวจสอบ", icon: <Activity size={21} /> },
  { href: "/admin/database", label: "ดูแลฐานข้อมูล", short: "ฐานข้อมูล", icon: <Database size={21} /> },
  { href: "/admin/errors", label: "แก้ไขข้อผิดพลาด", short: "ข้อผิดพลาด", icon: <Bug size={21} /> },
  { href: "/admin/backup", label: "สำรองข้อมูล", short: "สำรอง", icon: <HardDriveDownload size={21} /> },
];

export default function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    // ลบเฉพาะ cookie ของ admin (session_admin) แท็บที่เปิดเป็นผู้ใช้หรือ staff ยังใช้งานต่อได้
    // admin ไม่ได้เก็บค่าใน localStorage จึงไม่ต้องลบ
    await fetch("/api/auth/logout?role=admin", { method: "POST" }).catch(() => {});
    router.replace("/login");
  };

  return (
    <>
      {/* ---------- DESKTOP ---------- */}
      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col bg-gradient-to-b from-[#172554] to-[#1e3a8a] px-5 py-7 text-white lg:flex">
        <Link href="/admin" className="flex items-center gap-3 px-2">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <ShieldCheck size={26} />
          </div>
          <div>
            <p className="font-bold">System Admin</p>
            <p className="text-xs text-blue-200">Health Risk Assessment</p>
          </div>
        </Link>

        <nav className="mt-12 space-y-2" aria-label="เมนูผู้ดูแลระบบ">
          {MENU.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-13 items-center gap-4 rounded-2xl px-4 py-3.5 font-medium transition ${
                  active
                    ? "bg-white text-[#1e3a8a] shadow-[0_8px_20px_rgba(0,0,0,0.15)]"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-xs text-blue-200">เข้าสู่ระบบในชื่อ</p>
            <p className="truncate font-semibold">{username || "-"}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex h-12 w-full items-center gap-3 rounded-2xl bg-white/10 px-4 font-semibold text-white transition hover:bg-white/20"
          >
            <LogOut size={20} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* ---------- MOBILE (แถบด้านบน) ---------- */}
      <header className="sticky top-0 z-30 bg-[#172554] text-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            <ShieldCheck size={22} /> System Admin
          </div>
          <button type="button" onClick={logout} aria-label="ออกจากระบบ" className="rounded-xl p-2 hover:bg-white/10">
            <LogOut size={20} />
          </button>
        </div>
        <nav className="grid grid-cols-4 gap-1 px-2 pb-2">
          {MENU.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs ${
                  active ? "bg-white text-[#1e3a8a]" : "text-blue-100"
                }`}
              >
                {item.icon}
                <span className="w-full truncate text-center">{item.short}</span>
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
