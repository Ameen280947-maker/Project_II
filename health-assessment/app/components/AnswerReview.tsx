"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";

/* =========================================================
   ข้อคำถามและคำตอบของผู้ใช้ในการประเมินครั้งนั้น
   ใช้ร่วมกันในหน้ารายละเอียดผลของทุกแบบประเมิน
========================================================= */

type Answer = {
  questionId: number;
  question: string;
  answer: string;
};

export default function AnswerReview({
  assessmentId,
  className = "",
}: {
  assessmentId: string | number | null | undefined;
  className?: string;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;

    let cancelled = false;

    fetch(`/api/history/answers?assessmentId=${encodeURIComponent(String(assessmentId))}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) setAnswers(data.answers || []);
      })
      .catch((error) => console.error("Load assessment answers error:", error));

    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  // ไม่มีคำตอบที่บันทึกไว้ ไม่ต้องแสดงส่วนนี้
  if (answers.length === 0) return null;

  return (
    <section
      className={`rounded-[28px] border border-[#eee8e9] bg-white shadow-[0_15px_40px_rgba(35,25,30,0.045)] ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-6 text-left sm:px-7"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f3f1ec] text-[#4a4f59]">
          <ListChecks size={22} strokeWidth={1.8} />
        </span>

        <span className="flex-1">
          <span className="block text-lg font-bold text-[#2f3037]">คำถามและคำตอบของคุณ</span>
          <span className="block text-sm text-[#858991]">
            {answers.length} ข้อ · {open ? "แตะเพื่อซ่อน" : "แตะเพื่อดูคำตอบที่คุณเลือกในการประเมินครั้งนี้"}
          </span>
        </span>

        <ChevronDown
          size={22}
          className={`shrink-0 text-[#858991] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ol className="space-y-3 border-t border-[#f0eaeb] px-6 pb-6 pt-5 sm:px-7">
          {answers.map((item, index) => (
            <li key={`${item.questionId}-${index}`} className="flex gap-3 rounded-2xl bg-[#faf9f7] p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-[#4a4f59]">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-6 text-[#5e6268]">{item.question}</p>
                <p className="mt-1 font-semibold text-[#2f3037]">{item.answer}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
