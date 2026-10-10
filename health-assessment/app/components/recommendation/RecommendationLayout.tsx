import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import type { CardTone } from "@/app/components/AssessmentMenuCard";
import Sidebar from "@/app/components/Sidebar";
import AnswerReview from "@/app/components/AnswerReview";
import ResultActions from "@/app/components/ResultActions";

/* =========================================================
   โครงหน้าคำแนะนำ ใช้รูปแบบเดียวกันทุกแบบประเมิน (อิงหน้าโรคหัวใจ)
   ส่วนหัว (คำแนะนำ + ชื่อผล) | วงกลมคะแนน + ป้ายระดับ
   → การ์ด "ผลและคำแนะนำ" → เนื้อหาเฉพาะแบบประเมิน (children)
   → คำตอบของคุณ → หมายเหตุ → ปุ่มท้ายหน้า
   สีตามโทนของแบบประเมิน (เดียวกับการ์ดในหน้าเมนู)
========================================================= */

type ToneClasses = {
  eyebrow: string; // ข้อความ/ไอคอนสีหลัก
  accent: string; // ข้อความเน้นสีรอง
  bar: string; // เส้นใต้หัวข้อ
  panel: string; // การ์ดผลและคำแนะนำ
  iconSoft: string; // วงไอคอนพื้นอ่อน
  spinner: string;
  button: string; // ปุ่มทึบ
  ring: string; // สีวงกลมคะแนน (hex)
  ringTrack: string; // สีพื้นวงกลมคะแนน (hex)
};

// เขียนคลาสเต็มทุกตัว ให้ Tailwind สร้าง CSS ได้
export const RECOMMENDATION_TONES: Record<CardTone, ToneClasses> = {
  rose: {
    eyebrow: "text-[#b91c2b]",
    accent: "text-[#ef4962]",
    bar: "bg-[#ef4962]",
    panel: "border-[#f1e2e4] from-[#fff8f9] to-[#fff0f2]",
    iconSoft: "bg-[#fff0f2] text-[#b91c2b]",
    spinner: "border-[#f1dadd] border-t-[#b91c2b]",
    button: "bg-[#b91c2b]",
    ring: "#ef3153",
    ringTrack: "#f8dfe3",
  },
  green: {
    eyebrow: "text-[#3f7a2e]",
    accent: "text-[#5a9445]",
    bar: "bg-[#5a9445]",
    panel: "border-[#dcead2] from-[#f6faf2] to-[#ebf3e2]",
    iconSoft: "bg-[#ebf3e2] text-[#3f7a2e]",
    spinner: "border-[#cde0c0] border-t-[#3f7a2e]",
    button: "bg-[#3f7a2e]",
    ring: "#5a9445",
    ringTrack: "#e2eed9",
  },
  blue: {
    eyebrow: "text-[#2f4fa0]",
    accent: "text-[#4f6fc0]",
    bar: "bg-[#4f6fc0]",
    panel: "border-[#dbe2f3] from-[#f5f7fc] to-[#e8edf8]",
    iconSoft: "bg-[#e8edf8] text-[#2f4fa0]",
    spinner: "border-[#c8d3ec] border-t-[#2f4fa0]",
    button: "bg-[#2f4fa0]",
    ring: "#4f6fc0",
    ringTrack: "#e0e6f5",
  },
  mint: {
    eyebrow: "text-[#2c6b45]",
    accent: "text-[#4a8a62]",
    bar: "bg-[#4a8a62]",
    panel: "border-[#d6e7da] from-[#f4f9f5] to-[#e5f0e8]",
    iconSoft: "bg-[#e5f0e8] text-[#2c6b45]",
    spinner: "border-[#c4dbcb] border-t-[#2c6b45]",
    button: "bg-[#2c6b45]",
    ring: "#4a8a62",
    ringTrack: "#dcebe0",
  },
  amber: {
    eyebrow: "text-[#8a5a00]",
    accent: "text-[#b07a14]",
    bar: "bg-[#b07a14]",
    panel: "border-[#f3e4c4] from-[#fdf8ee] to-[#fbf1dd]",
    iconSoft: "bg-[#fbf1dd] text-[#8a5a00]",
    spinner: "border-[#edd5a6] border-t-[#8a5a00]",
    button: "bg-[#8a5a00]",
    ring: "#b07a14",
    ringTrack: "#f6e9cc",
  },
  teal: {
    eyebrow: "text-[#1f7a69]",
    accent: "text-[#2f9a85]",
    bar: "bg-[#2f9a85]",
    panel: "border-[#d0e9e3] from-[#f3faf8] to-[#e2f3ef]",
    iconSoft: "bg-[#e2f3ef] text-[#1f7a69]",
    spinner: "border-[#bbdfd7] border-t-[#1f7a69]",
    button: "bg-[#1f7a69]",
    ring: "#2f9a85",
    ringTrack: "#d8eee9",
  },
  violet: {
    eyebrow: "text-[#5b3ea6]",
    accent: "text-[#7a5cc8]",
    bar: "bg-[#7a5cc8]",
    panel: "border-[#e2daf5] from-[#f7f4fc] to-[#eee9f9]",
    iconSoft: "bg-[#eee9f9] text-[#5b3ea6]",
    spinner: "border-[#d4c9ee] border-t-[#5b3ea6]",
    button: "bg-[#5b3ea6]",
    ring: "#7a5cc8",
    ringTrack: "#e8e1f7",
  },
  pink: {
    eyebrow: "text-[#b4235a]",
    accent: "text-[#d0457a]",
    bar: "bg-[#d0457a]",
    panel: "border-[#f5d6e2] from-[#fef5f8] to-[#fce9f0]",
    iconSoft: "bg-[#fce9f0] text-[#b4235a]",
    spinner: "border-[#efc1d3] border-t-[#b4235a]",
    button: "bg-[#b4235a]",
    ring: "#d0457a",
    ringTrack: "#f8dfe9",
  },
};

