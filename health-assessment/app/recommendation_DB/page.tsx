"use client";

import {
  Gauge,
  HeartPulse,
} from "lucide-react";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import {
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

// หน้าผลและคำแนะนำความดันโลหิต: ครอบเนื้อหาด้วย Suspense
export default function BloodPressureRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <RecommendationContent />
    </Suspense>
  );
}

// เนื้อหาหน้าผลความดัน: โหลดผลตาม assessmentId แล้วแสดงค่าความดันและคำแนะนำ
function RecommendationContent() {
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

  /* =========================================================
     โหลดผลจาก Database
  ========================================================= */

  useEffect(() => {
    // โหลดผลประเมินความดันโลหิตตาม assessmentId (session หมดอายุให้กลับหน้า login)
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

  const riskColor: RiskColor =
    BP_LEVELS.find((b) => b.level === result.riskLevel)?.color ?? "gray";

  const t = RECOMMENDATION_TONES[TONE];

  return (
    <>
      <RecommendationLayout
        tone={TONE}
        assessmentKey="blood pressure"
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
