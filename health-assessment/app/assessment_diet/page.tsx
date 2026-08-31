"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Leaf,
  Utensils,
} from "lucide-react";

type Choice = {
  choice_id: number;
  choice_text: string;
  option_score: number;
};

type Question = {
  question_id: number;
  question_text: string;
  question_order: number;
  choices: Choice[];
};

type QuestionsResponse = {
  success: boolean;
  assessment_type_id?: number;
  assessment_name?: string;
  questions?: Question[];
  message?: string;
};

type SubmitResponse = {
  success: boolean;
  assessment_id?: number;
  total_score?: number;
  risk_level?: string;
  recommendation_text?: string;
  message?: string;
};

export default function DietAssessmentPage() {
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);

  /* =====================================================
     LOAD QUESTIONS
  ===================================================== */

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/assessments/diet",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          (await response.json()) as QuestionsResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ??
              "ไม่สามารถโหลดแบบประเมินการรับประทานอาหารได้",
          );
        }

        setQuestions(data.questions ?? []);
      } catch (err) {
        console.error(
          "LOAD DIET QUESTIONS ERROR:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดแบบประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadQuestions();
  }, []);

  /* =====================================================
     CURRENT QUESTION
  ===================================================== */

  const currentQuestion =
    questions[currentIndex];

  const answeredCount =
    Object.keys(answers).length;

  const progress =
    questions.length > 0
      ? Math.round(
          ((answeredCount) /
            questions.length) *
            100,
        )
      : 0;

  const isLastQuestion =
    currentIndex === questions.length - 1;

  const currentAnswer =
    currentQuestion
      ? answers[currentQuestion.question_id]
      : undefined;

  /* =====================================================
     QUESTION CATEGORY
  ===================================================== */

  const category = useMemo(() => {
    if (!currentQuestion) {
      return {
        title: "การรับประทานอาหาร",
        icon: <Utensils size={25} />,
        color:
          "bg-[#fff0f5] text-[#ed3564]",
      };
    }

    const order =
      currentQuestion.question_order;

    if (order === 1) {
      return {
        title: "การบริโภคผัก",
        icon: <Leaf size={25} />,
        color:
          "bg-[#eef9e9] text-[#57965c]",
      };
    }

    if (
      order >= 2 &&
      order <= 4
    ) {
      return {
        title: "น้ำตาลและอาหารหวาน",
        icon: <Utensils size={25} />,
        color:
          "bg-[#fff5df] text-[#c08a27]",
      };
    }

    if (order === 5) {
      return {
        title: "อาหารไขมันสูง",
        icon: <Utensils size={25} />,
        color:
          "bg-[#fff0f2] text-[#b91c2b]",
      };
    }

    return {
      title: "โซเดียมและอาหารเค็ม",
      icon: <Utensils size={25} />,
      color:
        "bg-[#f1efff] text-[#7355bd]",
    };
  }, [currentQuestion]);

  /* =====================================================
     SELECT ANSWER
  ===================================================== */

  const selectAnswer = (
    questionId: number,
    choiceId: number,
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }));
  };

  /* =====================================================
     NEXT
  ===================================================== */

  const nextQuestion = () => {
    if (!currentQuestion) {
      return;
    }

    if (!currentAnswer) {
      setError(
        "กรุณาเลือกคำตอบก่อนดำเนินการต่อ",
      );
      return;
    }

    setError("");

    if (!isLastQuestion) {
      setCurrentIndex(
        (prev) => prev + 1,
      );
    }
  };

  /* =====================================================
     PREVIOUS
  ===================================================== */

  const previousQuestion = () => {
    setError("");

    if (currentIndex > 0) {
      setCurrentIndex(
        (prev) => prev - 1,
      );
    }
  };

  /* =====================================================
     SUBMIT
  ===================================================== */

  const submitAssessment = async () => {
    if (
      questions.length === 0 ||
      answeredCount !== questions.length
    ) {
      setError(
        "กรุณาตอบคำถามให้ครบทุกข้อ",
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const userId =
        localStorage.getItem("userId");

      if (!userId) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        "/api/assessments/diet",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            user_id: Number(userId),
            answers,
          }),
        },
      );

      const data =
        (await response.json()) as SubmitResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            "ไม่สามารถบันทึกผลการประเมินได้",
        );
      }

      if (!data.assessment_id) {
        throw new Error(
          "ไม่พบ Assessment ID หลังจากบันทึกผล",
        );
      }

      router.push(
        `/recommendation_diet?assessmentId=${data.assessment_id}`,
      );
    } catch (err) {
      console.error(
        "SUBMIT DIET ASSESSMENT ERROR:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถบันทึกผลการประเมินได้",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex flex-1 items-center justify-center px-6">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f4d6df] border-t-[#ed3564]" />

              <p className="mt-5 font-semibold text-[#777780]">
                กำลังโหลดแบบประเมิน...
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  /* =====================================================
     ERROR / EMPTY
  ===================================================== */

  if (
    !loading &&
    questions.length === 0
  ) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex-1 px-6 py-10 lg:px-12">
            <div className="mx-auto max-w-3xl rounded-[28px] border border-[#f0e5e7] bg-white p-10 text-center">
              <h1 className="text-2xl font-black">
                ไม่พบแบบประเมิน
              </h1>

              <p className="mt-3 text-[#85858d]">
                กรุณาตรวจสอบข้อมูล Diet
                ใน Supabase
              </p>

              {error && (
                <p className="mt-4 text-sm text-[#b91c2b]">
                  {error}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    );
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl">

            {/* HEADER */}

            <header>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ed3564]">
                Health Assessment
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                แบบประเมิน
                <span className="text-[#ed3564]">
                  การรับประทานอาหาร
                </span>
              </h1>

              <p className="mt-3 text-base leading-7 text-[#85858d] sm:text-lg">
                ประเมินพฤติกรรมการรับประทานอาหาร
                ด้านผัก น้ำตาล ไขมัน และโซเดียม
              </p>
            </header>

            {/* PROGRESS */}

            <section className="mt-8 rounded-[24px] border border-[#eee5e6] bg-white p-5 shadow-[0_12px_35px_rgba(35,25,30,0.04)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#65666f]">
                  ความคืบหน้า
                </p>

                <p className="text-sm font-bold text-[#ed3564]">
                  {answeredCount} /{" "}
                  {questions.length}
                </p>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#f4edef]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f15a7c] to-[#ed3564] transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </section>

            {/* QUESTION */}

            {currentQuestion && (
              <section className="mt-7 rounded-[30px] border border-[#eee5e6] bg-white p-6 shadow-[0_14px_40px_rgba(35,25,30,0.05)] sm:p-8">

                {/* CATEGORY */}

                <div className="flex items-center gap-4">
                  <div
                    className={`grid h-14 w-14 place-items-center rounded-2xl ${category.color}`}
                  >
                    {category.icon}
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#999aa1]">
                      ข้อที่{" "}
                      {currentIndex + 1}{" "}
                      จาก{" "}
                      {questions.length}
                    </p>

                    <p className="mt-1 font-bold text-[#ed3564]">
                      {category.title}
                    </p>
                  </div>
                </div>

                {/* QUESTION TEXT */}

                <h2 className="mt-8 text-xl font-bold leading-9 sm:text-2xl">
                  {currentQuestion.question_text}
                </h2>

                {/* OPTIONS */}

                <div className="mt-7 space-y-3">
                  {currentQuestion.choices.map(
                    (choice) => {
                      const selected =
                        currentAnswer ===
                        choice.choice_id;

                      return (
                        <button
                          key={
                            choice.choice_id
                          }
                          type="button"
                          onClick={() =>
                            selectAnswer(
                              currentQuestion.question_id,
                              choice.choice_id,
                            )
                          }
                          className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                            selected
                              ? "border-[#ed3564] bg-[#fff0f5] shadow-[0_8px_20px_rgba(237,53,100,0.08)]"
                              : "border-[#eee5e6] bg-white hover:border-[#f3b5c5] hover:bg-[#fffafa]"
                          }`}
                        >
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
                              selected
                                ? "border-[#ed3564] bg-[#ed3564]"
                                : "border-[#d7d5d7]"
                            }`}
                          >
                            {selected && (
                              <span className="h-2.5 w-2.5 rounded-full bg-white" />
                            )}
                          </span>

                          <span
                            className={`flex-1 text-base leading-7 ${
                              selected
                                ? "font-bold text-[#b91c2b]"
                                : "text-[#55565f]"
                            }`}
                          >
                            {choice.choice_text}
                          </span>

                          {selected && (
                            <CheckCircle2
                              size={22}
                              className="shrink-0 text-[#ed3564]"
                            />
                          )}
                        </button>
                      );
                    },
                  )}
                </div>

                {/* ERROR */}

                {error && (
                  <div className="mt-5 rounded-2xl border border-[#f4d0d5] bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b91c2b]">
                    {error}
                  </div>
                )}

                {/* BUTTONS */}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={
                      previousQuestion
                    }
                    disabled={
                      currentIndex === 0 ||
                      submitting
                    }
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#eee5e6] bg-white px-6 font-bold text-[#777780] transition hover:bg-[#faf7f7] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft size={19} />

                    ย้อนกลับ
                  </button>

                  {!isLastQuestion ? (
                    <button
                      type="button"
                      onClick={nextQuestion}
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ed3564] px-7 font-bold text-white shadow-[0_10px_24px_rgba(237,53,100,0.22)] transition hover:bg-[#d92d59]"
                    >
                      ถัดไป

                      <ArrowRight size={19} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={
                        submitAssessment
                      }
                      disabled={
                        submitting ||
                        answeredCount !==
                          questions.length
                      }
                      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ed3564] px-7 font-bold text-white shadow-[0_10px_24px_rgba(237,53,100,0.22)] transition hover:bg-[#d92d59] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting
                        ? "กำลังบันทึก..."
                        : "ส่งแบบประเมิน"}

                      {!submitting && (
                        <CheckCircle2
                          size={19}
                        />
                      )}
                    </button>
                  )}
                </div>
              </section>
            )}

          </div>
        </section>
      </div>
    </main>
  );
}