/* ป้ายระดับความเสี่ยง: สีตามความหมายของผล ไม่ใช่โทนของแบบประเมิน */
export type RiskColor = "green" | "yellow" | "orange" | "red" | "gray";

const RISK_BADGE: Record<RiskColor, string> = {
  green: "bg-[#eaf7e8] text-[#4f9857]",
  yellow: "bg-[#fff6d6] text-[#9a7300]",
  orange: "bg-[#fff1e3] text-[#c2620c]",
  red: "bg-[#fde8eb] text-[#c81e3a]",
  gray: "bg-[#f3f3f4] text-[#6b6c74]",
};

/* =========================================================
   วงกลมคะแนน
   progress 0-1 (สัดส่วนที่เติมสี), value = ตัวเลขกลางวง, unit = หน่วย/คะแนนเต็ม
========================================================= */

export function ScoreCircle({
  tone,
  progress,
  value,
  unit,
  caption,
}: {
  tone: CardTone;
  progress: number;
  value: string;
  unit?: string;
  caption?: string;
}) {
  const t = RECOMMENDATION_TONES[tone];
  const deg = Math.min(Math.max(progress, 0), 1) * 360;

  return (
    <div
      className="grid h-44 w-44 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${t.ring} 0deg ${deg}deg, ${t.ringTrack} ${deg}deg 360deg)`,
      }}
    >
      <div className="grid h-36 w-36 place-items-center rounded-full bg-white">
        <div className="text-center">
          <div className="flex items-end justify-center">
            <span className="text-5xl font-black" style={{ color: t.ring }}>
              {value}
            </span>
            {unit && (
              <span className="mb-1 ml-0.5 text-xl font-bold" style={{ color: t.ring }}>
                {unit}
              </span>
            )}
          </div>
          {caption && <p className="mt-1 text-xs font-semibold text-[#85858d]">{caption}</p>}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   หัวข้อส่วนเนื้อหาเฉพาะแบบประเมิน + การ์ดแนวทาง
========================================================= */

export function RecommendationSection({
  icon,
  title,
  children,
  className = "mt-8",
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-2xl font-bold">{title}</h3>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function AdviceCard({
  tone,
  icon,
  title,
  children,
}: {
  tone: CardTone;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[25px] border border-[#eee8e9] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)]">
      <div className={`grid h-14 w-14 place-items-center rounded-full ${RECOMMENDATION_TONES[tone].iconSoft}`}>
        {icon}
      </div>
      <h4 className="mt-5 text-xl font-bold">{title}</h4>
      <div className="mt-3 text-sm leading-7 text-[#767880]">{children}</div>
    </article>
  );
}

/* =========================================================
   โหลด / ผิดพลาด
========================================================= */

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">
        <Sidebar />
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </main>
  );
}

export function RecommendationLoading({ tone }: { tone: CardTone }) {
  return (
    <Shell>
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <div className={`mx-auto h-12 w-12 animate-spin rounded-full border-4 ${RECOMMENDATION_TONES[tone].spinner}`} />
          <p className="mt-5 font-semibold text-[#767780]">กำลังโหลดผลการประเมิน...</p>
        </div>
      </div>
    </Shell>
  );
}

