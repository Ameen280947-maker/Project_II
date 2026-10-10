"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import { useSearchParams } from "next/navigation";

import RecommendationLayout, {
  RECOMMENDATION_TONES,
  RecommendationError,
  RecommendationLoading,
  ScoreCircle,
  type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "green";

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
   ระดับความเสี่ยง → ชื่อ + สีป้าย
   low <5%, moderate 5-<10%, high 10-<20%, very_high ≥20%
========================================================= */

const RISK_INFO: Record<string, { name: string; color: RiskColor }> = {
  low: { name: "ความเสี่ยงน้อย", color: "green" },
  moderate: { name: "ความเสี่ยงปานกลาง", color: "yellow" },
  high: { name: "ความเสี่ยงสูง", color: "orange" },
  very_high: { name: "ความเสี่ยงสูงมาก", color: "red" },
};

const UNKNOWN_RISK = { name: "ไม่ทราบระดับความเสี่ยง", color: "gray" as RiskColor };

/* =========================================================
   PAGE
========================================================= */

export default function RecommendationDiabetesPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
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

          // session หมดอายุ → กลับไปหน้า login
          if (response.status === 401) {
            localStorage.removeItem("userId");
            window.location.replace("/login");
            return;
          }

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
     LOADING / ERROR
  ========================================================= */

  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (
    error ||
    !assessment
  ) {
    return (
      <RecommendationError
        tone={TONE}
        message={error || "กรุณาทำแบบประเมินอีกครั้ง"}
        editHref="/assessment_diabetes"
      />
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  const riskPercent = Math.min(Math.max(Number(assessment.risk_percent), 0), 100);
  const risk = RISK_INFO[assessment.risk_level] ?? UNKNOWN_RISK;
  const t = RECOMMENDATION_TONES[TONE];

  return (
    <RecommendationLayout
      tone={TONE}
      title={
        <>
          ความเสี่ยงการเกิดโรคเบาหวานใน{" "}
          <span className={t.accent}>12 ปี</span>
        </>
      }
      score={
        <ScoreCircle
          tone={TONE}
          progress={riskPercent / 100}
          value={riskPercent.toFixed(1)}
          unit="%"
        />
      }
      riskLevel={risk.name}
      riskColor={risk.color}
      summary={
        <>
          ผลประเมินของคุณอยู่ใน{" "}
          <strong className={t.eyebrow}>{risk.name}</strong>{" "}
          โดยมีโอกาสเกิดโรคเบาหวานใน 12 ปีประมาณ{" "}
          <strong className={t.accent}>{riskPercent.toFixed(2)}%</strong>
        </>
      }
      recommendation={
        recommendation ? (
          <>
            <strong className={`block ${t.eyebrow}`}>{recommendation.title}</strong>
            {recommendation.recommendation}
          </>
        ) : (
          "ยังไม่มีคำแนะนำสำหรับระดับความเสี่ยงนี้"
        )
      }
      // ใช้ id ที่โหลดได้จริง (รองรับกรณีดึงจาก localStorage)
      assessmentId={assessment.assessment_id}
      editHref="/assessment_diabetes"
    />
  );
}
