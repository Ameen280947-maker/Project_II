"use client";

import { ClipboardList, ListOrdered, Phone } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RecommendationLayout, {
  RECOMMENDATION_TONES,
  RecommendationError,
  RecommendationLoading,
  RecommendationSection,
  ScoreCircle,
  type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "green";
const EDIT_HREF = "/assessment_smoking";

// คะแนนเต็ม (0 ต่ำ / 1-4 ปานกลาง / 5-8 สูง ตาม API)
const MAX_SCORE = 8;

/* =========================================================
   TYPES
========================================================= */

type Answer = {
  question_id: number;
  question_text: string;
  display_order: number;
  answer_value: string | null;
  choice_text: string | null;
  score: number | string | null;
};

type Assessment = {
  assessment_id: number;
  user_id: number;
  total_score: number | string | null;
  risk_level: string | null;
  assessment_type_id: number;
  assessment_name: string;
  assessed_at: string;
  recommendation_text: string | null;
};

type RecommendationResponse = {
  success: boolean;
  assessment?: Assessment;
  answers?: Answer[];
  message?: string;
};

/* =========================================================
   PAGE
========================================================= */

export default function SmokingRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <SmokingRecommendationContent />
    </Suspense>
  );
}

function SmokingRecommendationContent() {
  const searchParams = useSearchParams();

  const assessmentId = searchParams.get("assessmentId");

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =======================================================
     LOAD RESULT
  ======================================================= */

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
          `/api/assessments/smoking?assessmentId=${encodeURIComponent(assessmentId)}`,
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

        const data = (await response.json()) as RecommendationResponse;

        if (!response.ok || !data.success || !data.assessment) {
          throw new Error(data.message ?? "ไม่สามารถโหลดผลการประเมินได้");
        }

        setAssessment(data.assessment);
        setAnswers(data.answers ?? []);
      } catch (err) {
        console.error("LOAD SMOKING RESULT ERROR:", err);

        setError(
          err instanceof Error ? err.message : "ไม่สามารถโหลดผลการประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadResult();
  }, [assessmentId]);

  /* =======================================================
     RISK
  ======================================================= */

  const riskInfo = useMemo(
    () => getRiskInfo(assessment?.risk_level),
    [assessment?.risk_level],
  );

  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (error || !assessment) {
    return <RecommendationError tone={TONE} message={error} editHref={EDIT_HREF} />;
  }

  const score = Number(assessment.total_score ?? 0);
  const t = RECOMMENDATION_TONES[TONE];

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <RecommendationLayout
      tone={TONE}
      title={
        <>
          ผลการประเมิน<span className={t.accent}>การสูบบุหรี่</span>
        </>
      }
      score={
        <ScoreCircle
          tone={TONE}
          progress={score / MAX_SCORE}
          value={String(score)}
          caption={`จาก ${MAX_SCORE} คะแนน`}
        />
      }
      riskLevel={riskInfo.label}
      riskColor={riskInfo.color}
      recommendation={
        assessment.recommendation_text ||
        getDefaultRecommendation(assessment.risk_level)
      }
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
          <RiskBox range="0 คะแนน" title="ความเสี่ยงต่ำ" active={score <= 0} color="green" />
          <RiskBox
            range="1–4 คะแนน"
            title="ความเสี่ยงปานกลาง"
            active={score >= 1 && score <= 4}
            color="yellow"
          />
          <RiskBox range="5–8 คะแนน" title="ความเสี่ยงสูง" active={score >= 5} color="orange" />
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
                key={answer.question_id}
                className="flex items-start gap-4 rounded-2xl bg-[#faf9f7] p-4"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${t.iconSoft}`}>
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 text-[#5e6268]">{answer.question_text}</p>
                  <p className="mt-1 font-semibold text-[#2f3037]">{answer.choice_text ?? "-"}</p>
                </div>

                <span className={`shrink-0 text-sm font-bold ${t.eyebrow}`}>
                  {Number(answer.score ?? 0)} คะแนน
                </span>
              </div>
            ))}
          </div>
        </RecommendationSection>
      )}

      {/* =================================================
          สายด่วนเลิกบุหรี่
      ================================================== */}

      <RecommendationSection
        icon={<Phone size={27} className={t.eyebrow} />}
        title="ต้องการความช่วยเหลือในการเลิกบุหรี่"
      >
        <div className="flex items-center gap-5 rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${t.iconSoft}`}>
            <Phone size={28} />
          </div>
          <div>
            <p className="text-xl font-bold">
              สายด่วนเลิกบุหรี่ <span className={t.eyebrow}>1600</span>
            </p>
            <p className="mt-1 text-sm leading-7 text-[#767880]">
              โทรฟรี ปรึกษาผู้เชี่ยวชาญเพื่อวางแผนเลิกบุหรี่ หรือขอรับบริการจากคลินิกเลิกบุหรี่ใกล้บ้าน
            </p>
          </div>
        </div>
      </RecommendationSection>
    </RecommendationLayout>
  );
}

/* =========================================================
   RISK INFO
========================================================= */

function getRiskInfo(
  riskLevel: string | null | undefined,
): { label: string; color: RiskColor } {
  const level = String(riskLevel ?? "").toLowerCase();

  if (
    level.includes("very_high") ||
    level.includes("very high") ||
    level.includes("สูงมาก") ||
    level.includes("อันตราย")
  ) {
    return { label: "ความเสี่ยงสูงมาก", color: "red" };
  }

  if (level.includes("high") || level.includes("สูง")) {
    return { label: "ความเสี่ยงสูง", color: "orange" };
  }

  if (level.includes("moderate") || level.includes("ปานกลาง")) {
    return { label: "ความเสี่ยงปานกลาง", color: "yellow" };
  }

  return { label: "ความเสี่ยงต่ำ", color: "green" };
}

/* =========================================================
   DEFAULT RECOMMENDATION
========================================================= */

function getDefaultRecommendation(riskLevel: string | null | undefined) {
  const level = String(riskLevel ?? "").toLowerCase();

  if (
    level.includes("very_high") ||
    level.includes("very high") ||
    level.includes("สูงมาก")
  ) {
    return "ควรพิจารณาปรับเปลี่ยนพฤติกรรมการสูบบุหรี่และขอคำปรึกษาจากบุคลากรทางการแพทย์หรือบริการช่วยเลิกบุหรี่";
  }

  if (level.includes("high") || level.includes("สูง")) {
    return "ควรลดหรือหยุดการสูบบุหรี่ และพิจารณาขอคำแนะนำเพื่อช่วยในการเลิกบุหรี่";
  }

  if (level.includes("moderate") || level.includes("ปานกลาง")) {
    return "ควรระมัดระวังพฤติกรรมการสูบบุหรี่และพยายามลดปริมาณหรือหลีกเลี่ยงการสูบบุหรี่";
  }

  return "ควรรักษาพฤติกรรมที่ดีและหลีกเลี่ยงการเริ่มสูบบุหรี่หรือกลับไปสูบบุหรี่";
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
  orange: {
    normal: "border-[#f3dfc6] bg-[#fffbf6] text-[#c2620c]",
    active: "border-[#ebbf8a] bg-[#fff1e3] text-[#c2620c]",
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
