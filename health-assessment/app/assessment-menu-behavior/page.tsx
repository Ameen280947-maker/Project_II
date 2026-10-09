"use client";

import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import NotificationBell from "@/app/components/NotificationBell";
import AssessmentMenuCard, { type CardTone } from "@/app/components/AssessmentMenuCard";

import {
  ArrowLeft,
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
  href: string;

  icon:
  | typeof Cigarette
  | typeof Wine
  | typeof Dumbbell
  | typeof Moon
  | typeof Utensils;

  tone: CardTone;
};

/* =========================================================
   DATA
========================================================= */

const behaviorAssessments: BehaviorAssessment[] = [
  {
    title: "การสูบบุหรี่",


    href: "/assessment_smoking",

    icon: Cigarette,

    tone: "green",
  },

  {
    title: "การดื่มแอลกอฮอล์",


    href: "/assessment_alcohol",

    icon: Wine,

    tone: "amber",
  },

  {
    title: "การออกกำลังกาย",


    href: "/assessment_physical_activity",

    icon: Dumbbell,

    tone: "teal",
  },

  {
    title: "การนอนหลับ",


    href: "/sleep-assessment",

    icon: Moon,

    tone: "violet",
  },

  {
    title: "การรับประทานอาหาร",


    href: "/assessment_diet",

    icon: Utensils,

    tone: "pink",
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

          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#57965c]">
                Health Assessment
              </p>

              <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-[44px]">
                Assessment-
                <span className="text-[#57965c]">
                  ความเสี่ยงด้านพฤติกรรม
                </span>
              </h1>

            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
              <NotificationBell />
            </div>
          </header>

          {/* =================================================
              ASSESSMENT CARDS
          ================================================= */}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {behaviorAssessments.map((assessment) => (
              <AssessmentMenuCard
                key={assessment.href}
                title={assessment.title}
                href={assessment.href}
                icon={assessment.icon}
                tone={assessment.tone}
              />
            ))}
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