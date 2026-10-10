import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/* =========================================================
   ปุ่มย้อนกลับมุมขวาบนของหน้าแบบประเมิน (แบบ minimal)
   ใช้เหมือนกันทุกแบบประเมิน
========================================================= */

export default function AssessmentBackLink({
  href,
  label = "ย้อนกลับ",
  className = "",
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-[#85858d] transition hover:bg-[#f3f1f1] hover:text-[#16181d] ${className}`}
    >
      <ChevronLeft size={16} />
      {label}
    </Link>
  );
}
