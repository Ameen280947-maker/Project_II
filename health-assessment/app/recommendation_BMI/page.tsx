"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    Apple,
    PersonStanding,
    Ruler,
    Scale,
    ShieldCheck,
    Stethoscope,
} from "lucide-react";
import RecommendationLayout, {
    AdviceCard,
    RECOMMENDATION_TONES,
    RecommendationError,
    RecommendationLoading,
    RecommendationSection,
    ScoreCircle,
    type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "mint";

type AssessmentResult = {
    assessmentId: number;
    weightKg: number | null;
    heightCm: number | null;
    bmi: number;
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

/* =========================================================
   เกณฑ์ระดับ BMI (ตรงกับ API)
   สีตามตารางของสำนักโภชนาการ กรมอนามัย
========================================================= */

const BMI_LEVELS: { level: string; range: string; color: RiskColor }[] = [
    { level: "ผอม", range: "< 18.5", color: "green" },
    { level: "ปกติ", range: "18.5 – 22.9", color: "yellow" },
    { level: "น้ำหนักเกิน", range: "23.0 – 24.9", color: "orange" },
    { level: "อ้วน", range: "25.0 – 29.9", color: "red" },
    { level: "อ้วนอันตราย", range: "≥ 30.0", color: "red" },
];

const DOT: Record<RiskColor, string> = {
    green: "bg-[#4f9857]",
    yellow: "bg-[#d9a400]",
    orange: "bg-[#e07a1f]",
    red: "bg-[#c81e3a]",
    gray: "bg-[#a3a4ab]",
};

export default function BmiResultPage() {
    return (
        <Suspense fallback={<RecommendationLoading tone={TONE} />}>
            <BmiResultContent />
        </Suspense>
    );
}

function BmiResultContent() {
    const searchParams = useSearchParams();
    const assessmentId = searchParams.get("assessmentId");

    const [result, setResult] = useState<AssessmentResult | null>(null);
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
                    `/api/assessments/bmi?assessmentId=${assessmentId}`,
                    { method: "GET", cache: "no-store" },
                );

                // session หมดอายุ → กลับไปหน้า login
                if (response.status === 401) {
                    localStorage.removeItem("userId");
                    window.location.replace("/login");
                    return;
                }

                const data = (await response.json()) as ResultResponse;

                if (!response.ok || !data.success || !data.result) {
                    throw new Error(data.message ?? "ไม่สามารถโหลดผลประเมินได้");
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
    }, [assessmentId]);

    if (loading) {
        return <RecommendationLoading tone={TONE} />;
    }

    if (error || !result) {
        return <RecommendationError tone={TONE} message={error} editHref="/assessment_BMI" />;
    }

    const riskColor: RiskColor =
        BMI_LEVELS.find((b) => b.level === result.riskLevel)?.color ?? "gray";
    const t = RECOMMENDATION_TONES[TONE];

    return (
        <RecommendationLayout
            tone={TONE}
            title={
                <>
                    ค่าดัชนีมวลกาย <span className={t.accent}>(BMI)</span> ของคุณ
                </>
            }
            score={
                <ScoreCircle
                    tone={TONE}
                    // เทียบกับเกณฑ์อ้วนอันตราย (BMI 30)
                    progress={result.bmi / 30}
                    value={result.bmi.toFixed(1)}
                    caption="BMI (kg/m²)"
                />
            }
            riskLevel={result.riskLevel}
            riskColor={riskColor}
            summary={
                <>
                    ผลประเมินของคุณอยู่ในระดับ{" "}
                    <strong className={t.eyebrow}>{result.riskLevel}</strong>{" "}
                    โดยมีค่าดัชนีมวลกาย (BMI) ประมาณ{" "}
                    <strong className={t.accent}>{result.bmi.toFixed(2)}</strong>
                    {result.weightKg && result.heightCm && (
                        <>
                            {" "}
                            (จากน้ำหนัก {result.weightKg} กก. ส่วนสูง {result.heightCm} ซม.)
                        </>
                    )}
                </>
            }
            recommendation={result.recommendation}
            assessmentId={assessmentId}
            editHref="/assessment_BMI"
        >
            {/* =====================================================
                เกณฑ์ BMI + แนวทางดูแลสุขภาพตามระดับ
            ====================================================== */}

            <RecommendationSection
                icon={<Ruler size={27} className={t.eyebrow} />}
                title="เกณฑ์ดัชนีมวลกาย (BMI)"
            >
                <div className="overflow-hidden rounded-[25px] border border-[#eee8e9] bg-white">
                    {BMI_LEVELS.map((band) => {
                        const active = band.level === result.riskLevel;

                        return (
                            <div
                                key={band.level}
                                className={`flex items-center justify-between gap-4 border-b border-[#f3eeef] px-6 py-4 last:border-b-0 ${
                                    active ? "bg-[#f4f9f5] font-bold" : "text-[#666872]"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[band.color]}`} />
                                    <span>{band.level}</span>
                                </div>
                                <span className="shrink-0 text-sm">{band.range} kg/m²</span>
                            </div>
                        );
                    })}
                </div>
            </RecommendationSection>

            <RecommendationSection
                icon={<ShieldCheck size={27} className={t.eyebrow} />}
                title="แนวทางดูแลสุขภาพ"
            >
                <div className="grid gap-5 md:grid-cols-3">
                    {getAdviceCards(result.riskLevel).map((card) => (
                        <AdviceCard key={card.title} tone={TONE} icon={card.icon} title={card.title}>
                            {card.description}
                        </AdviceCard>
                    ))}
                </div>
            </RecommendationSection>
        </RecommendationLayout>
    );
}

