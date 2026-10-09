"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Heart,
  HeartPulse,
  Weight,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";
import NotificationBell from "@/app/components/NotificationBell";
import AssessmentMenuCard, { type CardTone } from "@/app/components/AssessmentMenuCard";

const assessmentCards: { title: string; icon: typeof Heart; tone: CardTone; href: string }[] = [
  {
    title: "แบบประเมินความเสี่ยงโรคหัวใจและหลอดเลือดในระยะ 10 ปีข้างหน้า",
    icon: Heart,
    tone: "rose",
    href: "/assessment_CVD",
  },
  {
    title: "แบบประเมินความเสี่ยงการเกิดโรคเบาหวานใน 12 ปีข้างหน้า",
    icon: Activity,
    tone: "green",
    href: "/assessment_diabetes",
  },
  {
    title: "แบบประเมินความดันโลหิต",
    icon: HeartPulse,
    tone: "blue",
    href: "/assessment_DB",
  },
  {
    title: "แบบประเมินภาวะน้ำหนักเกิน",
    icon: Weight,
    tone: "mint",
    href: "/assessment_BMI",
  },
];

export default function AssessmentMenuPage() {
  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">

        {/* =====================================================
            SIDEBAR กลาง
        ====================================================== */}

        <Sidebar />

        {/* =====================================================
            MAIN CONTENT
        ====================================================== */}

        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
                Health Assessment
              </p>

              <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-[44px]">
                Assessment-
                <span className="text-[#ef4962]">
                  โรคไม่ติดต่อเรื้อรัง
                </span>
              </h1>

            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
              <NotificationBell />
            </div>
          </header>

          {/* =================================================
              ASSESSMENT CARDS
          ================================================== */}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {assessmentCards.map((card) => (
              <AssessmentMenuCard key={card.href} title={card.title} href={card.href} icon={card.icon} tone={card.tone} />
            ))}
          </div>

          {/* =================================================
              BACK BUTTON
          ================================================== */}

          <div className="mt-8 flex justify-end">

            <Link
              href="/assessment-type"
              className="flex items-center gap-2 rounded-full bg-[#fff0f2] px-5 py-3 font-semibold text-[#ef4962] transition hover:bg-[#ffe4e8]"
            >
              <ArrowLeft
                size={19}
              />

              ย้อนกลับ
            </Link>

          </div>

        </section>

      </div>
    </main>
  );
}