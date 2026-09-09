"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    Moon,
    ArrowRight,
    Loader2,
    CalendarDays,
} from "lucide-react";

type Recommendation = {
    id: number;
    score: number;
    interpretation: string;
    title: string | null;
    description: string | null;
    recommendations: string[];
    color: string;
};

type ResultData = {
    id: string;
    score: number;
    interpretation: string;
    answers: unknown;
    createdAt: string;
    recommendation: Recommendation;
};

export default function RecommendationSleepPage() {
    const router = useRouter();

    const [recordId, setRecordId] =
        useState<string | null>(null);

    const [result, setResult] =
        useState<ResultData | null>(null);

    const [loading, setLoading] =
        useState(true);

    // =====================================================
    // อ่าน recordId จาก URL
    // =====================================================

    useEffect(() => {
        const params = new URLSearchParams(
            window.location.search
        );

        const id = params.get("recordId");

        setRecordId(id);
    }, []);

    // =====================================================
    // ดึงผลการประเมิน
    // =====================================================

    useEffect(() => {
        if (!recordId) {
            return;
        }

        async function loadResult() {
            try {
                setLoading(true);

                const response = await fetch(
                    `/api/assessments/sleep?recordId=${recordId}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "ไม่สามารถโหลดผลการประเมินได้"
                    );
                }

                if (data.success) {
                    setResult(data.data);
                }
            } catch (error) {
                console.error(
                    "Load sleep recommendation error:",
                    error
                );

                alert(
                    error instanceof Error
                        ? error.message
                        : "ไม่สามารถโหลดผลการประเมินได้"
                );
            } finally {
                setLoading(false);
            }
        }

        loadResult();
    }, [recordId]);

    // =====================================================
    // Loading
    // =====================================================

    if (loading || !recordId) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#FCFBFA]">

                <div className="flex flex-col items-center gap-4">

                    <Loader2
                        size={42}
                        className="animate-spin text-[#5D9F61]"
                    />

                    <p className="text-[#777780]">
                        กำลังโหลดผลการประเมิน...
                    </p>

                </div>

            </main>
        );
    }

    // =====================================================
    // ไม่พบข้อมูล
    // =====================================================

    if (!result || !result.recommendation) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#FCFBFA]">

                <div className="text-center">

                    <AlertTriangle
                        size={50}
                        className="mx-auto text-[#D5B900]"
                    />

                    <h2 className="mt-4 text-xl font-bold text-[#303038]">
                        ไม่พบผลการประเมิน
                    </h2>

                    <p className="mt-2 text-[#888890]">
                        กรุณากลับไปทำแบบประเมินใหม่
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                "/sleep-assessment"
                            )
                        }
                        className="mt-6 rounded-2xl bg-[#5D9F61] px-6 py-3 font-semibold text-white"
                    >
                        ทำแบบประเมินอีกครั้ง
                    </button>

                </div>

            </main>
        );
    }

    const recommendation =
        result.recommendation;

    const score = result.score;

    // =====================================================
    // Icon ตามคะแนน
    // =====================================================

    function ResultIcon() {
        if (score === 3) {
            return (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#EDF8E9]">
                    <CheckCircle2
                        size={46}
                        className="text-[#65A85B]"
                    />
                </div>
            );
        }

        if (score === 2) {
            return (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFFDE5]">
                    <AlertTriangle
                        size={46}
                        className="text-[#D1BD00]"
                    />
                </div>
            );
        }

        return (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF0ED]">
                <ShieldAlert
                    size={46}
                    className="text-[#FF321A]"
                />
            </div>
        );
    }

    // =====================================================
    // วันที่
    // =====================================================

    const formattedDate =
        new Date(
            result.createdAt
        ).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });

    return (
        <main className="min-h-screen bg-[#FCFBFA]">

            <div className="mx-auto max-w-5xl px-6 py-14">

                {/* =================================================
            Header
        ================================================= */}

                <div className="mb-8">

                    <p className="mb-3 text-sm font-bold tracking-[0.2em] text-[#56965B]">
                        HEALTH ASSESSMENT
                    </p>

                    <h1 className="text-4xl font-bold text-[#303038]">
                        ผลการประเมินการนอนหลับ
                    </h1>

                    <p className="mt-3 text-lg text-[#92929A]">
                        ผลการประเมินและคำแนะนำสำหรับคุณ
                    </p>

                </div>


                {/* =================================================
            Main Card
        ================================================= */}

                <div className="overflow-hidden rounded-[30px] border border-[#E7E5E2] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.04)]">

                    {/* Color Bar */}

                    <div
                        className="h-3 w-full"
                        style={{
                            backgroundColor:
                                recommendation.color,
                        }}
                    />


                    <div className="p-8 md:p-10">

                        {/* =================================================
                Icon
            ================================================= */}

                        <div className="flex flex-col items-center text-center">

                            <ResultIcon />

                            <p className="mt-6 text-sm font-semibold text-[#99999F]">
                                คะแนนของคุณ
                            </p>

                            <div className="mt-1">

                                <span className="text-6xl font-bold text-[#303038]">
                                    {score}
                                </span>

                                <span className="ml-2 text-xl text-[#99999F]">
                                    คะแนน
                                </span>

                            </div>


                            {/* Interpretation */}

                            <h2 className="mt-5 text-3xl font-bold text-[#303038]">
                                {recommendation.interpretation}
                            </h2>


                            {/* Title */}

                            {recommendation.title && (
                                <p className="mt-3 text-lg font-semibold text-[#55555D]">
                                    {recommendation.title}
                                </p>
                            )}


                            {/* Description */}

                            {recommendation.description && (
                                <p className="mt-3 max-w-2xl leading-7 text-[#85858D]">
                                    {recommendation.description}
                                </p>
                            )}

                        </div>


                        {/* =================================================
                Date
            ================================================= */}

                        <div className="mt-7 flex items-center justify-center gap-2 text-sm text-[#99999F]">

                            <CalendarDays size={16} />

                            ประเมินเมื่อ {formattedDate}

                        </div>


                        {/* =================================================
                Recommendation
            ================================================= */}

                        <div className="mt-10 rounded-[24px] bg-[#F8F8F6] p-7">

                            <div className="flex items-center gap-3">

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF5E7]">

                                    <Moon
                                        size={23}
                                        className="text-[#5D9F61]"
                                    />

                                </div>

                                <h3 className="text-xl font-bold text-[#303038]">
                                    คำแนะนำสำหรับคุณ
                                </h3>

                            </div>


                            {/* =================================================
                  Recommendation List
              ================================================= */}

                            <div className="mt-6 space-y-4">

                                {Array.isArray(
                                    recommendation.recommendations
                                ) &&
                                    recommendation.recommendations.map(
                                        (item, index) => (
                                            <div
                                                key={index}
                                                className="flex items-start gap-4"
                                            >

                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E5F3E1] text-sm font-bold text-[#5D9F61]">
                                                    {index + 1}
                                                </div>

                                                <p className="flex-1 pt-0.5 leading-7 text-[#55555D]">
                                                    {item}
                                                </p>

                                            </div>
                                        )
                                    )}

                            </div>

                        </div>


                        {/* =================================================
                Important Note
            ================================================= */}

                        <div className="mt-6 rounded-2xl border border-[#E8E4D8] bg-[#FFFDF5] p-5">

                            <p className="text-sm leading-6 text-[#77715F]">
                                <span className="font-bold">
                                    หมายเหตุ:
                                </span>{" "}
                                ผลการประเมินนี้เป็นข้อมูลเบื้องต้น
                                สำหรับใช้ประกอบการดูแลสุขภาพ
                                ไม่สามารถใช้แทนการวินิจฉัยจากแพทย์ได้
                            </p>

                        </div>


                        {/* =================================================
                Finish Button
            ================================================= */}

                        <button
                            type="button"
                            onClick={() =>
                                router.push("/history")
                            }
                            className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#5D9F61] font-semibold text-white transition hover:bg-[#4F8E53]"
                        >

                            ดูบันทึกแบบประเมิน

                            <ArrowRight size={20} />

                        </button>


                        {/* Back */}

                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/assessment-type"
                                )
                            }
                            className="mt-3 h-12 w-full rounded-2xl font-semibold text-[#777780] transition hover:bg-[#F7F7F5]"
                        >
                            กลับไปเลือกแบบประเมิน
                        </button>

                    </div>

                </div>

            </div>

        </main>
    );
}