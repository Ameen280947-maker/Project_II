"use client";

import { ClipboardList, Phone } from "lucide-react";
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

// โทนสีของหน้าและลิงก์กลับไปทำแบบประเมินใหม่
const TONE = "green";
const EDIT_HREF = "/assessment_smoking";

// คะแนนเต็มของแบบประเมินการสูบบุหรี่
const MAX_SCORE = 8;

// ข้อความตัวเลือก "ไม่เคยสูบ" ในข้อ 2 ใช้ตัดสินว่าจะแสดงช่องทางช่วยเลิกบุหรี่หรือไม่
const NEVER_SMOKED = "ไม่สูบ";

// คำตอบรายข้อของผู้ใช้
type Answer = {
  question_id: number;
  question_text: string;
  display_order: number;
  answer_value: string | null;
  choice_text: string | null;
  score: number | string | null;
};

// แถวผลประเมินจากตาราง assessments (คะแนน ระดับ คำแนะนำ)
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

// รูปแบบ response ของ API ผลประเมิน
type RecommendationResponse = {
  success: boolean;
  assessment?: Assessment;
  answers?: Answer[];
  message?: string;
};

// หน้า: ผลและคำแนะนำการประเมินการสูบบุหรี่ ครอบด้วย Suspense
export default function SmokingRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <SmokingRecommendationContent />
    </Suspense>
  );
}

// เนื้อหาหน้า: แสดงคะแนน ระดับความเสี่ยงการสูบบุหรี่ และคำแนะนำตาม assessmentId
// แสดงวงคะแนน (เต็ม 8) เกณฑ์ 3 ระดับ และสายด่วนเลิกบุหรี่ 1600 ถ้าเคยสูบหรือคะแนน ≥1
function SmokingRecommendationContent() {
  const searchParams = useSearchParams();

  const assessmentId = searchParams.get("assessmentId");

  // state ของหน้า: ผลประเมิน คำตอบ สถานะโหลด และ error
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // โหลดผลประเมินจาก API ตอนเปิดหน้า
  useEffect(() => {
    // ดึงผลประเมินจาก /api/assessments/smoking (401 → ลบ userId แล้วไปหน้า login)
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

  // แปลง risk_level เป็นข้อความและสีสำหรับแสดงผล
  const riskInfo = useMemo(
    () => getRiskInfo(assessment?.risk_level),
    [assessment?.risk_level],
  );

  // สถานะกำลังโหลด / error
  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (error || !assessment) {
    return <RecommendationError tone={TONE} message={error} editHref={EDIT_HREF} />;
  }

  const score = Number(assessment.total_score ?? 0);
  const t = RECOMMENDATION_TONES[TONE];

  // ตัดสินว่าจะแสดงช่องทางช่วยเลิกบุหรี่ (คะแนน ≥1 หรือข้อ 2 ไม่ได้ตอบว่าไม่สูบ)
  const lifetime = answers.find((a) => a.display_order === 2)?.choice_text?.trim();
  const showQuitHelp = score >= 1 || (lifetime !== undefined && lifetime !== NEVER_SMOKED);

  // ส่วนแสดงผล: วงคะแนน ระดับ และคำแนะนำ (ใช้คำแนะนำสำรองถ้า API ไม่มี)
  return (
    <RecommendationLayout
      tone={TONE}
      assessmentKey="smoking"
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

      {/* เกณฑ์การแปลผล 3 ระดับ ไฮไลต์ระดับของผู้ใช้ */}
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

      {/* ช่องทางช่วยเลิกบุหรี่: สายด่วน 1600 */}
      {showQuitHelp && (
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
      )}
    </RecommendationLayout>
  );
}

// แปลง risk_level (ไทย/อังกฤษ) เป็นข้อความระดับความเสี่ยงและสี
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

// คำแนะนำสำรองตามระดับความเสี่ยง ใช้เมื่อ API ไม่ส่งคำแนะนำมา
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

// คลาสสีของกล่องระดับความเสี่ยง แยกแบบปกติ/แบบที่ไฮไลต์
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

// กล่องแสดงช่วงคะแนนและระดับความเสี่ยงหนึ่งระดับ (ไฮไลต์ถ้าเป็นระดับของผู้ใช้)
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
