"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";

/* =========================================================
   แจ้งเตือนเมื่อแบบประเมินถูกปิดใช้งาน (staff ปิดไว้)
   แสดงทับหน้าทำแบบประเมิน ผู้ใช้ทำต่อไม่ได้ ให้เลือกไปหน้าอื่นแทน
========================================================= */

export default function AssessmentClosedNotice({ typeId }: { typeId: number }) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/assessments/status?typeId=${typeId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && data.isActive === false) setClosed(true);
      })
      .catch((error) => console.error("Check assessment status error:", error));

    return () => {
      cancelled = true;
    };
  }, [typeId]);

  if (!closed) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assessment-closed-title"
    >
      <div className="w-full max-w-md rounded-[28px] bg-white p-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fbefd6] text-[#7a4a00]">
          <CalendarClock size={30} strokeWidth={1.8} />
        </div>

        <h2 id="assessment-closed-title" className="mt-5 text-xl font-bold text-[#2f3037]">
          แบบประเมินนี้ปิดให้บริการชั่วคราว
        </h2>

        <p className="mt-3 text-sm leading-7 text-[#6b6d75]">
          ขณะนี้ยังไม่สามารถทำแบบประเมินนี้ได้ กรุณาเลือกทำแบบประเมินอื่นก่อน หรือกลับมาใหม่ภายหลัง
          ผลการประเมินที่คุณเคยทำไว้ยังดูได้ตามปกติในหน้าประวัติ
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/assessment-type"
            className="flex h-12 items-center justify-center rounded-2xl bg-[#b91c2b] font-semibold text-white transition hover:bg-[#991b2b]"
          >
            เลือกแบบประเมินอื่น
          </Link>
          <Link
            href="/history"
            className="flex h-12 items-center justify-center rounded-2xl border border-[#e8dddd] bg-white font-semibold text-[#777780] transition hover:bg-[#faf7f7]"
          >
            ดูประวัติการประเมิน
          </Link>
        </div>
      </div>
    </div>
  );
}
