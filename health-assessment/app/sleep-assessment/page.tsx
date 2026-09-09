"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Moon,
    ArrowRight,
    ArrowLeft,
    Loader2,
    Check,
} from "lucide-react";

type SleepOption = {
    id: number;
    optionText: string;
    score: number;
};

type SleepQuestion = {
    id: number;
    questionNo: number;
    question: string;
    options: SleepOption[];
};

type Answer = {
    questionId: number;
    optionId: number;
    answer: string;
    score: number;
};

export default function SleepAssessmentPage() {
    const router = useRouter();

    const [questions, setQuestions] = useState<
        SleepQuestion[]
    >([]);

    const [currentQuestion, setCurrentQuestion] =
        useState(0);

    const [answers, setAnswers] = useState<Answer[]>(
        []
    );

    const [loading, setLoading] = useState(true);

    const [saving, setSaving] = useState(false);

    // =====================================================
    // โหลดคำถามจาก Database
    // =====================================================

    useEffect(() => {
        async function loadQuestions() {
            try {
                setLoading(true);

                const response = await fetch(
                    "/api/assessments/sleep",
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "ไม่สามารถโหลดแบบประเมินได้"
                    );
                }

                if (
                    data.success &&
                    Array.isArray(data.questions)
                ) {
                    setQuestions(data.questions);
                } else {
                    setQuestions([]);
                }
            } catch (error) {
                console.error(
                    "Load sleep questions error:",
                    error
                );

                alert(
                    "ไม่สามารถโหลดแบบประเมินการนอนหลับได้"
                );
            } finally {
                setLoading(false);
            }
        }

        loadQuestions();
    }, []);

    // =====================================================
    // คำตอบของข้อปัจจุบัน
    // =====================================================

    const question =
        questions[currentQuestion];

    const selectedAnswer =
        question &&
        answers.find(
            (answer) =>
                answer.questionId === question.id
        );

    // =====================================================
    // เลือกคำตอบ
    // =====================================================

    function handleSelectOption(
        option: SleepOption
    ) {
        if (!question) return;

        const newAnswer: Answer = {
            questionId: question.id,
            optionId: option.id,
            answer: option.optionText,
            score: option.score,
        };

        setAnswers((previous) => {
            const filtered = previous.filter(
                (answer) =>
                    answer.questionId !== question.id
            );

            return [...filtered, newAnswer];
        });
    }

    // =====================================================
    // ข้อต่อไป
    // =====================================================

    function handleNext() {
        if (!question) return;

        const hasAnswer = answers.some(
            (answer) =>
                answer.questionId === question.id
        );

        if (!hasAnswer) {
            alert("กรุณาเลือกคำตอบ");
            return;
        }

        if (
            currentQuestion <
            questions.length - 1
        ) {
            setCurrentQuestion(
                currentQuestion + 1
            );

            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        } else {
            handleSubmit();
        }
    }

    // =====================================================
    // ย้อนกลับ
    // =====================================================

    function handleBack() {
        if (currentQuestion > 0) {
            setCurrentQuestion(
                currentQuestion - 1
            );

            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        } else {
            router.back();
        }
    }

    // =====================================================
    // Submit
    // =====================================================

    async function handleSubmit() {
        if (
            !questions.length ||
            answers.length !== questions.length
        ) {
            alert(
                "กรุณาตอบคำถามให้ครบทุกข้อ"
            );
            return;
        }

        try {
            setSaving(true);

            const storedUserId = localStorage.getItem("userId");

            if (!storedUserId) {
                alert("กรุณาเข้าสู่ระบบก่อนบันทึกผล");
                router.push("/login");
                return;
            }

            const response = await fetch(
                "/api/assessments/sleep",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        answers,
                        userId: Number(storedUserId),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "ไม่สามารถบันทึกผลได้"
                );
            }

            // =================================================
            // ไปหน้าคำแนะนำ
            // =================================================

            router.push(
                `/recommendation_sleep?recordId=${data.recordId}`
            );
        } catch (error) {
            console.error(
                "Submit sleep assessment error:",
                error
            );

            alert(
                error instanceof Error
                    ? error.message
                    : "ไม่สามารถบันทึกผลการประเมินได้"
            );
        } finally {
            setSaving(false);
        }
    }

    // =====================================================
    // Loading
    // =====================================================

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#FCFBFA]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2
                        size={40}
                        className="animate-spin text-[#5D9F61]"
                    />

                    <p className="text-[#777780]">
                        กำลังโหลดแบบประเมิน...
                    </p>
                </div>
            </main>
        );
    }

    // =====================================================
    // ไม่พบคำถาม
    // =====================================================

    if (!questions.length) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#FCFBFA]">
                <div className="text-center">
                    <Moon
                        size={48}
                        className="mx-auto text-[#A7A7AD]"
                    />

                    <h2 className="mt-4 text-xl font-bold text-[#303038]">
                        ไม่พบแบบประเมินการนอนหลับ
                    </h2>

                    <p className="mt-2 text-[#8A8A93]">
                        กรุณาตรวจสอบข้อมูลใน Database
                    </p>

                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="mt-6 rounded-2xl bg-[#5D9F61] px-6 py-3 font-semibold text-white"
                    >
                        ย้อนกลับ
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#FCFBFA]">

            <div className="mx-auto max-w-5xl px-6 py-12">

                {/* =================================================
            Header
        ================================================= */}

                <div className="mb-8">

                    <p className="mb-3 text-sm font-bold tracking-[0.2em] text-[#56965B]">
                        HEALTH ASSESSMENT
                    </p>

                    <h1 className="text-4xl font-bold text-[#303038]">
                        แบบประเมินการนอนหลับ
                    </h1>

                    <p className="mt-3 text-lg text-[#92929A]">
                        ประเมินพฤติกรรมการนอนหลับ
                        และปัจจัยที่เกี่ยวข้องกับสุขภาพ
                    </p>

                </div>


                {/* =================================================
            Progress
        ================================================= */}

                <div className="mb-6 rounded-[24px] border border-[#E8E6E4] bg-white p-5">

                    <div className="mb-3 flex items-center justify-between">

                        <span className="text-sm font-semibold text-[#66666E]">
                            ความคืบหน้า
                        </span>

                        <span className="text-sm font-semibold text-[#5D9F61]">
                            {currentQuestion + 1} /{" "}
                            {questions.length}
                        </span>

                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[#EDEDE9]">

                        <div
                            className="h-full rounded-full bg-[#69A963] transition-all duration-300"
                            style={{
                                width: `${((currentQuestion + 1) /
                                    questions.length) *
                                    100
                                    }%`,
                            }}
                        />

                    </div>

                </div>


                {/* =================================================
            Assessment Header
        ================================================= */}

                <div className="mb-7 rounded-[28px] border border-[#E7E7E2] bg-white p-7">

                    <div className="flex items-center gap-5">

                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#EEF8EA]">

                            <Moon
                                size={32}
                                className="text-[#63A65D]"
                            />

                        </div>

                        <div>

                            <h2 className="text-2xl font-bold text-[#303038]">
                                การนอนหลับ
                            </h2>

                            <p className="mt-1 text-[#92929A]">
                                กรุณาตอบคำถามตามพฤติกรรมจริงของคุณ
                            </p>

                        </div>

                    </div>

                </div>


                {/* =================================================
            Question
        ================================================= */}

                <div className="rounded-[28px] border border-[#E8E6E4] bg-white p-7">

                    <div className="mb-7 flex items-start gap-4">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDF8E9] font-bold text-[#5D9F61]">

                            {question.questionNo}

                        </div>

                        <h2 className="pt-1 text-lg font-bold leading-7 text-[#303038]">
                            {question.question}
                        </h2>

                    </div>


                    {/* =================================================
              Options
          ================================================= */}

                    <div className="space-y-3">

                        {question.options.map(
                            (option) => {

                                const isSelected =
                                    selectedAnswer?.optionId ===
                                    option.id;

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() =>
                                            handleSelectOption(
                                                option
                                            )
                                        }
                                        className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-all ${isSelected
                                            ? "border-[#A8D6A2] bg-[#F3FAF1]"
                                            : "border-[#ECE9E7] bg-white hover:border-[#C6DCC2] hover:bg-[#FAFCF9]"
                                            }`}
                                    >

                                        {/* Radio */}

                                        <span
                                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${isSelected
                                                ? "border-[#5D9F61]"
                                                : "border-[#D5D5D5]"
                                                }`}
                                        >

                                            {isSelected && (
                                                <span className="h-3 w-3 rounded-full bg-[#5D9F61]" />
                                            )}

                                        </span>


                                        {/* Text */}

                                        <span
                                            className={`flex-1 text-base leading-6 ${isSelected
                                                ? "font-semibold text-[#3E7042]"
                                                : "font-medium text-[#404047]"
                                                }`}
                                        >
                                            {option.optionText}
                                        </span>


                                        {/* Check */}

                                        {isSelected && (
                                            <Check
                                                size={21}
                                                className="shrink-0 text-[#5D9F61]"
                                            />
                                        )}

                                    </button>
                                );
                            }
                        )}

                    </div>


                    {/* =================================================
              Buttons
          ================================================= */}

                    <div className="mt-8 flex gap-3">

                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={saving}
                            className="flex h-14 w-[30%] items-center justify-center gap-2 rounded-2xl border border-[#E2DFDD] bg-white font-semibold text-[#777780] transition hover:bg-[#F8F8F6] disabled:opacity-50"
                        >

                            <ArrowLeft size={19} />

                            ย้อนกลับ

                        </button>


                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={
                                saving ||
                                !selectedAnswer
                            }
                            className="flex h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-[#5D9F61] font-semibold text-white transition hover:bg-[#4F8E53] disabled:cursor-not-allowed disabled:opacity-40"
                        >

                            {saving ? (
                                <>
                                    <Loader2
                                        size={20}
                                        className="animate-spin"
                                    />

                                    กำลังบันทึก...
                                </>
                            ) : currentQuestion ===
                                questions.length - 1 ? (
                                <>
                                    เสร็จสิ้นการประเมิน

                                    <Check size={20} />
                                </>
                            ) : (
                                <>
                                    ถัดไป

                                    <ArrowRight size={20} />
                                </>
                            )}

                        </button>

                    </div>

                </div>

            </div>

        </main>
    );
}