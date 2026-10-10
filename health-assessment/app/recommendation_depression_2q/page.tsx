"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";

import RecommendationLayout, {
  RECOMMENDATION_TONES,
  RecommendationError,
  RecommendationLoading,
  ScoreCircle,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "violet";
const EDIT_HREF = "/assessment_depression_2q";

/* =========================================================
   TYPES
========================================================= */

type Result = {
  assessment_id: number;
  total_score: number;
  risk_level: string;
  recommendation_text: string;
  assessed_at: string;
};

/* =========================================================
   COMPONENT CONTENT
========================================================= */

function Depression2QRecommendationContent() {
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessmentId");

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!assessmentId) {
      setError("ไม่พบรหัสผลการประเมิน (Assessment ID)");
      setLoading(false);
      return;
    }

    async function loadResult() {
      try {
        setLoading(true);
        setError("");

        const userId =
          typeof window !== "undefined"
            ? localStorage.getItem("userId")
            : "";

        const res = await fetch(
          `/api/assessments/depression?stage=2q&assessmentId=${assessmentId}&userId=${userId || ""}`,
          {
            cache: "no-store",
          }
        );

        // session หมดอายุ → กลับไปหน้า login
        if (res.status === 401) {
          localStorage.removeItem("userId");
          window.location.replace("/login");
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "ไม่สามารถโหลดผลการประเมินได้");
        }

        setResult(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดผลการประเมิน"
        );
      } finally {
        setLoading(false);
      }
    }

    loadResult();
  }, [assessmentId]);

  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (error || !result) {
    return <RecommendationError tone={TONE} message={error} editHref={EDIT_HREF} />;
  }

  const isRisk =
    result.total_score > 0 ||
    result.risk_level.includes("เสี่ยง") ||
    result.risk_level.includes("แนวโน้ม");

  const score = Number(result.total_score ?? 0);
  const t = RECOMMENDATION_TONES[TONE];

  return (
    <RecommendationLayout
      tone={TONE}
      title="การคัดกรองโรคซึมเศร้า (2Q)"
      score={
        <ScoreCircle
          tone={TONE}
          progress={score / 2}
          value={String(score)}
          unit="/2"
          caption="คะแนน"
        />
      }
      riskLevel={result.risk_level}
      riskColor={isRisk ? "yellow" : "green"}
      recommendation={result.recommendation_text}
      assessmentId={assessmentId}
      editHref={EDIT_HREF}
      menuHref="/assessment-menu-mental-health"
    >
      {/* =====================================================
         มีแนวโน้มซึมเศร้า → ชวนทำแบบประเมิน 9Q ต่อทันที
      ===================================================== */}
      {isRisk && (
        <section className={`mt-8 rounded-[28px] border-2 bg-gradient-to-br p-6 sm:p-8 ${t.panel}`}>
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${t.iconSoft}`}>
                <Brain size={27} />
              </div>
              <div>
                <h3 className="text-2xl font-bold">ขั้นตอนถัดไป: ทำแบบประเมินโรคซึมเศร้า 9Q</h3>
                <p className="mt-2 leading-7 text-[#666872]">
                  เพื่อความแม่นยำในการคัดกรอง แนะนำให้ตอบแบบประเมิน 9Q ต่อเนื่องทันที
                </p>
              </div>
            </div>

            <Link
              href={`/assessment_depression_9q?previousAssessmentId=${result.assessment_id}`}
              className={`inline-flex h-14 shrink-0 items-center gap-2 rounded-2xl px-6 font-bold text-white shadow-sm transition hover:opacity-90 ${t.button}`}
            >
              เริ่มทำแบบประเมิน 9Q
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      )}
    </RecommendationLayout>
  );
}

export default function Depression2QRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <Depression2QRecommendationContent />
    </Suspense>
  );
}
