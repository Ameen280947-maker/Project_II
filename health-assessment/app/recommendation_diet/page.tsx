"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Leaf, Salad, ShieldCheck, Utensils } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import RecommendationLayout, {
  RECOMMENDATION_TONES,
  RecommendationError,
  RecommendationLoading,
  RecommendationSection,
  ScoreCircle,
  type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "pink";
const EDIT_HREF = "/assessment_diet";

/* คะแนนรวมเต็ม: ผลรวมคะแนนสูงสุดของ 9 ข้อในฐานข้อมูล (ยิ่งสูงยิ่งดี) */
const MAX_SCORE = 34;

/* =====================================================
   TYPES
===================================================== */

type DomainResult = {
  score: number;
  level: string;
};

type ResultResponse = {
  success: boolean;

  assessment?: {
    assessment_id: number;
    total_score: number;
    risk_level: string;
    assessed_at: string;
    recommendation_text: string | null;
  };

  domains?: {
    vegetable: DomainResult;
    sugar: DomainResult;
    fat: DomainResult;
    sodium: DomainResult;
  };

  message?: string;
};

/* =====================================================
   สีผลรวม: ใช้ด้านที่แย่ที่สุด (ตารางที่ 24)
===================================================== */

const OVERALL_COLOR: Record<string, RiskColor> = {
  พฤติกรรมเหมาะสม: "green",
  ควรใส่ใจ: "yellow",
  ควรปรับพฤติกรรม: "orange",
  ควรปรับพฤติกรรมมาก: "red",
};

/* =====================================================
   PAGE
===================================================== */

export default function DietRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <DietRecommendationContent />
    </Suspense>
  );
}

function DietRecommendationContent() {
  const searchParams = useSearchParams();

  const assessmentId = searchParams.get("assessmentId");

  const [data, setData] =
    useState<ResultResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =====================================================
     LOAD RESULT
  ===================================================== */

  useEffect(() => {
    if (!assessmentId) {
      // ไม่ setState ตรง ๆ ในส่วน synchronous ของ effect
      return;
    }

    const loadResult = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/assessments/diet?assessmentId=${assessmentId}`,
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

        const result =
          (await response.json()) as ResultResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ??
              "ไม่สามารถโหลดผลการประเมินได้",
          );
        }

        setData(result);
      } catch (err) {
        console.error(
          "LOAD DIET RESULT ERROR:",
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

  /* =====================================================
     NO ASSESSMENT ID / LOADING / ERROR
  ===================================================== */

  if (!assessmentId) {
    return <RecommendationError tone={TONE} message="ไม่พบ Assessment ID" editHref={EDIT_HREF} />;
  }

  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (error || !data?.assessment) {
    return (
      <RecommendationError
        tone={TONE}
        message={error || "ไม่พบข้อมูลผลการประเมิน"}
        editHref={EDIT_HREF}
      />
    );
  }

  /* =====================================================
     DATA
  ===================================================== */

  const assessment = data.assessment;
  const domains = data.domains;
  const totalScore = Number(assessment.total_score);

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <RecommendationLayout
      tone={TONE}
      title={
        <>
          พฤติกรรม<span className={RECOMMENDATION_TONES[TONE].accent}>การรับประทานอาหาร</span>
        </>
      }
      score={
        <ScoreCircle
          tone={TONE}
          progress={totalScore / MAX_SCORE}
          value={String(totalScore)}
          unit={`/${MAX_SCORE}`}
          caption="คะแนนรวม"
        />
      }
      riskLevel={assessment.risk_level}
      riskColor={OVERALL_COLOR[assessment.risk_level] ?? "gray"}
      recommendation={assessment.recommendation_text || "ยังไม่มีคำแนะนำ"}
      assessmentId={assessmentId}
      editHref={EDIT_HREF}
      menuHref="/assessment-menu-behavior"
    >
      {domains && (
        <RecommendationSection
          icon={<Salad size={27} className={RECOMMENDATION_TONES[TONE].eyebrow} />}
          title="ผลแยกตามด้าน"
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <DomainCard title="ผัก" icon={<Leaf size={25} />} result={domains.vegetable} />
            <DomainCard title="น้ำตาล" icon={<Salad size={25} />} result={domains.sugar} />
            <DomainCard title="ไขมัน" icon={<Utensils size={25} />} result={domains.fat} />
            <DomainCard title="โซเดียม" icon={<ShieldCheck size={25} />} result={domains.sodium} />
          </div>
        </RecommendationSection>
      )}
    </RecommendationLayout>
  );
}

/* =====================================================
   DOMAIN CARD
===================================================== */

function DomainCard({
  title,
  icon,
  result,
}: {
  title: string;
  icon: ReactNode;
  result: DomainResult;
}) {

  const level = result.level;

  /*
   * สีตามตารางที่ 24 ของเอกสารอ้างอิง (0 = เขียว ... 3 = แดง)
   * ผัก: สูงมาก เขียว / สูง เหลือง / ปานกลาง ส้ม / น้อย แดง
   * ด้านอื่น: ต่ำ เขียว / ปานกลาง เหลือง / สูง ส้ม / สูงมาก แดง
   */

  const tier =
    title === "ผัก"
      ? ({ สูงมาก: 0, สูง: 1, ปานกลาง: 2, น้อย: 3 } as Record<string, number>)[level] ?? 0
      : ({ ต่ำ: 0, ปานกลาง: 1, สูง: 2, สูงมาก: 3 } as Record<string, number>)[level] ?? 0;

  const box = [
    "bg-[#eef9e9] text-[#57965c]",
    "bg-[#fff8e8] text-[#a77723]",
    "bg-[#fff1e3] text-[#c2620c]",
    "bg-[#fff0f2] text-[#b91c2b]",
  ][tier];

  return (
    <article className="rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
      <div className="flex items-center gap-3">
        <div className={`grid h-12 w-12 place-items-center rounded-full ${box}`}>
          {icon}
        </div>
        <div>
          <h4 className="text-lg font-bold">{title}</h4>
          <p className="mt-0.5 text-sm text-[#85858d]">คะแนน {result.score}</p>
        </div>
      </div>

      <div className={`mt-5 rounded-full px-4 py-2 text-center text-sm font-bold ${box}`}>
        {getDomainLabel(title, level)}
      </div>
    </article>
  );
}

/* =====================================================
   LABEL
===================================================== */

function getDomainLabel(
  title: string,
  level: string,
) {

  if (title === "ผัก") {
    return `ปริมาณ${level}`;
  }

  return `ระดับ${level}`;
}
