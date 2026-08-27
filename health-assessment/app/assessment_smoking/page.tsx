"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cigarette,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

type SmokingQuestion = {
  id: number;
  question: string;
  options: string[];
};

type SmokingAssessment = {
  assessment_id?: number;
  questions?: SmokingQuestion[];
};

export default function SmokingAssessmentPage() {
  const router = useRouter();

  const [assessment, setAssessment] =
    useState<SmokingAssessment | null>(null);

  const [answers, setAnswers] =
    useState<Record<number, string>>({});

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =====================================================
     LOAD ASSESSMENT
  ===================================================== */

  useEffect(() => {
    const loadAssessment = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/assessments/smoking",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `ไม่สามารถโหลดแบบประเมินได้ (${response.status})`
          );
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            data.message ||
              "ไม่สามารถโหลดแบบประเมินได้"
          );
        }

        setAssessment(data);
      } catch (err) {
        console.error(
          "LOAD SMOKING ASSESSMENT ERROR:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดแบบประเมินได้"
        );
      } finally {
        setLoading(false);
      }
    };

    void loadAssessment();
  }, []);

  /* =====================================================
     SELECT ANSWER
  ===================================================== */

  const handleAnswer = (
    questionId: number,
    answer: string
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  /* =====================================================
     SUBMIT
  ===================================================== */

  const handleSubmit = async () => {
    if (!assessment?.questions) {
      return;
    }

    const unanswered =
      assessment.questions.some(
        (question) =>
          !answers[question.id]
      );

    if (unanswered) {
      alert(
        "กรุณาตอบคำถามให้ครบทุกข้อ"
      );
      return;
    }

    try {
      setSubmitting(true);

      const storedUserId =
        localStorage.getItem("userId");

      if (!storedUserId) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        "/api/assessments/smoking",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId: Number(
              storedUserId
            ),
            answers,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "ไม่สามารถบันทึกผลการประเมินได้"
        );
      }

      /*
       * ส่ง assessment id ไปหน้า recommendation
       */

      router.push(
        `/recommendation_smoking?assessmentId=${data.assessment_id}`
      );
    } catch (err) {
      console.error(
        "SUBMIT SMOKING ASSESSMENT ERROR:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
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
      <main className="min-h-screen bg-[#fbf9f9] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#dcebd7] border-t-[#65a05b]" />

          <p className="mt-4 font-semibold text-[#777]">
            กำลังโหลดแบบประเมิน...
          </p>
        </div>
      </main>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error) {
    return (
      <main className="min-h-screen bg-[#fbf9f9] flex items-center justify-center px-5">
        <div className="w-full max-w-xl rounded-[28px] border border-red-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#b91c2b]">
            ไม่สามารถโหลดแบบประเมินได้
          </h1>

          <p className="mt-3 text-sm text-[#777]">
            {error}
          </p>

          <button
            onClick={() =>
              window.location.reload()
            }
            className="mt-6 rounded-2xl bg-[#65a05b] px-6 py-3 font-bold text-white"
          >
            ลองใหม่
          </button>
        </div>
      </main>
    );
  }

  /* =====================================================
     MAIN
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-12">

        {/* HEADER */}

        <header>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#57965c]">
            Health Assessment
          </p>

          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            แบบประเมิน
            <span className="text-[#65a05b]">
              การสูบบุหรี่
            </span>
          </h1>

          <p className="mt-3 text-[#858991]">
            ประเมินพฤติกรรมการสูบบุหรี่
            และปัจจัยที่เกี่ยวข้องกับสุขภาพ
          </p>
        </header>

        {/* ICON */}

        <section className="mt-8 rounded-[28px] border border-[#e7eee4] bg-white p-6 shadow-[0_15px_40px_rgba(35,25,30,0.04)]">

          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eef8e9] text-[#65a05b]">
              <Cigarette
                size={28}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <h2 className="text-xl font-bold">
                การสูบบุหรี่
              </h2>

              <p className="mt-1 text-sm text-[#898a92]">
                กรุณาตอบคำถามตามพฤติกรรมจริงของคุณ
              </p>
            </div>
          </div>
        </section>

        {/* QUESTIONS */}

        <section className="mt-6 space-y-5">

          {assessment?.questions?.map(
            (question, index) => (
              <article
                key={question.id}
                className="rounded-[26px] border border-[#eee8e9] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)]"
              >
                <div className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef8e9] text-sm font-black text-[#57965c]">
                    {index + 1}
                  </span>

                  <h2 className="pt-1 font-bold leading-7">
                    {question.question}
                  </h2>
                </div>

                <div className="mt-5 space-y-3">

                  {question.options.map(
                    (option) => {
                      const selected =
                        answers[
                          question.id
                        ] === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            handleAnswer(
                              question.id,
                              option
                            )
                          }
                          className={`flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left transition ${
                            selected
                              ? "border-[#65a05b] bg-[#eef8e9] text-[#477c40]"
                              : "border-[#eee8e9] bg-[#fafafa] hover:border-[#b9d8b1] hover:bg-[#f5faf3]"
                          }`}
                        >
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                              selected
                                ? "border-[#65a05b] bg-[#65a05b] text-white"
                                : "border-[#d5d5d5]"
                            }`}
                          >
                            {selected && (
                              <CheckCircle2
                                size={17}
                              />
                            )}
                          </span>

                          <span className="font-medium">
                            {option}
                          </span>
                        </button>
                      );
                    }
                  )}

                </div>
              </article>
            )
          )}

        </section>

        {/* BUTTONS */}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/assessment-menu-behavior"
              )
            }
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#e7e2e2] bg-white px-6 font-bold text-[#777]"
          >
            <ArrowLeft size={19} />
            ย้อนกลับ
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#9ac982] to-[#72ad64] px-8 font-bold text-white shadow-[0_12px_26px_rgba(114,173,100,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? "กำลังบันทึก..."
              : "ดูผลการประเมิน"}

            {!submitting && (
              <ArrowRight size={21} />
            )}
          </button>

        </div>

      </div>
    </main>
  );
}