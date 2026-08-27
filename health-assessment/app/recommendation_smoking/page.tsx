"use client";

import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import {
  ArrowLeft,
  Cigarette,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

/* =========================================================
   TYPES
========================================================= */

type Answer = {
  question_id: number;
  question_text: string;
  display_order: number;

  answer_value:
    | string
    | null;

  choice_text:
    | string
    | null;

  score:
    | number
    | string
    | null;
};

type Assessment = {
  assessment_id: number;
  user_id: number;

  total_score:
    | number
    | string
    | null;

  risk_level:
    | string
    | null;

  assessment_type_id: number;

  assessment_name: string;

  assessed_at: string;

  recommendation_text:
    | string
    | null;
};

type RecommendationResponse = {
  success: boolean;

  assessment?: Assessment;

  answers?: Answer[];

  message?: string;
};

/* =========================================================
   PAGE
========================================================= */

export default function SmokingRecommendationPage() {
  const searchParams =
    useSearchParams();

  const assessmentId =
    searchParams.get(
      "assessmentId",
    );

  const [assessment, setAssessment] =
    useState<
      Assessment | null
    >(null);

  const [answers, setAnswers] =
    useState<Answer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD RESULT
  ======================================================= */

  useEffect(() => {
    const loadResult = async () => {
      if (!assessmentId) {
        setError(
          "ไม่พบ assessmentId",
        );

        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `/api/assessment/smoking?assessmentId=${encodeURIComponent(
              assessmentId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          (await response.json()) as RecommendationResponse;

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
      } catch (err) {
        console.error(
          "LOAD SMOKING RESULT ERROR:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดผลการประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadResult();
  }, [assessmentId]);

  /* =======================================================
     RISK
  ======================================================= */

  const riskInfo =
    useMemo(() => {
      return getRiskInfo(
        assessment?.risk_level,
      );
    }, [
      assessment?.risk_level,
    ]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">

          <Sidebar />

          <section className="flex flex-1 items-center justify-center">

            <div className="text-center">

              <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-[#dcebd7] border-t-[#65a05b]" />

              <p className="mt-5 font-semibold text-[#74767d]">
                กำลังโหลดผลการประเมิน...
              </p>

            </div>

          </section>

        </div>
      </main>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (
    error ||
    !assessment
  ) {
    return (
      <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">

        <div className="flex min-h-screen">

          <Sidebar />

          <section className="flex flex-1 items-center justify-center px-5">

            <div className="w-full max-w-xl rounded-[28px] border border-[#f0d7db] bg-white p-8 text-center shadow-[0_15px_40px_rgba(35,25,30,0.05)]">

              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">
                <Cigarette
                  size={30}
                />
              </div>

              <h1 className="mt-5 text-2xl font-bold">
                ไม่สามารถโหลดผลการประเมิน
              </h1>

              <p className="mt-3 text-sm leading-7 text-[#858991]">
                {error ||
                  "ไม่พบข้อมูลผลการประเมิน"}
              </p>

              <Link
                href="/assessment-menu-behavior"
                className="mx-auto mt-6 flex h-12 w-fit items-center gap-2 rounded-2xl bg-[#eef8e9] px-6 font-bold text-[#57965c]"
              >
                <ArrowLeft size={18} />
                กลับไปหน้าแบบประเมิน
              </Link>

            </div>

          </section>

        </div>

      </main>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">

      <div className="flex min-h-screen">

        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

          {/* =================================================
              HEADER
          ================================================== */}

          <header className="mx-auto max-w-5xl">

            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#57965c]">
              Assessment Result
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">

              ผลการประเมิน
              <span className="text-[#57965c]">
                การสูบบุหรี่
              </span>

            </h1>

            <p className="mt-2 text-[#858991]">
              ผลการประเมินพฤติกรรมการสูบบุหรี่ของคุณ
            </p>

          </header>

          {/* =================================================
              SCORE CARD
          ================================================== */}

          <section className="mx-auto mt-7 max-w-5xl rounded-[30px] border border-[#eee8e9] bg-white p-6 shadow-[0_15px_40px_rgba(35,25,30,0.05)] sm:p-8">

            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

              <div className="flex items-center gap-5">

                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#eef8e9] text-[#65a05b]">

                  <Cigarette
                    size={32}
                    strokeWidth={1.8}
                  />

                </div>

                <div>

                  <p className="text-sm font-semibold text-[#8a8b93]">
                    คะแนนการประเมิน
                  </p>

                  <div className="mt-1 flex items-baseline gap-2">

                    <span className="text-5xl font-black tracking-tight">
                      {Number(
                        assessment.total_score ??
                          0,
                      )}
                    </span>

                    <span className="text-sm text-[#898a92]">
                      คะแนน
                    </span>

                  </div>

                </div>

              </div>

              {/* Risk */}

              <div
                className={`inline-flex w-fit items-center gap-2 rounded-full px-5 py-3 text-sm font-black ${riskInfo.badgeClass}`}
              >

                {riskInfo.icon}

                {riskInfo.label}

              </div>

            </div>

          </section>

          {/* =================================================
              DETAIL
          ================================================== */}

          <section className="mx-auto mt-6 grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">

            {/* Answers */}

            <article className="rounded-[28px] border border-[#eee8e9] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)] sm:p-7">

              <div className="flex items-center gap-3">

                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef8e9] text-[#65a05b]">

                  <ClipboardCheck
                    size={23}
                  />

                </div>

                <div>

                  <h2 className="text-xl font-bold">
                    รายละเอียดคำตอบ
                  </h2>

                  <p className="text-sm text-[#898a92]">
                    คำตอบที่บันทึกจากการประเมิน
                  </p>

                </div>

              </div>

              <div className="mt-6 space-y-4">

                {answers.length ===
                0 ? (
                  <p className="rounded-2xl bg-[#faf8f8] p-5 text-sm text-[#898a92]">
                    ไม่พบรายละเอียดคำตอบ
                  </p>
                ) : (
                  answers.map(
                    (
                      answer,
                      index,
                    ) => (
                      <div
                        key={
                          answer.question_id
                        }
                        className="rounded-2xl border border-[#f0ebeb] bg-[#fcfbfb] p-5"
                      >

                        <p className="text-sm font-bold leading-6">
                          {index +
                            1}
                          .{" "}
                          {
                            answer.question_text
                          }
                        </p>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">

                          <span className="rounded-xl bg-[#eef8e9] px-4 py-2 text-sm font-semibold text-[#527e4a]">
                            {
                              answer.choice_text
                            }
                          </span>

                          <span className="text-sm font-bold text-[#777980]">
                            คะแนน{" "}
                            {
                              answer.score ??
                              0
                            }
                          </span>

                        </div>

                      </div>
                    ),
                  )
                )}

              </div>

            </article>

            {/* Recommendation */}

            <article className="h-fit rounded-[28px] border border-[#e3eedf] bg-[#f5faf2] p-6 shadow-[0_12px_35px_rgba(35,25,30,0.03)]">

              <div className="flex items-center gap-3">

                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#65a05b] shadow-sm">

                  {riskInfo.icon}

                </div>

                <div>

                  <h2 className="font-bold">
                    คำแนะนำ
                  </h2>

                  <p className="text-xs text-[#798179]">
                    ตามผลการประเมินของคุณ
                  </p>

                </div>

              </div>

              <div className="mt-5 rounded-2xl bg-white p-5">

                <p className="text-sm leading-7 text-[#656a65]">
                  {assessment.recommendation_text ||
                    getDefaultRecommendation(
                      assessment.risk_level,
                    )}
                </p>

              </div>

            </article>

          </section>

          {/* =================================================
              DATE
          ================================================== */}

          <section className="mx-auto mt-6 max-w-5xl rounded-2xl border border-[#eee8e9] bg-white px-5 py-4">

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#898a92]">

              <span className="flex items-center gap-2">

                <CalendarDays
                  size={17}
                />

                ประเมินเมื่อ{" "}
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

          </section>

          {/* =================================================
              BUTTON
          ================================================== */}

          <div className="mx-auto mt-7 flex max-w-5xl justify-between">

            <Link
              href="/assessment-menu-behavior"
              className="flex h-12 items-center gap-2 rounded-2xl bg-white px-6 font-bold text-[#6f7179] shadow-sm ring-1 ring-[#eee8e9]"
            >

              <ArrowLeft
                size={19}
              />

              กลับไปแบบประเมิน

            </Link>

            <Link
              href="/history"
              className="flex h-12 items-center gap-2 rounded-2xl bg-[#eef8e9] px-6 font-bold text-[#57965c]"
            >

              ดูประวัติ

            </Link>

          </div>

        </section>

      </div>

    </main>
  );
}

/* =========================================================
   RISK INFO
========================================================= */

function getRiskInfo(
  riskLevel:
    | string
    | null
    | undefined,
) {
  const level =
    String(
      riskLevel ?? "",
    ).toLowerCase();

  if (
    level.includes("very_high") ||
    level.includes("very high") ||
    level.includes("สูงมาก") ||
    level.includes("อันตราย")
  ) {
    return {
      label: "ความเสี่ยงสูงมาก",

      badgeClass:
        "bg-[#fff0f2] text-[#b91c2b]",

      icon: (
        <AlertTriangle
          size={18}
        />
      ),
    };
  }

  if (
    level.includes("high") ||
    level.includes("สูง")
  ) {
    return {
      label: "ความเสี่ยงสูง",

      badgeClass:
        "bg-[#fff4e5] text-[#b7791f]",

      icon: (
        <AlertTriangle
          size={18}
        />
      ),
    };
  }

  if (
    level.includes("moderate") ||
    level.includes("ปานกลาง")
  ) {
    return {
      label: "ความเสี่ยงปานกลาง",

      badgeClass:
        "bg-[#fff8e6] text-[#a77723]",

      icon: (
        <AlertTriangle
          size={18}
        />
      ),
    };
  }

  return {
    label: "ความเสี่ยงต่ำ",

    badgeClass:
      "bg-[#eef8e9] text-[#57965c]",

    icon: (
      <CheckCircle2
        size={18}
      />
    ),
  };
}

/* =========================================================
   DEFAULT RECOMMENDATION
========================================================= */

function getDefaultRecommendation(
  riskLevel:
    | string
    | null
    | undefined,
) {
  const level =
    String(
      riskLevel ?? "",
    ).toLowerCase();

  if (
    level.includes("very_high") ||
    level.includes("very high") ||
    level.includes("สูงมาก")
  ) {
    return "ควรพิจารณาปรับเปลี่ยนพฤติกรรมการสูบบุหรี่และขอคำปรึกษาจากบุคลากรทางการแพทย์หรือบริการช่วยเลิกบุหรี่";
  }

  if (
    level.includes("high") ||
    level.includes("สูง")
  ) {
    return "ควรลดหรือหยุดการสูบบุหรี่ และพิจารณาขอคำแนะนำเพื่อช่วยในการเลิกบุหรี่";
  }

  if (
    level.includes("moderate") ||
    level.includes("ปานกลาง")
  ) {
    return "ควรระมัดระวังพฤติกรรมการสูบบุหรี่และพยายามลดปริมาณหรือหลีกเลี่ยงการสูบบุหรี่";
  }

  return "ควรรักษาพฤติกรรมที่ดีและหลีกเลี่ยงการเริ่มสูบบุหรี่หรือกลับไปสูบบุหรี่";
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
      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  ).format(date);
}