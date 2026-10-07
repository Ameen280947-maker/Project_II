"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AdminSidebar from "./components/AdminSidebar";

/* =========================================================
   LAYOUT ของทุกหน้า /admin/*
   - ถามสิทธิ์จาก server (/api/admin/me อ่าน session cookie)
     ไม่ใช้ค่า role ใน localStorage เพราะแก้เองได้
   - ยังไม่ login หรือไม่ใช่ system_admin → กลับไปหน้า /login
   - API ทุกตัวของ admin ตรวจสิทธิ์ซ้ำอีกชั้น (lib/adminAuth.ts)
========================================================= */

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/me", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          router.replace("/login");
          return;
        }
        setUsername(data.admin?.username ?? "");
        setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
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
