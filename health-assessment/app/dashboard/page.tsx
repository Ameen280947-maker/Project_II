"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/app/components/Sidebar";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Footprints,
  HeartPulse,
  Info,
  MessageCircle,
  Moon,
  Phone,
  Plus,
  Ruler,
  Zap,
  type LucideIcon,
} from "lucide-react";

/* =========================================================
   TYPES (ตรงกับ /api/dashboard เดิม)
========================================================= */

type Assessment = {
  assessment_id: number;
  assessment_type_id: number;
  assessment_name: string;
  total_score: number | string | null;
  risk_level: string;
  systolic?: number | string | null; // เฉพาะ Blood Pressure
  diastolic?: number | string | null; // เฉพาะ Blood Pressure
  assessed_at: string;
  recommendation_text?: string | null;
};

type DashboardData = {
  success: boolean;
  summary: {
    totalAssessments: number;
    totalTypes: number;
    riskAssessments: number;
    latestAssessment: Assessment | null;
  };
  latestByType: Assessment[];
  assessments: Assessment[];
};

type Level = "ok" | "mid" | "high" | "unknown";
type Category = "mind" | "body";
type Band = { from: number; to: number; label: string; color: string };

type TypeConfig = {
  thaiName: string;
  icon: LucideIcon;
  category: Category;
  max?: number; // คะแนนเต็ม (ถ้ามี)
  min?: number; // ค่าต่ำสุดของกราฟ
  chartMax?: number; // ค่าสูงสุดของกราฟ สำหรับแบบที่ไม่มีคะแนนเต็ม
  unit?: string;
  bands?: Band[]; // แถบเกณฑ์ในกราฟแนวโน้ม
  levelFromScore?: (score: number) => Level; // ใช้แทนการอ่านจากข้อความ
  tip: { title: string; text: string };
};

/* =========================================================
   THEME
========================================================= */

const ACCENT = "#8E1428";

const LEVEL_STYLE: Record<
  Level,
  { label: string; pill: string; seg: string; text: string; soft: string; icon: LucideIcon; n: number }
> = {
  ok: {
    label: "ปกติ",
    pill: "bg-[#E4F1E8] text-[#1D6436]",
    seg: "bg-[#2F8A4F]",
    text: "text-[#1D6436]",
    soft: "bg-[#E4F1E8]",
    icon: CheckCircle2,
    n: 1,
  },
  mid: {
    label: "ควรระวัง",
    pill: "bg-[#FBEFD6] text-[#7A4A00]",
    seg: "bg-[#D08A14]",
    text: "text-[#7A4A00]",
    soft: "bg-[#FBEFD6]",
    icon: AlertTriangle,
    n: 2,
  },
  high: {
    label: "ควรพบผู้เชี่ยวชาญ",
    pill: "bg-[#FADDE0] text-[#8E1428]",
    seg: "bg-[#B4233A]",
    text: "text-[#8E1428]",
    soft: "bg-[#FBE9EB]",
    icon: AlertTriangle,
    n: 3,
  },
  unknown: {
    label: "-",
    pill: "bg-[#F3F1EC] text-[#4A4F59]",
    seg: "bg-[#9AA0A8]",
    text: "text-[#4A4F59]",
    soft: "bg-[#F3F1EC]",
    icon: Activity,
    n: 0,
  },
};

const BAND = {
  green: "#EEF6F0",
  amber: "#FDF6E7",
  amber2: "#FBECCD",
  red: "#FBE9EB",
  red2: "#F7DADE",
  blue: "#EAF0F8",
};

/* =========================================================
   CONFIG ต่อประเภทแบบประเมิน
   key = assessment_name แบบตัวพิมพ์เล็ก
   (ปรับคะแนนเต็ม/เกณฑ์ให้ตรงกับแบบประเมินจริงของโปรเจค)
========================================================= */

