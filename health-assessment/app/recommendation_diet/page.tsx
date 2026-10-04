"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

import {
  ArrowLeft,
  CheckCircle2,
  Leaf,
  Salad,
  ShieldCheck,
  TriangleAlert,
  Utensils,
} from "lucide-react";

import { Suspense, useEffect, useState } from "react";

/* =====================================================
   TYPES
===================================================== */

type DomainResult = {
  score: number;
  level: string;
};

type ResultResponse = {
  success: boolean;

  assessment?: {
    assessment_id: number;
    total_score: number;
    risk_level: string;
    assessed_at: string;
    recommendation_text: string | null;
  };

  domains?: {
    vegetable: DomainResult;
    sugar: DomainResult;
    fat: DomainResult;
    sodium: DomainResult;
  };

  message?: string;
};

/* =====================================================
   PAGE
===================================================== */

export default function DietRecommendationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f4d6df] border-t-[#ed3564]" />
        </div>
      }
    >
      <DietRecommendationContent />
    </Suspense>
  );
}

function DietRecommendationContent() {
  const searchParams = useSearchParams();

  const assessmentId = searchParams.get("assessmentId");

  const [data, setData] =
    useState<ResultResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =====================================================
     LOAD RESULT
  ===================================================== */

  useEffect(() => {
    if (!assessmentId) {
      // ไม่ setState ตรง ๆ ในส่วน synchronous ของ effect
      return;
    }

    const loadResult = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/assessments/diet?assessmentId=${assessmentId}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as ResultResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ??
              "ไม่สามารถโหลดผลการประเมินได้",
          );
        }

        setData(result);
      } catch (err) {
        console.error(
          "LOAD DIET RESULT ERROR:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดผลการประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadResult();
  }, [assessmentId]);

  /* =====================================================
     NO ASSESSMENT ID
  ===================================================== */

  if (!assessmentId) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex-1 px-6 py-10 lg:px-12">
            <div className="mx-auto max-w-3xl rounded-[28px] border border-[#f2d3d7] bg-white p-10 text-center">

              <TriangleAlert
                size={48}
                className="mx-auto text-[#b91c2b]"
              />

              <h1 className="mt-5 text-2xl font-black">
                ไม่สามารถแสดงผลการประเมิน
              </h1>

              <p className="mt-3 text-[#85858d]">
                ไม่พบ Assessment ID
              </p>

              <Link
                href="/assessment-type"
                className="mx-auto mt-7 flex h-12 w-fit items-center gap-2 rounded-2xl bg-[#ed3564] px-6 font-bold text-white"
              >
                กลับไปแบบประเมิน

                <ArrowLeft size={18} />
              </Link>

            </div>
          </section>
        </div>
      </main>
    );
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex flex-1 items-center justify-center">
            <div className="text-center">

              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f4d6df] border-t-[#ed3564]" />

              <p className="mt-5 font-semibold text-[#777780]">
                กำลังโหลดผลการประเมิน...
              </p>

            </div>
          </section>
        </div>
      </main>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error || !data?.assessment) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex-1 px-6 py-10 lg:px-12">
            <div className="mx-auto max-w-3xl rounded-[28px] border border-[#f2d3d7] bg-white p-10 text-center">

              <TriangleAlert
                size={48}
                className="mx-auto text-[#b91c2b]"
              />

              <h1 className="mt-5 text-2xl font-black">
                ไม่สามารถแสดงผลการประเมิน
              </h1>

              <p className="mt-3 text-[#85858d]">
                {error ||
                  "ไม่พบข้อมูลผลการประเมิน"}
              </p>

              <Link
                href="/assessment-type"
                className="mx-auto mt-7 flex h-12 w-fit items-center gap-2 rounded-2xl bg-[#ed3564] px-6 font-bold text-white"
              >
                กลับไปแบบประเมิน

                <ArrowLeft size={18} />
              </Link>

            </div>
          </section>
        </div>
      </main>
    );
  }

  /* =====================================================
     DATA
  ===================================================== */

  const assessment = data.assessment;
  const domains = data.domains;

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">

      <div className="flex min-h-screen">

        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12">

          <div className="mx-auto max-w-5xl">

            {/* =================================================
                HEADER
            ================================================== */}

            <header>

              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ed3564]">
                Assessment Result
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                ผลการประเมิน{" "}
                <span className="text-[#ed3564]">
                  การรับประทานอาหาร
                </span>
              </h1>

              <p className="mt-3 text-[#85858d]">
                ผลการประเมินพฤติกรรมการรับประทานอาหาร
                ด้านผัก น้ำตาล ไขมัน และโซเดียม
              </p>

            </header>

            {/* =================================================
                MAIN RESULT
            ================================================== */}

            <section className="mt-8 overflow-hidden rounded-[30px] border border-[#eee5e6] bg-white shadow-[0_16px_45px_rgba(35,25,30,0.05)]">

              <div className="bg-gradient-to-r from-[#ed3564] to-[#f45c7d] px-6 py-8 text-white sm:px-8">

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="text-sm font-semibold text-white/80">
                      ผลการประเมินโดยรวม
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {assessment.risk_level}
                    </h2>

                  </div>

                  <div className="rounded-2xl bg-white/15 px-6 py-4 backdrop-blur">

                    <p className="text-xs text-white/75">
                      คะแนนรวม
                    </p>

                    <p className="mt-1 text-3xl font-black">
                      {Number(
                        assessment.total_score,
                      )}
                    </p>

                  </div>

                </div>

              </div>

              {/* =================================================
                  DOMAIN CARDS
              ================================================== */}

              <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">

                {domains && (
                  <>
                    <DomainCard
                      title="ผัก"
                      icon={<Leaf size={25} />}
                      result={domains.vegetable}
                    />

                    <DomainCard
                      title="น้ำตาล"
                      icon={<Salad size={25} />}
                      result={domains.sugar}
                    />

                    <DomainCard
                      title="ไขมัน"
                      icon={<Utensils size={25} />}
                      result={domains.fat}
                    />

                    <DomainCard
                      title="โซเดียม"
                      icon={<ShieldCheck size={25} />}
                      result={domains.sodium}
                    />
                  </>
                )}

              </div>

            </section>

            {/* =================================================
                RECOMMENDATION
            ================================================== */}

            <section className="mt-7 rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_14px_40px_rgba(35,25,30,0.04)] sm:p-8">

              <div className="flex items-center gap-4">

                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#eef9e9] text-[#57965c]">

                  <CheckCircle2 size={28} />

                </div>

                <div>

                  <h2 className="text-2xl font-black">
                    คำแนะนำสุขภาพ
                  </h2>

                  <p className="mt-1 text-sm text-[#898a92]">
                    แนวทางปรับพฤติกรรมการรับประทานอาหาร
                  </p>

                </div>

              </div>

              <div className="mt-7 rounded-2xl bg-[#faf8f8] p-5">

                <div className="whitespace-pre-line text-sm leading-8 text-[#65666f]">
                  {assessment.recommendation_text ||
                    "ยังไม่มีคำแนะนำ"}
                </div>

              </div>

            </section>

            {/* =================================================
                NOTE
            ================================================== */}

            <section className="mt-7 rounded-[24px] border border-[#f0e1e4] bg-[#fff8fa] p-5">

              <p className="text-sm leading-7 text-[#777780]">
                ผลนี้เป็นการประเมินพฤติกรรมการรับประทานอาหาร
                เพื่อใช้เป็นข้อมูลในการดูแลสุขภาพเบื้องต้น
                ไม่ใช่การวินิจฉัยโรค
              </p>

            </section>

            {/* =================================================
                BUTTON
            ================================================== */}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">

              <Link
                href="/assessment-type"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#eee5e6] bg-white px-6 font-bold text-[#777780] transition hover:bg-[#faf7f7]"
              >
                <ArrowLeft size={18} />

                กลับไปแบบประเมิน
              </Link>

              <Link
                href="/history"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ed3564] px-6 font-bold text-white shadow-[0_10px_24px_rgba(237,53,100,0.18)]"
              >
                ดูประวัติการประเมิน
              </Link>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}

