"use client";

import { useSearchParams } from "next/navigation";
import { ClipboardList, ListOrdered } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import RecommendationLayout, {
  RECOMMENDATION_TONES,
  RecommendationError,
  RecommendationLoading,
  RecommendationSection,
  ScoreCircle,
  type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "amber";
const EDIT_HREF = "/assessment_alcohol";

// คะแนนเต็มของแบบประเมิน (ผลรวมคะแนนสูงสุดของข้อ 2-7)
const MAX_SCORE = 39;

/* =========================================================
   TYPES
========================================================= */

type Assessment = {
  assessment_id: number;
  user_id: number;
  assessment_type_id: number;
  total_score: number | string | null;
  risk_level: string | null;
  recommendation_text: string | null;
  assessed_at: string;
};

type Answer = {
  answer_id?: number;
  assessment_id: number;
  user_id?: number;
  username?: string;
  question_id?: number;
  question_text: string;
  answer_value: number | string;
  choice_text: string;
  answer_score: number | string;
};

type ResultResponse = {
  success: boolean;
  assessment?: Assessment;
  answers?: Answer[];
  message?: string;
};

/* =========================================================
   PAGE WRAPPER
========================================================= */

export default function AlcoholRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <AlcoholRecommendationContent />
    </Suspense>
  );
}

/* =========================================================
   CONTENT
========================================================= */

