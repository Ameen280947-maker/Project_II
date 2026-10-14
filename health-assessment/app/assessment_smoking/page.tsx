"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cigarette,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import AssessmentBackLink from "@/app/components/AssessmentBackLink";
import HealthConsentNotice from "@/app/components/HealthConsentNotice";
import { AssessmentSourceNote } from "@/app/components/AssessmentSources";

// คำถามหนึ่งข้อ พร้อมตัวเลือกเป็นข้อความ
type SmokingQuestion = {
  id: number;
  question: string;
  options: string[];
};

// คำตอบข้อ 2 ที่หมายถึงไม่เคยสูบ (ใช้ซ่อนข้อที่เหลือ)
const NEVER_SMOKED = "ไม่สูบ";

// ข้อมูลแบบประเมินที่ได้จาก GET /api/assessments/smoking
type SmokingAssessment = {
  assessment_id?: number;
  questions?: SmokingQuestion[];
};

// หน้า: แบบประเมินการสูบบุหรี่ (ซ่อนข้อที่เหลือถ้าตอบว่าไม่เคยสูบ)
export default function SmokingAssessmentPage() {
  const router = useRouter();

  // state แบบประเมิน คำตอบ (questionId → ข้อความตัวเลือก) และสถานะโหลด/ส่ง/error
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

  // โหลดแบบประเมินตอนเปิดหน้า
  useEffect(() => {
    // โหลดแบบประเมินและคำถามจาก GET /api/assessments/smoking
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

  // บันทึกคำตอบของแต่ละข้อลง state
  const handleAnswer = (
    questionId: number,
    answer: string
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  // ถ้าข้อ 2 ตอบ "ไม่สูบ" ให้แสดงแค่ 2 ข้อแรก นอกนั้นแสดงทุกข้อ
  const questions = assessment?.questions ?? [];
  const lifetimeQuestion = questions[1];
  const neverSmoked =
    !!lifetimeQuestion &&
    answers[lifetimeQuestion.id] === NEVER_SMOKED;
  const visibleQuestions = neverSmoked
    ? questions.slice(0, 2)
    : questions;

  // ส่งคำตอบ POST /api/assessments/smoking แล้วพาไปหน้าผลลัพธ์
  const handleSubmit = async () => {
    if (visibleQuestions.length === 0) {
      return;
    }

    // ตรวจว่าตอบครบทุกข้อที่แสดงอยู่
    const unanswered =
      visibleQuestions.some(
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

      // ไม่มี userId → ไปหน้า login
      const storedUserId =
        localStorage.getItem("userId");

      if (!storedUserId) {
        router.push("/login");
        return;
      }

      // ส่งเฉพาะคำตอบของข้อที่แสดงไปบันทึกที่ API
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
            answers: Object.fromEntries(
              visibleQuestions.map((question) => [
                question.id,
                answers[question.id],
              ])
            ),
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

  // หน้าระหว่างโหลดแบบประเมิน
  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbf9f9] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#cde0c0] border-t-[#3f7a2e]" />

          <p className="mt-4 font-semibold text-[#777]">
            กำลังโหลดแบบประเมิน...
          </p>
        </div>
      </main>
    );
  }

  // โหลดไม่สำเร็จ → แสดงหน้า error พร้อมปุ่มลองใหม่
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
            className="mt-6 rounded-2xl bg-[#3f7a2e] px-6 py-3 font-bold text-white"
          >
            ลองใหม่
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-12">

        {/* ส่วนหัวหน้า: ชื่อแบบประเมิน ความยินยอม และปุ่มย้อนกลับ */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#3f7a2e]">
            Health Assessment
          </p>

          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            แบบประเมิน
            <span className="text-[#3f7a2e]">
              การสูบบุหรี่
            </span>
          </h1>
          </div>

          <HealthConsentNotice />
          <AssessmentBackLink href="/assessment-menu-behavior" />
        </header>
        <AssessmentSourceNote typeId={6} className="mt-3" />

        {/* การ์ดหัวข้อหมวดการสูบบุหรี่ */}
        <section className="mt-8 rounded-[28px] border border-[#cde0c0] bg-white p-6 shadow-[0_15px_40px_rgba(35,25,30,0.04)]">

          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#ebf3e2] text-[#3f7a2e]">
              <Cigarette
                size={28}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <h2 className="text-xl font-bold">
                การสูบบุหรี่
              </h2>
            </div>
          </div>
        </section>

        <section className="mt-6 space-y-5">

          {/* รายการคำถามที่แสดง แต่ละข้อมีปุ่มตัวเลือก */}
          {visibleQuestions.map(
            (question, index) => (
              <article
                key={question.id}
                className="rounded-[26px] border border-[#eee8e9] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)]"
              >
                <div className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ebf3e2] text-sm font-black text-[#3f7a2e]">
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
                              ? "border-[#3f7a2e] bg-[#ebf3e2] text-[#2f5f22]"
                              : "border-[#eee8e9] bg-[#fafafa] hover:border-[#cde0c0] hover:bg-[#f5f9f0]"
                          }`}
                        >
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                              selected
                                ? "border-[#3f7a2e] bg-[#3f7a2e] text-white"
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

          {/* แจ้งว่าข้ามข้อที่เหลือเมื่อเลือก "ไม่สูบ" */}
          {neverSmoked && (
            <div className="rounded-2xl bg-[#ebf3e2] p-5 text-sm leading-7 text-[#3f7a2e]">
              คุณเลือก “ไม่สูบ” ในข้อ 2
              ระบบจะไม่ถามข้อ 3–{questions.length}
              และจะแสดงผลตามเกณฑ์ของแบบประเมิน
            </div>
          )}

        </section>

        {/* ปุ่มส่งคำตอบเพื่อดูผลการประเมิน */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#5a9445] to-[#3f7a2e] px-8 font-bold text-white shadow-[0_12px_26px_rgba(63,122,46,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
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