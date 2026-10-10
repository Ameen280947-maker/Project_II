"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";

/* =========================================================
   แจ้งเตือนเมื่อผู้ใช้ถอนความยินยอมเก็บข้อมูลสุขภาพ (หน้าการตั้งค่า)
   แสดงทับหน้าทำแบบประเมินตั้งแต่เปิดหน้า เพราะ API จะไม่รับผลประเมิน
   ให้เลือกไปเปิดความยินยอม หรือกลับไปหน้าแบบประเมิน
========================================================= */

export default function HealthConsentNotice() {
  const [withdrawn, setWithdrawn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    fetch(`/api/settings?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && data.settings?.consent_health === false) setWithdrawn(true);
      })
      .catch((error) => console.error("Check health consent error:", error));

    return () => {
      cancelled = true;
    };
  }, []);

  if (!withdrawn) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-consent-title"
    >
      <div className="w-full max-w-md rounded-[28px] bg-white p-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">
          <ShieldOff size={30} />
        </div>
        <h2 id="health-consent-title" className="mt-5 text-xl font-bold text-[#16181d]">
          ยังไม่ได้ยินยอมให้เก็บข้อมูลสุขภาพ
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#686970]">
          คุณถอนความยินยอมให้เก็บและประมวลผลข้อมูลสุขภาพไว้ ระบบจึงไม่สามารถบันทึกผลประเมินได้
          หากต้องการทำแบบประเมิน กรุณาเปิดความยินยอมที่หน้าการตั้งค่า
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/settings#privacy"
            className="flex h-12 items-center justify-center rounded-2xl bg-[#b91c2b] font-bold text-white transition hover:bg-[#991b1b]"
          >
            ไปที่การตั้งค่าความเป็นส่วนตัว
          </Link>
          <Link
            href="/assessment-type"
            className="flex h-12 items-center justify-center rounded-2xl border border-[#eee5e6] font-semibold text-[#686970] transition hover:bg-[#faf7f7]"
          >
            กลับไปหน้าแบบประเมิน
          </Link>
        </div>
      </div>
    </div>
  );
}
