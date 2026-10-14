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
import AssessmentBackLink from "@/app/components/AssessmentBackLink";
import HealthConsentNotice from "@/app/components/HealthConsentNotice";
import { AssessmentSourceNote } from "@/app/components/AssessmentSources";

// ตัวเลือกคำตอบหนึ่งรายการ พร้อมคะแนน
type Choice = {
  choice_id: number;
  choice_text: string;
  score: number;
};

// คำถามหนึ่งข้อจาก API พร้อมตัวเลือก
type Question = {
  question_id: number;
  question_text: string;
  question_type: string;
  display_order: number;
  is_required: boolean;
  choices: Choice[];
};

// คำตอบหนึ่งข้อที่ส่งไป API
type Answer = {
  question_id: number;
  choice_id: number;
};

// หน้า: แบบคัดกรองโรคซึมเศร้า 2Q ทีละข้อ
export default function Depression2QPage() {
  const router = useRouter();

  // state ของหน้า: คำถาม คำตอบ สถานะโหลด/ส่ง error ข้อปัจจุบัน และ userId
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // อ่าน userId และโหลดคำถาม 2Q ตอนเปิดหน้า
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = localStorage.getItem("userId");
      setUserId(storedId);
    }

    // โหลดคำถาม 2Q จาก GET /api/assessments/depression?stage=2q
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

  // บันทึกตัวเลือกที่ผู้ใช้เลือกของข้อปัจจุบันลง state
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

  // ข้อมูลของข้อปัจจุบันและคำตอบที่เลือกไว้
  const currentQuestionData = questions[currentQuestion];

  const currentAnswer =
    currentQuestionData
      ? answers[currentQuestionData.question_id]
      : undefined;

  // ตรวจว่าตอบข้อบังคับแล้ว จากนั้นไปข้อถัดไปหรือส่งผลเมื่อถึงข้อสุดท้าย
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

  // ย้อนกลับไปข้อก่อนหน้าและเลื่อนหน้าขึ้นบนสุด
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

  // ส่งคำตอบ POST /api/assessments/depression แล้วไปต่อ 9Q (ถ้ามี next_path) หรือหน้าผลลัพธ์
  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError("");

      // ตรวจ userId
      const activeUserId =
        userId || (typeof window !== "undefined" ? localStorage.getItem("userId") : null);

      if (!activeUserId) {
        setError("ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบก่อนทำแบบประเมิน");
        setSubmitting(false);
        return;
      }

      // ตรวจว่าตอบครบ ถ้ายังไม่ครบให้กระโดดไปข้อแรกที่ยังไม่ได้ตอบ
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

      // ส่งคำตอบ stage 2q ไปบันทึกที่ API
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

      // เลือกหน้าถัดไป: next_path จาก API → มีความเสี่ยงไป 9Q → ไม่เสี่ยงไปหน้าคำแนะนำ 2Q
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

  // หน้าระหว่างโหลดคำถาม
  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex min-h-screen flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eee9f9]">
              <Loader2 className="animate-spin text-[#5b3ea6]" size={28} />
            </div>
            <p className="text-base font-medium text-[#666770]">
              กำลังโหลดแบบประเมิน...
            </p>
          </div>
        </main>
      </div>
    );
  }

  // โหลดคำถามไม่สำเร็จ → หน้า error พร้อมปุ่มลองใหม่
  if (error && questions.length === 0) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex min-h-screen flex-1 items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#eee9f9]">
              <ClipboardList size={30} className="text-[#5b3ea6]" />
            </div>

            <h2 className="text-xl font-bold text-[#2f3037]">
              ไม่สามารถโหลดแบบประเมินได้
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#777780]">{error}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-2xl bg-[#5b3ea6] px-6 py-3 font-semibold text-white transition hover:bg-[#4a3289]"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        </main>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-10">

          {/* ส่วนหัว: ชื่อแบบประเมิน คำอธิบาย และแจ้งเตือนถ้ายังไม่ login */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eee9f9]">
                  <ClipboardList size={25} className="text-[#5b3ea6]" />
                </div>

                <div>
                  <p className="text-sm font-semibold tracking-wide text-[#5b3ea6]">
                    แบบประเมินสุขภาพจิต
                  </p>

                  <h1 className="text-2xl font-bold text-[#2f3037]">
                    แบบคัดกรองภาวะซึมเศร้า 2Q
                  </h1>
                </div>
              </div>

              <HealthConsentNotice />
              <AssessmentBackLink href="/assessment-menu-mental-health" />
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#777780]">
              แบบคัดกรองเบื้องต้นเพื่อประเมินความรู้สึกหรืออาการที่เกิดขึ้นในช่วง 2 สัปดาห์ที่ผ่านมารวมถึงวันนี้
              กรุณาตอบตามความเป็นจริงเพื่อประโยชน์ในการดูแลสุขภาพจิตของท่าน
            </p>
            <AssessmentSourceNote typeId={13} className="mt-2" />

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

          {/* การ์ดความคืบหน้า พร้อมปุ่มเลขข้อสำหรับกระโดดไปข้อที่ตอบแล้ว */}
          <div className="mb-6 rounded-3xl border border-[#eee5e6] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#777780]">ความคืบหน้า</p>
                <p className="mt-1 font-semibold text-[#2f3037]">
                  ข้อ {currentQuestion + 1} จาก {questions.length}
                </p>
              </div>

              <div className="text-sm font-semibold text-[#5b3ea6]">
                {Math.round(progress)}%
              </div>
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-[#f1eeee]">
              <div
                className="h-full rounded-full bg-[#5b3ea6] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

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
                          ? "bg-[#5b3ea6] text-white shadow-sm"
                          : answered
                          ? "bg-[#eee9f9] text-[#5b3ea6]"
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

          {/* การ์ดคำถามข้อปัจจุบัน: ตัวเลือก ข้อความ error และปุ่มย้อนกลับ/ถัดไป */}
          {currentQuestionData && (
            <div className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5b3ea6] text-sm font-bold text-white shadow-sm">
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

              <h2 className="max-w-3xl text-xl font-bold leading-9 text-[#2f3037] sm:text-2xl">
                {currentQuestionData.question_text}
              </h2>

              <p className="mt-3 text-sm text-[#999aa2]">
                กรุณาเลือกคำตอบที่ตรงกับความรู้สึกของท่าน
              </p>

              {/* รายการตัวเลือกคำตอบ */}
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
                            ? "border-[#5b3ea6] bg-[#f7f4fc] shadow-sm"
                            : "border-[#eee9e9] bg-white hover:border-[#d4c9ee] hover:bg-[#f7f4fc]"
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
                              ? "border-[#5b3ea6]"
                              : "border-[#c8c8ce]"
                          }
                        `}
                      >
                        {selected ? (
                          <div className="h-3.5 w-3.5 rounded-full bg-[#5b3ea6]" />
                        ) : (
                          <Circle size={10} className="text-transparent" />
                        )}
                      </div>

                      <span
                        className={`
                          text-base font-medium
                          ${
                            selected ? "text-[#5b3ea6] font-semibold" : "text-[#55565e]"
                          }
                        `}
                      >
                        {choice.choice_text}
                      </span>

                      {selected && (
                        <CheckCircle2
                          size={22}
                          className="ml-auto shrink-0 text-[#5b3ea6]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
              )}

              {/* ปุ่มนำทาง ย้อนกลับ / ข้อถัดไป / ส่งแบบประเมิน */}
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
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#5b3ea6] px-7 font-semibold text-white shadow-[0_10px_25px_rgba(91,62,166,0.18)] transition hover:bg-[#4a3289] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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

          {/* หมายเหตุท้ายหน้า: ถ้าพบความเสี่ยงจะไปต่อแบบประเมิน 9Q */}
          <div className="mt-6 rounded-2xl bg-[#f7f4fc] border border-[#f5ecec] px-5 py-4">
            <p className="text-center text-xs leading-6 text-[#999aa2]">
              แบบคัดกรอง 2Q เป็นการประเมินเบื้องต้น หากผลพบความเสี่ยง ระบบจะนำท่านเข้าสู่แบบประเมินโรคซึมเศร้า 9Q เพื่อการประเมินที่ละเอียดต่อไป
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}