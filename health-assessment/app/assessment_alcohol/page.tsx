"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Wine,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import AssessmentBackLink from "@/app/components/AssessmentBackLink";
import HealthConsentNotice from "@/app/components/HealthConsentNotice";
import { AssessmentSourceNote } from "@/app/components/AssessmentSources";

// ตัวเลือกคำตอบ (value ที่ส่งไป API และคะแนนของตัวเลือก)
type Option = {
  value: number;
  text: string;
  score: number;
};

// คำถามหนึ่งข้อพร้อมรายการตัวเลือก
type Question = {
  id: number;
  text: string;
  options: Option[];
};

// รูปแบบ response จาก POST /api/assessments/alcohol
type SubmitResponse = {
  success: boolean;
  assessment_id?: number;
  total_score?: number;
  risk_level?: string;
  recommendation_text?: string;
  message?: string;
};

// ชุดคำถามแบบคัดกรองการดื่มแอลกอฮอล์ 7 ข้อ พร้อมคะแนนของแต่ละตัวเลือก
const QUESTIONS: Question[] = [
  {
    id: 1,
    text:
      "ตลอดชีวิตที่ผ่านมา คุณเคยดื่มเครื่องดื่มแอลกอฮอล์หรือไม่ หรือเคยดื่มแต่หยุดดื่มมาแล้ว 1 ปีขึ้นไป",
    options: [
      {
        value: 1,
        text: "ไม่เคย",
        score: 0,
      },
      {
        value: 2,
        text: "เคยดื่มแต่หยุดดื่มมาแล้ว 1 ปีขึ้นไป",
        score: 0,
      },
      {
        value: 3,
        text: "เคยดื่มในช่วง 3 เดือน",
        score: 0,
      },
    ],
  },

  {
    id: 2,
    text:
      "ในช่วง 3 เดือนที่ผ่านมา คุณดื่มเครื่องดื่มแอลกอฮอล์บ่อยเพียงไร",
    options: [
      {
        value: 1,
        text: "ไม่เคย",
        score: 0,
      },
      {
        value: 2,
        text: "ครั้งสองครั้ง",
        score: 2,
      },
      {
        value: 3,
        text: "ทุกเดือน",
        score: 3,
      },
      {
        value: 4,
        text: "ทุกสัปดาห์",
        score: 4,
      },
      {
        value: 5,
        text: "เกือบทุกวัน",
        score: 6,
      },
    ],
  },

  {
    id: 3,
    text:
      "ในช่วง 3 เดือนที่ผ่านมา คุณเคยรู้สึกอยากดื่มเครื่องดื่มแอลกอฮอล์อย่างมาก บ่อยเพียงไร",
    options: [
      {
        value: 1,
        text: "ไม่เคย",
        score: 0,
      },
      {
        value: 2,
        text: "ครั้งสองครั้ง",
        score: 3,
      },
      {
        value: 3,
        text: "ทุกเดือน",
        score: 4,
      },
      {
        value: 4,
        text: "ทุกสัปดาห์",
        score: 5,
      },
      {
        value: 5,
        text: "เกือบทุกวัน",
        score: 6,
      },
    ],
  },

  {
    id: 4,
    text:
      "ในช่วง 3 เดือนที่ผ่านมา การดื่มแอลกอฮอล์ทำให้คุณเกิดปัญหาสุขภาพ ครอบครัว สังคม กฎหมาย หรือการเงิน บ่อยเพียงไร",
    options: [
      {
        value: 1,
        text: "ไม่เคย",
        score: 0,
      },
      {
        value: 2,
        text: "ครั้งสองครั้ง",
        score: 4,
      },
      {
        value: 3,
        text: "ทุกเดือน",
        score: 5,
      },
      {
        value: 4,
        text: "ทุกสัปดาห์",
        score: 6,
      },
      {
        value: 5,
        text: "เกือบทุกวัน",
        score: 7,
      },
    ],
  },

  {
    id: 5,
    text:
      "ในช่วง 3 เดือนที่ผ่านมา คุณไม่สามารถทำกิจกรรมที่คุณควรจะทำได้ตามปกติเนื่องจากดื่มแอลกอฮอล์ บ่อยเพียงไร",
    options: [
      {
        value: 1,
        text: "ไม่เคย",
        score: 0,
      },
      {
        value: 2,
        text: "ครั้งสองครั้ง",
        score: 5,
      },
      {
        value: 3,
        text: "ทุกเดือน",
        score: 6,
      },
      {
        value: 4,
        text: "ทุกสัปดาห์",
        score: 7,
      },
      {
        value: 5,
        text: "เกือบทุกวัน",
        score: 8,
      },
    ],
  },

  {
    id: 6,
    text:
      "ตลอดชีวิตที่ผ่านมา เพื่อนฝูง ญาติ หรือคนอื่นเคยแสดงความกังวลหรือตักเตือนคุณเกี่ยวกับการดื่มแอลกอฮอล์ของคุณหรือไม่",
    options: [
      {
        value: 1,
        text: "ไม่เคย",
        score: 0,
      },
      {
        value: 2,
        text: "เคยในช่วง 3 เดือนที่ผ่านมา",
        score: 6,
      },
      {
        value: 3,
        text: "เคยก่อน 3 เดือนที่ผ่านมา",
        score: 3,
      },
    ],
  },

  {
    id: 7,
    text:
      "ตลอดชีวิตที่ผ่านมา คุณเคยพยายามหยุดหรือลดการดื่มเครื่องดื่มแอลกอฮอล์ให้น้อยลง แต่ไม่สำเร็จหรือไม่",
    options: [
      {
        value: 1,
        text: "ไม่เคย",
        score: 0,
      },
      {
        value: 2,
        text: "เคยในช่วง 3 เดือนที่ผ่านมา",
        score: 6,
      },
      {
        value: 3,
        text: "เคยก่อน 3 เดือนที่ผ่านมา",
        score: 3,
      },
    ],
  },
];

