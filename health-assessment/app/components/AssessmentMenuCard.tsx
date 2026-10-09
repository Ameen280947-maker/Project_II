import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

/* =========================================================
   การ์ดเลือกแบบประเมิน (ใช้ในหน้าเมนูแบบประเมินทุกหมวด)
   - พื้นสีพาสเทลตามโทน + ไอคอนตกแต่งจาง ๆ มุมขวาล่าง
   - ทั้งการ์ดกดได้ เมื่อชี้เมาส์: การ์ดลอยขึ้น ไอคอนตกแต่งขยาย/เอียง ลูกศรเลื่อนไปขวา
========================================================= */

export type CardTone = "rose" | "green" | "blue" | "mint" | "amber" | "teal" | "violet" | "pink";

// เขียนคลาสเต็มทุกตัว ให้ Tailwind สร้าง CSS ได้
const TONES: Record<CardTone, { card: string; icon: string; deco: string }> = {
  rose: { card: "bg-[#fce8ea] hover:bg-[#fadde2]", icon: "text-[#a3112a]", deco: "text-[#ebbcc5]" },
  green: { card: "bg-[#ebf3e2] hover:bg-[#e2edd5]", icon: "text-[#3f7a2e]", deco: "text-[#cde0c0]" },
  blue: { card: "bg-[#e8edf8] hover:bg-[#dee5f5]", icon: "text-[#2f4f9e]", deco: "text-[#c8d3ec]" },
  mint: { card: "bg-[#e5f0e8] hover:bg-[#dbeadf]", icon: "text-[#2c6b45]", deco: "text-[#c4dbcb]" },
  amber: { card: "bg-[#fbf1dd] hover:bg-[#f8e9cc]", icon: "text-[#8a5a00]", deco: "text-[#edd5a6]" },
  teal: { card: "bg-[#e2f3ef] hover:bg-[#d6ede8]", icon: "text-[#1f7a69]", deco: "text-[#bbdfd7]" },
  violet: { card: "bg-[#eee9f9] hover:bg-[#e6dff6]", icon: "text-[#5b3ea6]", deco: "text-[#d4c9ee]" },
  pink: { card: "bg-[#fce9f0] hover:bg-[#f9dfe9]", icon: "text-[#b4235a]", deco: "text-[#efc1d3]" },
};

export default function AssessmentMenuCard({
  title,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  href: string;
  icon: LucideIcon;
  tone: CardTone;
}) {
  const t = TONES[tone];

  return (
    <Link
      href={href}
      className={`group relative isolate flex min-h-[240px] flex-col overflow-hidden rounded-[28px] p-7 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(22,24,29,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b1f2a] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-8 ${t.card}`}
    >
      {/* ไอคอนตกแต่ง */}
      <Icon
        aria-hidden
        size={224}
        strokeWidth={1.6}
        className={`pointer-events-none absolute -bottom-12 -right-10 -z-10 h-44 w-44 transition duration-500 ease-out group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transition-none sm:h-56 sm:w-56 ${t.deco}`}
      />

      <span
        className={`grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-[0_4px_12px_rgba(22,24,29,0.06)] transition duration-300 group-hover:scale-110 motion-reduce:transition-none ${t.icon}`}
      >
        <Icon size={24} strokeWidth={1.9} />
      </span>

      <h2 className="mt-5 max-w-[78%] text-[22px] font-bold leading-snug text-[#16181d]">{title}</h2>

      <span className="mt-auto pt-6">
        <span className="inline-flex h-12 items-center gap-3 rounded-full bg-[#1b1f2a] px-6 font-semibold text-white transition-colors duration-300 group-hover:bg-black">
          เริ่มทำแบบประเมิน
          <ArrowRight
            size={19}
            className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
          />
        </span>
      </span>
    </Link>
  );
}
