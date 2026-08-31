"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Info,
  Wine,
} from "lucide-react";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

type Assessment = {
  assessment_id: number;
  user_id: number;
  assessment_type_id: number;
  total_score: number | string | null;
  risk_level: string | null;
  recommendation_text:
    | string
    | null;
  assessed_at: string;
};

type Answer = {
  answer_id?: number;
  assessment_id: number;
  user_id?: number;
  username?: string;
  question_id?: number;
  question_text: string;
  answer_value:
    | number
    | string;
  choice_text: string;
  answer_score:
    | number
    | string;
};

type ResultResponse = {
  success: boolean;
  assessment?: Assessment;
  answers?: Answer[];
  message?: string;
};

/* =========================================================
   PAGE WRAPPER
========================================================= */

export default function AlcoholRecommendationPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen />
      }
    >
      <AlcoholRecommendationContent />
    </Suspense>
  );
}

/* =========================================================
   CONTENT
========================================================= */

function AlcoholRecommendationContent() {
  const searchParams =
    useSearchParams();

  const assessmentId =
    searchParams.get(
      "assessmentId",
    );

  const [assessment, setAssessment] =
    useState<Assessment | null>(
      null,
    );

  const [answers, setAnswers] =
    useState<Answer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =====================================================
     LOAD RESULT
  ====================================================== */

  useEffect(() => {
    const loadResult = async () => {
      try {
        setLoading(true);
        setError("");

        if (!assessmentId) {
          throw new Error(
            "ไม่พบ Assessment ID",
          );
        }

        const id =
          Number(assessmentId);

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          throw new Error(
            "Assessment ID ไม่ถูกต้อง",
          );
        }

        const response =
          await fetch(
            `/api/assessments/alcohol?assessmentId=${id}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as ResultResponse;

        if (
          !response.ok ||
          !data.success ||
          !data.assessment
        ) {
          throw new Error(
            data.message ??
              "ไม่สามารถโหลดผลการประเมินได้",
          );
        }

        setAssessment(
          data.assessment,
        );

        setAnswers(
          data.answers ?? [],
        );
      } catch (loadError) {
        console.error(
          "LOAD ALCOHOL RESULT ERROR:",
          loadError,
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "ไม่สามารถโหลดผลการประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadResult();
  }, [assessmentId]);

  /* =====================================================
     RESULT
  ====================================================== */

  const result =
    useMemo(() => {
      if (!assessment) {
        return null;
      }

      const score =
        Number(
          assessment.total_score ??
            0,
        );

      const risk =
        assessment.risk_level ??
        "";

      /* NEVER */

      if (
        risk ===
        "ไม่เคยดื่ม"
      ) {
        return {
          title:
            "ไม่เคยดื่มแอลกอฮอล์",
          subtitle:
            "คุณปลอดภัยจากโทษของเครื่องดื่มแอลกอฮอล์",
          color:
            "text-[#57965c]",
          bg:
            "bg-[#eef8e9]",
          border:
            "border-[#dcefd8]",
          badge:
            "bg-[#eef8e9] text-[#57965c]",
          icon:
            "bg-[#eef8e9] text-[#57965c]",
        };
      }

      /* STOPPED */

      if (
        risk ===
        "หยุดดื่มแล้ว"
      ) {
        return {
          title:
            "หยุดดื่มแล้ว",
          subtitle:
            "ขอชื่นชมคุณที่สามารถหยุดดื่มได้",
          color:
            "text-[#57965c]",
          bg:
            "bg-[#eef8e9]",
          border:
            "border-[#dcefd8]",
          badge:
            "bg-[#eef8e9] text-[#57965c]",
          icon:
            "bg-[#eef8e9] text-[#57965c]",
        };
      }

      /* LOW */

      if (
        score <= 10
      ) {
        return {
          title:
            "ความเสี่ยงต่ำ",
          subtitle:
            "ดื่มในระดับเสี่ยงต่ำ",
          color:
            "text-[#57965c]",
          bg:
            "bg-[#eef8e9]",
          border:
            "border-[#dcefd8]",
          badge:
            "bg-[#eef8e9] text-[#57965c]",
          icon:
            "bg-[#eef8e9] text-[#57965c]",
        };
      }

      /* MODERATE */

      if (
        score <= 26
      ) {
        return {
          title:
            "ความเสี่ยงปานกลาง",
          subtitle:
            "ดื่มในระดับเสี่ยงปานกลาง",
          color:
            "text-[#a77723]",
          bg:
            "bg-[#fff8e8]",
          border:
            "border-[#f3e4bc]",
          badge:
            "bg-[#fff8e8] text-[#a77723]",
          icon:
            "bg-[#fff8e8] text-[#a77723]",
        };
      }

      /* HIGH */

      return {
        title:
          "ความเสี่ยงสูง",
        subtitle:
          "ดื่มในระดับเสี่ยงสูง",
        color:
          "text-[#b91c2b]",
        bg:
          "bg-[#fff0f2]",
        border:
          "border-[#f2d3d7]",
        badge:
          "bg-[#fff0f2] text-[#b91c2b]",
        icon:
          "bg-[#fff0f2] text-[#b91c2b]",
      };
    }, [assessment]);

  /* =====================================================
     LOADING
  ====================================================== */

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  /* =====================================================
     ERROR
  ====================================================== */

  if (error || !assessment) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex-1 px-5 py-10 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-3xl">

              <div className="rounded-[28px] border border-[#f2d3d7] bg-white p-8 text-center shadow-[0_15px_45px_rgba(35,25,30,0.05)]">

                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">
                  <Info size={30} />
                </div>

                <h1 className="mt-5 text-2xl font-black">
                  ไม่สามารถโหลดผลการประเมิน
                </h1>

                <p className="mt-3 text-[#85858d]">
                  {error ||
                    "ไม่พบข้อมูลผลการประเมิน"}
                </p>

                <Link
                  href="/history"
                  className="mx-auto mt-7 flex h-12 w-fit items-center justify-center rounded-2xl bg-[#b91c2b] px-6 font-bold text-white"
                >
                  กลับไปประวัติการประเมิน
                </Link>

              </div>

            </div>
          </section>
        </div>
      </main>
    );
  }

  const score =
    Number(
      assessment.total_score ??
        0,
    );

  /* =====================================================
     RENDER
  ====================================================== */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">

        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12">

          <div className="mx-auto max-w-5xl">

            {/* =================================================
                BACK
            ================================================== */}

            <Link
              href="/history"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#777880] transition hover:text-[#b91c2b]"
            >
              <ArrowLeft size={18} />
              กลับไปประวัติการประเมิน
            </Link>

            {/* =================================================
                HEADER
            ================================================== */}

            <header className="mt-7">

              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
                Assessment Result
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                ผลการประเมิน
                <span className="text-[#b91c2b]">
                  การดื่มแอลกอฮอล์
                </span>
              </h1>

              <div className="mt-4 flex flex-wrap gap-5 text-sm text-[#898a92]">

                <span className="flex items-center gap-2">
                  <CalendarDays
                    size={17}
                  />

                  {formatDateTime(
                    assessment.assessed_at,
                  )}
                </span>

                <span>
                  Assessment ID:{" "}
                  {
                    assessment.assessment_id
                  }
                </span>

              </div>

            </header>

            {/* =================================================
                RESULT HERO
            ================================================== */}

            <section
              className={`mt-8 rounded-[32px] border ${result?.border} ${result?.bg} p-7 shadow-[0_15px_45px_rgba(35,25,30,0.05)] sm:p-10`}
            >

              <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">

                <div className="flex items-center gap-5">

                  <div
                    className={`grid h-20 w-20 shrink-0 place-items-center rounded-[24px] ${result?.icon}`}
                  >
                    <Wine size={40} />
                  </div>

                  <div>

                    <p className="text-sm font-bold text-[#85858d]">
                      ผลการประเมิน
                    </p>

                    <h2
                      className={`mt-1 text-3xl font-black ${result?.color}`}
                    >
                      {result?.title}
                    </h2>

                    <p className="mt-2 text-sm font-semibold text-[#777880]">
                      {result?.subtitle}
                    </p>

                  </div>

                </div>

                {/* SCORE */}

                <div className="rounded-[24px] bg-white/80 px-8 py-5 text-center shadow-sm">

                  <p className="text-xs font-bold text-[#999aa1]">
                    คะแนนรวม
                  </p>

                  <p
                    className={`mt-1 text-5xl font-black ${result?.color}`}
                  >
                    {score}
                  </p>

                  {score > 0 && (
                    <p className="mt-1 text-xs font-semibold text-[#999aa1]">
                      คะแนน
                    </p>
                  )}

                </div>

              </div>

            </section>

            {/* =================================================
                RECOMMENDATION
            ================================================== */}

            <section className="mt-6 rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)] sm:p-8">

              <div className="flex items-center gap-4">

                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
                  <CheckCircle2
                    size={25}
                  />
                </div>

                <div>
                  <h2 className="text-xl font-black">
                    คำแนะนำสำหรับคุณ
                  </h2>

                  <p className="mt-1 text-sm text-[#898a92]">
                    คำแนะนำตามระดับผลการประเมิน
                  </p>
                </div>

              </div>

              <div className="mt-6 rounded-2xl bg-[#faf8f8] p-5">

                <p className="text-[15px] leading-8 text-[#65666e]">
                  {
                    assessment.recommendation_text ??
                    "ไม่มีคำแนะนำ"
                  }
                </p>

              </div>

            </section>

            {/* =================================================
                SCORE INTERPRETATION
            ================================================== */}

            <section className="mt-6 rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)] sm:p-8">

              <div className="flex items-center gap-4">

                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f7f4f4] text-[#777880]">
                  <ClipboardList
                    size={24}
                  />
                </div>

                <div>
                  <h2 className="text-xl font-black">
                    เกณฑ์การแปลผล
                  </h2>

                  <p className="mt-1 text-sm text-[#898a92]">
                    ระดับความเสี่ยงจากคะแนนรวม
                  </p>
                </div>

              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">

                <RiskBox
                  range="0–10 คะแนน"
                  title="ความเสี่ยงต่ำ"
                  active={
                    score <= 10 &&
                    assessment.risk_level !==
                      "ไม่เคยดื่ม" &&
                    assessment.risk_level !==
                      "หยุดดื่มแล้ว"
                  }
                  className="green"
                />

                <RiskBox
                  range="11–26 คะแนน"
                  title="ความเสี่ยงปานกลาง"
                  active={
                    score >= 11 &&
                    score <= 26
                  }
                  className="yellow"
                />

                <RiskBox
                  range="27 คะแนนขึ้นไป"
                  title="ความเสี่ยงสูง"
                  active={
                    score >= 27
                  }
                  className="red"
                />

              </div>

            </section>

            {/* =================================================
                ANSWERS
            ================================================== */}

            {answers.length > 0 && (
              <section className="mt-6 rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)] sm:p-8">

                <div className="flex items-center gap-4">

                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
                    <ClipboardList
                      size={24}
                    />
                  </div>

                  <div>
                    <h2 className="text-xl font-black">
                      รายละเอียดคำตอบ
                    </h2>

                    <p className="mt-1 text-sm text-[#898a92]">
                      คำตอบที่ใช้ในการประเมินครั้งนี้
                    </p>
                  </div>

                </div>

                <div className="mt-6 space-y-4">

                  {answers.map(
                    (
                      answer,
                      index,
                    ) => (
                      <article
                        key={
                          answer.answer_id ??
                          index
                        }
                        className="rounded-2xl border border-[#f0eaeb] bg-[#fcfbfb] p-5"
                      >

                        <div className="flex items-start gap-4">

                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0f2] text-sm font-black text-[#b91c2b]">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">

                            <p className="font-semibold leading-7">
                              {
                                answer.question_text
                              }
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-3">

                              <span className="rounded-full bg-[#f8e8ea] px-4 py-2 text-sm font-bold text-[#b91c2b]">
                                {
                                  answer.choice_text
                                }
                              </span>

                              {Number(
                                answer.answer_score,
                              ) >
                                0 && (
                                <span className="text-sm font-semibold text-[#898a92]">
                                  +
                                  {
                                    answer.answer_score
                                  }{" "}
                                  คะแนน
                                </span>
                              )}

                            </div>

                          </div>

                        </div>

                      </article>
                    ),
                  )}

                </div>

              </section>
            )}

            {/* =================================================
                FOOTER ACTION
            ================================================== */}

            <div className="mt-8 flex flex-col gap-3 pb-10 sm:flex-row">

              <Link
                href="/assessment-type"
                className="flex h-13 items-center justify-center rounded-2xl bg-[#b91c2b] px-7 font-bold text-white shadow-[0_10px_25px_rgba(185,28,43,0.18)] transition hover:bg-[#991b2b]"
              >
                ทำแบบประเมินอื่น
              </Link>

              <Link
                href="/history"
                className="flex h-13 items-center justify-center rounded-2xl border border-[#eee5e6] bg-white px-7 font-bold text-[#666770] transition hover:bg-[#faf7f7]"
              >
                ดูประวัติการประเมิน
              </Link>

            </div>

          </div>

        </section>
      </div>
    </main>
  );
}

/* =========================================================
   RISK BOX
========================================================= */

function RiskBox({
  range,
  title,
  active,
  className,
}: {
  range: string;
  title: string;
  active: boolean;
  className:
    | "green"
    | "yellow"
    | "red";
}) {
  const styles = {
    green: {
      normal:
        "border-[#e0eee0] bg-[#f7fbf5] text-[#57965c]",
      active:
        "border-[#9ed092] bg-[#eef8e9] text-[#57965c]",
    },

    yellow: {
      normal:
        "border-[#f1e5c9] bg-[#fffdf7] text-[#a77723]",
      active:
        "border-[#e5c875] bg-[#fff8e8] text-[#a77723]",
    },

    red: {
      normal:
        "border-[#f0d8dc] bg-[#fffafa] text-[#b91c2b]",
      active:
        "border-[#e8aeb6] bg-[#fff0f2] text-[#b91c2b]",
    },
  };

  return (
    <div
      className={`rounded-2xl border p-5 ${
        active
          ? styles[className].active
          : styles[className].normal
      }`}
    >
      <p className="text-sm font-bold">
        {range}
      </p>

      <p className="mt-2 text-lg font-black">
        {title}
      </p>

      {active && (
        <span className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-bold">
          ผลของคุณ
        </span>
      )}
    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-[#fbf9f9]">
      <div className="flex min-h-screen">

        <Sidebar />

        <section className="flex flex-1 items-center justify-center px-5">

          <div className="text-center">

            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f0dadd] border-t-[#b91c2b]" />

            <p className="mt-5 font-semibold text-[#797a82]">
              กำลังโหลดผลการประเมิน...
            </p>

          </div>

        </section>

      </div>
    </main>
  );
}

/* =========================================================
   DATE
========================================================= */

function formatDateTime(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}