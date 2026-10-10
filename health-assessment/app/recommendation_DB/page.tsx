"use client";

import Link from "next/link";

import {
  ArrowRight,
  Gauge,
  HeartPulse,
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

import RecommendationLayout, {
  RECOMMENDATION_TONES,
  RecommendationError,
  RecommendationLoading,
  RecommendationSection,
  ScoreCircle,
  type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "blue";

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

/* =========================================================
   เกณฑ์ระดับความดัน (ตรงกับ API, เอกสารอ้างอิง ตารางที่ 4)
   color = สีตามความหมายของผล
========================================================= */

const BP_LEVELS: { level: string; range: string; color: RiskColor }[] = [
  { level: "ความดันต่ำกว่าเกณฑ์", range: "< 90 / < 60", color: "yellow" },
  { level: "ความดันอยู่ในระดับปกติ", range: "< 130 / < 85", color: "green" },
  { level: "ความดันโลหิตเริ่มสูง", range: "130–139 / 85–89", color: "yellow" },
  { level: "อาจเป็นโรคความดันโลหิตสูง", range: "140–159 / 90–99", color: "orange" },
  { level: "น่าจะเป็นโรคความดันโลหิตสูง", range: "160–179 / 100–109", color: "red" },
  { level: "ความดันโลหิตสูงอันตราย", range: "≥ 180 / ≥ 110", color: "red" },
];

const DOT: Record<RiskColor, string> = {
  green: "bg-[#4f9857]",
  yellow: "bg-[#d9a400]",
  orange: "bg-[#e07a1f]",
  red: "bg-[#c81e3a]",
  gray: "bg-[#a3a4ab]",
};

// ระดับที่ควรแนะนำให้ประเมินโรคหัวใจและหลอดเลือดเพิ่ม
const HIGH_RISK_LEVELS = [
  "ความดันโลหิตเริ่มสูง",
  "อาจเป็นโรคความดันโลหิตสูง",
  "น่าจะเป็นโรคความดันโลหิตสูง",
  "ความดันโลหิตสูงอันตราย",
];

export default function BloodPressureRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
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

          // session หมดอายุ → กลับไปหน้า login
          if (response.status === 401) {
            localStorage.removeItem("userId");
            window.location.replace("/login");
            return;
          }

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
    return <RecommendationLoading tone={TONE} />;
  }

  if (
    error ||
    !result
  ) {
    return <RecommendationError tone={TONE} message={error} editHref="/assessment_DB" />;
  }

  const shouldSuggestMoreAssessment =
    HIGH_RISK_LEVELS.includes(result.riskLevel);

  const riskColor: RiskColor =
    BP_LEVELS.find((b) => b.level === result.riskLevel)?.color ?? "gray";

  const t = RECOMMENDATION_TONES[TONE];

  return (
    <>
      <RecommendationLayout
        tone={TONE}
        title={
          <>
            ผลการประเมิน<span className={t.accent}>ความดันโลหิต</span>ของคุณ
          </>
        }
        score={
          <ScoreCircle
            tone={TONE}
            // เทียบตัวบนกับเกณฑ์ระดับอันตราย (180 mmHg)
            progress={result.systolic / 180}
            value={String(result.systolic)}
            unit={`/${result.diastolic}`}
            caption="mmHg"
          />
        }
        riskLevel={result.riskLevel}
        riskColor={riskColor}
        summary={
          <>
            ผลประเมินของคุณอยู่ในระดับ{" "}
            <strong className={t.eyebrow}>{result.riskLevel}</strong>{" "}
            โดยมีความดันโลหิต{" "}
            <strong className={t.accent}>
              {result.systolic}/{result.diastolic} mmHg
            </strong>
          </>
        }
        recommendation={result.recommendation}
        assessmentId={assessmentId}
        editHref="/assessment_DB"
        onMenuClick={() => {
          if (shouldSuggestMoreAssessment) {
            setShowPopup(true);
          } else {
            router.push("/assessment-menu");
          }
        }}
      >
        {/* =====================================================
            ค่าความดันที่วัดได้ + เกณฑ์แต่ละระดับ
        ====================================================== */}

        <RecommendationSection
          icon={<HeartPulse size={27} className={t.eyebrow} />}
          title="ค่าความดันโลหิตของคุณ"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <PressureResult
              title="ตัวบน (SYSTOLIC)"
              value={result.systolic}
              valueClass={t.eyebrow}
            />
            <PressureResult
              title="ตัวล่าง (DIASTOLIC)"
              value={result.diastolic}
              valueClass={t.eyebrow}
            />
          </div>
        </RecommendationSection>

        <RecommendationSection
          icon={<Gauge size={27} className={t.eyebrow} />}
          title="เกณฑ์ระดับความดันโลหิต"
        >
          <div className="overflow-hidden rounded-[25px] border border-[#eee8e9] bg-white">
            {BP_LEVELS.map((band) => {
              const active = band.level === result.riskLevel;

              return (
                <div
                  key={band.level}
                  className={`flex items-center justify-between gap-4 border-b border-[#f3eeef] px-6 py-4 last:border-b-0 ${
                    active ? "bg-[#f5f7fc] font-bold" : "text-[#666872]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[band.color]}`} />
                    <span>{band.level}</span>
                  </div>
                  <span className="shrink-0 text-sm">{band.range} mmHg</span>
                </div>
              );
            })}
          </div>
        </RecommendationSection>
      </RecommendationLayout>

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

              <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${t.iconSoft}`}>
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
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f6fc0] to-[#22397a] font-bold text-white"
                >
                  ประเมินโรคหัวใจและหลอดเลือด
                  <ArrowRight
                    size={20}
                  />
                </button>

                <Link
                  href="/assessment-type"
                  className="flex h-14 items-center justify-center rounded-2xl border border-[#c8d3ec] font-semibold text-[#777780]"
                >
                  ไว้ภายหลัง
                </Link>

              </div>

            </div>

          </div>
        )}
    </>
  );
}

/* =========================================================
   การ์ดค่าความดัน
========================================================= */

function PressureResult({
  title,
  value,
  valueClass,
}: {
  title: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
      <p className="text-xs font-semibold text-[#8b8c94]">
        {title}
      </p>

      <div className="mt-2 flex items-end gap-2">
        <span className={`text-5xl font-black ${valueClass}`}>
          {value}
        </span>
        <span className="mb-1 text-xs text-[#777780]">
          mmHg
        </span>
      </div>
    </div>
  );
}