const TYPE_CONFIG: Record<string, TypeConfig> = {
  "phq-2": {
    thaiName: "คัดกรองภาวะซึมเศร้า",
    icon: MessageCircle,
    category: "mind",
    max: 2,
    bands: [
      { from: 0, to: 0.5, label: "ปกติ", color: BAND.green },
      { from: 0.5, to: 2, label: "มีความเสี่ยง", color: BAND.amber },
    ],
    levelFromScore: (s) => (s >= 1 ? "mid" : "ok"),
    tip: {
      title: "ดูแลสุขภาพใจ",
      text: "ลองพูดคุยกับคนที่ไว้ใจ และทำแบบประเมิน 9Q ต่อเพื่อดูระดับอาการ",
    },
  },
  "9q": {
    thaiName: "ประเมินระดับภาวะซึมเศร้า",
    icon: ClipboardList,
    category: "mind",
    max: 27,
    bands: [
      { from: 0, to: 6.5, label: "ไม่มีอาการ", color: BAND.green },
      { from: 6.5, to: 12.5, label: "น้อย", color: BAND.amber },
      { from: 12.5, to: 18.5, label: "ปานกลาง", color: BAND.amber2 },
      { from: 18.5, to: 27, label: "รุนแรง", color: BAND.red },
    ],
    levelFromScore: (s) => (s >= 13 ? "high" : s >= 7 ? "mid" : "ok"),
    tip: {
      title: "ปรึกษาผู้เชี่ยวชาญ",
      text: "แนะนำให้นัดพูดคุยกับนักจิตวิทยาหรือแพทย์ หากรู้สึกไม่ไหวโทรสายด่วน 1323 ได้ตลอด 24 ชั่วโมง",
    },
  },
  stress: {
    thaiName: "ความเครียด",
    icon: Zap,
    category: "mind",
    max: 15,
    bands: [
      { from: 0, to: 4.5, label: "น้อย", color: BAND.green },
      { from: 4.5, to: 7.5, label: "ปานกลาง", color: BAND.amber },
      { from: 7.5, to: 9.5, label: "มาก", color: BAND.red },
      { from: 9.5, to: 15, label: "มากที่สุด", color: BAND.red2 },
    ],
    levelFromScore: (s) => (s >= 8 ? "high" : s >= 5 ? "mid" : "ok"),
    tip: {
      title: "จัดการความเครียด",
      text: "ฝึกหายใจช้า ๆ วันละ 10 นาที และแบ่งเวลาพักจากหน้าจอระหว่างวัน",
    },
  },
  sleep: {
    thaiName: "คุณภาพการนอน",
    icon: Moon,
    category: "body",
    tip: {
      title: "ปรับการนอนหลับ",
      text: "เข้านอนและตื่นเวลาเดิมทุกวัน งดคาเฟอีนหลังบ่าย และวางมือถือก่อนนอน 30 นาที",
    },
  },
  bmi: {
    thaiName: "ดัชนีมวลกาย",
    icon: Ruler,
    category: "body",
    min: 15,
    max: 35,
    unit: "kg/m²",
    bands: [
      { from: 15, to: 18.5, label: "น้ำหนักน้อย", color: BAND.blue },
      { from: 18.5, to: 23, label: "ปกติ", color: BAND.green },
      { from: 23, to: 25, label: "ท้วม", color: BAND.amber },
      { from: 25, to: 35, label: "อ้วน", color: BAND.red },
    ],
    tip: {
      title: "ดูแลน้ำหนักตัว",
      text: "เลือกอาหารที่มีผักและโปรตีน ลดของหวานและของทอด ควบคู่กับการออกกำลังกาย",
    },
  },
  "blood pressure": {
    thaiName: "ความดันโลหิต",
    icon: HeartPulse,
    category: "body",
    unit: "mmHg",
    // กราฟใช้ค่าความดันตัวบน เกณฑ์ตรงกับ /api/assessments/blood-pressure
    min: 80,
    chartMax: 200,
    bands: [
      { from: 80, to: 130, label: "ปกติ", color: BAND.green },
      { from: 130, to: 140, label: "เริ่มสูง", color: BAND.amber },
      { from: 140, to: 160, label: "อาจเป็นความดันสูง", color: BAND.amber2 },
      { from: 160, to: 180, label: "ความดันสูง", color: BAND.red },
      { from: 180, to: 200, label: "อันตราย", color: BAND.red2 },
    ],
    tip: {
      title: "ดูแลความดันโลหิต",
      text: "ลดอาหารเค็ม ออกกำลังกายสม่ำเสมอ และวัดความดันซ้ำในช่วงเวลาเดิม",
    },
  },
  "thai cvd": {
    thaiName: "ความเสี่ยงโรคหัวใจและหลอดเลือด",
    icon: HeartPulse,
    category: "body",
    unit: "% ความเสี่ยงใน 10 ปี",
    // เกณฑ์ตรงกับ /api/assessments/thai-cvd
    min: 0,
    chartMax: 40,
    bands: [
      { from: 0, to: 10, label: "เสี่ยงน้อย", color: BAND.green },
      { from: 10, to: 30, label: "เสี่ยงปานกลาง", color: BAND.amber },
      { from: 30, to: 40, label: "เสี่ยงสูง", color: BAND.red },
    ],
    levelFromScore: (s) => (s >= 30 ? "high" : s >= 10 ? "mid" : "ok"),
    tip: {
      title: "ดูแลหัวใจและหลอดเลือด",
      text: "ควบคุมความดัน น้ำหนัก และรอบเอว งดสูบบุหรี่ และตรวจสุขภาพประจำปี",
    },
  },
  "physical activity": {
    thaiName: "กิจกรรมทางกาย",
    icon: Footprints,
    category: "body",
    tip: {
      title: "ขยับร่างกายให้มากขึ้น",
      text: "ตั้งเป้าออกกำลังกายระดับปานกลาง 150 นาทีต่อสัปดาห์ เริ่มจากเดินเร็ววันละ 20 นาที",
    },
  },
};
TYPE_CONFIG["กิจกรรมทางกาย"] = TYPE_CONFIG["physical activity"];

const FALLBACK_CONFIG: TypeConfig = {
  thaiName: "",
  icon: Activity,
  category: "body",
  tip: { title: "ติดตามผลต่อเนื่อง", text: "ทำแบบประเมินซ้ำเพื่อติดตามการเปลี่ยนแปลง" },
};

