"use client";

import { useState } from "react";
import type { SnapLevel, SnapQuestion } from "./shared";

/* =========================================================
   แท็บ "ตัวอย่าง" — คำถามตามที่ผู้ใช้เห็น (โทนแดงแบบหน้าผู้ใช้จริง)
   ใช้ซ้ำในหน้าดูเวอร์ชันเก่า (readOnly)
========================================================= */

// แท็บตัวอย่าง: แสดงคำถามแบบที่ผู้ใช้เห็น ลองเลือกคำตอบเพื่อดูคะแนนรวมและผล
export default function PreviewTab({
  label,
  description,
  questions,
  levels,
  generic,
}: {
  label: string;
  description: string;
  questions: SnapQuestion[];
  levels: SnapLevel[];
  generic: boolean;
}) {
  // ลำดับคำถาม → ลำดับตัวเลือกที่เลือก
  const [picked, setPicked] = useState<Record<number, number>>({});
  const answered = questions.filter((q, i) => q.type === "choice" && picked[i] !== undefined).length;
  const total = questions.reduce((s, q, i) => s + (picked[i] !== undefined ? q.choices[picked[i]]?.score ?? 0 : 0), 0);
  const level = generic ? levels.find((l) => l.min !== null && l.max !== null && total >= l.min && total <= l.max) : undefined;

  return (
    <div className="mt-4 rounded-3xl bg-[#fbf7f7] p-4 sm:p-6">
      <p className="text-sm font-semibold text-[#b91c2b]">แบบประเมิน</p>
      <h3 className="break-words text-xl font-bold text-[#2f3037]">{label}</h3>
      {description && <p className="mt-1 text-sm text-[#777780]">{description}</p>}
      <div className="mt-4 flex flex-col gap-3">
        {questions.length === 0 && <p className="text-sm text-[#777780]">ยังไม่มีคำถาม</p>}
        {questions.map((q, i) => (
          <div key={i} className="rounded-2xl border border-[#eee5e6] bg-white p-4">
            <p className="break-words font-semibold text-[#2f3037]">
              {i + 1}. {q.text || "…"}
            </p>
            {q.type === "number" ? (
              <input type="number" disabled placeholder="กรอกตัวเลข" className="mt-3 w-40 max-w-full rounded-xl border border-[#eee5e6] px-3 py-2 text-sm" />
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.choices.map((c, j) => {
                  const on = picked[i] === j;
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setPicked((a) => ({ ...a, [i]: j }))}
                      className={`break-words rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                        on ? "border-[#b91c2b] bg-[#fff0f2] font-semibold text-[#b91c2b]" : "border-[#eee5e6] text-[#2f3037]"
                      }`}
                    >
                      {c.text || "…"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-[#777780]">
        คะแนนรวมจากตัวอย่าง: <b className="text-[#2f3037]">{total}</b>
        {generic && answered > 0 && (
          <>
            {" · "}ผลที่ได้: <b className="text-[#2f3037]">{level?.riskLevel || "ไม่อยู่ในช่วงเกณฑ์ใด"}</b>
          </>
        )}
      </p>
    </div>
  );
}
