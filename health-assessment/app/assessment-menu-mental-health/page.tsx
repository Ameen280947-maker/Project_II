"use client";

import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import AssessmentMenuCard, { type CardTone } from "@/app/components/AssessmentMenuCard";

import {
    ArrowLeft,
    Brain,
    HeartPulse,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type MentalHealthAssessment = {
    title: string;
    href: string;

    icon:
    | typeof Brain
    | typeof HeartPulse;

    tone: CardTone;
};

/* =========================================================
   DATA
========================================================= */

const mentalHealthAssessments: MentalHealthAssessment[] = [
    {
        title: "ความเครียดสะสม",


        href: "/assessment_stress",

        icon: Brain,

        tone: "blue",
    },

    {
        title: "ภาวะซึมเศร้า",


        href: "/assessment_depression_2q",

        icon: HeartPulse,

        tone: "violet",
    },
];

/* =========================================================
   PAGE
========================================================= */

export default function MentalHealthMenuPage() {
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
                                ความเสี่ยงด้านสุขภาพจิต
                            </span>
                        </h1>

                    </header>

                    {/* =================================================
              ASSESSMENT CARDS
          ================================================= */}

                    <div className="mt-8 grid gap-6 lg:grid-cols-2">
                      {mentalHealthAssessments.map((assessment) => (
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

                    <div className="mt-7 rounded-[24px] border border-[#e8edf5] bg-[#f5f8fc] px-6 py-5">

                        <div className="flex items-start gap-4">

                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e7f0fb] text-[#6595ce]">
                                <Brain
                                    size={23}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <div>
                                <h3 className="font-bold text-[#4f535b]">
                                    เกี่ยวกับการประเมินสุขภาพจิต
                                </h3>

                                <p className="mt-1 text-sm leading-6 text-[#858991]">
                                    แบบประเมินนี้ใช้สำหรับคัดกรองความเสี่ยงเบื้องต้น
                                    ไม่ใช่การวินิจฉัยทางการแพทย์
                                    หากพบว่ามีความเสี่ยงหรือมีอาการที่ส่งผลกระทบต่อการใช้ชีวิต
                                    ควรปรึกษาผู้เชี่ยวชาญด้านสุขภาพจิต
                                </p>
                            </div>

                        </div>

                    </div>

                    {/* =================================================
              BACK BUTTON
          ================================================= */}

                    <div className="mt-7 flex justify-end">

                        <Link
                            href="/assessment-type"
                            className="
                flex
                items-center
                gap-2
                rounded-full
                bg-[#eef5ff]
                px-5
                py-3
                font-semibold
                text-[#6092cb]
                transition
                hover:bg-[#e2edf9]
              "
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