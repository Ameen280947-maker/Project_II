"use client";

import Link from "next/link";
import {
  Activity,
  Apple,
  ArrowRight,
  Brain,
  Cigarette,
  Dumbbell,
  Heart,
  Wine,
} from "lucide-react";
import type { ReactNode } from "react";

import Sidebar from "@/app/components/Sidebar";

const assessmentTypes = [
  {
    title: "โรคไม่ติดต่อเรื้อรัง",
    subtitle: "(NCDs)",
    descriptionItems: [
      "โรคหัวใจและหลอดเลือด",
      "โรคเบาหวาน",
      "ความดันโลหิตสูง",
    ],
    href: "/assessment-menu",
    theme: "red" as const,
  },
  {
    title: "ความเสี่ยงด้านพฤติกรรม",
    descriptionItems: [
      "การสูบบุหรี่",
      "แอลกอฮอล์",
      "การออกกำลังกาย",
      "การรับประทานอาหาร",
    ],
    href: "/behavior-assessment",
    theme: "green" as const,
  },
  {
    title: "ความเสี่ยงด้านสุขภาพจิต",
    descriptionItems: [
      "ความเครียดสะสม",
      "ภาวะซึมเศร้า",
    ],
    href: "/mental-health-assessment",
    theme: "blue" as const,
  },
];

export default function AssessmentTypePage() {
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

        <section className="min-w-0 flex-1 px-5 py-5 sm:px-6 lg:px-8">

          {/* Header */}

          <header>
            

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Assessment-
              <span className="text-[#ef4962]">
                Type
              </span>
            </h1>

            <h2 className="mt-3 text-2xl font-bold">
              เข้าสู่แบบประเมิน
            </h2>

            <p className="mt-3 max-w-[760px] text-sm leading-7 text-[#7c7d85]">
              กรุณาเลือกประเภทแบบประเมินที่คุณต้องการ
              เพื่อให้ระบบวิเคราะห์ข้อมูลสุขภาพเบื้องต้นของคุณอย่างเหมาะสม
            </p>
          </header>

          {/* =================================================
              ASSESSMENT CARDS
          ================================================== */}

          <div className="mt-6 grid gap-5 xl:grid-cols-3">

            {assessmentTypes.map((type) => (
              <AssessmentTypeCard
                key={type.title}
                title={type.title}
                subtitle={type.subtitle}
                descriptionItems={
                  type.descriptionItems
                }
                href={type.href}
                theme={type.theme}
              />
            ))}

          </div>

        </section>

      </div>
    </main>
  );
}

/* =========================================================
   ASSESSMENT TYPE CARD
========================================================= */

type AssessmentTypeCardProps = {
  title: string;
  subtitle?: string;

  descriptionItems: string[];

  href: string;

  theme:
    | "red"
    | "green"
    | "blue";
};

function AssessmentTypeCard({
  title,
  subtitle,
  descriptionItems,
  href,
  theme,
}: AssessmentTypeCardProps) {
  const themeStyles = {
    red: {
      imageArea:
        "bg-[#fff0f2]",

      icon:
        "text-[#ef4962]",

      bullet:
        "bg-[#ef4962]",

      button:
        "bg-gradient-to-r from-[#ef3153] to-[#f5526a] text-white shadow-[0_12px_26px_rgba(239,49,83,0.22)]",

      accent:
        "text-[#ef4962]",
    },

    green: {
      imageArea:
        "bg-[#eff8ec]",

      icon:
        "text-[#67a556]",

      bullet:
        "bg-[#67a556]",

      button:
        "bg-gradient-to-r from-[#eef7e9] to-[#dfeeda] text-[#5b963f]",

      accent:
        "text-[#67a556]",
    },

    blue: {
      imageArea:
        "bg-[#edf5ff]",

      icon:
        "text-[#6594c8]",

      bullet:
        "bg-[#6594c8]",

      button:
        "bg-gradient-to-r from-[#edf5ff] to-[#dceafb] text-[#527da9]",

      accent:
        "text-[#6594c8]",
    },
  }[theme];

  return (
    <article className="flex min-h-[535px] flex-col overflow-hidden rounded-[26px] border border-[#eee8e9] bg-white p-5 shadow-[0_14px_36px_rgba(35,25,30,0.045)]">

      {/* Illustration */}

      <div
        className={`relative flex h-[170px] items-center justify-center overflow-hidden rounded-[22px] ${themeStyles.imageArea}`}
      >
        <AssessmentIllustration
          theme={theme}
        />
      </div>

      {/* Content */}

      <div className="mt-5">

        <h3 className="text-[25px] font-bold leading-tight">
          {title}
        </h3>

        {subtitle && (
          <p
            className={`mt-1.5 text-xl font-bold ${themeStyles.accent}`}
          >
            {subtitle}
          </p>
        )}

        <div className="mt-5 space-y-3">

          {descriptionItems.map(
            (item) => (
              <div
                key={item}
                className="flex items-start gap-3 text-sm text-[#5f6068]"
              >

                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${themeStyles.bullet}`}
                />

                <span>
                  {item}
                </span>

              </div>
            ),
          )}

        </div>

      </div>

      {/* Start button */}

      <Link
        href={href}
        className={`mt-auto flex h-13 min-h-13 items-center justify-center gap-3 rounded-2xl px-5 text-base font-bold transition hover:-translate-y-0.5 ${themeStyles.button}`}
      >
        เริ่มประเมิน

        <ArrowRight
          size={20}
        />
      </Link>

    </article>
  );
}

/* =========================================================
   ASSESSMENT ILLUSTRATION
========================================================= */

function AssessmentIllustration({
  theme,
}: {
  theme:
    | "red"
    | "green"
    | "blue";
}) {
  /* ================= NCD ================= */

  if (theme === "red") {
    return (
      <div className="relative grid h-32 w-32 place-items-center rounded-full bg-white/75 text-[#ef4962] shadow-[0_14px_34px_rgba(239,73,98,0.1)]">

        <Heart
          size={78}
          fill="currentColor"
          strokeWidth={1.2}
        />

        <Activity
          size={62}
          className="absolute text-white"
          strokeWidth={1.8}
        />

      </div>
    );
  }

  /* ================= Behavior ================= */

  if (theme === "green") {
    return (
      <div className="grid grid-cols-2 gap-3">

        <IconCircle>
          <Apple size={38} />
        </IconCircle>

        <IconCircle>
          <Dumbbell size={38} />
        </IconCircle>

        <IconCircle>
          <Cigarette size={36} />
        </IconCircle>

        <IconCircle>
          <Wine size={36} />
        </IconCircle>

      </div>
    );
  }

  /* ================= Mental Health ================= */

  return (
    <div className="relative grid h-36 w-36 place-items-center rounded-full bg-white/75 text-[#6594c8] shadow-[0_14px_34px_rgba(101,148,200,0.12)]">

      <Brain
        size={80}
        strokeWidth={1.4}
      />

      <div className="absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full bg-[#edf5ff]">

        <Heart
          size={24}
        />

      </div>

    </div>
  );
}

/* =========================================================
   ICON CIRCLE
========================================================= */

function IconCircle({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid h-20 w-20 place-items-center rounded-full bg-white/80 text-[#67a556] shadow-[0_8px_20px_rgba(60,110,50,0.08)]">
      {children}
    </div>
  );
}