/* =====================================================
   DOMAIN CARD
===================================================== */

function DomainCard({
  title,
  icon,
  result,
}: {
  title: string;
  icon: React.ReactNode;
  result: DomainResult;
}) {

  const level = result.level;

  const isWarning =
    level === "ปานกลาง";

  const isDanger =
    level === "สูง" ||
    level === "สูงมาก";

  /*
   * สำหรับ "ผัก"
   * ระดับสูง / สูงมาก = ผลดี
   *
   * สำหรับด้านอื่น
   * ระดับสูง / สูงมาก = ควรระวัง
   */

  const isVegetableGood =
    title === "ผัก" &&
    (level === "สูง" ||
      level === "สูงมาก");

  let box =
    "bg-[#eef9e9] text-[#57965c]";

  /* ผักระดับสูง/สูงมาก = ดี */

  if (isVegetableGood) {
    box =
      "bg-[#eef9e9] text-[#57965c]";
  }

  /* ระดับปานกลาง */

  if (isWarning) {
    box =
      "bg-[#fff8e8] text-[#a77723]";
  }

  /* ระดับสูง/สูงมาก ของด้านอื่น = อันตราย */

  if (
    isDanger &&
    !isVegetableGood
  ) {
    box =
      "bg-[#fff0f2] text-[#b91c2b]";
  }

  return (
    <article className="rounded-2xl border border-[#eee5e6] bg-[#fcfbfb] p-4">

      <div className="flex items-center gap-3">

        <div
          className={`grid h-11 w-11 place-items-center rounded-xl ${box}`}
        >
          {icon}
        </div>

        <div>

          <p className="text-sm font-bold">
            {title}
          </p>

          <p className="mt-1 text-xs text-[#999aa1]">
            คะแนน {result.score}
          </p>

        </div>

      </div>

      <div
        className={`mt-4 rounded-xl px-3 py-2 text-center text-sm font-bold ${box}`}
      >
        {getDomainLabel(
          title,
          level,
        )}
      </div>

    </article>
  );
}

/* =====================================================
   LABEL
===================================================== */

function getDomainLabel(
  title: string,
  level: string,
) {

  if (title === "ผัก") {
    return `ปริมาณ${level}`;
  }

  return `ระดับ${level}`;
}