/* =========================================================
   HELPERS
========================================================= */

const getConfig = (name?: string | null): TypeConfig =>
  TYPE_CONFIG[String(name || "").toLowerCase().trim()] ?? FALLBACK_CONFIG;

/**
 * จัดระดับจากข้อความ risk_level
 * ลำดับการเช็คสำคัญ: "ไม่เพียงพอ" มีคำว่า "เพียงพอ" อยู่ข้างใน
 * จึงต้องเช็คคำเชิงลบก่อนคำเชิงบวกเสมอ
 */
const levelFromText = (risk?: string | null): Level => {
  const v = String(risk || "").toLowerCase();
  if (!v) return "unknown";
  if (v.includes("ไม่มีความเสี่ยง") || v.includes("ไม่พบ") || v.includes("ไม่มีอาการ")) return "ok";
  if (v.includes("สูง") || v.includes("อันตราย") || v.includes("รุนแรง") || v.includes("มาก")) return "high";
  if (
    v.includes("ไม่เพียงพอ") ||
    v.includes("ปานกลาง") ||
    v.includes("เสี่ยง") ||
    v.includes("แนวโน้ม") ||
    v.includes("ท้วม") ||
    v.includes("ควร")
  )
    return "mid";
  if (v.includes("ปกติ") || v.includes("เพียงพอ") || v.includes("น้อย") || v.includes("ดี")) return "ok";
  return "unknown";
};

const isBloodPressure = (a: Assessment) =>
  String(a.assessment_name || "").toLowerCase().trim() === "blood pressure";

// ค่าที่ใช้แสดง/วาดกราฟ: Blood Pressure ใช้ความดันตัวบน, แบบอื่นใช้ total_score
// คืนค่า NaN ถ้าไม่มีข้อมูล (ระวัง Number(null) = 0)
const scoreOf = (a?: Assessment | null): number => {
  if (!a) return NaN;
  const raw = isBloodPressure(a) ? a.systolic : a.total_score;
  return raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
};

const displayScore = (a: Assessment) => {
  if (isBloodPressure(a)) {
    const sys = Number(a.systolic);
    const dia = Number(a.diastolic);
    if (a.systolic != null && a.diastolic != null && Number.isFinite(sys) && Number.isFinite(dia)) {
      return `${sys}/${dia}`;
    }
    return "-";
  }
  return formatScore(scoreOf(a));
};

const getLevel = (a: Assessment): Level => {
  const cfg = getConfig(a.assessment_name);
  if (cfg.levelFromScore && Number.isFinite(scoreOf(a))) {
    return cfg.levelFromScore(scoreOf(a));
  }
  return levelFromText(a.risk_level);
};

const formatScore = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "-";
  const n = Number(score);
  if (!Number.isFinite(n)) return "-";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const formatDateTime = (date?: string | null) =>
  date
    ? new Date(date).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
    : "-";

const formatShortDate = (date: string) =>
  new Date(date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

const daysSince = (date: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));

const relativeDay = (date: string) => {
  const d = daysSince(date);
  if (d === 0) return "วันนี้";
  if (d === 1) return "เมื่อวาน";
  return `${d} วันที่แล้ว`;
};

/* =========================================================
   PAGE
========================================================= */

export default function DashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const userId = localStorage.getItem("userId");
        // ปรับ key ให้ตรงกับที่ระบบ login เก็บไว้
        setUserName(localStorage.getItem("userName") || "");

        if (!userId) {
          throw new Error("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        }

        const response = await fetch(`/api/dashboard?userId=${encodeURIComponent(userId)}`, {
          method: "GET",
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "ไม่สามารถโหลด Dashboard ได้");
        }
        setData(result);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลได้");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const openResult = (assessment: Assessment) => {
    const type = assessment.assessment_name?.toLowerCase().trim();
    if (type === "physical activity" || type === "กิจกรรมทางกาย") {
      router.push(`/recommendation_physical_activity?assessmentId=${assessment.assessment_id}`);
      return;
    }
    router.push(`/history?assessmentId=${assessment.assessment_id}`);
  };

  return (
    <PageShell>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : data ? (
        <DashboardContent data={data} userName={userName} openResult={openResult} />
      ) : null}
    </PageShell>
  );
}

