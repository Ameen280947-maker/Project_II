"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Choice = {
  choice_id: number;
  choice_text: string;
  score: number;
  display_order?: number;
};

type Question = {
  question_id: number;
  question_text: string;
  question_type?: string;
  display_order?: number;
  is_required?: boolean;
  choices: Choice[];
};

export default function PhysicalActivityAssessmentPage() {
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<
    Record<number, number>
  >({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /* =========================================================
     LOAD QUESTIONS
  ========================================================= */

  useEffect(() => {
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

  /* =========================================================
     SELECT ANSWER
  ========================================================= */

  const handleSelect = (
    questionId: number,
    choiceId: number
  ) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: choiceId,
    }));
  };

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async () => {
    try {
      setError("");

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

      /* ตรวจว่าตอบครบทุกข้อ */

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

      /* ไปหน้าผลการประเมิน */

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

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 rounded-full border-4 border-gray-300 border-t-red-600 mx-auto mb-4" />

          <p className="text-gray-600">
            กำลังโหลดแบบประเมิน...
          </p>
        </div>
      </main>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error && questions.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
            <div className="text-red-600 text-4xl mb-4">
              ⚠️
            </div>

            <h1 className="text-xl font-bold text-gray-800 mb-2">
              ไม่สามารถโหลดแบบประเมินได้
            </h1>

            <p className="text-gray-600 mb-6">
              {error}
            </p>

            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700"
            >
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}

        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            แบบประเมินกิจกรรมทางกาย
          </h1>

          <p className="text-gray-500 mt-2">
            กรุณาเลือกคำตอบที่ตรงกับพฤติกรรมของคุณมากที่สุด
          </p>
        </div>

        {/* Error */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        {/* Questions */}

        <div className="space-y-6">
          {questions.map((question, index) => (
            <div
              key={question.question_id}
              className="bg-white rounded-2xl shadow-sm border p-6"
            >

              {/* Question */}

              <div className="mb-5">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
                    {index + 1}
                  </div>

                  <div>
                    <h2 className="font-semibold text-gray-800 text-lg">
                      {question.question_text}
                    </h2>

                    {question.is_required && (
                      <span className="text-sm text-red-500">
                        * จำเป็นต้องตอบ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Choices */}

              <div className="space-y-3">
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
                      className={`w-full text-left p-4 rounded-xl border-2 transition ${
                        selected
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 hover:border-red-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">

                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selected
                              ? "border-red-500"
                              : "border-gray-300"
                          }`}
                        >
                          {selected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          )}
                        </div>

                        <span>
                          {choice.choice_text}
                        </span>

                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}

        <div className="bg-white rounded-2xl shadow-sm border p-6 mt-6">

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-full py-4 rounded-xl text-white font-semibold text-lg transition ${
              submitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {submitting
              ? "กำลังบันทึก..."
              : "ดูผลการประเมิน"}
          </button>

          <p className="text-center text-sm text-gray-500 mt-3">
            กรุณาตอบคำถามให้ครบทุกข้อก่อนดูผลการประเมิน
          </p>

        </div>

      </div>
    </main>
  );
}