function AlcoholRecommendationContent() {
  const searchParams = useSearchParams();

  const assessmentId = searchParams.get("assessmentId");

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =====================================================
     LOAD RESULT
  ====================================================== */

  useEffect(() => {
    const loadResult = async () => {
      try {
        setLoading(true);
        setError("");

        if (!assessmentId) {
          throw new Error("ไม่พบ Assessment ID");
        }

        const id = Number(assessmentId);

        if (!Number.isInteger(id) || id <= 0) {
          throw new Error("Assessment ID ไม่ถูกต้อง");
        }

        const response = await fetch(
          `/api/assessments/alcohol?assessmentId=${id}`,
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

        const data = (await response.json()) as ResultResponse;

        if (!response.ok || !data.success || !data.assessment) {
          throw new Error(data.message ?? "ไม่สามารถโหลดผลการประเมินได้");
        }

        setAssessment(data.assessment);
        setAnswers(data.answers ?? []);
      } catch (loadError) {
        console.error("LOAD ALCOHOL RESULT ERROR:", loadError);

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
  }, [assessmentId]);

  /* =====================================================
     RESULT
     ไม่เคยดื่ม / หยุดดื่มแล้ว / 0-10 ต่ำ / 11-26 ปานกลาง / 27+ สูง
  ====================================================== */

  const result = useMemo((): {
    title: string;
    subtitle: string;
    color: RiskColor;
    noScore: boolean;
  } | null => {
    if (!assessment) {
      return null;
    }

    const score = Number(assessment.total_score ?? 0);
    const risk = assessment.risk_level ?? "";

    if (risk === "ไม่เคยดื่ม") {
      return {
        title: "ไม่เคยดื่มแอลกอฮอล์",
        subtitle: "คุณปลอดภัยจากโทษของเครื่องดื่มแอลกอฮอล์",
        color: "green",
        noScore: true,
      };
    }

    if (risk === "หยุดดื่มแล้ว") {
      return {
        title: "หยุดดื่มแล้ว",
        subtitle: "ขอชื่นชมคุณที่สามารถหยุดดื่มได้",
        color: "green",
        noScore: true,
      };
    }

    if (score <= 10) {
      return {
        title: "ความเสี่ยงต่ำ",
        subtitle: "ดื่มในระดับเสี่ยงต่ำ",
        color: "green",
        noScore: false,
      };
    }

    if (score <= 26) {
      return {
        title: "ความเสี่ยงปานกลาง",
        subtitle: "ดื่มในระดับเสี่ยงปานกลาง",
        color: "yellow",
        noScore: false,
      };
    }

    return {
      title: "ความเสี่ยงสูง",
      subtitle: "ดื่มในระดับเสี่ยงสูง",
      color: "red",
      noScore: false,
    };
  }, [assessment]);

  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (error || !assessment || !result) {
    return <RecommendationError tone={TONE} message={error} editHref={EDIT_HREF} />;
  }

  const score = Number(assessment.total_score ?? 0);
  const t = RECOMMENDATION_TONES[TONE];

  /* =====================================================
     RENDER
  ====================================================== */

  return (
    <RecommendationLayout
      tone={TONE}
      title={
        <>
          ผลการประเมิน<span className={t.accent}>การดื่มแอลกอฮอล์</span>
        </>
      }
      score={
        <ScoreCircle
          tone={TONE}
          progress={score / MAX_SCORE}
          value={String(score)}
          caption={result.noScore ? "ไม่มีคะแนนความเสี่ยง" : `จาก ${MAX_SCORE} คะแนน`}
        />
      }
      riskLevel={result.title}
      riskColor={result.color}
      summary={
        <>
          ผลประเมินของคุณคือ{" "}
          <strong className={t.eyebrow}>{result.title}</strong>{" "}
          — {result.subtitle}
        </>
      }
      recommendation={assessment.recommendation_text ?? "ไม่มีคำแนะนำ"}
      assessmentId={assessmentId}
      editHref={EDIT_HREF}
      menuHref="/assessment-menu-behavior"
    >
      {/* =================================================
          เกณฑ์การแปลผล
      ================================================== */}

      <RecommendationSection
        icon={<ClipboardList size={27} className={t.eyebrow} />}
        title="เกณฑ์การแปลผล"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <RiskBox
            range="0–10 คะแนน"
            title="ความเสี่ยงต่ำ"
            active={!result.noScore && score <= 10}
            color="green"
          />
          <RiskBox
            range="11–26 คะแนน"
            title="ความเสี่ยงปานกลาง"
            active={!result.noScore && score >= 11 && score <= 26}
            color="yellow"
          />
          <RiskBox
            range="27 คะแนนขึ้นไป"
            title="ความเสี่ยงสูง"
            active={!result.noScore && score >= 27}
            color="red"
          />
        </div>
      </RecommendationSection>

      {/* =================================================
          คะแนนรายข้อ
      ================================================== */}

      {answers.length > 0 && (
        <RecommendationSection
          icon={<ListOrdered size={27} className={t.eyebrow} />}
          title="คะแนนรายข้อ"
        >
          <div className="space-y-3 rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
            {answers.map((answer, index) => (
              <div
                key={answer.answer_id ?? index}
                className="flex items-start gap-4 rounded-2xl bg-[#faf9f7] p-4"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${t.iconSoft}`}>
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 text-[#5e6268]">{answer.question_text}</p>
                  <p className="mt-1 font-semibold text-[#2f3037]">{answer.choice_text}</p>
                </div>

                <span className={`shrink-0 text-sm font-bold ${t.eyebrow}`}>
                  {Number(answer.answer_score)} คะแนน
                </span>
              </div>
            ))}
          </div>
        </RecommendationSection>
      )}
    </RecommendationLayout>
  );
}

/* =========================================================
   RISK BOX (สีตามความหมายของระดับความเสี่ยง)
========================================================= */

const RISK_BOX_STYLES = {
  green: {
    normal: "border-[#e0eee0] bg-[#f7fbf5] text-[#57965c]",
    active: "border-[#9ed092] bg-[#eef8e9] text-[#57965c]",
  },
  yellow: {
    normal: "border-[#f1e5c9] bg-[#fffdf7] text-[#a77723]",
    active: "border-[#e5c875] bg-[#fff8e8] text-[#a77723]",
  },
  red: {
    normal: "border-[#f0d8dc] bg-[#fffafa] text-[#b91c2b]",
    active: "border-[#e8aeb6] bg-[#fff0f2] text-[#b91c2b]",
  },
};

function RiskBox({
  range,
  title,
  active,
  color,
}: {
  range: string;
  title: string;
  active: boolean;
  color: keyof typeof RISK_BOX_STYLES;
}) {
  const styles = RISK_BOX_STYLES[color];

  return (
    <div className={`rounded-[25px] border p-5 ${active ? styles.active : styles.normal}`}>
      <p className="text-sm font-bold">{range}</p>
      <p className="mt-2 text-lg font-black">{title}</p>

      {active && (
        <span className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-bold">
          ผลของคุณ
        </span>
      )}
    </div>
  );
}