/* =========================================================
   LAYOUT: แถบเมนูซ้าย + เนื้อหา
   - จอใหญ่: Sidebar อยู่ซ้าย เนื้อหาเลื่อนอยู่ด้านขวา
   - ถ้า Sidebar ของคุณมีระบบซ่อน/เปิดบนมือถืออยู่แล้ว ใช้ได้เลย
========================================================= */

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F6F5F1] text-[#16181D] font-[family-name:var(--font-plex-thai)]">
      <Sidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* =========================================================
   CONTENT
========================================================= */

function DashboardContent({
  data,
  userName,
  openResult,
}: {
  data: DashboardData;
  userName: string;
  openResult: (a: Assessment) => void;
}) {
  const router = useRouter();
  const { summary, latestByType, assessments } = data;
  const latest = summary.latestAssessment;

  const okTypes = latestByType.filter((a) => getLevel(a) === "ok");
  const highTypes = latestByType.filter((a) => getLevel(a) === "high");

  return (
    <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16 flex flex-col gap-8">
      {/* ---------- Greeting ---------- */}
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-[#4F7A4C]">HEALTH DASHBOARD</p>
          <h1 className="mt-1.5 mb-1 font-[family-name:var(--font-anuphan)] text-4xl font-bold leading-tight">
            สวัสดี{userName ? `, ${userName}` : ""}
          </h1>
          <p className="text-[#5E6470] text-base">
            สรุปผลการประเมินสุขภาพของคุณ
            {latest && <> · อัปเดตล่าสุด {formatDateTime(latest.assessed_at)}</>}
          </p>
        </div>
        <button
          onClick={() => router.push("/assessment")}
          className="inline-flex items-center gap-2 min-h-12 px-5 rounded-2xl text-white font-semibold hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: ACCENT, outlineColor: ACCENT }}
        >
          <Plus size={18} strokeWidth={2.4} />
          ทำแบบประเมินใหม่
        </button>
      </section>

      {/* ---------- Priority alert ---------- */}
      {highTypes.length > 0 && <PriorityAlert items={highTypes} />}

      {/* ---------- KPI ---------- */}
      <section className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        <KpiCard
          label="การประเมินทั้งหมด"
          value={summary.totalAssessments}
          unit="ครั้ง"
          note={`ครอบคลุม ${summary.totalTypes} ประเภทแบบประเมิน`}
          icon={ClipboardList}
          iconWrap="bg-[#FBE9EB] text-[#8E1428]"
        />
        <KpiCard
          label="ผลอยู่ในเกณฑ์ปกติ"
          value={okTypes.length}
          unit={`จาก ${latestByType.length} ด้าน`}
          note={okTypes.map((a) => getConfig(a.assessment_name).thaiName || a.assessment_name).join(", ") || "-"}
          icon={CheckCircle2}
          iconWrap="bg-[#E4F1E8] text-[#1D6436]"
        />
        <KpiCard
          label="ผลที่ควรติดตาม"
          value={summary.riskAssessments}
          unit="รายการ"
          note="จากประวัติการประเมินทั้งหมด"
          icon={AlertTriangle}
          iconWrap="bg-[#FBEFD6] text-[#7A4A00]"
        />
        <KpiCard
          label="ประเมินล่าสุด"
          value={latest?.assessment_name ?? "-"}
          note={latest ? `${relativeDay(latest.assessed_at)} · ${formatDateTime(latest.assessed_at)}` : "-"}
          icon={CalendarDays}
          iconWrap="bg-[#E8EEF8] text-[#2B5197]"
          small
        />
      </section>

      {latestByType.length === 0 ? (
        <EmptyState onStart={() => router.push("/assessment")} />
      ) : (
        <>
          {/* ---------- Trend + Risk profile ---------- */}
          <section className="flex flex-wrap gap-4">
            <TrendCard assessments={assessments} />
            <RiskProfile items={latestByType} />
          </section>

          {/* ---------- Assessment cards ---------- */}
          <section className="flex flex-col gap-4">
            <SectionHead eyebrow="HEALTH ASSESSMENTS" title="สรุปผลการประเมิน" aside="ผลล่าสุดของแต่ละแบบประเมิน" />
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {latestByType.map((a) => (
                <AssessmentCard
                  key={a.assessment_id}
                  assessment={a}
                  previous={findPrevious(assessments, a)}
                  onOpen={() => openResult(a)}
                />
              ))}
              <button
                onClick={() => router.push("/assessment")}
                className="min-h-[200px] rounded-[20px] border-[1.5px] border-dashed border-[#D9CFC9] p-6 flex flex-col items-center justify-center gap-2.5 text-center hover:bg-white"
                style={{ color: ACCENT }}
              >
                <span className="w-12 h-12 rounded-full bg-[#FBE9EB] flex items-center justify-center">
                  <Plus size={22} strokeWidth={2.4} />
                </span>
                <span className="font-[family-name:var(--font-anuphan)] font-bold text-[17px]">ทำแบบประเมินใหม่</span>
                <span className="text-[13px] text-[#5E6470]">เลือกจากแบบประเมินทั้งหมด</span>
              </button>
            </div>
          </section>

          {/* ---------- Tips ---------- */}
          <section className="flex flex-wrap gap-4">
            <Recommendations items={latestByType} />
          </section>
        </>
      )}

      {/* ---------- History ---------- */}
      <HistoryTable assessments={assessments} onOpen={openResult} onSeeAll={() => router.push("/history")} total={summary.totalAssessments} />

      <footer className="flex gap-2.5 items-start text-[13px] text-[#5E6470] px-1">
        <Info size={16} className="shrink-0 mt-0.5" />
        <span>
          ผลการประเมินนี้เป็นการคัดกรองเบื้องต้นเพื่อการดูแลสุขภาพตนเอง ไม่ใช่การวินิจฉัยทางการแพทย์
          หากมีอาการหรือข้อกังวล ควรปรึกษาแพทย์หรือบุคลากรทางการแพทย์
        </span>
      </footer>
    </main>
  );
}

const findPrevious = (all: Assessment[], current: Assessment) =>
  all
    .filter(
      (x) =>
        x.assessment_type_id === current.assessment_type_id &&
        new Date(x.assessed_at).getTime() < new Date(current.assessed_at).getTime()
    )
    .sort((a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime())[0];

/* =========================================================
   SMALL PIECES
========================================================= */

function SectionHead({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-[#4F7A4C]">{eyebrow}</p>
        <h2 className="mt-0.5 font-[family-name:var(--font-anuphan)] text-[22px] font-bold">{title}</h2>
      </div>
      {aside && <div className="text-sm text-[#5E6470]">{aside}</div>}
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  note,
  icon: Icon,
  iconWrap,
  small,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note: string;
  icon: LucideIcon;
  iconWrap: string;
  small?: boolean;
}) {
  return (
    <div className="bg-white border border-[#E9E6DE] rounded-[20px] px-6 py-[22px] flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[#5E6470] font-medium">{label}</span>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconWrap}`}>
          <Icon size={20} />
        </span>
      </div>
      <div
        className={`font-[family-name:var(--font-anuphan)] font-bold leading-tight ${small ? "text-[28px]" : "text-[40px]"}`}
      >
        {value} {unit && <span className="text-base font-medium text-[#5E6470]">{unit}</span>}
      </div>
      <div className="text-[13px] text-[#5E6470] truncate">{note}</div>
    </div>
  );
}

function PriorityAlert({ items }: { items: Assessment[] }) {
  const first = items[0];
  return (
    <section
      aria-label="ผลที่ควรได้รับความสนใจ"
      className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5 sm:px-6 rounded-[20px] bg-[#FBE9EB] border border-[#F1C9CF]"
    >
      <span className="w-12 h-12 shrink-0 rounded-[14px] bg-white flex items-center justify-center">
        <AlertTriangle size={24} className="text-[#8E1428]" />
      </span>
      <div className="flex-[1_1_360px]">
        <p className="font-[family-name:var(--font-anuphan)] font-bold text-lg text-[#6E0F1F]">
          ผล {first.assessment_name} ล่าสุด: {first.risk_level} ({displayScore(first)} {getConfig(first.assessment_name).unit ?? "คะแนน"})
          {items.length > 1 && ` และอีก ${items.length - 1} รายการ`}
        </p>
        <p className="text-[#5A2A31]">
          แนะนำให้พูดคุยกับผู้เชี่ยวชาญ หากรู้สึกไม่ไหว สามารถโทรสายด่วนสุขภาพจิต 1323 ได้ตลอด 24 ชั่วโมง
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <a
          href="#recommendations"
          className="min-h-11 px-4 inline-flex items-center rounded-xl bg-white text-[#8E1428] font-semibold border border-[#F1C9CF]"
        >
          ดูคำแนะนำ
        </a>
        <a href="tel:1323" className="min-h-11 px-4 inline-flex items-center gap-2 rounded-xl bg-[#8E1428] text-white font-semibold">
          <Phone size={16} />
          โทร 1323
        </a>
      </div>
    </section>
  );
}

/* =========================================================
   TREND CHART (SVG ล้วน ไม่ต้องติดตั้ง library)
========================================================= */

function TrendCard({ assessments }: { assessments: Assessment[] }) {
  // จัดกลุ่มตามประเภท เรียงจากเก่าไปใหม่ เก็บ 8 ครั้งล่าสุด
  const groups = useMemo(() => {
    const map = new Map<number, Assessment[]>();
    assessments.forEach((a) => {
      const list = map.get(a.assessment_type_id) ?? [];
      list.push(a);
      map.set(a.assessment_type_id, list);
    });
    return Array.from(map.values())
      .map((list) =>
        list
          .filter((a) => Number.isFinite(scoreOf(a)))
          .sort((a, b) => new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime())
          .slice(-8)
      )
      .filter((list) => list.length > 0)
      .sort((a, b) => b.length - a.length);
  }, [assessments]);

  const [selectedType, setSelectedType] = useState<number | null>(null);
  const active = groups.find((g) => g[0].assessment_type_id === selectedType) ?? groups[0];

  if (!active) return null;

  const cfg = getConfig(active[0].assessment_name);
  const scores = active.map((a) => scoreOf(a));
  const min = cfg.min ?? 0;
  const max = cfg.chartMax ?? cfg.max ?? (Math.max(...scores) * 1.25 || 1);
  const range = max - min || 1;

  const pts = active.map((a, i) => {
    const x = active.length === 1 ? 50 : 10 + i * (80 / (active.length - 1));
    const y = ((max - scoreOf(a)) / range) * 100;
    return { x, y: Math.min(100, Math.max(0, y)), a };
  });
  const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const dotPath = pts.map((p) => `M${p.x} ${p.y}h0`).join(" ");

  const last = scores[scores.length - 1];
  const prev = scores.length > 1 ? scores[scores.length - 2] : null;
  const delta = prev === null ? null : Math.round((last - prev) * 100) / 100;

  return (
    <div className="flex-[2_1_560px] min-w-0 bg-white border border-[#E9E6DE] rounded-[20px] p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHead eyebrow="TREND" title="แนวโน้มคะแนน" />
        <div role="tablist" aria-label="เลือกแบบประเมิน" className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[#F3F1EC]">
          {groups.map((g) => {
            const id = g[0].assessment_type_id;
            const isActive = id === active[0].assessment_type_id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedType(id)}
                className={`px-3.5 min-h-9 rounded-[9px] text-sm ${
                  isActive ? "bg-white font-semibold shadow-sm" : "text-[#4A4F59] hover:text-[#16181D]"
                }`}
              >
                {g[0].assessment_name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="font-[family-name:var(--font-anuphan)] text-[34px] font-bold">{displayScore(active[active.length - 1])}</span>
        <span className="text-[#5E6470]">{cfg.unit ?? (cfg.max ? `คะแนน (เต็ม ${cfg.max})` : "คะแนน")}</span>
        <DeltaPill delta={delta} />
      </div>

      <div className="relative h-60 mt-9 mb-7">
        {/* แถบเกณฑ์ */}
        {(cfg.bands ?? []).map((b) => (
          <div
            key={b.label}
            className="absolute inset-x-0 border-t border-dashed border-[#DDD8CD] flex justify-end items-start px-2 py-1"
            style={{
              top: `${((max - b.to) / range) * 100}%`,
              height: `${((b.to - b.from) / range) * 100}%`,
              background: b.color,
            }}
          >
            <span className="text-xs text-[#4A4F59]">{b.label}</span>
          </div>
        ))}
        {!cfg.bands && <div className="absolute inset-0 rounded-xl bg-[#FBF8F4]" />}

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full overflow-visible"
          aria-label={`กราฟคะแนน ${active[0].assessment_name}`}
          role="img"
        >
          <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={dotPath} fill="none" stroke={ACCENT} strokeWidth={14} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={dotPath} fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>

        {pts.map((p) => (
          <div key={p.a.assessment_id}>
            <div
              className="absolute -translate-x-1/2 px-2 py-0.5 rounded-lg bg-[#16181D] text-white text-[13px] font-semibold whitespace-nowrap"
              style={{ left: `${p.x}%`, top: `calc(${p.y}% - 36px)` }}
            >
              {displayScore(p.a)}
            </div>
            <div
              className="absolute -bottom-7 -translate-x-1/2 text-xs text-[#5E6470] whitespace-nowrap"
              style={{ left: `${p.x}%` }}
            >
              {formatShortDate(p.a.assessed_at)}
            </div>
          </div>
        ))}
      </div>

      {active.length < 2 && (
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#F3F1EC] text-[#4A4F59] text-sm">
          <Info size={18} />
          มีข้อมูลเพียง 1 ครั้ง ทำแบบประเมินนี้อีกครั้งเพื่อดูแนวโน้ม
        </div>
      )}
    </div>
  );
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null)
    return <span className="px-2.5 py-1 rounded-full text-[13px] font-semibold bg-[#F3F1EC] text-[#4A4F59]">ข้อมูล 1 ครั้ง</span>;
  if (delta === 0)
    return <span className="px-2.5 py-1 rounded-full text-[13px] font-semibold bg-[#F3F1EC] text-[#4A4F59]">คงที่จากครั้งก่อน</span>;
  // หมายเหตุ: ใช้สีแดงเมื่อคะแนนเพิ่ม เพราะแบบประเมินส่วนใหญ่ คะแนนสูง = เสี่ยงมาก
  const up = delta > 0;
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[13px] font-semibold ${
        up ? "bg-[#FBE9EB] text-[#8E1428]" : "bg-[#E4F1E8] text-[#1D6436]"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)} จากครั้งก่อน
    </span>
  );
}

/* =========================================================
   RISK PROFILE
========================================================= */

function RiskProfile({ items }: { items: Assessment[] }) {
  const sorted = [...items].sort((a, b) => LEVEL_STYLE[getLevel(b)].n - LEVEL_STYLE[getLevel(a)].n);

  return (
    <div className="flex-[1_1_340px] min-w-0 bg-white border border-[#E9E6DE] rounded-[20px] p-6 flex flex-col gap-4">
      <SectionHead eyebrow="RISK PROFILE" title="ระดับความเสี่ยงรายด้าน" />
      <ul className="flex flex-col">
        {sorted.map((a) => {
          const cfg = getConfig(a.assessment_name);
          const level = getLevel(a);
          const s = LEVEL_STYLE[level];
          return (
            <li key={a.assessment_id} className="flex items-center gap-3 py-3 border-b border-[#F0EEE8] last:border-0">
              <div className="flex-auto min-w-0">
                <p className="font-semibold text-sm">
                  {cfg.thaiName || a.assessment_name}{" "}
                  <span className="font-normal text-[#5E6470]">({a.assessment_name})</span>
                </p>
                <p className="text-[13px] text-[#5E6470] truncate">
                  {a.risk_level || "-"}
                  {cfg.max ? ` · ${displayScore(a)}/${cfg.max}` : ""}
                </p>
              </div>
              <div className="flex gap-1" aria-label={s.label}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`w-[22px] h-2 rounded ${i < s.n ? s.seg : "bg-[#ECEAE4]"}`} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-3 text-xs text-[#4A4F59]">
        {(["ok", "mid", "high"] as Level[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-[3px] ${LEVEL_STYLE[l].seg}`} />
            {LEVEL_STYLE[l].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ASSESSMENT CARD
========================================================= */

function AssessmentCard({
  assessment: a,
  previous,
  onOpen,
}: {
  assessment: Assessment;
  previous?: Assessment;
  onOpen: () => void;
}) {
  const cfg = getConfig(a.assessment_name);
  const level = getLevel(a);
  const s = LEVEL_STYLE[level];
  const Icon = cfg.icon;
  const score = scoreOf(a);
  const delta = previous ? Math.round((score - scoreOf(previous)) * 100) / 100 : null;
  const pct = cfg.max ? Math.min(100, Math.max(0, ((score - (cfg.min ?? 0)) / (cfg.max - (cfg.min ?? 0))) * 100)) : null;

  return (
    <button
      onClick={onOpen}
      className="text-left bg-white border border-[#E9E6DE] rounded-[20px] p-[22px] flex flex-col gap-3.5 hover:border-[#D9CFC9] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ outlineColor: ACCENT }}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.soft} ${s.text}`}>
          <Icon size={22} />
        </span>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.pill}`}>{s.label}</span>
      </div>

      <div>
        <p className="font-[family-name:var(--font-anuphan)] text-xl font-bold">{a.assessment_name}</p>
        <p className="text-[13px] text-[#5E6470]">
          {cfg.thaiName && `${cfg.thaiName} · `}
          {formatShortDate(a.assessed_at)}
        </p>
      </div>

      <div className="flex w-full items-baseline gap-1.5">
        <span className={`font-[family-name:var(--font-anuphan)] text-[34px] font-bold ${s.text}`}>{displayScore(a)}</span>
        <span className="text-[#5E6470]">{cfg.max ? `/ ${cfg.max}` : cfg.unit ?? ""}</span>
        {delta !== null && delta !== 0 ? (
          <span className={`ml-auto text-[13px] font-semibold ${delta > 0 ? "text-[#8E1428]" : "text-[#1D6436]"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} จากครั้งก่อน
          </span>
        ) : (
          <span className={`ml-auto text-sm font-semibold text-right line-clamp-1 ${s.text}`}>{a.risk_level}</span>
        )}
      </div>

      {pct !== null && (
        <div className="w-full h-1.5 rounded bg-[#F0EEE8]">
          <div className={`h-1.5 rounded ${s.seg}`} style={{ width: `${pct}%` }} />
        </div>
      )}

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold" style={{ color: ACCENT }}>
        ดูผล <ArrowRight size={16} />
      </span>
    </button>
  );
}

/* =========================================================
   RECOMMENDATIONS
========================================================= */

function Recommendations({ items }: { items: Assessment[] }) {
  const needAttention = items
    .filter((a) => getLevel(a) === "high" || getLevel(a) === "mid")
    .sort((a, b) => LEVEL_STYLE[getLevel(b)].n - LEVEL_STYLE[getLevel(a)].n);
  const goodOnes = items.filter((a) => getLevel(a) === "ok");

  const tips = needAttention.slice(0, 4).map((a) => {
    const cfg = getConfig(a.assessment_name);
    return {
      key: a.assessment_id,
      level: getLevel(a),
      source: `จาก ${a.assessment_name}`,
      title: cfg.tip.title,
      // ใช้คำแนะนำจากฐานข้อมูลก่อน ถ้าไม่มีค่อยใช้ข้อความสำรอง
      text: a.recommendation_text?.trim() || cfg.tip.text,
    };
  });

  if (tips.length < 4 && goodOnes.length > 0) {
    tips.push({
      key: -1,
      level: "ok",
      source: `จาก ${goodOnes.map((a) => a.assessment_name).join(", ")}`,
      title: "รักษาระดับที่ดีไว้",
      text: "ผลอยู่ในเกณฑ์ปกติ ดูแลตัวเองแบบนี้ต่อไป และประเมินซ้ำตามรอบ",
    });
  }

  return (
    <div
      id="recommendations"
      className="flex-[2_1_560px] min-w-0 bg-white border border-[#E9E6DE] rounded-[20px] p-6 flex flex-col gap-4 scroll-mt-6"
    >
      <SectionHead eyebrow="FOR YOU" title="คำแนะนำจากผลประเมินของคุณ" />
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        {tips.map((t) => (
          <div key={t.key} className="p-[18px] rounded-2xl bg-[#FBF8F4] flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${LEVEL_STYLE[t.level].seg}`} />
              <span className={`text-xs font-semibold ${LEVEL_STYLE[t.level].text}`}>{t.source}</span>
            </div>
            <p className="font-semibold">{t.title}</p>
            <p className="text-sm text-[#4A4F59] whitespace-pre-line">{t.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   HISTORY TABLE
========================================================= */

function HistoryTable({
  assessments,
  onOpen,
  onSeeAll,
  total,
}: {
  assessments: Assessment[];
  onOpen: (a: Assessment) => void;
  onSeeAll: () => void;
  total: number;
}) {
  const [filter, setFilter] = useState<"all" | Category>("all");
  const chips: { key: "all" | Category; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "mind", label: "สุขภาพจิต" },
    { key: "body", label: "สุขภาพกาย" },
  ];

  const rows = assessments
    .filter((a) => filter === "all" || getConfig(a.assessment_name).category === filter)
    .slice(0, 8);

  return (
    <section className="bg-white border border-[#E9E6DE] rounded-[20px] p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead eyebrow="RECENT HISTORY" title="ประวัติการประเมินล่าสุด" />
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              aria-pressed={filter === c.key}
              className={`min-h-10 px-3.5 rounded-full text-sm border ${
                filter === c.key
                  ? "bg-[#16181D] text-white border-[#16181D]"
                  : "bg-white text-[#4A4F59] border-[#E7E4DC] hover:bg-[#F6F5F1]"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button onClick={onSeeAll} className="ml-2 px-1 py-2 font-semibold hover:underline" style={{ color: ACCENT }}>
            ดูทั้งหมด {total} รายการ
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-[#5E6470]">ยังไม่มีประวัติการประเมินในหมวดนี้</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-[#5E6470]">
                <th className="px-3 py-2.5 font-medium border-b border-[#E9E6DE]">แบบประเมิน</th>
                <th className="px-3 py-2.5 font-medium border-b border-[#E9E6DE]">วันที่</th>
                <th className="px-3 py-2.5 font-medium border-b border-[#E9E6DE] text-right">คะแนน</th>
                <th className="px-3 py-2.5 font-medium border-b border-[#E9E6DE]">ผลการประเมิน</th>
                <th className="px-3 py-2.5 border-b border-[#E9E6DE]">
                  <span className="sr-only">ดูผล</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const cfg = getConfig(a.assessment_name);
                const s = LEVEL_STYLE[getLevel(a)];
                return (
                  <tr key={a.assessment_id} className="hover:bg-[#FBFAF8]">
                    <td className="px-3 py-3.5 border-b border-[#F0EEE8]">
                      <p className="font-semibold">{a.assessment_name}</p>
                      {cfg.thaiName && <p className="text-xs text-[#5E6470]">{cfg.thaiName}</p>}
                    </td>
                    <td className="px-3 py-3.5 border-b border-[#F0EEE8] text-[#4A4F59] whitespace-nowrap">
                      {formatDateTime(a.assessed_at)}
                    </td>
                    <td className="px-3 py-3.5 border-b border-[#F0EEE8] text-right font-[family-name:var(--font-anuphan)] font-bold text-base whitespace-nowrap">
                      {displayScore(a)}
                    </td>
                    <td className="px-3 py-3.5 border-b border-[#F0EEE8]">
                      <span className={`inline-block px-3 py-1 rounded-full text-[13px] font-semibold ${s.pill}`}>
                        {a.risk_level || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 border-b border-[#F0EEE8] text-right">
                      <button
                        onClick={() => onOpen(a)}
                        aria-label={`ดูผล ${a.assessment_name}`}
                        className="inline-flex w-10 h-10 rounded-[10px] border border-[#E7E4DC] items-center justify-center hover:bg-[#F6F5F1]"
                      >
                        <ArrowRight size={18} className="text-[#4A4F59]" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   STATES
========================================================= */

function LoadingState() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center" role="status">
        <div className="w-10 h-10 border-4 border-[#E7E4DC] rounded-full animate-spin mx-auto mb-4" style={{ borderTopColor: ACCENT }} />
        <p className="text-[#5E6470]">กำลังโหลด Dashboard...</p>
      </div>
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-xl mx-auto mt-16 bg-white border border-[#F1C9CF] rounded-3xl p-8 text-center">
        <AlertTriangle size={44} className="text-[#8E1428] mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">ไม่สามารถโหลดข้อมูลได้</h1>
        <p className="text-[#5E6470] mb-6">{message}</p>
        <button onClick={onRetry} className="min-h-11 px-5 rounded-xl text-white font-semibold" style={{ background: ACCENT }}>
          ลองอีกครั้ง
        </button>
      </div>
    </main>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="bg-white border border-[#E9E6DE] rounded-[20px] p-12 text-center">
      <ClipboardList size={48} className="text-[#C9C4BA] mx-auto mb-4" />
      <h3 className="text-lg font-semibold">ยังไม่มีผลการประเมิน</h3>
      <p className="text-[#5E6470] mt-1 mb-6">เริ่มทำแบบประเมินแรก แล้วผลสรุปจะแสดงที่นี่</p>
      <button onClick={onStart} className="min-h-11 px-5 rounded-xl text-white font-semibold" style={{ background: ACCENT }}>
        เริ่มทำแบบประเมิน
      </button>
    </div>
  );
}