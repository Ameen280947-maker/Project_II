"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertOctagon, PhoneCall } from "lucide-react";

import RecommendationLayout, {
  RecommendationError,
  RecommendationLoading,
  ScoreCircle,
  type RiskColor,
} from "@/app/components/recommendation/RecommendationLayout";

const TONE = "violet";
// แบบประเมินเริ่มที่ 2Q เสมอ
const EDIT_HREF = "/assessment_depression_2q";

/* =========================================================
   TYPES
========================================================= */

type AnswerItem = {
  answer_id: number;
  question_id: number;
  question_text: string;
  display_order: number;
  choice_id: number;
  choice_text: string;
  score: number;
  answer_value?: string | number | null;
};

type Result = {
  assessment_id: number;
  total_score: number;
  risk_level: string;
  recommendation_text: string;
  assessed_at: string;
  needs_urgent_attention: boolean;
  answers?: AnswerItem[];
};

/* =========================================================
   COMPONENT CONTENT
========================================================= */

function Depression9QRecommendationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
          `/api/assessments/depression?stage=9q&assessmentId=${assessmentId}&userId=${userId || ""}`,
          {
            cache: "no-store",
          }
        );

        // session หมดอายุ → กลับไปหน้า login
        if (res.status === 401) {
          localStorage.removeItem("userId");
          router.replace("/login");
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
  }, [assessmentId, router]);

  if (loading) {
    return <RecommendationLoading tone={TONE} />;
  }

  if (error || !result) {
    return <RecommendationError tone={TONE} message={error} editHref={EDIT_HREF} />;
  }

  /* ===== ระดับความรุนแรงตามคะแนน 9Q ===== */
  const score = Number(result.total_score ?? 0);

  let riskColor: RiskColor = "green";
  let levelDesc = "ไม่มีอาการของโรคซึมเศร้า หรือมีน้อยมาก";

  if (score >= 19) {
    riskColor = "red";
    levelDesc = "มีอาการของโรคซึมเศร้าระดับรุนแรง ควรพบแพทย์โดยเร็ว";
  } else if (score >= 13) {
    riskColor = "orange";
    levelDesc = "มีอาการของโรคซึมเศร้าระดับปานกลาง ควรรับการปรึกษา";
  } else if (score >= 7) {
    riskColor = "yellow";
    levelDesc = "มีอาการของโรคซึมเศร้าระดับน้อย ควรเฝ้าระวังและดูแลตนเอง";
  }

  /* ข้อ 9 (ข้อสุดท้าย) = คิดทำร้ายตนเอง ตอบมากกว่า 0 คะแนน
     ถ้าไม่มีรายการคำตอบ ใช้ค่าที่ API ตรวจมาให้แทน */
  const lastAnswer = result.answers?.length
    ? result.answers.reduce((max, a) =>
        Number(a.display_order) > Number(max.display_order) ? a : max
      )
    : null;
  const selfHarm = lastAnswer
    ? Number(lastAnswer.score) > 0
    : !!result.needs_urgent_attention;

  // ระดับปานกลางขึ้นไป (≥13) หรือคิดทำร้ายตนเอง → แสดงช่องทางช่วยเหลือ
  const showHelpBox = selfHarm || score >= 13;

  return (
    <RecommendationLayout
      tone={TONE}
      title="การประเมินโรคซึมเศร้า (9Q)"
      score={
        <ScoreCircle
          tone={TONE}
          progress={score / 27}
          value={String(score)}
          unit="/27"
          caption="คะแนน"
        />
      }
      riskLevel={result.risk_level}
      riskColor={riskColor}
      summary={
        <>
          ผลประเมินของคุณอยู่ในระดับ{" "}
          <strong className="text-[#5b3ea6]">{result.risk_level}</strong>{" "}
          — {levelDesc}
        </>
      }
      recommendation={result.recommendation_text}
      assessmentId={assessmentId}
      editHref={EDIT_HREF}
      menuHref="/assessment-menu-mental-health"
    >
      {/* =====================================================
         ระดับปานกลางขึ้นไป / คิดทำร้ายตนเอง → ช่องทางช่วยเหลือเร่งด่วน
         (คงสีแดงไว้ เพราะเป็นสีแจ้งเตือนความเสี่ยง)
      ===================================================== */}
      {showHelpBox && (
        <section className="mt-8 rounded-[28px] border-2 border-red-200 bg-red-50/90 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
              <AlertOctagon size={28} />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-2xl font-bold text-red-800">
                {selfHarm
                  ? "คำเตือน: ควรได้รับการประเมินและดูแลอย่างใกล้ชิด"
                  : score >= 19
                    ? "มีอาการซึมเศร้าระดับรุนแรง ควรพบแพทย์เพื่อรับการรักษา"
                    : "มีอาการซึมเศร้าระดับปานกลาง ควรพบแพทย์เพื่อรับการประเมินและรักษา"}
              </h3>

              <p className="mt-3 leading-8 text-red-700">
                {selfHarm
                  ? "เนื่องจากมีคำตอบที่บ่งชี้ถึงความคิดทำร้ายตนเอง หรือมีความเสี่ยงต่อความปลอดภัย หากท่านหรือคนใกล้ชิดรู้สึกไม่ปลอดภัย ขอให้ปรึกษาผู้เชี่ยวชาญหรือติดต่อสายด่วนทันที"
                  : "คะแนนของท่านอยู่ในระดับที่ควรได้รับการดูแลและวางแผนการรักษาจากแพทย์หรือบุคลากรสาธารณสุขโดยเร็ว"}
              </p>

              {/* คิดทำร้ายตนเอง → ส่งต่อประเมินความเสี่ยงการฆ่าตัวตาย 8Q */}
              {selfHarm && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-white/80 px-4 py-3 text-sm leading-relaxed text-red-800">
                  <span className="font-bold">ขั้นตอนถัดไป: </span>
                  ควรไปพบแพทย์หรือเจ้าหน้าที่ที่สถานพยาบาลใกล้บ้าน
                  เพื่อรับการประเมินความเสี่ยงการฆ่าตัวตายด้วยแบบประเมิน 8Q โดยเร็วที่สุด
                </div>
              )}

              {/* สายด่วน */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href="tel:1323"
                  className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-50"
                >
                  <PhoneCall size={16} />
                  สายด่วนสุขภาพจิต 1323 (โทรฟรี 24 ชม.)
                </a>

                <a
                  href="tel:021136789"
                  className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-50"
                >
                  <PhoneCall size={16} />
                  สมาคมสะมาริตันส์ 02-113-6789
                </a>
              </div>
            </div>
          </div>
        </section>
      )}
    </RecommendationLayout>
  );
}

export default function Depression9QRecommendationPage() {
  return (
    <Suspense fallback={<RecommendationLoading tone={TONE} />}>
      <Depression9QRecommendationContent />
    </Suspense>
  );
}