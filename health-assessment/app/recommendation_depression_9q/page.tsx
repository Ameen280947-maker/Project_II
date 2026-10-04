"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Heart,
  ClipboardCheck,
  PhoneCall,
  RotateCcw,
  History,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";

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
  const assessmentId = searchParams.get("assessmentId");

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);

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
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex min-h-screen flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-[#666770]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f8e8ea]">
              <Loader2 size={28} className="animate-spin text-[#b91c2b]" />
            </div>
            <p className="font-medium">กำลังโหลดผลการประเมิน 9Q...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fb]">
        <Sidebar />
        <main className="flex min-h-screen flex-1 items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-xl font-bold text-[#2f3037]">ไม่พบข้อมูล</h2>
            <p className="mt-2 text-sm text-[#777780]">{error || "ไม่พบผลการประเมินที่ระบุ"}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/assessment_depression_2q"
                className="rounded-2xl bg-[#b91c2b] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#9f1726]"
              >
                เริ่มประเมิน 2Q
              </Link>
              <Link
                href="/assessment-menu-mental-health"
                className="rounded-2xl bg-gray-100 px-6 py-2.5 text-sm font-semibold text-[#55565e] transition hover:bg-gray-200"
              >
                กลับสู่เมนู
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* Severity Classification */
  const score = Number(result.total_score ?? 0);

  let severityTheme = {
    badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-800",
    iconBg: "bg-emerald-50 text-emerald-500",
    scoreText: "text-emerald-700",
    Icon: CheckCircle2,
    levelDesc: "ไม่มีอาการของโรคซึมเศร้า หรือมีน้อยมาก",
  };

  if (score >= 19) {
    severityTheme = {
      badgeBg: "bg-red-50 border-red-200 text-red-800",
      iconBg: "bg-red-50 text-red-600",
      scoreText: "text-red-700",
      Icon: AlertOctagon,
      levelDesc: "มีอาการของโรคซึมเศร้าระดับรุนแรง ควรพบแพทย์โดยเร็ว",
    };
  } else if (score >= 13) {
    severityTheme = {
      badgeBg: "bg-orange-50 border-orange-200 text-orange-800",
      iconBg: "bg-orange-50 text-orange-500",
      scoreText: "text-orange-700",
      Icon: AlertTriangle,
      levelDesc: "มีอาการของโรคซึมเศร้าระดับปานกลาง ควรรับการปรึกษา",
    };
  } else if (score >= 7) {
    severityTheme = {
      badgeBg: "bg-amber-50 border-amber-200 text-amber-800",
      iconBg: "bg-amber-50 text-amber-500",
      scoreText: "text-amber-700",
      Icon: Info,
      levelDesc: "มีอาการของโรคซึมเศร้าระดับน้อย ควรเฝ้าระวังและดูแลตนเอง",
    };
  }

  const StatusIcon = severityTheme.Icon;

  const formattedDate = result.assessed_at
    ? new Date(result.assessed_at).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      <Sidebar />

      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl">

          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f8e8ea] text-[#b91c2b]">
                  <ClipboardCheck size={26} />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide text-[#b91c2b]">
                    ผลการประเมินสุขภาพจิต
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#2f3037]">
                    ผลประเมินโรคซึมเศร้า 9Q
                  </h1>
                </div>
              </div>

              {formattedDate && (
                <div className="flex items-center gap-2 text-xs font-medium text-[#777780] bg-white border border-[#eee5e6] px-3.5 py-2 rounded-xl">
                  <Calendar size={14} className="text-[#b91c2b]" />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Result Card */}
          <div className="rounded-3xl border border-[#eee5e6] bg-white p-6 sm:p-10 shadow-sm">
            
            {/* Score & Level Display */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ${severityTheme.iconBg}`}
              >
                <StatusIcon size={46} />
              </div>

              <span className="text-xs font-bold uppercase tracking-wider text-[#999aa2]">
                คะแนนรวมแบบประเมิน 9Q (เต็ม 27 คะแนน)
              </span>

              <div className="my-2 text-6xl font-extrabold text-[#b91c2b]">
                {score}
                <span className="text-xl font-normal text-[#999aa2]"> / 27</span>
              </div>

              <div
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-base font-bold ${severityTheme.badgeBg}`}
              >
                <span>{result.risk_level}</span>
              </div>

              <p className="mt-2 text-sm text-[#777780]">
                {severityTheme.levelDesc}
              </p>
            </div>

            {/* Urgent Attention Alert Box */}
            {(result.needs_urgent_attention || score >= 19) && (
              <div className="mt-8 rounded-3xl border-2 border-red-200 bg-red-50/90 p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                    <AlertOctagon size={28} />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-800">
                      {result.needs_urgent_attention
                        ? "คำเตือน: ควรได้รับการประเมินและดูแลอย่างใกล้ชิด"
                        : "มีอาการซึมเศร้าระดับรุนแรง ควรพบแพทย์เพื่อรับการรักษา"}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-red-700">
                      {result.needs_urgent_attention
                        ? "เนื่องจากมีคำตอบที่บ่งชี้ถึงความคิดทำร้ายตนเอง หรือมีความเสี่ยงต่อความปลอดภัย หากท่านหรือคนใกล้ชิดรู้สึกไม่ปลอดภัย ขอให้ปรึกษาผู้เชี่ยวชาญหรือติดต่อสายด่วนทันที"
                        : "คะแนนของท่านอยู่ในระดับที่ควรได้รับการดูแลและวางแผนการรักษาจากแพทย์หรือบุคลากรสาธารณสุขโดยเร็ว"}
                    </p>

                    {/* Hotlines */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <a
                        href="tel:1323"
                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
                      >
                        <PhoneCall size={16} />
                        สายด่วนสุขภาพจิต 1323 (โทรฟรี 24 ชม.)
                      </a>

                      <a
                        href="tel:021136789"
                        className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-50"
                      >
                        <PhoneCall size={16} />
                        สะมาริตันส์ 02-113-6789
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendation Text */}
            <div className="mt-8 rounded-3xl border border-[#f3e6e8] bg-[#fff8f9] p-6 sm:p-7">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8e8ea] text-[#b91c2b]">
                  <Heart size={20} fill="currentColor" />
                </div>
                <h2 className="text-lg font-bold text-[#2f3037]">
                  คำแนะนำด้านสุขภาพ
                </h2>
              </div>

              <p className="whitespace-pre-line text-base leading-relaxed text-[#4f535b]">
                {result.recommendation_text}
              </p>
            </div>

            {/* Answers Summary Toggle (Optional Detail) */}
            {result.answers && result.answers.length > 0 && (
              <div className="mt-6 border-t border-[#eee5e6] pt-6">
                <button
                  type="button"
                  onClick={() => setShowAnswers(!showAnswers)}
                  className="flex w-full items-center justify-between rounded-2xl bg-gray-50 px-5 py-3 text-sm font-semibold text-[#55565e] transition hover:bg-gray-100"
                >
                  <span>รายละเอียดคำตอบของท่าน ({result.answers.length} ข้อ)</span>
                  {showAnswers ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {showAnswers && (
                  <div className="mt-4 space-y-3">
                    {result.answers.map((item, idx) => (
                      <div
                        key={item.answer_id ?? idx}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-[#2f3037]">
                            {idx + 1}. {item.question_text}
                          </p>
                          <p className="mt-1 text-xs text-[#777780]">
                            คำตอบ: <span className="font-medium text-[#b91c2b]">{item.choice_text || item.answer_value}</span>
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                          {item.score} คะแนน
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5e6] pt-6">
              <Link
                href="/assessment-menu-mental-health"
                className="flex items-center gap-2 rounded-2xl bg-[#f5f3f3] px-5 py-3 text-sm font-semibold text-[#55565e] transition hover:bg-[#ebe8e8]"
              >
                กลับสู่เมนูสุขภาพจิต
              </Link>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/history"
                  className="flex items-center gap-2 rounded-2xl border border-[#eee5e6] bg-white px-5 py-3 text-sm font-semibold text-[#55565e] shadow-sm transition hover:bg-gray-50"
                >
                  <History size={16} />
                  ดูประวัติการประเมิน
                </Link>

                <Link
                  href="/assessment_depression_2q"
                  className="flex items-center gap-2 rounded-2xl bg-[#b91c2b] px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(185,28,43,0.16)] transition hover:bg-[#9f1726]"
                >
                  <RotateCcw size={16} />
                  ทำแบบประเมินใหม่อีกครั้ง
                </Link>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}

export default function Depression9QRecommendationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb]">
          <Loader2 className="animate-spin text-[#b91c2b]" size={32} />
        </div>
      }
    >
      <Depression9QRecommendationContent />
    </Suspense>
  );
}