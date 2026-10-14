"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import StaffSidebar from "./components/StaffSidebar";
import { clearStaffSession } from "@/lib/staff/client";

// role_id ของเจ้าหน้าที่ (เทียบแบบข้อความ)
const STAFF_ROLE_ID = "3";

// เลย์เอาต์ระบบเจ้าหน้าที่: ตรวจ session ว่าเป็น role staff ก่อนแสดง ถ้าไม่ใช่ให้กลับไปหน้า login
export default function StaffLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  // ผ่านการตรวจสิทธิ์แล้วหรือยัง
  const [allowed, setAllowed] = useState(false);

  // ตรวจ session staff จาก /api/auth/session ตอนเปิดหน้า ไม่ผ่าน → ล้างข้อมูลแล้วไป /login
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

  // ระหว่างตรวจสิทธิ์ แสดงตัวหมุนโหลด
  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-staff-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-staff-100 border-t-staff-500" role="status" aria-label="กำลังตรวจสอบสิทธิ์" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-staff-bg text-staff-ink lg:flex-row">
      {/* เมนูด้านข้าง และพื้นที่เนื้อหาของหน้า */}
      <StaffSidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