export function RecommendationError({
  tone,
  message,
  editHref,
}: {
  tone: CardTone;
  message?: string;
  editHref: string;
}) {
  const t = RECOMMENDATION_TONES[tone];

  return (
    <Shell>
      <div className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-lg">
          <Info size={45} className={`mx-auto ${t.eyebrow}`} />
          <h1 className="mt-5 text-2xl font-bold">ไม่สามารถแสดงผลได้</h1>
          <p className="mt-3 text-[#767780]">{message || "ไม่พบผลการประเมิน"}</p>
          <Link
            href={editHref}
            className={`mt-7 flex h-14 items-center justify-center gap-2 rounded-2xl font-bold text-white ${t.button}`}
          >
            <ArrowLeft size={20} />
            กลับไปทำแบบประเมิน
          </Link>
        </div>
      </div>
    </Shell>
  );
}

/* =========================================================
   หน้าคำแนะนำ
========================================================= */

export default function RecommendationLayout({
  tone,
  title,
  score,
  riskLevel,
  riskColor,
  summary,
  recommendation,
  children,
  assessmentId,
  editHref,
  menuHref,
  onMenuClick,
  disclaimer = "ผลนี้เป็นการประเมินความเสี่ยงเบื้องต้น ไม่ใช่การวินิจฉัยโรค หากมีความผิดปกติหรือมีความกังวล ควรปรึกษาบุคลากรทางการแพทย์",
}: {
  tone: CardTone;
  /* ชื่อผลประเมิน (หัวข้อใหญ่ใต้ "คำแนะนำ") */
  title: ReactNode;
  /* วงกลมคะแนนด้านขวา (ใช้ ScoreCircle) */
  score: ReactNode;
  riskLevel: string;
  riskColor: RiskColor;
  /* ประโยคสรุปผลบรรทัดแรกในการ์ด "ผลและคำแนะนำ" */
  summary?: ReactNode;
  /* ข้อความคำแนะนำจากฐานข้อมูล */
  recommendation?: ReactNode;
  /* เนื้อหาเฉพาะแบบประเมิน */
  children?: ReactNode;
  assessmentId: string | number | null;
  editHref: string;
  menuHref?: string;
  onMenuClick?: () => void;
  disclaimer?: string;
}) {
  const t = RECOMMENDATION_TONES[tone];

  return (
    <Shell>
      <div className="px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1250px]">
          <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-start">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.18em] ${t.eyebrow}`}>
                Health Recommendation
              </p>
              <h1 className="mt-3 text-4xl font-black sm:text-5xl">คำแนะนำ</h1>
              <div className={`mt-4 h-1 w-10 rounded-full ${t.bar}`} />
              <h2 className="mt-6 text-3xl font-bold leading-snug sm:text-4xl">{title}</h2>
            </div>

            <div className="flex flex-col items-center">
              {score}
              <span className={`mt-4 rounded-full px-5 py-2 text-center font-semibold ${RISK_BADGE[riskColor]}`}>
                {riskLevel}
              </span>
            </div>
          </header>

          <section className={`mt-8 rounded-[28px] border bg-gradient-to-br p-6 sm:p-8 ${t.panel}`}>
            <div className="flex items-start gap-4">
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white ${t.accent}`}>
                <Info size={27} />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-bold">ผลและคำแนะนำ</h3>
                <p className="mt-4 leading-8 text-[#666872]">
                  {summary ?? (
                    <>
                      ผลประเมินของคุณอยู่ในระดับ{" "}
                      <strong className={t.eyebrow}>{riskLevel}</strong>
                    </>
                  )}
                </p>
                {recommendation && (
                  <div className="mt-4 whitespace-pre-line leading-8 text-[#666872]">{recommendation}</div>
                )}
              </div>
            </div>
          </section>

          {children}

          <AnswerReview assessmentId={assessmentId} className="mt-8" />

          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#eee5e6] bg-white p-5 text-sm leading-7 text-[#858791]">
            <CheckCircle2 size={21} className="mt-1 shrink-0 text-[#6fa85e]" />
            <p>{disclaimer}</p>
          </div>

          <ResultActions tone={tone} editHref={editHref} menuHref={menuHref} onMenuClick={onMenuClick} />
        </div>
      </div>
    </Shell>
  );
}
