import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CardTone } from "@/app/components/AssessmentMenuCard";

/* =========================================================
   ปุ่มท้ายหน้าผลประเมิน/คำแนะนำ
   "กลับไปแก้แบบประเมิน" + "เลือกแบบประเมินอื่น"
   ใช้เหมือนกันทุกแบบประเมิน (อิงหน้าโรคหัวใจ) สีตามโทนของแบบประเมิน
========================================================= */

const btnBase = "flex h-13 items-center justify-center gap-2 rounded-full px-6 font-semibold";

// เขียนคลาสเต็มทุกตัว ให้ Tailwind สร้าง CSS ได้
const TONES: Record<CardTone, { edit: string; menu: string }> = {
  rose: { edit: "border-[#ead9db] text-[#8a1420]", menu: "bg-[#fff0f2] text-[#ef4962]" },
  green: { edit: "border-[#cde0c0] text-[#2c5a20]", menu: "bg-[#ebf3e2] text-[#3f7a2e]" },
  blue: { edit: "border-[#c8d3ec] text-[#22397a]", menu: "bg-[#e8edf8] text-[#2f4fa0]" },
  mint: { edit: "border-[#c4dbcb] text-[#235638]", menu: "bg-[#e5f0e8] text-[#2c6b45]" },
  amber: { edit: "border-[#edd5a6] text-[#6b4500]", menu: "bg-[#fbf1dd] text-[#8a5a00]" },
  teal: { edit: "border-[#bbdfd7] text-[#165e51]", menu: "bg-[#e2f3ef] text-[#1f7a69]" },
  violet: { edit: "border-[#d4c9ee] text-[#452e80]", menu: "bg-[#eee9f9] text-[#5b3ea6]" },
  pink: { edit: "border-[#efc1d3] text-[#8c1a45]", menu: "bg-[#fce9f0] text-[#b4235a]" },
};

export default function ResultActions({
  editHref,
  menuHref = "/assessment-menu",
  onMenuClick,
  tone = "rose",
  className = "mt-8",
}: {
  editHref: string;
  menuHref?: string;
  /* ใช้แทนลิงก์ เมื่อหน้าต้องทำอย่างอื่นก่อนเปลี่ยนหน้า เช่น เปิด popup */
  onMenuClick?: () => void;
  tone?: CardTone;
  className?: string;
}) {
  const t = TONES[tone];
  const menuCls = `${btnBase} ${t.menu}`;

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:justify-end ${className}`}>
      <Link href={editHref} className={`${btnBase} border bg-white ${t.edit}`}>
        <ArrowLeft size={19} />
        กลับไปแก้แบบประเมิน
      </Link>

      {onMenuClick ? (
        <button type="button" onClick={onMenuClick} className={menuCls}>
          เลือกแบบประเมินอื่น
          <ArrowRight size={19} />
        </button>
      ) : (
        <Link href={menuHref} className={menuCls}>
          เลือกแบบประเมินอื่น
          <ArrowRight size={19} />
        </Link>
      )}
    </div>
  );
}
