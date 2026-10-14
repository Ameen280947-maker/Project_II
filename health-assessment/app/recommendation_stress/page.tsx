"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ListChecks, Phone } from "lucide-react";
import RecommendationLayout, {
    RECOMMENDATION_TONES,
    RecommendationError,
    RecommendationLoading,
    RecommendationSection,
    ScoreCircle,
    type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

// โทนสีของหน้า ใช้กับคอมโพเนนต์แสดงผลประเมิน
const TONE = "blue";

// คะแนนเต็มของแบบประเมินความเครียด ST-5
const MAX_SCORE = 15;

// ผลประเมินความเครียดจาก API พร้อมคำแนะนำตามระดับ
type AssessmentData = {
    id: number;
    score: number;
    interpretation: string;
    createdAt: string;

    recommendation: {
        id: number;
        score: number;
        interpretation: string;
        title: string | null;
        description: string | null;
        recommendations: string[];
        color: string;
    };
};

// แปลงระดับความเครียด (ข้อความไทย) เป็นสีสำหรับแสดงผล
function getRiskColor(level: string): RiskColor {
    if (level === "เครียดน้อย") return "green";
    if (level === "เครียดปานกลาง") return "yellow";
    if (level === "เครียดมาก") return "orange";
    return "red";
}

// เนื้อหาหน้า: แสดงคะแนนความเครียด ระดับความเครียด และคำแนะนำตาม assessmentId
// คะแนน ≥8 แสดงกล่องเตือนให้พบแพทย์ (≥10 ต้องพบทันที) พร้อมปุ่มโทรสายด่วน 1323
function StressRecommendationContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const assessmentId = searchParams.get("assessmentId");

    // state ของหน้า: ผลประเมิน สถานะโหลด และ error
    const [data, setData] =
        useState<AssessmentData | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    // โหลดผลประเมินจาก API ตอนเปิดหน้า
    useEffect(() => {
        // ดึงผลประเมินจาก /api/assessments/stress (401 → ลบ userId แล้วไปหน้า login)
        const loadResult = async () => {
            if (!assessmentId) {
                setError("ไม่พบ assessmentId");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                const response = await fetch(
                    `/api/assessments/stress?assessmentId=${assessmentId}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    },
                );

                if (response.status === 401) {
                    localStorage.removeItem("userId");
                    router.replace("/login");
                    return;
                }

                const result = await response.json();

                if (
                    !response.ok ||
                    !result.success
                ) {
                    throw new Error(
                        result.message ||
                            "ไม่สามารถโหลดผลการประเมินได้",
                    );
                }

                setData(result.data);
            } catch (err) {
                console.error(err);

                setError(
                    err instanceof Error
                        ? err.message
                        : "เกิดข้อผิดพลาด",
                );
            } finally {
                setLoading(false);
            }
        };

        loadResult();
    }, [assessmentId, router]);

    // สถานะกำลังโหลด / error
    if (loading) {
        return <RecommendationLoading tone={TONE} />;
    }

    if (error || !data) {
        return (
            <RecommendationError
                tone={TONE}
                message={error || "ไม่พบข้อมูลผลการประเมิน"}
                editHref="/assessment_stress"
            />
        );
    }

    // ค่าที่คำนวณสำหรับแสดงผล (ต้องพบแพทย์เมื่อ ≥8, รุนแรงเมื่อ ≥10, รายการคำแนะนำ)
    const score = Number(data.score);
    const needsHelp = score >= 8;
    const isSevere = score >= 10;

    const t = RECOMMENDATION_TONES[TONE];
    const adviceList = data.recommendation?.recommendations ?? [];

    // ส่วนแสดงผล: วงคะแนน ระดับความเครียด และคำอธิบาย
    return (
        <RecommendationLayout
            tone={TONE}
            assessmentKey="stress"
            title={
                <>
                    แบบประเมิน<span className={t.accent}>ความเครียด</span> (ST-5)
                </>
            }
            score={
                <ScoreCircle
                    tone={TONE}
                    progress={score / MAX_SCORE}
                    value={String(score)}
                    unit={`/${MAX_SCORE}`}
                    caption="คะแนนรวม"
                />
            }
            riskLevel={data.interpretation}
            riskColor={getRiskColor(data.interpretation)}
            recommendation={data.recommendation?.description}
            assessmentId={assessmentId}
            editHref="/assessment_stress"
            menuHref="/assessment-menu-mental-health"
            disclaimer="ผลการประเมินนี้เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีความเครียดสูงหรือมีอาการที่ส่งผลกระทบต่อการใช้ชีวิต ควรปรึกษาผู้เชี่ยวชาญด้านสุขภาพ"
        >

            {/* กล่องเตือนให้พบแพทย์ + ปุ่มโทร 1323 (คะแนน ≥8) */}
            {needsHelp && (
                <div className="mt-8 rounded-[25px] border border-[#f4c9c2] bg-[#fff0ed] px-6 py-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffe1db] text-[#e83a24]">
                            <AlertTriangle
                                size={23}
                                strokeWidth={1.8}
                            />
                        </div>

                        <div className="flex-1">
                            <h3 className="font-bold text-[#c2321f]">
                                {isSevere
                                    ? "เครียดมากที่สุด ต้องพบแพทย์ทันที"
                                    : "เครียดมาก ควรพบแพทย์ภายใน 2 สัปดาห์"}
                            </h3>

                            <p className="mt-1 text-sm leading-6 text-[#7a4a43]">
                                {isSevere
                                    ? "ความเครียดระดับนี้ต้องได้รับการดูแลจากแพทย์โดยเร็ว กรุณาไปพบแพทย์ที่สถานพยาบาลใกล้บ้านทันที"
                                    : "ความเครียดระดับนี้ควรได้รับคำปรึกษาจากแพทย์ กรุณานัดพบแพทย์ที่สถานพยาบาลใกล้บ้านภายใน 2 สัปดาห์"}
                                {" "}หากรู้สึกไม่ไหวหรือต้องการคนรับฟัง โทรสายด่วนสุขภาพจิต 1323 ได้ฟรีตลอด 24 ชั่วโมง
                            </p>
                        </div>

                        <a
                            href="tel:1323"
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#e83a24] px-5 py-3 font-semibold text-white transition hover:bg-[#c2321f]"
                        >
                            <Phone size={18} />
                            โทร 1323
                        </a>
                    </div>
                </div>
            )}

            {/* รายการคำแนะนำตามระดับความเครียด */}
            <RecommendationSection
                icon={
                    <div className={`grid h-11 w-11 place-items-center rounded-full ${t.iconSoft}`}>
                        <ListChecks size={23} />
                    </div>
                }
                title="คำแนะนำสำหรับคุณ"
            >
                <div className="rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
                    <p className="text-sm leading-6 text-[#858991]">
                        คำแนะนำต่อไปนี้อ้างอิงจากระดับความเครียดที่ได้จากการประเมินของคุณ
                    </p>

                    <div className="mt-5 space-y-3">
                        {adviceList.length > 0 ? (
                            adviceList.map((item, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <CheckCircle2
                                        size={20}
                                        className={`mt-0.5 shrink-0 ${t.accent}`}
                                    />
                                    <p className="text-sm leading-6 text-[#5e6268]">
                                        {item}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-[#858991]">
                                ไม่พบคำแนะนำสำหรับระดับความเครียดนี้ กรุณาติดต่อผู้ดูแลระบบ
                            </p>
                        )}
                    </div>
                </div>
            </RecommendationSection>
        </RecommendationLayout>
    );
}

// หน้า: ผลประเมินความเครียด ครอบด้วย Suspense
export default function StressRecommendationPage() {
    return (
        <Suspense fallback={<RecommendationLoading tone={TONE} />}>
            <StressRecommendationContent />
        </Suspense>
    );
}