/*
  การ์ดแนวทางแยกตามระดับ ให้สอดคล้องกับคำแนะนำในเอกสารอ้างอิง ตารางที่ 12
  ผอม = ควรเพิ่มน้ำหนัก, ปกติ = ควบคุมน้ำหนัก, น้ำหนักเกินขึ้นไป = ลดน้ำหนัก, อ้วนอันตราย = พบแพทย์
*/
function getAdviceCards(riskLevel: string): { icon: ReactNode; title: string; description: string }[] {
    const nutrition = <Apple size={31} />;
    const exercise = <PersonStanding size={32} />;
    const followUp = <Scale size={30} />;

    if (riskLevel === "ผอม") {
        return [
            {
                icon: nutrition,
                title: "โภชนาการ",
                description: "เพิ่มพลังงานจากอาหารให้ครบ 5 หมู่ เพิ่มโปรตีน และกินให้ตรงเวลา เพื่อเพิ่มน้ำหนักให้อยู่ในเกณฑ์ปกติ",
            },
            {
                icon: exercise,
                title: "การออกกำลังกาย",
                description: "ออกกำลังกายแบบเสริมสร้างกล้ามเนื้อควบคู่กับการกินให้เพียงพอ",
            },
            {
                icon: followUp,
                title: "ติดตามสุขภาพ",
                description: "ชั่งน้ำหนักสม่ำเสมอ หากน้ำหนักลดลงต่อเนื่องโดยไม่ทราบสาเหตุควรพบแพทย์",
            },
        ];
    }

    if (riskLevel === "ปกติ") {
        return [
            {
                icon: nutrition,
                title: "โภชนาการ",
                description: "กินอาหารให้ครบ 5 หมู่ เน้นผัก ผลไม้ ลดอาหารหวาน มัน เค็ม เพื่อคงน้ำหนักให้อยู่ในเกณฑ์ปกติ",
            },
            {
                icon: exercise,
                title: "การออกกำลังกาย",
                description: "ออกกำลังกายระดับปานกลางอย่างน้อย 150 นาทีต่อสัปดาห์",
            },
            {
                icon: followUp,
                title: "ติดตามสุขภาพ",
                description: "ชั่งน้ำหนักสม่ำเสมอเพื่อควบคุมน้ำหนักให้คงที่",
            },
        ];
    }

    return [
        {
            icon: nutrition,
            title: "โภชนาการ",
            description: "ลดอาหารหวาน มัน เค็ม และอาหารแปรรูป ควบคุมปริมาณอาหาร เน้นผักและผลไม้รสไม่หวาน",
        },
        {
            icon: exercise,
            title: "การออกกำลังกาย",
            description: "ออกกำลังกายระดับปานกลางอย่างน้อย 150 นาทีต่อสัปดาห์ เพื่อช่วยลดน้ำหนัก",
        },
        riskLevel === "อ้วนอันตราย"
            ? {
                  icon: <Stethoscope size={30} />,
                  title: "พบแพทย์",
                  description: "ความอ้วนอยู่ในระดับอันตราย ควรลดน้ำหนักอย่างเร่งด่วนและไปพบแพทย์",
              }
            : {
                  icon: followUp,
                  title: "ติดตามสุขภาพ",
                  description: "ชั่งน้ำหนักสม่ำเสมอ ตั้งเป้าลดน้ำหนักให้เข้าสู่เกณฑ์ปกติ และตรวจสุขภาพเป็นประจำ",
              },
    ];
}
