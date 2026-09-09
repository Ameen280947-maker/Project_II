"use client";

import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";

import {
    ArrowLeft,
    ArrowRight,
    Brain,
    HeartPulse,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type MentalHealthAssessment = {
    title: string;
    description: string;
    href: string;

    icon:
    | typeof Brain
    | typeof HeartPulse;

    iconClass: string;
    buttonClass: string;
};

/* =========================================================
   DATA
========================================================= */

const mentalHealthAssessments: MentalHealthAssessment[] = [
    {
        title: "ความเครียดสะสม",

        description:
            "ประเมินระดับความเครียดที่เกิดขึ้นในชีวิตประจำวัน เพื่อเฝ้าระวังความเครียดสะสมที่อาจส่งผลกระทบต่อสุขภาพกายและสุขภาพจิต",

        href: "/assessment_stress",

        icon: Brain,

        iconClass:
            "bg-[#eef5ff] text-[#6394cf]",

        buttonClass:
            "bg-gradient-to-r from-[#78a9dc] to-[#6092cb] shadow-[0_12px_26px_rgba(96,146,203,0.22)]",
    },

    {
        title: "ภาวะซึมเศร้า",

        description:
            "ประเมินอาการและความรู้สึกที่เกี่ยวข้องกับภาวะซึมเศร้า เพื่อช่วยคัดกรองความเสี่ยงและส่งเสริมการดูแลสุขภาพจิต",

        href: "/depression-assessment",

        icon: HeartPulse,

        iconClass:
            "bg-[#f1edff] text-[#8061c5]",

        buttonClass:
            "bg-gradient-to-r from-[#9273d0] to-[#7958bb] shadow-[0_12px_26px_rgba(121,88,187,0.22)]",
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

                        <h2 className="mt-3 text-lg font-semibold text-[#4f535b]">
                            แบบประเมินสุขภาพเบื้องต้น
                        </h2>

                        <p className="mt-2 max-w-[900px] leading-7 text-[#8b8f98]">
                            ประเมินสุขภาพจิตและอารมณ์ในชีวิตประจำวัน
                            เพื่อค้นหาปัจจัยเสี่ยงที่อาจส่งผลกระทบต่อสุขภาพจิตของคุณ
                        </p>
                    </header>

                    {/* =================================================
              ASSESSMENT CARDS
          ================================================= */}

                    <div className="mt-8 grid gap-6 xl:grid-cols-2">

                        {mentalHealthAssessments.map(
                            (assessment) => {
                                const Icon = assessment.icon;

                                return (
                                    <article
                                        key={assessment.title}
                                        className="
                      flex
                      min-h-[300px]
                      flex-col
                      rounded-[28px]
                      border
                      border-[#eee8e9]
                      bg-white
                      p-6
                      shadow-[0_15px_40px_rgba(35,25,30,0.045)]
                      transition
                      duration-300
                      hover:-translate-y-1
                      hover:shadow-[0_20px_45px_rgba(35,25,30,0.07)]
                      sm:p-7
                    "
                                    >

                                        {/* =================================================
                        ICON
                    ================================================= */}

                                        <div
                                            className={`
                        grid
                        h-14
                        w-14
                        place-items-center
                        rounded-2xl
                        ${assessment.iconClass}
                      `}
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
                                            className={`
                        mt-auto
                        flex
                        h-14
                        w-full
                        items-center
                        justify-center
                        gap-3
                        rounded-2xl
                        font-bold
                        text-white
                        transition
                        duration-200
                        hover:-translate-y-0.5
                        hover:brightness-[1.03]
                        ${assessment.buttonClass}
                      `}
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