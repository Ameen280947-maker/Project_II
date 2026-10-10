"use client";

import { Activity, Armchair, PersonStanding } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import RecommendationLayout, {
  RECOMMENDATION_TONES,
  RecommendationError,
  RecommendationLoading,
  RecommendationSection,
  ScoreCircle,
  type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "teal";
const EDIT_HREF = "/assessment_physical_activity";

type Answer = {
  answer_id: number;
  question_text: string;
  answer_value: string;
  choice_text: string;
  answer_score: number;
};

type Result = {
  assessment_id: number;
  username: string;
  total_score: number;
  risk_level: string;
  recommendation_text: string;
  assessed_at: string;
  answers: Answer[];
  sedentary?: {
    score: number;
    risk_level: string;
    recommendation_text: string | null;
  } | null;
};

/* =========================================================
   สีตามความหมายของผล
   กิจกรรมทางกาย (ตารางที่ 18): เพียงพอ เขียว / ไม่เพียงพอ เหลือง / ไม่มีกิจกรรมทางกาย แดง
   พฤติกรรมเนือยนิ่ง (ตารางที่ 20): ปกติ เขียว / เสี่ยงปานกลาง เหลือง / เสี่ยงสูง แดง
========================================================= */

const ACTIVITY_COLOR: Record<string, RiskColor> = {
  เพียงพอ: "green",
  ไม่เพียงพอ: "yellow",
  ไม่มีกิจกรรมทางกาย: "red",
};

const SEDENTARY_COLOR: Record<string, RiskColor> = {
  ปกติ: "green",
  เสี่ยงปานกลาง: "yellow",
  เสี่ยงสูง: "red",
};

const BADGE: Record<RiskColor, string> = {
  green: "bg-[#eaf7e8] text-[#4f9857]",
  yellow: "bg-[#fff6d6] text-[#9a7300]",
  orange: "bg-[#fff1e3] text-[#c2620c]",
  red: "bg-[#fde8eb] text-[#c81e3a]",
  gray: "bg-[#f3f3f4] text-[#6b6c74]",
};

/* =========================================================
   MAIN CONTENT
========================================================= */

function PhysicalActivityResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const assessmentId =
    searchParams.get("assessmentId");

  const [result, setResult] =
    useState<Result | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================================================
     LOAD RESULT
  ========================================================= */

  useEffect(() => {
    const loadResult = async () => {
      try {
        setLoading(true);
        setError("");

        if (!assessmentId) {
          throw new Error(
            "ไม่พบ Assessment ID"
          );
        }

        const userId =
          localStorage.getItem("userId");

        if (!userId) {
          throw new Error(
            "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่"
          );
        }

        const response = await fetch(
          `/api/assessments/physical_activity?assessmentId=${encodeURIComponent(
            assessmentId
          )}&userId=${encodeURIComponent(userId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        // session หมดอายุ → กลับไปหน้า login
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

        setResult(data);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดผลการประเมินได้"
        );
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [assessmentId, router]);

  /* =========================================================
     LOADING / ERROR
  ========================================================= */

  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (error || !result) {
    return (
      <RecommendationError
        tone={TONE}
        message={error || "ไม่พบข้อมูลผลการประเมิน"}
        editHref={EDIT_HREF}
      />
    );
  }

  /* =========================================================
     SCORE

     เอกสารอ้างอิงแปลผลกิจกรรมทางกายจากข้อ 1 (ตารางที่ 18) เต็ม 3 คะแนน
     ใช้คะแนนจากคำตอบข้อแรก เพราะผลเก่าบันทึก total_score เป็นผลรวม 2 ข้อ
  ========================================================= */

  const maxScore = 3;

  const activityScore =
    result.answers[0]?.answer_score ??
    result.total_score;

  const activityColor = ACTIVITY_COLOR[result.risk_level] ?? "gray";

  const sedentary = result.sedentary;

  const t = RECOMMENDATION_TONES[TONE];

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <RecommendationLayout
      tone={TONE}
      title={
        <>
          ระดับ<span className={t.accent}>กิจกรรมทางกาย</span>
        </>
      }
      score={
        <ScoreCircle
          tone={TONE}
          progress={activityScore / maxScore}
          value={String(activityScore)}
          unit={`/${maxScore}`}
          caption="คะแนนกิจกรรมทางกาย"
        />
      }
      riskLevel={result.risk_level}
      riskColor={activityColor}
      recommendation={result.recommendation_text || "ยังไม่มีคำแนะนำสำหรับผลนี้"}
      assessmentId={assessmentId}
      editHref={EDIT_HREF}
      menuHref="/assessment-menu-behavior"
    >
      <RecommendationSection
        icon={<Activity size={27} className={t.eyebrow} />}
        title="ผลแยกตามส่วนของแบบประเมิน"
      >
        <div className="grid gap-5 md:grid-cols-2">
          {/* ===== กิจกรรมทางกาย (ตารางที่ 18) ===== */}
          <article className="rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`grid h-12 w-12 place-items-center rounded-full ${t.iconSoft}`}>
                  <PersonStanding size={25} />
                </div>
                <div>
                  <h4 className="text-lg font-bold">กิจกรรมทางกาย</h4>
                  <p className="mt-0.5 text-sm text-[#85858d]">
                    {activityScore} / {maxScore} คะแนน
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${BADGE[activityColor]}`}>
                {result.risk_level}
              </span>
            </div>
            <p className="mt-5 text-sm leading-7 text-[#767880]">
              คำแนะนำด้านกิจกรรมทางกายแสดงในส่วน “ผลและคำแนะนำ” ด้านบน
            </p>
          </article>

          {/* ===== พฤติกรรมเนือยนิ่ง (ตารางที่ 20) ===== */}
          {sedentary && (
            <article className="rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`grid h-12 w-12 place-items-center rounded-full ${t.iconSoft}`}>
                    <Armchair size={25} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">พฤติกรรมเนือยนิ่ง</h4>
                    <p className="mt-0.5 text-sm text-[#85858d]">
                      นั่งหรือเอนกายต่อเนื่อง 2 ชั่วโมงขึ้นไป · {sedentary.score} คะแนน
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    BADGE[SEDENTARY_COLOR[sedentary.risk_level] ?? "gray"]
                  }`}
                >
                  {sedentary.risk_level}
                </span>
              </div>
              <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#767880]">
                {sedentary.recommendation_text ||
                  "ยังไม่มีคำแนะนำสำหรับผลนี้"}
              </p>
            </article>
          )}
        </div>
      </RecommendationSection>
    </RecommendationLayout>
  );
}

/* =========================================================
   SUSPENSE
========================================================= */

export default function PhysicalActivityRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <PhysicalActivityResultContent />
    </Suspense>
  );
}
