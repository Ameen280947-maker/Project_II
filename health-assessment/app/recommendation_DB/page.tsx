"use client";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  HeartPulse,
  Info,
  Stethoscope,
  X,
} from "lucide-react";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

type AssessmentResult = {
  assessmentId: number;
  userId: number;
  assessmentName: string;
  systolic: number;
  diastolic: number;
  riskLevel: string;
  recommendation: string;
  assessedAt: string;
};

type ResultResponse = {
  success: boolean;
  result?: AssessmentResult;
  message?: string;
};

export default function BloodPressureRecommendationPage() {
  return (
    <Suspense
      fallback={<LoadingPage />}
    >
      <RecommendationContent />
    </Suspense>
  );
}

function RecommendationContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const assessmentId =
    searchParams.get(
      "assessmentId",
    );

  const [result, setResult] =
    useState<AssessmentResult | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [showPopup, setShowPopup] =
    useState(false);

  /* =========================================================
     โหลดผลจาก Database
  ========================================================= */

  useEffect(() => {
    const loadResult =
      async () => {
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
              `/api/assessments/blood-pressure?assessmentId=${encodeURIComponent(
                assessmentId,
              )}`,
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
            !data.result
          ) {
            throw new Error(
              data.message ??
                "ไม่สามารถโหลดผลประเมินได้",
            );
          }

          setResult(data.result);

        } catch (loadError) {
          console.error(
            "LOAD BP RESULT:",
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : "ไม่สามารถโหลดผลประเมินได้",
          );
        } finally {
          setLoading(false);
        }
      };

    void loadResult();
  }, [assessmentId]);

  if (loading) {
    return <LoadingPage />;
  }

  if (
    error ||
    !result
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbf9f9] p-6">

        <div className="w-full max-w-md rounded-[28px] border border-[#eee5e6] bg-white p-8 text-center shadow-lg">

          <Info
            size={45}
            className="mx-auto text-[#b91c2b]"
          />

          <h1 className="mt-5 text-2xl font-bold">
            ไม่สามารถแสดงผลได้
          </h1>

          <p className="mt-3 text-[#767780]">
            {error ||
              "ไม่พบผลการประเมิน"}
          </p>

          <Link
            href="/assessment_DB"
            className="mt-7 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#b91c2b] font-bold text-white"
          >
            <ArrowLeft size={20} />
            กลับไปทำแบบประเมิน
          </Link>

        </div>

      </main>
    );
  }

  const highRiskLevels = [
    "ความดันโลหิตเริ่มสูง",
    "อาจเป็นโรคความดันโลหิตสูง",
    "น่าจะเป็นโรคความดันโลหิตสูง",
    "ความดันโลหิตสูงอันตราย",
  ];

  const shouldSuggestMoreAssessment =
    highRiskLevels.includes(result.riskLevel);

  const riskColor =
    result.riskLevel === "ความดันต่ำกว่าเกณฑ์"
      ? "text-[#2563eb]"
      : result.riskLevel === "ความดันอยู่ในระดับปกติ"
        ? "text-[#16a34a]"
        : result.riskLevel === "ความดันโลหิตเริ่มสูง"
          ? "text-[#d97706]"
          : "text-[#c5162d]";

  return (
    <main className="min-h-screen bg-[#fbf9f9] px-5 py-8 text-[#2f3037] sm:px-8 lg:px-12">

      <div className="mx-auto max-w-[1250px]">

        {/* Header */}

        <header>

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
            Health Recommendation
          </p>

          <h1 className="mt-3 text-4xl font-black">
            คำแนะนำ
          </h1>

          <div className="mt-4 h-1 w-10 rounded-full bg-[#b91c2b]" />

        </header>

        <div className="mt-8 space-y-7">

          <div className="space-y-7">

            {/* BP numbers */}

            <section className="rounded-[28px] border border-[#eee5e6] bg-white p-8">

              <div className="flex items-center gap-3">

                <HeartPulse
                  size={28}
                  className="text-[#b91c2b]"
                />

                <h3 className="text-xl font-bold">
                  ผลความดันโลหิต{" "}
                  <span className={riskColor}>
                    — {result.riskLevel}
                  </span>
                </h3>

              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">

                <PressureResult
                  title="ตัวบน (SYSTOLIC)"
                  value={result.systolic}
                  riskColor={riskColor}
                />

                <PressureResult
                  title="ตัวล่าง (DIASTOLIC)"
                  value={result.diastolic}
                  riskColor={riskColor}
                />

              </div>

            </section>

            {/* Recommendation */}

            <section className="rounded-[28px] border border-[#f0dfe1] bg-[#fff7f8] p-8">

              <div className="flex items-start gap-4">

                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#b91c2b]">
                  <Info size={25} />
                </div>

                <div>

                  <h3 className="text-xl font-bold">
                    คำแนะนำสุขภาพ
                  </h3>

                  <p className="mt-4 whitespace-pre-line leading-8 text-[#696a72]">
                    {
                      result.recommendation
                    }
                  </p>

                </div>

              </div>

            </section>

          </div>

          {/* Back to assessment */}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (shouldSuggestMoreAssessment) {
                  setShowPopup(true);
                } else {
                  router.push("/assessment-menu");
                }
              }}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#c5162d] to-[#9d1426] font-bold text-white shadow-sm transition hover:opacity-95 sm:w-[320px]"
            >
              <ArrowLeft size={19} />
              กลับไปหน้าแบบประเมิน
            </button>
          </div>
        </div>

      </div>

      {/* =====================================================
          Popup แนะนำ CVD
      ====================================================== */}

      {showPopup &&
        shouldSuggestMoreAssessment && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5 backdrop-blur-sm">

            <div className="relative w-full max-w-[480px] rounded-[30px] bg-white p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,0.18)]">

              <button
                type="button"
                onClick={() =>
                  setShowPopup(
                    false,
                  )
                }
                className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-[#f7f4f4] text-[#777780]"
              >
                <X size={20} />
              </button>

              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">

                <Stethoscope
                  size={38}
                />

              </div>

              <h2 className="mt-6 text-2xl font-bold">
                แนะนำให้ประเมินเพิ่มเติม
              </h2>

              <p className="mt-3 leading-7 text-[#74757d]">
                ผลการประเมินพบว่า
                ความดันโลหิตของคุณสูงกว่าปกติ
                แนะนำให้ประเมินความเสี่ยงโรคอื่นเพิ่มเติม โดยเฉพาะโรคหัวใจและหลอดเลือด
              </p>

              <div className="mt-7 flex flex-col gap-3">

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/assessment_CVD",
                    )
                  }
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#c5162d] to-[#9d1426] font-bold text-white"
                >

                  ประเมินโรคหัวใจและหลอดเลือด

                  <ArrowRight
                    size={20}
                  />

                </button>

         <Link
  href="/assessment-type"
  className="flex h-14 items-center justify-center rounded-2xl border border-[#ead9db] font-semibold text-[#777780]"
>
  ไว้ภายหลัง
</Link>

              </div>

            </div>

          </div>
        )}

    </main>
  );
}

/* ========================================================= */

function PressureResult({
  title,
  value,
  riskColor,
}: {
  title: string;
  value: number;
  riskColor: string;
}) {
  return (
    <div className="rounded-[24px] bg-[#faf8f8] p-6">

      <p className="text-xs font-semibold text-[#8b8c94]">
        {title}
      </p>

      <div className="mt-2 flex items-end gap-2">

        <span className={`text-5xl font-black ${riskColor}`}>
          {value}
        </span>

        <span className="mb-1 text-xs text-[#777780]">
          mmHg
        </span>

      </div>

    </div>
  );
}

function LoadingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fbf9f9]">

      <div className="text-center">

        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f1dadd] border-t-[#b91c2b]" />

        <p className="mt-5 font-semibold text-[#767780]">
          กำลังโหลดผลการประเมิน...
        </p>

      </div>

    </main>
  );
}