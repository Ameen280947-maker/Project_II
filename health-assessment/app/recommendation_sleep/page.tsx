"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon } from "lucide-react";
import RecommendationLayout, {
    RECOMMENDATION_TONES,
    RecommendationError,
    RecommendationLoading,
    RecommendationSection,
    ScoreCircle,
    type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

// โทนสีของหน้า ใช้กับคอมโพเนนต์แสดงผลประเมิน
const TONE = "violet";

// คะแนนเต็มของแบบประเมินการนอน
const MAX_SCORE = 3;

// คำแนะนำตามคะแนน (การแปลผล หัวข้อ คำอธิบาย รายการคำแนะนำ)
type Recommendation = {
    id: number;
    score: number;
    interpretation: string;
    title: string | null;
    description: string | null;
    recommendations: string[];
    color: string;
};

// ผลประเมินการนอนหนึ่งรายการพร้อมคำแนะนำ
type ResultData = {
    id: string;
    score: number;
    interpretation: string;
    answers: unknown;
    createdAt: string;
    recommendation: Recommendation;
};

// แปลงคะแนนการนอนเป็นสีความเสี่ยง (≥3 เขียว, 2 เหลือง, ต่ำกว่านั้นแดง)
function getRiskColor(score: number): RiskColor {
    if (score >= 3) return "green";
    if (score === 2) return "yellow";
    return "red";
}

// หน้า: ผลและคำแนะนำการประเมินการนอนหลับ (อ่าน recordId จาก URL)
// แสดงวงคะแนน (เต็ม 3) การแปลผล คำอธิบาย และรายการคำแนะนำแบบมีลำดับ
export default function RecommendationSleepPage() {
    const router = useRouter();

    // state ของหน้า: recordId (undefined = ยังไม่อ่าน URL) ผลประเมิน สถานะโหลด error
    const [recordId, setRecordId] =
        useState<string | null | undefined>(undefined);

    const [result, setResult] =
        useState<ResultData | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    // อ่าน recordId (หรือ assessmentId) จาก URL ตอนเปิดหน้า
    useEffect(() => {
        const params = new URLSearchParams(
            window.location.search
        );

        const id = params.get("recordId") || params.get("assessmentId");

        setRecordId(id);
    }, []);

    // โหลดผลประเมินจาก API เมื่อได้ recordId แล้ว
    useEffect(() => {
        if (!recordId) {
            return;
        }

        // ดึงผลประเมินจาก /api/assessments/sleep (401 → ลบ userId แล้วไปหน้า login)
        async function loadResult() {
            try {
                setLoading(true);

                const response = await fetch(
                    `/api/assessments/sleep?recordId=${recordId}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                if (response.status === 401) {
                    localStorage.removeItem("userId");
                    router.replace("/login");
                    return;
                }

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "ไม่สามารถโหลดผลการประเมินได้"
                    );
                }

                if (data.success) {
                    setResult(data.data);
                }
            } catch (error) {
                console.error(
                    "Load sleep recommendation error:",
                    error
                );

                setError(
                    error instanceof Error
                        ? error.message
                        : "ไม่สามารถโหลดผลการประเมินได้"
                );
            } finally {
                setLoading(false);
            }
        }

        loadResult();
    }, [recordId, router]);

    // สถานะกำลังโหลด / ไม่พบผล
    if (recordId === undefined || (recordId && loading)) {
        return <RecommendationLoading tone={TONE} />;
    }

    if (!result || !result.recommendation) {
        return (
            <RecommendationError
                tone={TONE}
                message={error || "กรุณากลับไปทำแบบประเมินใหม่"}
                editHref="/sleep-assessment"
            />
        );
    }

    // ค่าที่คำนวณสำหรับแสดงผล (คะแนน ชุดสี รายการคำแนะนำ)
    const recommendation = result.recommendation;
    const score = Number(result.score);
    const t = RECOMMENDATION_TONES[TONE];
    const adviceList = Array.isArray(recommendation.recommendations)
        ? recommendation.recommendations
        : [];

    // ส่วนแสดงผล: วงคะแนน การแปลผล และคำอธิบาย
    return (
        <RecommendationLayout
            tone={TONE}
            assessmentKey="sleep"
            title={
                <>
                    ผลการประเมิน<span className={t.accent}>การนอนหลับ</span>
                </>
            }
            score={
                <ScoreCircle
                    tone={TONE}
                    progress={score / MAX_SCORE}
                    value={String(score)}
                    unit={`/${MAX_SCORE}`}
                    caption="คะแนน"
                />
            }
            riskLevel={recommendation.interpretation}
            riskColor={getRiskColor(score)}
            summary={
                <>
                    ผลประเมินของคุณอยู่ในระดับ{" "}
                    <strong className={t.eyebrow}>{recommendation.interpretation}</strong>
                    {recommendation.title && <> — {recommendation.title}</>}
                </>
            }
            recommendation={recommendation.description}
            assessmentId={recordId}
            editHref="/sleep-assessment"
            menuHref="/assessment-menu-behavior"
            disclaimer="ผลการประเมินนี้เป็นข้อมูลเบื้องต้น สำหรับใช้ประกอบการดูแลสุขภาพ ไม่สามารถใช้แทนการวินิจฉัยจากแพทย์ได้"
        >

            {/* รายการคำแนะนำสำหรับผู้ใช้ (มีลำดับเลข) */}
            {adviceList.length > 0 && (
                <RecommendationSection
                    icon={
                        <div className={`grid h-11 w-11 place-items-center rounded-full ${t.iconSoft}`}>
                            <Moon size={23} />
                        </div>
                    }
                    title="คำแนะนำสำหรับคุณ"
                >
                    <div className="space-y-4 rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
                        {adviceList.map((item, index) => (
                            <div key={index} className="flex items-start gap-4">
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${t.iconSoft}`}>
                                    {index + 1}
                                </div>
                                <p className="flex-1 pt-0.5 leading-7 text-[#55555D]">
                                    {item}
                                </p>
                            </div>
                        ))}
                    </div>
                </RecommendationSection>
            )}
        </RecommendationLayout>
    );
}
