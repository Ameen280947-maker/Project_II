"use client";

import { Apple, Heart, PersonStanding, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RecommendationLayout, {
  AdviceCard,
  RecommendationError,
  RecommendationLoading,
  RecommendationSection,
  ScoreCircle,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "rose";

type AssessmentResult = {
  assessmentId: number;
  riskPercent: number;
  riskLevel: string;
  recommendation: string;
  assessedAt: string;
  assessmentName: string;
};

type ResultResponse = {
  success: boolean;
  result?: AssessmentResult;
  message?: string;
};

export default function RecommendationHealthPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <RecommendationContent />
    </Suspense>
  );
}

function RecommendationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const assessmentId = searchParams.get("assessmentId");

  const [result, setResult] =
    useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadResult = async () => {
      if (!assessmentId) {
        setError("ไม่พบ assessmentId");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/assessments/thai-cvd?assessmentId=${assessmentId}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        // session หมดอายุ → กลับไปหน้า login
        if (response.status === 401) {
          localStorage.removeItem("userId");
          router.replace("/login");
          return;
        }

        const data = (await response.json()) as ResultResponse;

        if (!response.ok || !data.success || !data.result) {
          throw new Error(
            data.message ?? "ไม่สามารถโหลดผลประเมินได้",
          );
        }

        setResult(data.result);
      } catch (loadError) {
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
  }, [assessmentId, router]);

  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (error || !result) {
    return <RecommendationError tone={TONE} message={error} editHref="/assessment_CVD" />;
  }

  return (
    <RecommendationLayout
      tone={TONE}
      title={
        <>
          ความเสี่ยงต่อการเกิดโรคหัวใจและหลอดเลือดใน{" "}
          <span className="text-[#ef4962]">10 ปี</span>
        </>
      }
      score={
        <ScoreCircle
          tone={TONE}
          progress={result.riskPercent / 100}
          value={Math.min(Math.max(result.riskPercent, 0), 100).toFixed(1)}
          unit="%"
        />
      }
      riskLevel={result.riskLevel}
      // สีตามตารางที่ 2 ของเอกสารอ้างอิง: <10% เขียว, 10-<30% เหลือง, ≥30% แดง
      riskColor={result.riskPercent >= 30 ? "red" : result.riskPercent >= 10 ? "yellow" : "green"}
      summary={
        <>
          ผลประเมินของคุณอยู่ในระดับ{" "}
          <strong className="text-[#b91c2b]">{result.riskLevel}</strong>{" "}
          โดยมีค่าความเสี่ยงประมาณ{" "}
          <strong className="text-[#ef4962]">{result.riskPercent.toFixed(2)}%</strong>
        </>
      }
      recommendation={result.recommendation}
      assessmentId={assessmentId}
      editHref="/assessment_CVD"
    >
      <RecommendationSection icon={<ShieldCheck size={27} />} title="แนวทางดูแลสุขภาพหัวใจ">
        <div className="grid gap-5 md:grid-cols-3">
          <AdviceCard tone={TONE} icon={<Apple size={31} />} title="โภชนาการ">
            รับประทานผัก ผลไม้ และธัญพืช ลดอาหารหวาน มัน เค็ม และอาหารแปรรูป
          </AdviceCard>
          <AdviceCard tone={TONE} icon={<PersonStanding size={32} />} title="การออกกำลังกาย">
            ออกกำลังกายระดับปานกลางอย่างน้อย 150 นาทีต่อสัปดาห์
          </AdviceCard>
          <AdviceCard tone={TONE} icon={<Heart size={31} />} title="ติดตามสุขภาพ">
            ตรวจความดัน ควบคุมน้ำหนัก งดสูบบุหรี่ และตรวจสุขภาพเป็นประจำ
          </AdviceCard>
        </div>
      </RecommendationSection>
    </RecommendationLayout>
  );
}
