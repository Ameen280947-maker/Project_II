"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Dumbbell,
} from "lucide-react";
import AssessmentBackLink from "@/app/components/AssessmentBackLink";
import HealthConsentNotice from "@/app/components/HealthConsentNotice";
import { AssessmentSourceNote } from "@/app/components/AssessmentSources";

// ตัวเลือกคำตอบหนึ่งรายการ พร้อมคะแนน
type Choice = {
  choice_id: number;
  choice_text: string;
  score: number;
  display_order?: number;
};

// คำถามหนึ่งข้อพร้อมรายการตัวเลือก
type Question = {
  question_id: number;
  question_text: string;
  question_type?: string;
  display_order?: number;
  is_required?: boolean;
  choices: Choice[];
};

// หน้า: แบบประเมินกิจกรรมทางกาย แสดงคำถามทั้งหมดในหน้าเดียว
export default function PhysicalActivityAssessmentPage() {
  const router = useRouter();

  // state คำถาม คำตอบที่เลือก (questionId → choiceId) และสถานะโหลด/ส่ง/error
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<
    Record<number, number>
  >({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // โหลดคำถามตอนเปิดหน้า
  useEffect(() => {
    // โหลดคำถามจาก GET /api/assessments/physical_activity
    const loadQuestions = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/assessments/physical_activity",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "ไม่สามารถโหลดแบบประเมินได้"
          );
        }

        setQuestions(data.questions || []);
      } catch (err) {
        console.error(err);

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

  // บันทึกตัวเลือกที่ผู้ใช้เลือกของแต่ละข้อลง state
  const handleSelect = (
    questionId: number,
    choiceId: number
  ) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: choiceId,
    }));
  };

  // ตรวจ userId และว่าตอบครบ แล้วส่ง POST /api/assessments/physical_activity และไปหน้าผลลัพธ์
  const handleSubmit = async () => {
    try {
      setError("");

      // ตรวจ userId จาก localStorage
      const userIdString =
        localStorage.getItem("userId");

      if (!userIdString) {
        setError("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const userId = Number(userIdString);

      if (!Number.isInteger(userId) || userId <= 0) {
        setError("User ID ไม่ถูกต้อง");
        return;
      }

      // ตรวจว่าตอบครบทุกข้อ
      const unansweredQuestions = questions.filter(
        (question) =>
          answers[question.question_id] === undefined
      );

      if (unansweredQuestions.length > 0) {
        setError(
          `กรุณาตอบคำถามให้ครบ ${unansweredQuestions.length} ข้อ`
        );
        return;
      }

      setSubmitting(true);

      // แปลงคำตอบเป็น payload (question_id, choice_id, ข้อความตัวเลือก)
      const payload = {
        userId,

        answers: questions.map((question) => {
          const choiceId =
            answers[question.question_id];

          const selectedChoice = question.choices.find(
            (choice) =>
              Number(choice.choice_id) ===
              Number(choiceId)
          );

          return {
            question_id: Number(question.question_id),
            choice_id: Number(choiceId),
            answer_value:
              selectedChoice?.choice_text || "",
          };
        }),
      };

      // ส่งคำตอบไปบันทึกที่ API
      const response = await fetch(
        "/api/assessments/physical_activity",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "ไม่สามารถบันทึกผลการประเมินได้"
        );
      }

      if (!data.assessment_id) {
        throw new Error(
          "ไม่พบ Assessment ID หลังบันทึกข้อมูล"
        );
      }

      router.push(
        `/recommendation_physical_activity?assessmentId=${data.assessment_id}`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "เกิดข้อผิดพลาดในการบันทึก"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // หน้าระหว่างโหลดคำถาม
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbf9f9]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#bbdfd7] border-t-[#1f7a69]" />

          <p className="mt-4 font-semibold text-[#777]">
            กำลังโหลดแบบประเมิน...
          </p>
        </div>
      </main>
    );
  }

  // โหลดคำถามไม่สำเร็จ → แสดงหน้า error พร้อมปุ่มลองใหม่
  if (error && questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbf9f9] px-5">
        <div className="w-full max-w-xl rounded-[28px] border border-red-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#b91c2b]">
            ไม่สามารถโหลดแบบประเมินได้
          </h1>

          <p className="mt-3 text-sm text-[#777]">
            {error}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-2xl bg-[#1f7a69] px-6 py-3 font-bold text-white"
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
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#1f7a69]">
              Health Assessment
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              แบบประเมิน
              <span className="text-[#1f7a69]">
                การออกกำลังกาย
              </span>
            </h1>
          </div>

          <HealthConsentNotice />
          <AssessmentBackLink href="/assessment-menu-behavior" />
        </header>
        <AssessmentSourceNote typeId={8} className="mt-3" />

        {/* การ์ดหัวข้อหมวดกิจกรรมทางกาย */}
        <section className="mt-8 rounded-[28px] border border-[#d6ebe6] bg-white p-6 shadow-[0_15px_40px_rgba(35,25,30,0.04)]">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e2f3ef] text-[#1f7a69]">
              <Dumbbell
                size={28}
                strokeWidth={1.8}
              />
            </div>

            <div>
              <h2 className="text-xl font-bold">
                กิจกรรมทางกาย
              </h2>
            </div>
          </div>
        </section>

        {/* รายการคำถามทั้งหมด แต่ละข้อมีปุ่มตัวเลือกให้กด */}
        <section className="mt-6 space-y-5">
          {questions.map((question, index) => (
            <article
              key={question.question_id}
              className="rounded-[26px] border border-[#eee8e9] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)]"
            >
              <div className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e2f3ef] text-sm font-black text-[#1f7a69]">
                  {index + 1}
                </span>

                <h2 className="pt-1 font-bold leading-7">
                  {question.question_text}
                </h2>
              </div>

              <div className="mt-5 space-y-3">
                {question.choices.map((choice) => {
                  const selected =
                    answers[question.question_id] ===
                    choice.choice_id;

                  return (
                    <button
                      key={choice.choice_id}
                      type="button"
                      onClick={() =>
                        handleSelect(
                          question.question_id,
                          choice.choice_id
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left transition ${
                        selected
                          ? "border-[#1f7a69] bg-[#e2f3ef] text-[#186355]"
                          : "border-[#eee8e9] bg-[#fafafa] hover:border-[#bbdfd7] hover:bg-[#f1f9f7]"
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                          selected
                            ? "border-[#1f7a69] bg-[#1f7a69] text-white"
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
                        {choice.choice_text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-[#f2d3d7] bg-[#fff0f2] p-4 text-sm font-medium text-[#b91c2b]">
            {error}
          </div>
        )}

        {/* ปุ่มส่งคำตอบเพื่อดูผลการประเมิน */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#3b998a] to-[#1f7a69] px-8 font-bold text-white shadow-[0_12px_26px_rgba(31,122,105,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
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
