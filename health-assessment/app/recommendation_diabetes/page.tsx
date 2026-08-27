"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  HeartPulse,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";

/* =========================================================
   TYPES
========================================================= */

type Assessment = {
  assessment_id: number;
  user_id: number;

  age: number;
  gender: string;

  height_cm: number;
  weight_kg: number;

  bmi: number;

  waist_cm: number;

  sbp: number;
  dbp: number;

  family_diabetes: boolean;

  risk_percent: number;
  risk_level: string;

  created_at: string;
};

type Recommendation = {
  recommendation_id: number;
  risk_level: string;
  title: string;
  recommendation: string;
};

type ResponseData = {
  success: boolean;
  message?: string;

  assessment?: Assessment;

  recommendation?:
    | Recommendation
    | null;
};

/* =========================================================
   PAGE
========================================================= */

export default function RecommendationDiabetesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fbf9f9]">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#f0dadd] border-t-[#b91c2b]" />
            <p className="mt-4 text-sm font-semibold text-[#777780]">
              กำลังโหลด...
            </p>
          </div>
        </main>
      }
    >
      <RecommendationDiabetesContent />
    </Suspense>
  );
}

function RecommendationDiabetesContent() {
  const searchParams =
    useSearchParams();

  const assessmentId =
    searchParams.get(
      "assessmentId",
    );

  /* =======================================================
     STATE
  ======================================================= */

  const [
    assessment,
    setAssessment,
  ] =
    useState<Assessment | null>(
      null,
    );

  const [
    recommendation,
    setRecommendation,
  ] =
    useState<Recommendation | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /* =========================================================
     LOAD RESULT
  ========================================================= */

  useEffect(() => {
    const loadResult =
      async () => {
        try {
          setLoading(true);

          setError("");

          let id =
            assessmentId;

          /* -----------------------------------------------
             FALLBACK LOCAL STORAGE
          ------------------------------------------------ */

          if (!id) {
            const stored =
              localStorage.getItem(
                "diabetesAssessment",
              );

            if (stored) {
              const parsed =
                JSON.parse(
                  stored,
                );

              id =
                String(
                  parsed.assessment_id,
                );
            }
          }

          if (!id) {
            throw new Error(
              "ไม่พบผลการประเมิน",
            );
          }

          /* -----------------------------------------------
             GET API
          ------------------------------------------------ */

          const response =
            await fetch(
              `/api/assessments/diabetes?assessmentId=${id}`,
              {
                method: "GET",
                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as ResponseData;

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

          setRecommendation(
            data.recommendation ??
              null,
          );
        } catch (loadError) {
          console.error(
            "LOAD DIABETES RESULT ERROR:",
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
  }, [
    assessmentId,
  ]);

  /* =========================================================
     RISK STYLE
  ========================================================= */

  const getRiskStyle = (
    level: string,
  ) => {
    switch (level) {
      case "low":
        return {
          bg: "bg-[#eef8e9]",
          text: "text-[#5f9a55]",
          border:
            "border-[#d8ebd1]",
        };

      case "moderate":
        return {
          bg: "bg-[#fff8e8]",
          text: "text-[#c28a28]",
          border:
            "border-[#f3e3b8]",
        };

      case "high":
        return {
          bg: "bg-[#fff0f2]",
          text: "text-[#d34a5c]",
          border:
            "border-[#f3cdd1]",
        };

      case "very_high":
        return {
          bg: "bg-[#ffe8e8]",
          text: "text-[#b91c2b]",
          border:
            "border-[#f0bfc4]",
        };

      default:
        return {
          bg: "bg-[#f5f5f5]",
          text: "text-[#777982]",
          border:
            "border-[#eeeeee]",
        };
    }
  };

  /* =========================================================
     RISK NAME
  ========================================================= */

  const getRiskName = (
    level: string,
  ) => {
    switch (level) {
      case "low":
        return "ความเสี่ยงน้อย";

      case "moderate":
        return "ความเสี่ยงปานกลาง";

      case "high":
        return "ความเสี่ยงสูง";

      case "very_high":
        return "ความเสี่ยงสูงมาก";

      default:
        return "ไม่ทราบระดับความเสี่ยง";
    }
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">

        <div className="flex min-h-screen">

          <Sidebar />

          <section className="flex flex-1 items-center justify-center px-5">

            <div className="text-center">

              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f3cdd1] border-t-[#b91c2b]" />

              <p className="mt-5 font-semibold text-[#777982]">
                กำลังโหลดผลการประเมิน...
              </p>

            </div>

          </section>

        </div>

      </main>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (
    error ||
    !assessment
  ) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">

        <div className="flex min-h-screen">

          <Sidebar />

          <section className="flex flex-1 items-center justify-center px-5">

            <div className="w-full max-w-md rounded-[28px] border border-[#eee5e6] bg-white p-8 text-center shadow-sm">

              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">
                <HeartPulse
                  size={40}
                />
              </div>

              <h1 className="mt-5 text-xl font-bold">
                ไม่พบผลการประเมิน
              </h1>

              <p className="mt-2 text-sm text-[#858791]">
                {error ||
                  "กรุณาทำแบบประเมินอีกครั้ง"}
              </p>

              <Link
                href="/assessment_diabetes"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#b91c2b] px-6 py-3 font-bold text-white"
              >
                ทำแบบประเมินอีกครั้ง
              </Link>

            </div>

          </section>

        </div>

      </main>
    );
  }

  /* =========================================================
     RISK STYLE
  ========================================================= */

  const riskStyle =
    getRiskStyle(
      assessment.risk_level,
    );

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">

      <div className="flex min-h-screen">

        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

          {/* =================================================
              HEADER
          ================================================= */}

          <header>

            <Link
              href="/assessment-type"
              className="inline-flex items-center gap-2 rounded-full bg-[#fff0f2] px-4 py-2 text-sm font-semibold text-[#b91c2b]"
            >
              <ArrowLeft
                size={18}
              />

              กลับหน้าแบบประเมิน
            </Link>

            <p className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Diabetes Result
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              ผลการประเมิน
              <span className="text-[#ef4962]">
                โรคเบาหวาน
              </span>
            </h1>

            <p className="mt-3 text-lg text-[#858791]">
              ผลการประเมินความเสี่ยงการเกิดโรคเบาหวาน
              ใน 12 ปีข้างหน้า
            </p>

          </header>

          {/* =================================================
              RESULT
          ================================================= */}

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">

            {/* LEFT */}

            <div className="space-y-6">

              {/* SCORE */}

              <section className="rounded-[30px] border border-[#eee5e6] bg-white p-7 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-9">

                <div className="flex flex-col items-center text-center">

                  <div className="grid h-28 w-28 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">
                    <HeartPulse
                      size={58}
                    />
                  </div>

                  <p className="mt-6 text-sm font-semibold text-[#858791]">
                    ความเสี่ยงการเกิดโรคเบาหวานใน 12 ปี
                  </p>

                  <div className="mt-2">

                    <span className="text-6xl font-black text-[#b91c2b]">
                      {Number(
                        assessment.risk_percent,
                      ).toFixed(
                        2,
                      )}
                    </span>

                    <span className="ml-2 text-2xl font-bold text-[#858791]">
                      %
                    </span>

                  </div>

                  <div
                    className={`mt-5 rounded-full border px-6 py-2.5 text-sm font-bold ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                  >
                    {getRiskName(
                      assessment.risk_level,
                    )}
                  </div>

                </div>

              </section>

              {/* =================================================
                  RECOMMENDATION
              ================================================= */}

              <section className="rounded-[30px] border border-[#eee5e6] bg-white p-7 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-9">

                <div className="flex items-center gap-3">

                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
                    <ShieldCheck
                      size={27}
                    />
                  </div>

                  <div>

                    <p className="text-sm font-bold uppercase tracking-wide text-[#b91c2b]">
                      Recommendation
                    </p>

                    <h2 className="text-xl font-black">
                      คำแนะนำสุขภาพ
                    </h2>

                  </div>

                </div>

                {recommendation ? (
                  <div className="mt-7">

                    <h3 className="text-lg font-bold text-[#b91c2b]">
                      {
                        recommendation.title
                      }
                    </h3>

                    <div className="mt-4 rounded-2xl bg-[#fff8f8] p-5">

                      <p className="leading-8 text-[#686970]">
                        {
                          recommendation.recommendation
                        }
                      </p>

                    </div>

                  </div>
                ) : (
                  <p className="mt-6 text-sm text-[#858791]">
                    ยังไม่มีคำแนะนำสำหรับระดับความเสี่ยงนี้
                  </p>
                )}

              </section>

            </div>

            {/* =================================================
                RIGHT
            ================================================= */}

            <aside className="space-y-5">

              {/* SUMMARY */}

              <section className="rounded-[30px] border border-[#eee5e6] bg-white p-7 shadow-[0_16px_45px_rgba(35,25,30,0.05)]">

                <h2 className="text-lg font-black">
                  ข้อมูลที่ใช้ประเมิน
                </h2>

                <div className="mt-5 space-y-3">

                  <SummaryRow
                    label="อายุ"
                    value={`${assessment.age} ปี`}
                  />

                  <SummaryRow
                    label="เพศ"
                    value={
                      assessment.gender ===
                      "male"
                        ? "ชาย"
                        : "หญิง"
                    }
                  />

                  <SummaryRow
                    label="ส่วนสูง"
                    value={`${assessment.height_cm} ซม.`}
                  />

                  <SummaryRow
                    label="น้ำหนัก"
                    value={`${assessment.weight_kg} กก.`}
                  />

                  <SummaryRow
                    label="BMI"
                    value={Number(
                      assessment.bmi,
                    ).toFixed(2)}
                  />

                  <SummaryRow
                    label="รอบเอว"
                    value={`${assessment.waist_cm} ซม.`}
                  />

                  <SummaryRow
                    label="ความดัน"
                    value={`${assessment.sbp}/${assessment.dbp} mmHg`}
                  />

                  <SummaryRow
                    label="ประวัติเบาหวานในครอบครัว"
                    value={
                      assessment.family_diabetes
                        ? "มี"
                        : "ไม่มี"
                    }
                  />

                </div>

              </section>

              {/* DATE */}

              <section className="rounded-[26px] bg-[#fff0f2] p-6">

                <div className="flex items-center gap-3 text-[#b91c2b]">

                  <CalendarCheck
                    size={24}
                  />

                  <div>

                    <p className="text-sm font-bold">
                      วันที่ประเมิน
                    </p>

                    <p className="mt-1 text-sm">
                      {new Date(
                        assessment.created_at,
                      ).toLocaleDateString(
                        "th-TH",
                        {
                          year: "numeric",
                          month:
                            "long",
                          day: "numeric",
                        },
                      )}
                    </p>

                  </div>

                </div>

              </section>

              {/* NEW */}

              <Link
                href="/assessment_diabetes"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#b91c2b] bg-white font-bold text-[#b91c2b] transition hover:bg-[#fff0f2]"
              >

                <RefreshCcw
                  size={19}
                />

                ทำแบบประเมินใหม่

              </Link>

            </aside>

          </div>

          {/* =================================================
              DISCLAIMER
          ================================================= */}

          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#eee5e6] bg-white p-5 text-sm leading-7 text-[#858791]">

            <CheckCircle2
              size={21}
              className="mt-1 shrink-0 text-[#6fa85e]"
            />

            <p>
              ผลนี้เป็นการประเมินความเสี่ยงเบื้องต้น
              ไม่ใช่การวินิจฉัยโรค
              หากมีความผิดปกติหรือมีความกังวล
              ควรปรึกษาบุคลากรทางการแพทย์
            </p>

          </div>

        </section>

      </div>

    </main>
  );
}

/* =========================================================
   SUMMARY ROW
========================================================= */

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#faf8f8] px-4 py-3">

      <span className="text-sm text-[#858791]">
        {label}
      </span>

      <span className="text-sm font-bold text-[#3a3a40]">
        {value}
      </span>

    </div>
  );
}