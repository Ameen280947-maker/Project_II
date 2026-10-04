"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle,
  HeartHandshake,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";

/* =========================================================
   TYPES
========================================================= */

type Choice = {
  choice_id: number;
  question_id: number;
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

/* =========================================================
   MAIN COMPONENT WITH SUSPENSE
========================================================= */

function Depression9QContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const previousAssessmentId = searchParams.get("previousAssessmentId");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserId(localStorage.getItem("userId"));
    }

    async function loadQuestions() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/assessments/depression?stage=9q", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "ไม่สามารถโหลดแบบประเมินได้");
        }

        setQuestions(data.questions || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดแบบประเมิน"
        );
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, []);

  function selectAnswer(questionId: number, choiceId: number) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }));
    setError("");
  }

  async function submitAssessment() {
    setError("");

    const unanswered = questions.filter(
      (question) =>
        question.is_required && answers[question.question_id] === undefined
    );

    if (unanswered.length > 0) {
      setError(`กรุณาตอบคำถามให้ครบถ้วน (ยังขาดอีก ${unanswered.length} ข้อ)`);
      // Scroll to first unanswered question
      const firstUnansweredId = unanswered[0].question_id;
      const el = document.getElementById(`q-${firstUnansweredId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    const activeUserId =
      userId || (typeof window !== "undefined" ? localStorage.getItem("userId") : null);

    if (!activeUserId) {
      setError("ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบก่อนทำแบบประเมิน");
      return;
    }

    try {
      setSubmitting(true);

      const answerList = questions.map((question) => ({
        question_id: question.question_id,
        choice_id: answers[question.question_id],
      }));

      const res = await fetch("/api/assessments/depression", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: activeUserId,
          stage: "9q",
          answers: answerList,
          previousAssessmentId: previousAssessmentId
            ? Number(previousAssessmentId)
            : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "ไม่สามารถบันทึกผลการประเมินได้");
      }

      if (data.next_path) {
        router.push(data.next_path);
      } else {
        router.push(
          `/recommendation_depression_9q?assessmentId=${data.assessment_id}`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกผล"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex min-h-screen flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-[#666770]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f8e8ea]">
              <Loader2 size={28} className="animate-spin text-[#b91c2b]" />
            </div>
            <p className="font-medium">กำลังโหลดแบบประเมินโรคซึมเศร้า 9Q...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl">

          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f8e8ea] text-[#b91c2b]">
                  <ClipboardCheck size={26} />
                </div>

                <div>
                  <span className="text-sm font-semibold tracking-wide text-[#b91c2b]">
                    แบบประเมินสุขภาพจิต
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#2f3037]">
                    แบบประเมินโรคซึมเศร้า 9Q
                  </h1>
                </div>
              </div>

              <Link
                href={
                  previousAssessmentId
                    ? `/assessment_depression_2q`
                    : `/assessment-menu-mental-health`
                }
                className="flex items-center gap-2 rounded-xl border border-[#eee5e6] bg-white px-4 py-2.5 text-sm font-medium text-[#666770] shadow-sm transition hover:bg-gray-50"
              >
                <ArrowLeft size={16} />
                {previousAssessmentId ? "ย้อนกลับไป 2Q" : "กลับสู่เมนู"}
              </Link>
            </div>

            <div className="mt-4 rounded-2xl border border-[#eedfe1] bg-[#fff8f9] p-4 text-sm text-[#7e454b]">
              <p className="font-medium">
                ในช่วง 2 สัปดาห์ที่ผ่านมารวมถึงวันนี้ ท่านมีอาการเหล่านี้บ่อยแค่ไหน?
              </p>
              <p className="mt-1 text-xs text-[#9b686d]">
                แบบประเมินนี้ใช้เพื่อประเมินความรุนแรงของอาการซึมเศร้า กรุณาตอบทุกข้อตามความเป็นจริง
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="sticky top-4 z-10 mb-8 rounded-2xl border border-[#eee5e6] bg-white p-4 shadow-sm backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-[#2f3037]">
                ความคืบหน้า
              </span>
              <span className="font-medium text-[#b91c2b]">
                {answeredCount} จาก {questions.length} ข้อ ({progressPercent}%)
              </span>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-[#f1eeee]">
              <div
                className="h-full rounded-full bg-[#b91c2b] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-6">
            {questions.map((question, index) => {
              const selected = answers[question.question_id];
              const isAnswered = selected !== undefined;
              const isSelfHarmQuestion =
                String(question.question_text).includes("ทำร้ายตนเอง") ||
                String(question.question_text).includes("ตาย") ||
                question.display_order === 9;

              return (
                <div
                  id={`q-${question.question_id}`}
                  key={question.question_id}
                  className={`rounded-3xl border bg-white p-6 shadow-sm transition-all sm:p-7 ${
                    isAnswered
                      ? "border-[#eee5e6]"
                      : "border-gray-200"
                  } ${isSelfHarmQuestion ? "ring-1 ring-amber-200" : ""}`}
                >
                  <div className="mb-5 flex items-start gap-4">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
                        isAnswered
                          ? "bg-[#f8e8ea] text-[#b91c2b]"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="flex-1">
                      <h2 className="text-lg font-bold leading-relaxed text-[#2f3037] sm:text-xl">
                        {question.question_text}
                      </h2>
                      {isSelfHarmQuestion && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                          <AlertTriangle size={14} className="shrink-0" />
                          คำตอบในข้อนี้จะช่วยให้เราประเมินความปลอดภัยและแนะนำความช่วยเหลือที่เหมาะสม
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {question.choices.map((choice) => {
                      const isSelected = selected === choice.choice_id;

                      return (
                        <button
                          key={choice.choice_id}
                          type="button"
                          onClick={() =>
                            selectAnswer(
                              question.question_id,
                              choice.choice_id
                            )
                          }
                          className={`
                            flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all
                            ${
                              isSelected
                                ? "border-[#b91c2b] bg-[#fff5f6] shadow-sm"
                                : "border-[#eee9e9] bg-white hover:border-[#d9a6ad] hover:bg-[#fffafa]"
                            }
                          `}
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                              isSelected
                                ? "border-[#b91c2b] bg-[#b91c2b]"
                                : "border-gray-300"
                            }`}
                          >
                            {isSelected && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>

                          <div className="flex-1">
                            <span
                              className={`text-sm font-medium ${
                                isSelected
                                  ? "font-semibold text-[#b91c2b]"
                                  : "text-[#4f535b]"
                              }`}
                            >
                              {choice.choice_text}
                            </span>
                          </div>

                          {isSelected && (
                            <CheckCircle2
                              size={18}
                              className="shrink-0 text-[#b91c2b]"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#eee5e6] pt-6">
            <Link
              href={
                previousAssessmentId
                  ? `/assessment_depression_2q`
                  : `/assessment-menu-mental-health`
              }
              className="flex items-center gap-2 rounded-2xl bg-[#f5f3f3] px-6 py-3.5 font-semibold text-[#55565e] transition hover:bg-[#ebe8e8]"
            >
              <ArrowLeft size={18} />
              ย้อนกลับ
            </Link>

            <button
              onClick={submitAssessment}
              disabled={submitting}
              className="flex items-center gap-3 rounded-2xl bg-[#b91c2b] px-8 py-3.5 text-base font-semibold text-white shadow-[0_10px_25px_rgba(185,28,43,0.18)] transition hover:bg-[#9f1726] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  กำลังบันทึกผล...
                </>
              ) : (
                <>
                  ดูผลการประเมิน
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>

          {/* Hotline Information Box */}
          <div className="mt-8 flex items-start gap-4 rounded-2xl border border-[#eee5e6] bg-white p-5 text-sm shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <HeartHandshake size={22} />
            </div>
            <div>
              <h3 className="font-bold text-[#2f3037]">ต้องการคำปรึกษาเร่งด่วน?</h3>
              <p className="mt-1 text-xs text-[#777780]">
                สายด่วนสุขภาพจิต กรมสุขภาพจิต โทร <strong className="text-[#b91c2b]">1323</strong> ให้บริการฟรีตลอด 24 ชั่วโมง หรือติดต่อสถานพยาบาลใกล้บ้าน
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default function Depression9QPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb]">
          <Loader2 className="animate-spin text-[#b91c2b]" size={32} />
        </div>
      }
    >
      <Depression9QContent />
    </Suspense>
  );
}