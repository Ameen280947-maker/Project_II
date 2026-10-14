"use client";

import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import AssessmentMenuCard, { type CardTone } from "@/app/components/AssessmentMenuCard";
import CategoryAssessmentCards from "@/app/components/CategoryAssessmentCards";

import {
    ArrowLeft,
    Brain,
    HeartPulse,
} from "lucide-react";

// ข้อมูลการ์ดแบบประเมินสุขภาพจิต 1 ใบ (ชื่อ ลิงก์ ไอคอน สี)
type MentalHealthAssessment = {
    title: string;
    href: string;

    icon:
    | typeof Brain
    | typeof HeartPulse;

    tone: CardTone;
};

// รายการแบบประเมินด้านสุขภาพจิต (ความเครียด, ซึมเศร้า 2Q)
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

// หน้า: เมนูเลือกแบบประเมินด้านสุขภาพจิต
export default function MentalHealthMenuPage() {
    return (
        <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
            <div className="flex min-h-screen">

                <Sidebar />

                <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

                    {/* ส่วนหัว: ชื่อหมวดสุขภาพจิต */}
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

                    {/* การ์ดแบบประเมินสุขภาพจิต + แบบประเมินเพิ่มเติมในหมวด */}
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
                      <CategoryAssessmentCards routePath="/assessment-menu-mental-health" />
                    </div>

                    {/* ปุ่มย้อนกลับ */}
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