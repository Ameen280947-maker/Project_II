"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import StaffSidebar from "./components/StaffSidebar";
import { clearStaffSession } from "@/lib/staff/client";

/* =========================================================
   LAYOUT ฝั่ง Staff
   - กันผู้ใช้ทั่วไปเข้าหน้า /staff (ด่านแรกฝั่งเบราว์เซอร์)
   - ด่านจริงอยู่ที่ API ทุกตัว (requireStaff เช็ค role จากฐานข้อมูล)
========================================================= */

const STAFF_ROLE_ID = "3";

export default function StaffLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  // ตรวจจาก cookie session_staff ที่ server (แยกจาก session ของผู้ใช้ทั่วไป
  // จึงเปิดหน้า staff กับหน้าผู้ใช้คนละแท็บพร้อมกันได้)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session?role=staff", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || String(data?.user?.role_id) !== STAFF_ROLE_ID) {
          clearStaffSession();
          router.replace("/login");
          return;
        }
        localStorage.setItem("staffUserId", String(data.user.user_id));
        setAllowed(true);
      })
      .catch(() => !cancelled && router.replace("/login"));
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-staff-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-staff-100 border-t-staff-500" role="status" aria-label="กำลังตรวจสอบสิทธิ์" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-staff-bg text-staff-ink lg:flex-row">
      <StaffSidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