// หน้า: แบบประเมินการดื่มแอลกอฮอล์ ทีละข้อ
export default function AlcoholAssessmentPage() {
  const router = useRouter();

  // state ของหน้า: ข้อปัจจุบัน คำตอบ สถานะกำลังส่ง และ error
  const [currentQuestion, setCurrentQuestion] =
    useState(0);

  const [answers, setAnswers] =
    useState<Record<number, number>>({});

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  // ค่าที่คำนวณจากข้อปัจจุบันและคำตอบข้อ 1 (ไม่เคยดื่ม/หยุดแล้ว/ยังดื่ม)
  const question =
    QUESTIONS[currentQuestion];

  const isFirstQuestion =
    currentQuestion === 0;

  const isLastQuestion =
    currentQuestion === QUESTIONS.length - 1;

  const selectedValue =
    answers[question.id];

  const q1Answer = answers[1];

  const isNeverDrink =
    q1Answer === 1;

  const isStoppedDrink =
    q1Answer === 2;

  const isCurrentDrink =
    q1Answer === 3;

  useEffect(() => {
    if (
      currentQuestion === 0 &&
      (isNeverDrink || isStoppedDrink)
    ) {
      return;
    }
  }, [
    currentQuestion,
    isNeverDrink,
    isStoppedDrink,
  ]);

  // เปอร์เซ็นต์ความคืบหน้า (100% ทันทีถ้าข้อ 1 ตอบไม่เคยดื่ม/หยุดแล้ว)
  const progress =
    useMemo(() => {
      if (
        isNeverDrink ||
        isStoppedDrink
      ) {
        return 100;
      }

      return Math.round(
        ((currentQuestion + 1) /
          QUESTIONS.length) *
          100,
      );
    }, [
      currentQuestion,
      isNeverDrink,
      isStoppedDrink,
    ]);

  // บันทึกคำตอบที่เลือกของข้อนั้นลง state และล้างข้อความ error
  const selectAnswer = (
    questionId: number,
    value: number,
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    setError("");
  };

  // ไปข้อถัดไป หรือส่งผลทันทีถ้าข้อแรกตอบว่าไม่ดื่ม/ถึงข้อสุดท้ายแล้ว
  const nextQuestion = () => {
    if (
      selectedValue === undefined
    ) {
      setError(
        "กรุณาเลือกคำตอบก่อนดำเนินการต่อ",
      );
      return;
    }

    setError("");

    if (
      question.id === 1 &&
      (selectedValue === 1 ||
        selectedValue === 2)
    ) {
      void submitAssessment({
        ...answers,
        1: selectedValue,
      });

      return;
    }

    if (!isLastQuestion) {
      setCurrentQuestion(
        (prev) => prev + 1,
      );
    } else {
      void submitAssessment(answers);
    }
  };

  // ย้อนกลับไปข้อก่อนหน้า
  const previousQuestion = () => {
    if (currentQuestion === 0) {
      return;
    }

    setCurrentQuestion(
      (prev) => prev - 1,
    );
  };

  // ส่งคำตอบไป POST /api/assessments/alcohol แล้วพาไปหน้าผลลัพธ์
  const submitAssessment = async (
    finalAnswers: Record<
      number,
      number
    >,
  ) => {
    try {
      setSubmitting(true);
      setError("");

      // ตรวจ userId ใน localStorage ถ้าไม่ถูกต้องให้ไปหน้า login
      const storedUserId =
        localStorage.getItem("userId");

      if (!storedUserId) {
        router.push("/login");
        return;
      }

      const userId =
        Number(storedUserId);

      if (
        !Number.isInteger(userId) ||
        userId <= 0
      ) {
        localStorage.removeItem(
          "userId",
        );

        router.push("/login");
        return;
      }

      // ส่งคำตอบไปบันทึกที่ API
      const username =
        localStorage.getItem(
          "username",
        ) ?? "";

      const response =
        await fetch(
          "/api/assessments/alcohol",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              userId,
              username,
              answers: finalAnswers,
            }),
          },
        );

      // ตรวจผลลัพธ์แล้วไปหน้าคำแนะนำ
      const data =
        (await response.json()) as SubmitResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.assessment_id
      ) {
        throw new Error(
          data.message ??
            "ไม่สามารถบันทึกผลการประเมินได้",
        );
      }

      router.push(
        `/recommendation_alcohol?assessmentId=${data.assessment_id}`,
      );
    } catch (submitError) {
      console.error(
        "SUBMIT ALCOHOL ERROR:",
        submitError,
      );

      setError(
        submitError instanceof Error
          ? submitError.message
          : "ไม่สามารถบันทึกผลการประเมินได้",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl">

            {/* ส่วนหัวหน้า: ชื่อแบบประเมิน ความยินยอม และปุ่มย้อนกลับ */}
            <header className="mb-8 flex items-start justify-between gap-4">
              <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#8a5a00]">
                Health Assessment
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                แบบประเมิน
                <span className="text-[#8a5a00]">
                  การดื่มแอลกอฮอล์
                </span>
              </h1>
              </div>

              <HealthConsentNotice />
              <AssessmentBackLink href="/assessment-menu-behavior" />
            </header>
            <AssessmentSourceNote typeId={7} className="mt-3" />

            {/* การ์ดแถบความคืบหน้า */}
            <section className="rounded-[28px] border border-[#eee5e6] bg-white p-5 shadow-[0_12px_35px_rgba(35,25,30,0.04)]">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#777880]">
                    ความคืบหน้า
                  </p>

                  <p className="mt-1 font-black">
                    ข้อ {currentQuestion + 1} /{" "}
                    {QUESTIONS.length}
                  </p>
                </div>

                <span className="font-black text-[#8a5a00]">
                  {progress}%
                </span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#fbf1dd]">
                <div
                  className="h-full rounded-full bg-[#8a5a00] transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </section>

            {/* การ์ดคำถามข้อปัจจุบัน */}
            <section className="mt-6 rounded-[30px] border border-[#eee5e6] bg-white p-6 shadow-[0_15px_45px_rgba(35,25,30,0.05)] sm:p-9">

              <div className="flex items-start gap-4">

                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#fbf1dd] text-[#8a5a00]">
                  <Wine size={27} />
                </div>

                <div>
                  <p className="text-sm font-bold text-[#8a5a00]">
                    คำถามที่ {question.id}
                  </p>

                  <h2 className="mt-2 text-xl font-bold leading-8 sm:text-2xl">
                    {question.text}
                  </h2>
                </div>

              </div>

              {/* รายการตัวเลือกคำตอบ */}
              <div className="mt-8 space-y-3">

                {question.options.map(
                  (option) => {
                    const selected =
                      selectedValue ===
                      option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          selectAnswer(
                            question.id,
                            option.value,
                          )
                        }
                        className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-[#8a5a00] bg-[#fbf1dd] text-[#8a5a00]"
                            : "border-[#eee5e6] bg-white hover:border-[#edd5a6] hover:bg-[#fdf8ee]"
                        }`}
                      >

                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-black ${
                            selected
                              ? "bg-[#8a5a00] text-white"
                              : "bg-[#f7f4f4] text-[#777880]"
                          }`}
                        >
                          {option.value}
                        </span>

                        <span className="flex-1 font-semibold">
                          {option.text}
                        </span>

                        {selected && (
                          <CheckCircle2
                            size={22}
                          />
                        )}

                      </button>
                    );
                  },
                )}

              </div>

              {/* ข้อความแจ้งข้ามข้อ 2–7 เมื่อข้อ 1 ตอบไม่เคยดื่ม/หยุดแล้ว */}
              {question.id === 1 &&
                selectedValue === 1 && (
                  <div className="mt-6 rounded-2xl bg-[#eef8e9] p-5 text-sm leading-7 text-[#57965c]">
                    คุณเลือก “ไม่เคยดื่ม”
                    ระบบจะไม่ถามข้อ 2–7
                    และจะแสดงผลว่า
                    คุณปลอดภัยจากโทษของเครื่องดื่มแอลกอฮอล์
                  </div>
                )}

              {question.id === 1 &&
                selectedValue === 2 && (
                  <div className="mt-6 rounded-2xl bg-[#eef8e9] p-5 text-sm leading-7 text-[#57965c]">
                    คุณหยุดดื่มมาแล้วอย่างน้อย 1 ปี
                    ระบบจะไม่ถามข้อ 2–7
                    และจะแสดงผลตามเกณฑ์ของแบบประเมิน
                  </div>
                )}

              {error && (
                <div className="mt-5 rounded-2xl bg-[#fff0f2] p-4 text-sm font-semibold text-[#b91c2b]">
                  {error}
                </div>
              )}

              {/* ปุ่มนำทาง ย้อนกลับ / ถัดไป / ส่งแบบประเมิน */}
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                {!isFirstQuestion && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={
                      previousQuestion
                    }
                    className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-[#eee5e6] bg-white px-6 font-bold text-[#666770] transition hover:bg-[#faf7f7] sm:mr-auto"
                  >
                    <ArrowLeft size={19} />
                    ย้อนกลับ
                  </button>
                )}

                <button
                  type="button"
                  disabled={
                    submitting ||
                    selectedValue ===
                      undefined
                  }
                  onClick={nextQuestion}
                  className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#8a5a00] px-7 font-bold text-white shadow-[0_10px_25px_rgba(138,90,0,0.2)] transition hover:bg-[#6f4800] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "กำลังบันทึก..."
                    : question.id === 1 &&
                        (selectedValue ===
                          1 ||
                          selectedValue ===
                            2)
                      ? "ดูผลการประเมิน"
                      : isLastQuestion
                        ? "ส่งแบบประเมิน"
                        : "ถัดไป"}

                  {!submitting && (
                    <ArrowRight size={19} />
                  )}
                </button>

              </div>
            </section>

          </div>
        </section>
      </div>
    </main>
  );
}