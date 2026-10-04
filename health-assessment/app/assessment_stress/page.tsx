"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";

import {
    ArrowLeft,
    ArrowRight,
    Brain,
    CheckCircle2,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type Option = {
    id: number;
    optionText: string;
    score: number;
};

type Question = {
    id: number;
    questionNo: number;
    question: string;
    options: Option[];
};

/* =========================================================
   PAGE
========================================================= */

export default function StressAssessmentPage() {
    const router = useRouter();

    const [questions, setQuestions] =
        useState<Question[]>([]);

    const [answers, setAnswers] =
        useState<
            Record<number, number>
        >({});

    const [loading, setLoading] =
        useState(true);

    const [submitting, setSubmitting] =
        useState(false);

    const [error, setError] =
        useState("");

    /* =======================================================
       LOAD QUESTIONS
    ======================================================= */

    useEffect(() => {
        const loadQuestions =
            async () => {
                try {
                    setLoading(true);

                    const response =
                        await fetch(
                            "/api/assessments/stress",
                            {
                                method: "GET",
                                cache: "no-store",
                            },
                        );

                    const result =
                        await response.json();

                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.message ||
                            "ไม่สามารถโหลดแบบประเมินได้",
                        );
                    }

                    setQuestions(
                        result.questions || [],
                    );
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

        loadQuestions();
    }, []);

    /* =======================================================
       SELECT ANSWER
    ======================================================= */

    const handleAnswerChange = (
        questionId: number,
        optionId: number,
    ) => {
        setAnswers((prev) => ({
            ...prev,
            [questionId]: optionId,
        }));

        setError("");
    };

    /* =======================================================
       GET USER ID
    ======================================================= */

    const getUserId = () => {
        const possibleKeys = [
            "userId",
            "user_id",
            "user",
            "currentUser",
        ];

        for (const key of possibleKeys) {
            const value =
                localStorage.getItem(key);

            if (!value) continue;

            try {
                const parsed =
                    JSON.parse(value);

                if (
                    typeof parsed === "number"
                ) {
                    return parsed;
                }

                if (
                    parsed?.userId
                ) {
                    return Number(
                        parsed.userId,
                    );
                }

                if (
                    parsed?.user_id
                ) {
                    return Number(
                        parsed.user_id,
                    );
                }

                if (
                    parsed?.id
                ) {
                    return Number(
                        parsed.id,
                    );
                }
            } catch {
                const numberValue =
                    Number(value);

                if (
                    Number.isInteger(
                        numberValue,
                    )
                ) {
                    return numberValue;
                }
            }
        }

        return null;
    };

    /* =======================================================
       SUBMIT
    ======================================================= */

    const handleSubmit =
        async () => {
            setError("");

            /* ตรวจสอบตอบครบ */

            if (
                questions.length !== 5
            ) {
                setError(
                    "ไม่พบคำถามแบบประเมินครบ 5 ข้อ",
                );

                return;
            }

            if (
                Object.keys(answers)
                    .length !== questions.length
            ) {
                setError(
                    "กรุณาตอบคำถามให้ครบทั้ง 5 ข้อ",
                );

                return;
            }

            const userId =
                getUserId();

            if (!userId) {
                setError(
                    "ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่",
                );

                return;
            }

            /* สร้าง answers */

            const answerPayload =
                questions.map(
                    (question) => {
                        const optionId =
                            answers[
                            question.id
                            ];

                        const selectedOption =
                            question.options.find(
                                (option) =>
                                    option.id ===
                                    optionId,
                            );

                        return {
                            questionId:
                                question.id,

                            optionId,

                            answer:
                                selectedOption
                                    ?.optionText || "",

                            score:
                                selectedOption
                                    ?.score ?? 0,
                        };
                    },
                );

            try {
                setSubmitting(true);

                const response =
                    await fetch(
                        "/api/assessments/stress",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body: JSON.stringify({
                                userId,
                                answers:
                                    answerPayload,
                            }),
                        },
                    );

                const result =
                    await response.json();

                if (
                    !response.ok ||
                    !result.success
                ) {
                    throw new Error(
                        result.message ||
                        "ไม่สามารถบันทึกผลได้",
                    );
                }

                /* สำคัญ:
                   ใช้ assessment_id
                   ที่ Backend สร้างจริง
                */

                const assessmentId =
                    result.assessment_id;

                if (!assessmentId) {
                    throw new Error(
                        "ไม่พบ assessment_id จากระบบ",
                    );
                }

                router.push(
                    `/recommendation_stress?assessmentId=${assessmentId}`,
                );
            } catch (err) {
                console.error(err);

                setError(
                    err instanceof Error
                        ? err.message
                        : "ไม่สามารถบันทึกผลการประเมินได้",
                );
            } finally {
                setSubmitting(false);
            }
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
                                กำลังโหลดแบบประเมิน...
                            </p>
                        </div>
                    </section>
                </div>
            </main>
        );
    }

    /* =======================================================
       PAGE
    ======================================================= */

    return (
        <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
            <div className="flex min-h-screen">

                <Sidebar />

                <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

                    {/* HEADER */}

                    <header>
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#57965c]">
                            Health Assessment
                        </p>

                        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-[42px]">
                            แบบประเมิน
                            <span className="text-[#6a9f62]">
                                ความเครียด
                            </span>
                        </h1>

                        <p className="mt-3 text-lg font-semibold text-[#4f535b]">
                            แบบประเมินความเครียด ST-5
                        </p>

                        <p className="mt-2 max-w-[900px] leading-7 text-[#8b8f98]">
                            กรุณาเลือกคำตอบที่ตรงกับอาการหรือความรู้สึก
                            ที่เกิดขึ้นกับคุณในช่วง 2–4 สัปดาห์ที่ผ่านมา
                        </p>
                    </header>

                    {/* INFO */}

                    <div className="mt-7 rounded-[24px] border border-[#e4eee1] bg-[#f3f9f0] p-5 sm:p-6">
                        <div className="flex items-start gap-4">

                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e3f1de] text-[#65a05b]">
                                <Brain
                                    size={25}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <div>
                                <h2 className="font-bold text-[#4d554c]">
                                    คำแนะนำในการทำแบบประเมิน
                                </h2>

                                <p className="mt-1 text-sm leading-6 text-[#858991]">
                                    กรุณาตอบคำถามตามความรู้สึกหรืออาการ
                                    ที่เกิดขึ้นจริงของคุณ
                                    เพื่อให้ผลการประเมินมีความเหมาะสมมากที่สุด
                                </p>
                            </div>

                        </div>
                    </div>

                    {/* QUESTIONS */}

                    <div className="mt-7 space-y-5">

                        {questions.map(
                            (question) => (
                                <article
                                    key={question.id}
                                    className="rounded-[26px] border border-[#eee8e9] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)] sm:p-7"
                                >

                                    <div className="flex gap-4">

                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef8e9] font-bold text-[#65a05b]">
                                            {question.questionNo}
                                        </div>

                                        <div className="flex-1">

                                            <h2 className="text-base font-bold leading-7 sm:text-lg">
                                                {question.question}
                                            </h2>

                                            <div className="mt-5 grid gap-3 sm:grid-cols-2">

                                                {question.options.map(
                                                    (option) => {
                                                        const selected =
                                                            answers[
                                                            question.id
                                                            ] ===
                                                            option.id;

                                                        return (
                                                            <label
                                                                key={
                                                                    option.id
                                                                }
                                                                className={`
                                  flex
                                  cursor-pointer
                                  items-center
                                  gap-3
                                  rounded-2xl
                                  border
                                  px-4
                                  py-4
                                  transition
                                  ${selected
                                                                        ? "border-[#8abb7e] bg-[#f0f8ed]"
                                                                        : "border-[#ece9ea] bg-white hover:bg-[#fafafa]"
                                                                    }
                                `}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={`question-${question.id}`}
                                                                    value={
                                                                        option.id
                                                                    }
                                                                    checked={
                                                                        selected
                                                                    }
                                                                    onChange={() =>
                                                                        handleAnswerChange(
                                                                            question.id,
                                                                            option.id,
                                                                        )
                                                                    }
                                                                    className="h-4 w-4 accent-[#65a05b]"
                                                                />

                                                                <span
                                                                    className={`text-sm font-medium ${selected
                                                                        ? "text-[#57965c]"
                                                                        : "text-[#62656d]"
                                                                        }`}
                                                                >
                                                                    {
                                                                        option.optionText
                                                                    }
                                                                </span>

                                                                {selected && (
                                                                    <CheckCircle2
                                                                        size={
                                                                            18
                                                                        }
                                                                        className="ml-auto text-[#65a05b]"
                                                                    />
                                                                )}
                                                            </label>
                                                        );
                                                    },
                                                )}

                                            </div>

                                        </div>

                                    </div>

                                </article>
                            ),
                        )}

                    </div>

                    {/* ERROR */}

                    {error && (
                        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">
                            {error}
                        </div>
                    )}

                    {/* BUTTON */}

                    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">

                        <Link
                            href="/assessment-menu-mental-health"
                            className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#e8dddd] bg-white px-6 font-semibold text-[#777780] transition hover:bg-[#faf7f7]"
                        >
                            <ArrowLeft
                                size={19}
                            />

                            ย้อนกลับ
                        </Link>

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#8fc67e] to-[#6eac61] px-8 font-bold text-white shadow-[0_12px_26px_rgba(110,172,97,0.22)] transition hover:-translate-y-0.5 hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting
                                ? "กำลังบันทึก..."
                                : "ดูผลการประเมิน"}

                            {!submitting && (
                                <ArrowRight
                                    size={21}
                                />
                            )}
                        </button>

                    </div>

                </section>
            </div>
        </main>
    );
}