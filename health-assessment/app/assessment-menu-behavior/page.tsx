"use client";

import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";

import {
  ArrowLeft,
  ArrowRight,
  Cigarette,
  Dumbbell,
  Moon,
  Utensils,
  Wine,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type BehaviorAssessment = {
  title: string;
  description: string;
  href: string;

  icon:
  | typeof Cigarette
  | typeof Wine
  | typeof Dumbbell
  | typeof Moon
  | typeof Utensils;

  iconClass: string;
  buttonClass: string;
};

/* =========================================================
   DATA
========================================================= */

const behaviorAssessments: BehaviorAssessment[] = [
  {
    title: "การสูบบุหรี่",

    description:
      "ประเมินพฤติกรรมการสูบบุหรี่และระดับความเสี่ยงที่อาจส่งผลกระทบต่อสุขภาพ",

    href: "/assessment_smoking",

    icon: Cigarette,

    iconClass:
      "bg-[#eef8e9] text-[#65a05b]",

    buttonClass:
      "bg-gradient-to-r from-[#9ac982] to-[#72ad64] shadow-[0_12px_26px_rgba(114,173,100,0.22)]",
  },

  {
    title: "การดื่มแอลกอฮอล์",

    description:
      "ประเมินพฤติกรรมการดื่มแอลกอฮอล์และปัจจัยเสี่ยงที่อาจส่งผลต่อสุขภาพ",

    href: "/assessment-menu-behavior/alcohol",

    icon: Wine,

    iconClass:
      "bg-[#fff6e5] text-[#e5a629]",

    buttonClass:
      "bg-gradient-to-r from-[#f5bc36] to-[#e9a51b] shadow-[0_12px_26px_rgba(233,165,27,0.22)]",
  },

  {
    title: "การออกกำลังกาย",

    description:
      "ประเมินระดับกิจกรรมทางกายและความเพียงพอของการออกกำลังกายในชีวิตประจำวัน",

    href: "#",

    icon: Dumbbell,

    iconClass:
      "bg-[#eaf9f5] text-[#36ad96]",

    buttonClass:
      "bg-gradient-to-r from-[#48c2ab] to-[#2eae97] shadow-[0_12px_26px_rgba(46,174,151,0.22)]",
  },

  {
    title: "การนอนหลับ",

    description:
      "ประเมินระยะเวลา คุณภาพ และความสม่ำเสมอของการนอนหลับ เพื่อเฝ้าระวังปัญหาการนอน",

    href: "/sleep-assessment",

    icon: Moon,

    iconClass:
      "bg-[#f3edff] text-[#7650b9]",

    buttonClass:
      "bg-gradient-to-r from-[#8255c5] to-[#6e43ad] shadow-[0_12px_26px_rgba(110,67,173,0.22)]",
  },

  {
    title: "การรับประทานอาหาร",

    description:
      "ประเมินพฤติกรรมการรับประทานอาหารและคุณภาพของอาหารที่บริโภคในชีวิตประจำวัน",

    href: "/assessment-menu-behavior/diet",

    icon: Utensils,

    iconClass:
      "bg-[#fff0f4] text-[#ed5c82]",

    buttonClass:
      "bg-gradient-to-r from-[#f26387] to-[#ec4e76] shadow-[0_12px_26px_rgba(236,78,118,0.22)]",
  },
];

/* =========================================================
   PAGE
========================================================= */

export default function BehaviorAssessmentPage() {
  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <Sidebar />

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

          {/* =================================================
              HEADER
          ================================================= */}

          <header>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#57965c]">
              Health Assessment
            </p>

            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-[44px]">
              Assessment-
              <span className="text-[#57965c]">
                ความเสี่ยงด้านพฤติกรรม
              </span>
            </h1>

            <p className="mt-3 text-lg font-semibold text-[#4f535b]">
              แบบประเมินสุขภาพเบื้องต้น
            </p>

            <p className="mt-2 max-w-[850px] leading-7 text-[#8b8f98]">
              ประเมินพฤติกรรมในชีวิตประจำวัน
              เพื่อค้นหาปัจจัยเสี่ยงด้านพฤติกรรม
              ที่อาจส่งผลกระทบต่อสุขภาพของคุณ
            </p>
          </header>

          {/* =================================================
              ASSESSMENT CARDS
          ================================================= */}

          <div className="mt-8 grid gap-6 xl:grid-cols-2">

            {behaviorAssessments.map(
              (assessment) => {
                const Icon = assessment.icon;

                return (
                  <article
                    key={assessment.title}
                    className="flex min-h-[300px] flex-col rounded-[28px] border border-[#eee8e9] bg-white p-6 shadow-[0_15px_40px_rgba(35,25,30,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(35,25,30,0.07)] sm:p-7"
                  >

                    {/* =================================================
                        ICON
                    ================================================= */}

                    <div
                      className={`grid h-14 w-14 place-items-center rounded-2xl ${assessment.iconClass}`}
                    >
                      <Icon
                        size={29}
                        strokeWidth={1.8}
                      />
                    </div>

                    {/* =================================================
                        TITLE
                    ================================================= */}

                    <h2 className="mt-5 text-xl font-bold leading-8">
                      {assessment.title}
                    </h2>

                    {/* =================================================
                        DESCRIPTION
                    ================================================= */}

                    <p className="mt-3 max-w-[600px] text-sm leading-7 text-[#858991]">
                      {assessment.description}
                    </p>

                    {/* =================================================
                        BUTTON
                    ================================================= */}

                    <Link
                      href={assessment.href}
                      className={`mt-auto flex h-14 w-full items-center justify-center gap-3 rounded-2xl font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-[1.03] ${assessment.buttonClass}`}
                    >
                      เริ่มทำแบบประเมิน

                      <ArrowRight
                        size={21}
                      />
                    </Link>

                  </article>
                );
              },
            )}

          </div>

          {/* =================================================
              INFORMATION BANNER
          ================================================= */}


          {/* =================================================
              BACK BUTTON
          ================================================= */}

          <div className="mt-7 flex justify-end">

            <Link
              href="/assessment-type"
              className="flex items-center gap-2 rounded-full bg-[#eef8e9] px-5 py-3 font-semibold text-[#57965c] transition hover:bg-[#e2f2dc]"
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