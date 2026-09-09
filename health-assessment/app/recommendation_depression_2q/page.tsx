"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  Heart,
  ClipboardCheck,
  ArrowRight,
  RotateCcw,
  History,
  Calendar,
  Loader2,
  Brain,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";

/* =========================================================
   TYPES
========================================================= */

type Result = {
  assessment_id: number;
  total_score: number;
  risk_level: string;
  recommendation_text: string;
  assessed_at: string;
};

/* =========================================================
   COMPONENT CONTENT
========================================================= */

function Depression2QRecommendationContent() {
  const searchParams = useSearchParams();
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
          `/api/assessments/depression?stage=2q&assessmentId=${assessmentId}&userId=${userId || ""}`,
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
            <p className="font-medium">กำลังโหลดผลการประเมิน 2Q...</p>
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
                ทำแบบประเมิน
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

  const isRisk =
    result.total_score > 0 ||
    result.risk_level.includes("เสี่ยง") ||
    result.risk_level.includes("แนวโน้ม");

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
                    ผลการคัดกรองสุขภาพจิต
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#2f3037]">
                    ผลคัดกรองภาวะซึมเศร้า 2Q
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

          {/* Score & Risk Card */}
          <div className="rounded-3xl border border-[#eee5e6] bg-white p-6 sm:p-10 shadow-sm">
            <div className="flex flex-col items-center text-center">

              {/* Status Badge Icon */}
              <div
                className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
                  isRisk ? "bg-amber-50 text-amber-500" : "bg-green-50 text-green-500"
                }`}
              >
                {isRisk ? (
                  <AlertTriangle size={42} />
                ) : (
                  <CheckCircle2 size={46} />
                )}
              </div>

              <span className="text-xs font-bold uppercase tracking-wider text-[#999aa2]">
                คะแนนแบบคัดกรอง 2Q (เต็ม 2 คะแนน)
              </span>

              <div className="my-2 text-6xl font-extrabold text-[#b91c2b]">
                {result.total_score}
                <span className="text-xl font-normal text-[#999aa2]"> / 2</span>
              </div>

              <div
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-base font-bold ${
                  isRisk
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                <span>{result.risk_level}</span>
              </div>
            </div>

            {/* Recommendation Box */}
            <div
              className={`mt-8 rounded-3xl p-6 sm:p-7 ${
                isRisk
                  ? "bg-amber-50/70 border border-amber-100"
                  : "bg-[#fff8f9] border border-[#f3e6e8]"
              }`}
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isRisk
                      ? "bg-amber-100 text-amber-700"
                      : "bg-[#f8e8ea] text-[#b91c2b]"
                  }`}
                >
                  <Heart size={20} fill="currentColor" />
                </div>

                <h2 className="text-lg font-bold text-[#2f3037]">
                  คำแนะนำด้านสุขภาพจิต
                </h2>
              </div>

              <p className="whitespace-pre-line text-base leading-relaxed text-[#4f535b]">
                {result.recommendation_text}
              </p>
            </div>

            {/* If Risk: Call to Action for 9Q */}
            {isRisk && (
              <div className="mt-6 rounded-2xl border border-purple-100 bg-purple-50 p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                      <Brain size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2f3037]">
                        ขั้นตอนถัดไป: ทำแบบประเมินโรคซึมเศร้า 9Q
                      </h3>
                      <p className="text-xs text-[#666770]">
                        เพื่อความแม่นยำในการคัดกรอง แนะนำให้ตอบแบบประเมิน 9Q ต่อเนื่องทันที
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/assessment_depression_9q?previousAssessmentId=${result.assessment_id}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700"
                  >
                    เริ่มทำแบบประเมิน 9Q
                    <ArrowRight size={16} />
                  </Link>
                </div>
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

export default function Depression2QRecommendationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb]">
          <Loader2 className="animate-spin text-[#b91c2b]" size={32} />
        </div>
      }
    >
      <Depression2QRecommendationContent />
    </Suspense>
  );
}