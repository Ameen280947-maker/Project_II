"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AdminSidebar from "./components/AdminSidebar";

/* =========================================================
   LAYOUT ของทุกหน้า /admin/*
   - ถ้ายังไม่ login หรือ role ไม่ใช่ system_admin → กลับไปหน้า /login
   - API ฝั่ง server ตรวจสิทธิ์ซ้ำอีกชั้น (lib/adminAuth.ts)
========================================================= */

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    try {
      const role = localStorage.getItem("role");
      const userId = localStorage.getItem("userId");
      if (!userId || role !== "system_admin") {
        router.replace("/login");
        return;
      }
      setUsername(localStorage.getItem("username") ?? "");
      setAllowed(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-[#64748b]">
        <Loader2 className="mr-2 animate-spin" size={20} /> กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#0f172a] lg:flex">
      <AdminSidebar username={username} />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
