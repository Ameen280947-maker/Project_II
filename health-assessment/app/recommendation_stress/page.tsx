"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";

import {
    ArrowLeft,
    CheckCircle2,
    Brain,
    CalendarDays,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type AssessmentData = {
    id: number;
    score: number;
    interpretation: string;
    createdAt: string;

    recommendation: {
        id: number;
        score: number;
        interpretation: string;
        title: string | null;
        description: string | null;
        recommendations: string[];
        color: string;
    };
};

/* =========================================================
   CONTENT
========================================================= */

function StressRecommendationContent() {
    const searchParams = useSearchParams();

    const assessmentId = searchParams.get("assessmentId");

    const [data, setData] =
        useState<AssessmentData | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    /* =======================================================
       LOAD RESULT
    ======================================================= */

    useEffect(() => {
        const loadResult = async () => {
            if (!assessmentId) {
                setError("ไม่พบ assessmentId");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                const response = await fetch(
                    `/api/assessments/stress?assessmentId=${assessmentId}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    },
                );

                const result = await response.json();

                if (
                    !response.ok ||
                    !result.success
                ) {
                    throw new Error(
                        result.message ||
                            "ไม่สามารถโหลดผลการประเมินได้",
                    );
                }

                setData(result.data);
            } catch (err) {
                console.error(err);

                setError(
                    err instanceof Error
                        ? err.message
                        : "เกิดข้อผิดพลาด",
                );
            } finally {
                setLoading(false);
            }
        };

        loadResult();
    }, [assessmentId]);

    /* =======================================================
       COLOR / LEVEL STYLE
    ======================================================= */

    const getLevelStyle = (
        level: string,
    ) => {
        if (level === "เครียดน้อย") {
            return {
                bg: "bg-[#eef8e9]",
                text: "text-[#57965c]",
                border: "border-[#dcefd5]",
            };
        }

        if (level === "เครียดปานกลาง") {
            return {
                bg: "bg-[#fffbe5]",
                text: "text-[#b29c00]",
                border: "border-[#f0e6a9]",
            };
        }

        if (level === "เครียดมาก") {
            return {
                bg: "bg-[#fff2eb]",
                text: "text-[#e66a32]",
                border: "border-[#f4d2c2]",
            };
        }

        return {
            bg: "bg-[#fff0ed]",
            text: "text-[#e83a24]",
            border: "border-[#f4c9c2]",
        };
    };

    /* =======================================================
       LOADING
    ======================================================= */

    if (loading) {
        return (
            <main className="min-h-screen bg-[#fbf9f9]">
                <div className="flex min-h-screen">
                    <Sidebar />

                    <section className="flex flex-1 items-center justify-center">
                        <div className="text-center">
                            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#e5e5e5] border-t-[#6b9f63]" />

                            <p className="mt-4 text-[#858991]">
                                กำลังโหลดผลการประเมิน...
                            </p>
                        </div>
                    </section>
                </div>
            </main>
        );
    }

    /* =======================================================
       ERROR
    ======================================================= */

    if (error || !data) {
        return (
            <main className="min-h-screen bg-[#fbf9f9]">
                <div className="flex min-h-screen">
                    <Sidebar />

                    <section className="flex flex-1 items-center justify-center px-6">
                        <div className="max-w-md text-center">
                            <h1 className="text-2xl font-bold text-[#2f3037]">
                                ไม่สามารถแสดงผลการประเมินได้
                            </h1>

                            <p className="mt-3 text-[#858991]">
                                {error ||
                                    "ไม่พบข้อมูลผลการประเมิน"}
                            </p>

                            <Link
                                href="/assessment-menu-mental-health"
                                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#eef8e9] px-5 py-3 font-semibold text-[#57965c]"
                            >
                                <ArrowLeft
                                    size={18}
                                />

                                กลับไปหน้าประเมิน
                            </Link>
                        </div>
                    </section>
                </div>
            </main>
        );
    }

    const levelStyle =
        getLevelStyle(
            data.interpretation,
        );

    /* =======================================================
       DATE
    ======================================================= */

    const formattedDate =
        new Date(
            data.createdAt,
        ).toLocaleDateString(
            "th-TH",
            {
                year: "numeric",
                month: "long",
                day: "numeric",
            },
        );

    /* =======================================================
       PAGE
    ======================================================= */

    return (
        <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
            <div className="flex min-h-screen">

                {/* SIDEBAR */}

                <Sidebar />

                {/* MAIN CONTENT */}

                <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

                    {/* =================================================
                       HEADER
                    ================================================= */}

                    <header>
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#57965c]">
                            Assessment Result
                        </p>

                        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-[42px]">
                            ผลการประเมิน
                            <span className="text-[#6a9f62]">
                                ความเครียด
                            </span>
                        </h1>

                        <p className="mt-3 text-lg font-semibold text-[#4f535b]">
                            แบบประเมินความเครียด ST-5
                        </p>
                    </header>

                    {/* =================================================
                       RESULT
                    ================================================= */}

                    <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">

                        {/* =================================================
                           SCORE CARD
                        ================================================= */}

                        <article className="rounded-[28px] border border-[#eee8e9] bg-white p-7 text-center shadow-[0_15px_40px_rgba(35,25,30,0.045)]">

                            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#eef8e9] text-[#65a05b]">
                                <Brain
                                    size={32}
                                    strokeWidth={1.7}
                                />
                            </div>

                            <p className="mt-5 text-sm font-semibold text-[#858991]">
                                คะแนนรวม
                            </p>

                            <div className="mt-2">
                                <span className="text-6xl font-bold text-[#2f3037]">
                                    {data.score}
                                </span>

                                <span className="ml-2 text-lg text-[#858991]">
                                    / 15 คะแนน
                                </span>
                            </div>

                            <div
                                className={`mx-auto mt-5 w-fit rounded-full border px-5 py-2 font-bold ${levelStyle.bg} ${levelStyle.text} ${levelStyle.border}`}
                            >
                                {data.interpretation}
                            </div>

                            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-[#858991]">
                                <CalendarDays
                                    size={17}
                                />

                                {formattedDate}
                            </div>
                        </article>

                        {/* =================================================
                           RECOMMENDATION
                        ================================================= */}

                        <article className="rounded-[28px] border border-[#eee8e9] bg-white p-7 shadow-[0_15px_40px_rgba(35,25,30,0.045)]">

                            <h2 className="text-xl font-bold">
                                คำแนะนำสำหรับคุณ
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-[#858991]">
                                คำแนะนำต่อไปนี้อ้างอิงจากระดับความเครียด
                                ที่ได้จากการประเมินของคุณ
                            </p>

                            <div className="mt-6 space-y-3">

                                {data
                                    .recommendation
                                    .recommendations
                                    .length > 0 ? (
                                    data
                                        .recommendation
                                        .recommendations
                                        .map(
                                            (
                                                recommendation,
                                                index,
                                            ) => (
                                                <div
                                                    key={
                                                        index
                                                    }
                                                    className="flex items-start gap-3 rounded-2xl bg-[#f8faf7] p-4"
                                                >
                                                    <CheckCircle2
                                                        size={
                                                            20
                                                        }
                                                        className="mt-0.5 shrink-0 text-[#65a05b]"
                                                    />

                                                    <p className="text-sm leading-6 text-[#5e6268]">
                                                        {
                                                            recommendation
                                                        }
                                                    </p>
                                                </div>
                                            ),
                                        )
                                ) : (
                                    <div className="rounded-2xl bg-[#f8faf7] p-5 text-sm text-[#858991]">
                                        ไม่พบคำแนะนำสำหรับระดับความเครียดนี้
                                        กรุณาติดต่อผู้ดูแลระบบ
                                    </div>
                                )}

                            </div>
                        </article>
                    </div>

                    {/* =================================================
                       DISCLAIMER
                    ================================================= */}

                    <div className="mt-6 rounded-[24px] border border-[#e8edf5] bg-[#f5f8fc] px-6 py-5">

                        <div className="flex items-start gap-4">

                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e7f0fb] text-[#6595ce]">
                                <Brain
                                    size={23}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <div>
                                <h3 className="font-bold text-[#4f535b]">
                                    หมายเหตุ
                                </h3>

                                <p className="mt-1 text-sm leading-6 text-[#858991]">
                                    ผลการประเมินนี้เป็นการคัดกรองเบื้องต้น
                                    ไม่ใช่การวินิจฉัยทางการแพทย์
                                    หากมีความเครียดสูงหรือมีอาการที่ส่งผลกระทบต่อการใช้ชีวิต
                                    ควรปรึกษาผู้เชี่ยวชาญด้านสุขภาพ
                                </p>
                            </div>

                        </div>
                    </div>

                    {/* =================================================
                       BUTTONS
                    ================================================= */}

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">

                        <Link
                            href="/history"
                            className="flex items-center justify-center gap-2 rounded-2xl border border-[#e8dddd] bg-white px-6 py-3 font-semibold text-[#777780] transition hover:bg-[#faf7f7]"
                        >
                            ดูประวัติการประเมิน
                        </Link>

                        <Link
                            href="/assessment-menu-mental-health"
                            className="flex items-center justify-center gap-2 rounded-2xl bg-[#eef8e9] px-6 py-3 font-semibold text-[#57965c] transition hover:bg-[#e2f2dc]"
                        >
                            <ArrowLeft
                                size={18}
                            />

                            กลับไปแบบประเมิน
                        </Link>

                    </div>

                </section>
            </div>
        </main>
    );
}

/* =========================================================
   PAGE
   Suspense Boundary สำหรับ useSearchParams()
========================================================= */

export default function StressRecommendationPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-[#fbf9f9]">
                    <div className="flex min-h-screen">
                        <Sidebar />

                        <section className="flex flex-1 items-center justify-center">
                            <div className="text-center">
                                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#e5e5e5] border-t-[#6b9f63]" />

                                <p className="mt-4 text-[#858991]">
                                    กำลังโหลดผลการประเมิน...
                                </p>
                            </div>
                        </section>
                    </div>
                </main>
            }
        >
            <StressRecommendationContent />
        </Suspense>
    );
}