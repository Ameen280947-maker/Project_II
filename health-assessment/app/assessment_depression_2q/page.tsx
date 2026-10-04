"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Circle,
  AlertCircle,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";

/* =========================================================
   TYPES
========================================================= */

type Choice = {
  choice_id: number;
  choice_text: string;
  score: number;
};

type Question = {
  question_id: number;
  question_text: string;
  question_type: string;
  display_order: number;
  is_required: boolean;
  choices: Choice[];
};

type Answer = {
  question_id: number;
  choice_id: number;
};

/* =========================================================
   PAGE
========================================================= */

export default function Depression2QPage() {
  const router = useRouter();

  /* =======================================================
     STATE
  ======================================================= */

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  /* =======================================================
     CHECK USER & LOAD QUESTIONS
  ======================================================= */

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = localStorage.getItem("userId");
      setUserId(storedId);
    }

    const loadQuestions = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/assessments/depression?stage=2q",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "ไม่สามารถโหลดแบบประเมิน 2Q ได้"
          );
        }

        if (!Array.isArray(data?.questions) || data.questions.length === 0) {
          throw new Error(
            "ไม่พบคำถามแบบประเมิน 2Q ในระบบ"
          );
        }

        setQuestions(data.questions);
      } catch (err) {
        console.error("Load 2Q error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดแบบประเมินได้"
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

  const handleSelectAnswer = (
    questionId: number,
    choiceId: number
  ) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: choiceId,
    }));

    setError("");
  };

  /* =======================================================
     CHECK CURRENT ANSWER
  ======================================================= */

  const currentQuestionData = questions[currentQuestion];

  const currentAnswer =
    currentQuestionData
      ? answers[currentQuestionData.question_id]
      : undefined;

  /* =======================================================
     NEXT QUESTION
  ======================================================= */

  const handleNext = () => {
    if (!currentQuestionData) {
      return;
    }

    if (
      currentQuestionData.is_required &&
      currentAnswer === undefined
    ) {
      setError("กรุณาเลือกคำตอบก่อนดำเนินการต่อ");
      return;
    }

    setError("");

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((previous) => previous + 1);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    handleSubmit();
  };

  /* =======================================================
     PREVIOUS QUESTION
  ======================================================= */

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((previous) => previous - 1);
      setError("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  /* =======================================================
     SUBMIT 2Q
  ======================================================= */

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError("");

      const activeUserId =
        userId || (typeof window !== "undefined" ? localStorage.getItem("userId") : null);

      if (!activeUserId) {
        setError("ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบก่อนทำแบบประเมิน");
        setSubmitting(false);
        return;
      }

      /* ตรวจสอบว่าตอบครบทุกข้อ */
      const unansweredQuestions = questions.filter(
        (question) =>
          question.is_required &&
          answers[question.question_id] === undefined
      );

      if (unansweredQuestions.length > 0) {
        const firstUnanswered = unansweredQuestions[0];
        const index = questions.findIndex(
          (question) => question.question_id === firstUnanswered.question_id
        );

        if (index >= 0) {
          setCurrentQuestion(index);
        }

        setError("กรุณาตอบคำถามให้ครบทุกข้อ");
        setSubmitting(false);
        return;
      }

      const answerPayload: Answer[] = questions.map((question) => ({
        question_id: question.question_id,
        choice_id: answers[question.question_id],
      }));

      const response = await fetch("/api/assessments/depression", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: activeUserId,
          stage: "2q",
          answers: answerPayload,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "ไม่สามารถบันทึกผลการประเมิน 2Q ได้"
        );
      }

      if (data?.next_path) {
        router.push(data.next_path);
        return;
      }

      if (
        data?.is_risk ||
        data?.risk_level === "มีความเสี่ยงหรือมีแนวโน้มเป็นโรคซึมเศร้า"
      ) {
        router.push(
          `/assessment_depression_9q?previousAssessmentId=${data.assessment_id}`
        );
        return;
      }

      router.push(
        `/recommendation_depression_2q?assessmentId=${data.assessment_id}`
      );
    } catch (err) {
      console.error("Submit 2Q error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "เกิดข้อผิดพลาดในการบันทึกผลการประเมิน"
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
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex min-h-screen flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f8e8ea]">
              <Loader2 className="animate-spin text-[#b91c2b]" size={28} />
            </div>
            <p className="text-base font-medium text-[#666770]">
              กำลังโหลดแบบประเมิน...
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error && questions.length === 0) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex min-h-screen flex-1 items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <ClipboardList size={30} className="text-[#b91c2b]" />
            </div>

            <h2 className="text-xl font-bold text-[#2f3037]">
              ไม่สามารถโหลดแบบประเมินได้
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#777780]">{error}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-2xl bg-[#b91c2b] px-6 py-3 font-semibold text-white transition hover:bg-[#9f1726]"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* =======================================================
     PROGRESS
  ======================================================= */

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-10">

          {/* =================================================
              HEADER
          ================================================= */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f8e8ea]">
                  <ClipboardList size={25} className="text-[#b91c2b]" />
                </div>

                <div>
                  <p className="text-sm font-semibold tracking-wide text-[#b91c2b]">
                    แบบประเมินสุขภาพจิต
                  </p>

                  <h1 className="text-2xl font-bold text-[#2f3037]">
                    แบบคัดกรองภาวะซึมเศร้า 2Q
                  </h1>
                </div>
              </div>

              <Link
                href="/assessment-menu-mental-health"
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[#666770] border border-[#eee5e6] shadow-sm transition hover:bg-gray-50"
              >
                <ArrowLeft size={16} />
                กลับสู่เมนู
              </Link>
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#777780]">
              แบบคัดกรองเบื้องต้นเพื่อประเมินความรู้สึกหรืออาการที่เกิดขึ้นในช่วง 2 สัปดาห์ที่ผ่านมารวมถึงวันนี้
              กรุณาตอบตามความเป็นจริงเพื่อประโยชน์ในการดูแลสุขภาพจิตของท่าน
            </p>

            {!userId && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertCircle size={18} className="shrink-0 text-amber-600" />
                <span>ท่านยังไม่ได้เข้าสู่ระบบ ผลการประเมินอาจไม่ถูกเชื่อมโยงกับบัญชีของท่าน</span>
                <Link href="/login" className="ml-auto font-semibold underline hover:text-amber-900">
                  เข้าสู่ระบบ
                </Link>
              </div>
            )}
          </div>

          {/* =================================================
              PROGRESS CARD
          ================================================= */}
          <div className="mb-6 rounded-3xl border border-[#eee5e6] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#777780]">ความคืบหน้า</p>
                <p className="mt-1 font-semibold text-[#2f3037]">
                  ข้อ {currentQuestion + 1} จาก {questions.length}
                </p>
              </div>

              <div className="text-sm font-semibold text-[#b91c2b]">
                {Math.round(progress)}%
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 overflow-hidden rounded-full bg-[#f1eeee]">
              <div
                className="h-full rounded-full bg-[#b91c2b] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Question indicators */}
            <div className="mt-4 flex items-center justify-center gap-3">
              {questions.map((question, index) => {
                const answered = answers[question.question_id] !== undefined;
                const active = index === currentQuestion;

                return (
                  <button
                    key={question.question_id}
                    type="button"
                    onClick={() => {
                      if (index <= currentQuestion || answered) {
                        setCurrentQuestion(index);
                        setError("");
                      }
                    }}
                    className={`
                      flex h-9 w-9 items-center justify-center
                      rounded-full text-xs font-semibold
                      transition
                      ${
                        active
                          ? "bg-[#b91c2b] text-white shadow-sm"
                          : answered
                          ? "bg-[#f8e8ea] text-[#b91c2b]"
                          : "bg-[#f5f5f6] text-[#999aa2]"
                      }
                    `}
                  >
                    {answered ? <CheckCircle2 size={17} /> : index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* =================================================
              QUESTION CARD
          ================================================= */}
          {currentQuestionData && (
            <div className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-sm sm:p-8">
              {/* Question number badge */}
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b91c2b] text-sm font-bold text-white shadow-sm">
                  {currentQuestion + 1}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[#a0a0a7]">
                    Question {currentQuestion + 1} of {questions.length}
                  </p>
                  <p className="text-sm font-semibold text-[#55565e]">
                    ใน 2 สัปดาห์ที่ผ่านมารวมวันนี้
                  </p>
                </div>
              </div>

              {/* Question text */}
              <h2 className="max-w-3xl text-xl font-bold leading-9 text-[#2f3037] sm:text-2xl">
                {currentQuestionData.question_text}
              </h2>

              <p className="mt-3 text-sm text-[#999aa2]">
                กรุณาเลือกคำตอบที่ตรงกับความรู้สึกของท่าน
              </p>

              {/* =================================================
                  CHOICES
              ================================================= */}
              <div className="mt-8 space-y-4">
                {currentQuestionData.choices.map((choice) => {
                  const selected = currentAnswer === choice.choice_id;

                  return (
                    <button
                      key={choice.choice_id}
                      type="button"
                      onClick={() =>
                        handleSelectAnswer(
                          currentQuestionData.question_id,
                          choice.choice_id
                        )
                      }
                      className={`
                        group flex w-full items-center gap-4
                        rounded-2xl border-2 p-5
                        text-left transition-all
                        ${
                          selected
                            ? "border-[#b91c2b] bg-[#fff5f6] shadow-sm"
                            : "border-[#eee9e9] bg-white hover:border-[#d9a6ad] hover:bg-[#fffafa]"
                        }
                      `}
                    >
                      <div
                        className={`
                          flex h-7 w-7 shrink-0
                          items-center justify-center
                          rounded-full border-2
                          ${
                            selected
                              ? "border-[#b91c2b]"
                              : "border-[#c8c8ce]"
                          }
                        `}
                      >
                        {selected ? (
                          <div className="h-3.5 w-3.5 rounded-full bg-[#b91c2b]" />
                        ) : (
                          <Circle size={10} className="text-transparent" />
                        )}
                      </div>

                      <span
                        className={`
                          text-base font-medium
                          ${
                            selected ? "text-[#b91c2b] font-semibold" : "text-[#55565e]"
                          }
                        `}
                      >
                        {choice.choice_text}
                      </span>

                      {selected && (
                        <CheckCircle2
                          size={22}
                          className="ml-auto shrink-0 text-[#b91c2b]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Error */}
              {error && (
                <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#f0eded] pt-6 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentQuestion === 0 || submitting}
                  className={`
                    flex h-12 items-center justify-center
                    gap-2 rounded-2xl px-6
                    font-semibold transition
                    ${
                      currentQuestion === 0 || submitting
                        ? "cursor-not-allowed bg-gray-100 text-gray-300"
                        : "bg-[#f5f3f3] text-[#55565e] hover:bg-[#ebe8e8]"
                    }
                  `}
                >
                  <ArrowLeft size={19} />
                  ย้อนกลับ
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#b91c2b] px-7 font-semibold text-white shadow-[0_10px_25px_rgba(185,28,43,0.18)] transition hover:bg-[#9f1726] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={19} className="animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : currentQuestion === questions.length - 1 ? (
                    <>
                      ส่งแบบประเมิน
                      <CheckCircle2 size={19} />
                    </>
                  ) : (
                    <>
                      ข้อถัดไป
                      <ArrowRight size={19} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="mt-6 rounded-2xl bg-[#fffafa] border border-[#f5ecec] px-5 py-4">
            <p className="text-center text-xs leading-6 text-[#999aa2]">
              แบบคัดกรอง 2Q เป็นการประเมินเบื้องต้น หากผลพบความเสี่ยง ระบบจะนำท่านเข้าสู่แบบประเมินโรคซึมเศร้า 9Q เพื่อการประเมินที่ละเอียดต่อไป
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}