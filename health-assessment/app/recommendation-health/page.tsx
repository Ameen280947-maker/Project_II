"use client";

import Link from "next/link";
import {
  Apple,
  ArrowLeft,
  ArrowRight,
  Heart,
  Info,
  PersonStanding,
  ShieldCheck,
} from "lucide-react";
import {
  Suspense,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

type AssessmentResult = {
  assessmentId: number;
  riskPercent: number;
  riskLevel: string;
  recommendation: string;
  assessedAt: string;
  assessmentName: string;
};

type ResultResponse = {
  success: boolean;
  result?: AssessmentResult;
  message?: string;
};

export default function RecommendationHealthPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <RecommendationContent />
    </Suspense>
  );
}

function RecommendationContent() {
  const searchParams = useSearchParams();

  const assessmentId = searchParams.get("assessmentId");

  const [result, setResult] =
    useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          `/api/assessments/thai-cvd?assessmentId=${assessmentId}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data = (await response.json()) as ResultResponse;

        if (!response.ok || !data.success || !data.result) {
          throw new Error(
            data.message ?? "ไม่สามารถโหลดผลประเมินได้",
          );
        }

        setResult(data.result);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "ไม่สามารถโหลดผลประเมินได้",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadResult();
  }, [assessmentId]);

  if (loading) {
    return <LoadingPage />;
  }

  if (error || !result) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbf9f9] p-6">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-lg">
          <Info
            size={45}
            className="mx-auto text-[#b91c2b]"
          />

          <h1 className="mt-5 text-2xl font-bold">
            ไม่สามารถแสดงผลได้
          </h1>

          <p className="mt-3 text-[#767780]">
            {error || "ไม่พบผลการประเมิน"}
          </p>

          <Link
            href="/assessment_"
            className="mt-7 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#b91c2b] font-bold text-white"
          >
            <ArrowLeft size={20} />
            กลับไปทำแบบประเมิน
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf9f9] px-5 py-8 text-[#2f3037] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1250px]">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Health Recommendation
            </p>

            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              คำแนะนำ
            </h1>

            <div className="mt-4 h-1 w-10 rounded-full bg-[#ef4962]" />

            <p className="mt-4 text-[#85858d]">
              คำแนะนำจากผลประเมินโรคหัวใจและหลอดเลือด
            </p>

            <h2 className="mt-6 text-3xl font-bold leading-snug sm:text-4xl">
              ความเสี่ยงต่อการเกิดโรคหัวใจและ
              <span className="block">
                หลอดเลือดใน{" "}
                <span className="text-[#ef4962]">
                  10 ปี
                </span>
              </span>
            </h2>
          </div>

          <div className="flex flex-col items-center">
            <RiskCircle score={result.riskPercent} />

            <span className="mt-4 rounded-full bg-[#eaf7e8] px-5 py-2 font-semibold text-[#4f9857]">
              {result.riskLevel}
            </span>
          </div>
        </header>

        <section className="mt-8 rounded-[28px] border border-[#f1e2e4] bg-gradient-to-br from-[#fff8f9] to-[#fff0f2] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-[#ef4962]">
              <Info size={27} />
            </div>

            <div>
              <h3 className="text-2xl font-bold">
                ผลและคำแนะนำจากฐานข้อมูล
              </h3>

              <p className="mt-4 leading-8 text-[#666872]">
                ผลประเมินของคุณอยู่ในระดับ{" "}
                <strong className="text-[#b91c2b]">
                  {result.riskLevel}
                </strong>{" "}
                โดยมีค่าความเสี่ยงประมาณ{" "}
                <strong className="text-[#ef4962]">
                  {result.riskPercent.toFixed(2)}%
                </strong>
              </p>

              <p className="mt-4 whitespace-pre-line leading-8 text-[#666872]">
                {result.recommendation}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-3">
            <ShieldCheck size={27} />
            <h3 className="text-2xl font-bold">
              แนวทางดูแลสุขภาพหัวใจ
            </h3>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <AdviceCard
              icon={<Apple size={31} />}
              title="โภชนาการ"
              description="รับประทานผัก ผลไม้ และธัญพืช ลดอาหารหวาน มัน เค็ม และอาหารแปรรูป"
            />

            <AdviceCard
              icon={<PersonStanding size={32} />}
              title="การออกกำลังกาย"
              description="ออกกำลังกายระดับปานกลางอย่างน้อย 150 นาทีต่อสัปดาห์"
            />

            <AdviceCard
              icon={<Heart size={31} />}
              title="ติดตามสุขภาพ"
              description="ตรวจความดัน ควบคุมน้ำหนัก งดสูบบุหรี่ และตรวจสุขภาพเป็นประจำ"
            />
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/assessment_CVD"
            className="flex h-13 items-center justify-center gap-2 rounded-full border border-[#ead9db] bg-white px-6 font-semibold text-[#8a1420]"
          >
            <ArrowLeft size={19} />
            กลับไปแก้แบบประเมิน
          </Link>

          <Link
            href="/assessment-menu"
            className="flex h-13 items-center justify-center gap-2 rounded-full bg-[#fff0f2] px-6 font-semibold text-[#ef4962]"
          >
            เลือกแบบประเมินอื่น
            <ArrowRight size={19} />
          </Link>
        </div>
      </div>
    </main>
  );
}

function RiskCircle({ score }: { score: number }) {
  const safeScore = Math.min(Math.max(score, 0), 100);
  const progress = safeScore * 3.6;

  return (
    <div
      className="grid h-44 w-44 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#ef3153 0deg ${progress}deg, #f8dfe3 ${progress}deg 360deg)`,
      }}
    >
      <div className="grid h-36 w-36 place-items-center rounded-full bg-white">
        <div className="flex items-end">
          <span className="text-5xl font-black text-[#ef3153]">
            {safeScore.toFixed(1)}
          </span>

          <span className="mb-1 text-xl font-bold text-[#ef3153]">
            %
          </span>
        </div>
      </div>
    </div>
  );
}

function AdviceCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">
        {icon}
      </div>

      <h4 className="mt-5 text-xl font-bold">{title}</h4>

      <p className="mt-3 text-sm leading-7 text-[#767880]">
        {description}
      </p>
    </article>
  );
}

function LoadingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fbf9f9]">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f1dadd] border-t-[#b91c2b]" />

        <p className="mt-5 font-semibold text-[#767780]">
          กำลังโหลดผลการประเมิน...
        </p>
      </div>
    </main>
  );
}