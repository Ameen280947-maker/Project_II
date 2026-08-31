"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Heart,
  HeartPulse,
  Weight,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";

const assessmentCards = [
  {
    title:
      "แบบประเมินความเสี่ยงโรคหัวใจและหลอดเลือดในระยะ 10 ปีข้างหน้า",
    description:
      "ประเมินความเสี่ยงต่อการเกิดโรคหัวใจและหลอดเลือดสมองในอนาคต พร้อมรับคำแนะนำเบื้องต้นเพื่อสุขภาพหัวใจที่แข็งแรง",
    icon: Heart,
    iconClass:
      "bg-[#fff0f2] text-[#b91c2b]",
    buttonClass:
      "bg-gradient-to-r from-[#ee3f5b] to-[#f2556d] shadow-[0_12px_26px_rgba(238,63,91,0.22)]",
    href: "/assessment_CVD",
  },

  {
    title:
      "แบบประเมินความเสี่ยงการเกิดโรคเบาหวานใน 12 ปีข้างหน้า",
    description:
      "ตรวจสอบความเสี่ยงที่จะเป็นโรคเบาหวานภายใน 12 ปีข้างหน้า",
    icon: Activity,
    iconClass:
      "bg-[#eef8e9] text-[#6fa85e]",
    buttonClass:
      "bg-gradient-to-r from-[#9ac982] to-[#78ad69] shadow-[0_12px_26px_rgba(120,173,105,0.22)]",
    href: "/assessment_diabetes",
  },

  {
    title:
      "แบบประเมินความดันโลหิต",
    description:
      "ตรวจวัดและประเมินระดับความดันโลหิต เพื่อเฝ้าระวังปัจจัยเสี่ยงที่อาจส่งผลกระทบต่อร่างกายและระบบหัวใจ",
    icon: HeartPulse,
    iconClass:
      "bg-[#edf5ff] text-[#6e9ed5]",
    buttonClass:
      "bg-gradient-to-r from-[#8fb7e5] to-[#6e9ed5] shadow-[0_12px_26px_rgba(110,158,213,0.22)]",
    href: "/assessment_DB",
  },

  {
    title:
      "แบบประเมินภาวะน้ำหนักเกิน",
    description:
      "คำนวณค่า BMI เพื่อวิเคราะห์ความเสี่ยงจากภาวะน้ำหนักตัวเกินเกณฑ์มาตรฐาน",
    icon: Weight,
    iconClass:
      "bg-[#eef8e9] text-[#65a06f]",
    buttonClass:
      "bg-gradient-to-r from-[#86bb8c] to-[#65a06f] shadow-[0_12px_26px_rgba(101,160,111,0.22)]",
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

          <header>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Health Assessment
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-[44px]">
              Assessment-
              <span className="text-[#ef4962]">
                โรคไม่ติดต่อเรื้อรัง
              </span>
            </h1>

            <p className="mt-3 text-lg font-semibold text-[#4f535b]">
              แบบประเมินสุขภาพเบื้องต้น
            </p>

            <p className="mt-2 max-w-[720px] leading-7 text-[#8b8f98]">
              เริ่มต้นการดูแลสุขภาพของคุณด้วยการประเมินที่มีความแม่นยำสูง
              เพื่อวางแผนการใช้ชีวิตที่ดีในอนาคต
            </p>
          </header>

          {/* =================================================
              ASSESSMENT CARDS
          ================================================== */}

          <div className="mt-8 grid gap-6 xl:grid-cols-2">

            {assessmentCards.map((card) => {
              const Icon = card.icon;

              return (
                <section
                  key={card.title}
                  className="flex min-h-[300px] flex-col rounded-[28px] border border-[#eee8e9] bg-white p-6 shadow-[0_15px_40px_rgba(35,25,30,0.045)] sm:p-7"
                >

                  {/* Icon */}

                  <div
                    className={`grid h-14 w-14 place-items-center rounded-2xl ${card.iconClass}`}
                  >
                    <Icon
                      size={29}
                      strokeWidth={1.8}
                    />
                  </div>

                  {/* Title */}

                  <h2 className="mt-5 max-w-[520px] text-xl font-bold leading-8">
                    {card.title}
                  </h2>

                  {/* Description */}

                  <p className="mt-3 max-w-[560px] text-sm leading-7 text-[#858991]">
                    {card.description}
                  </p>

                  {/* Start button */}

                  <Link
                    href={card.href}
                    className={`mt-auto flex h-14 w-full items-center justify-center gap-3 rounded-2xl font-bold text-white transition hover:-translate-y-0.5 ${card.buttonClass}`}
                  >
                    เริ่มทำแบบประเมิน

                    <ArrowRight
                      size={21}
                    />
                  </Link>

                </section>
              );
            })}

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