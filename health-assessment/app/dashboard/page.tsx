"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationBell from "@/app/components/NotificationBell";

import Sidebar from "@/app/components/Sidebar";
import { riskLevelOf, type Level } from "@/lib/riskLevel";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Footprints,
  HeartPulse,
  Info,
  MessageCircle,
  Moon,
  Plus,
  Ruler,
  Zap,
  type LucideIcon,
} from "lucide-react";

/* =========================================================
   TYPES (ตรงกับ /api/dashboard)
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
  self_harm_flag?: boolean; // 9Q: ตอบข้อคิดทำร้ายตนเอง > 0
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
const ASSESSMENT_HREF = "/assessment-type";

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
      // ชื่อช่วงตามเอกสารอ้างอิง ตารางที่ 12
      { from: 15, to: 18.5, label: "ผอม", color: BAND.blue },
      { from: 18.5, to: 23, label: "ปกติ", color: BAND.green },
      { from: 23, to: 25, label: "น้ำหนักเกิน", color: BAND.amber },
      { from: 25, to: 30, label: "อ้วน", color: BAND.red },
      { from: 30, to: 35, label: "อ้วนอันตราย", color: BAND.red2 },
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

const isBloodPressure = (a: Assessment) =>
  String(a.assessment_name || "").toLowerCase().trim() === "blood pressure";

// ค่าที่ใช้แสดง/วาดกราฟ: Blood Pressure ใช้ความดันตัวบน, แบบอื่นใช้ total_score
// คืนค่า NaN ถ้าไม่มีข้อมูล (ระวัง Number(null) = 0)
const scoreOf = (a?: Assessment | null): number => {
  if (!a) return NaN;
  const raw = isBloodPressure(a) ? a.systolic : a.total_score;
  return raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
};

const formatScore = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "-";
  const n = Number(score);
  if (!Number.isFinite(n)) return "-";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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
  // 9Q ที่ตอบข้อคิดทำร้ายตนเอง = เสี่ยงสูงเสมอ ไม่ว่าคะแนนรวมเท่าไร
  if (a.self_harm_flag) return "high";
  const cfg = getConfig(a.assessment_name);
  if (cfg.levelFromScore && Number.isFinite(scoreOf(a))) {
    return cfg.levelFromScore(scoreOf(a));
  }
  return riskLevelOf(a.assessment_name, a.risk_level);
};

// หน้าผลและคำแนะนำของแต่ละแบบประเมิน (key = assessment_name ตัวพิมพ์เล็ก)
const RESULT_PAGE: Record<string, string> = {
  "thai cvd": "/recommendation-CVD",
  "diabetes tds": "/recommendation_diabetes",
  "blood pressure": "/recommendation_DB",
  bmi: "/recommendation_BMI",
  "phq-2": "/recommendation_depression_2q",
  "9q": "/recommendation_depression_9q",
  stress: "/recommendation_stress",
  sleep: "/recommendation_sleep",
  diet: "/recommendation_diet",
  alcohol: "/recommendation_alcohol",
  smoking: "/recommendation_smoking",
  "physical activity": "/recommendation_physical_activity",
  กิจกรรมทางกาย: "/recommendation_physical_activity",
};

const formatShortDate = (date: string) =>
  new Date(date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

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
        // ใช้ key เดียวกับที่หน้า login เก็บไว้ ("username")
        setUserName(localStorage.getItem("username") || "");

        if (!userId) {
          throw new Error("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        }

        // กระดิ่งแจ้งเตือน (NotificationBell) โหลดการแจ้งเตือนเอง
        const dashRes = await fetch(`/api/dashboard?userId=${encodeURIComponent(userId)}`, {
          method: "GET",
          cache: "no-store",
        });

        // session หมดอายุ → กลับไปหน้า login
        if (dashRes.status === 401) {
          localStorage.removeItem("userId");
          router.replace("/login");
          return;
        }

        const result = await dashRes.json();

        if (!dashRes.ok) {
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
  }, [router]);

  // ไปหน้าผลและคำแนะนำของแบบประเมินนั้น (ไม่มีหน้าเฉพาะ → หน้าประวัติ)
  const openResult = (assessment: Assessment) => {
    const page = RESULT_PAGE[assessment.assessment_name?.toLowerCase().trim() ?? ""];
    router.push(`${page ?? "/history"}?assessmentId=${assessment.assessment_id}`);
  };

  return (
    <PageShell>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : data ? (
        <DashboardContent
          data={data}
          userName={userName}
          openResult={openResult}
        />
      ) : null}
    </PageShell>
  );
}

/* =========================================================
   LAYOUT: แถบเมนูซ้าย + เนื้อหา
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

  // ส่วนที่ไม่จำเป็นต้องเห็นตลอด ซ่อนไว้ก่อน กดดูได้ (จำสถานะไว้ในเบราว์เซอร์)
  const [allCardsOpen, toggleAllCards] = useToggle("dashboard.cards", false);
  const [trendOpen, toggleTrend] = useToggle("dashboard.trend", false);
  const [tipsOpen, toggleTips] = useToggle("dashboard.tips", false);
  const urgent = latestByType.some((a) => a.self_harm_flag);

  // แสดงผลที่เสี่ยงก่อน ถ้าย่ออยู่จะเห็นเฉพาะ 4 ใบแรก
  const sortedTypes = [...latestByType].sort((a, b) => LEVEL_STYLE[getLevel(b)].n - LEVEL_STYLE[getLevel(a)].n);
  const visibleTypes = allCardsOpen ? sortedTypes : sortedTypes.slice(0, CARD_PREVIEW);

  return (
    <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16 flex flex-col gap-8">
      {/* ---------- Greeting ---------- */}
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex items-center gap-5 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[0.18em] text-[#4F7A4C]">HEALTH DASHBOARD</p>
            <h1 className="mt-1.5 mb-1 font-[family-name:var(--font-anuphan)] text-2xl sm:text-3xl font-bold leading-tight">
              สวัสดี
              {userName && (
                <>
                  ,{" "}
                  <span
                    className="inline-block max-w-full truncate align-bottom px-1"
                    style={{
                      color: ACCENT,
                      background: "linear-gradient(transparent 68%, rgba(215,53,79,0.16) 68%)",
                    }}
                  >
                    คุณ{userName}
                  </span>
                </>
              )}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <NotificationBell />

          <Link
            href={ASSESSMENT_HREF}
            className="inline-flex items-center gap-2 min-h-12 px-5 rounded-2xl text-white font-semibold hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: ACCENT, outlineColor: ACCENT }}
          >
            <Plus size={18} strokeWidth={2.4} />
            ทำแบบประเมินใหม่
          </Link>
        </div>
      </section>

      {/* ---------- KPI ---------- */}
      <section className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        <KpiCard
          label="การประเมินทั้งหมด"
          value={summary.totalAssessments}
          unit="ครั้ง"
          icon={ClipboardList}
          iconWrap="bg-[#FBE9EB] text-[#8E1428]"
        />
        <KpiCard
          label="ผลอยู่ในเกณฑ์ปกติ"
          value={okTypes.length}
          unit={`จาก ${latestByType.length} ด้าน`}
          icon={CheckCircle2}
          iconWrap="bg-[#E4F1E8] text-[#1D6436]"
        />
        <KpiCard
          label="ผลที่ควรติดตาม"
          value={summary.riskAssessments}
          unit="รายการ"
          icon={AlertTriangle}
          iconWrap="bg-[#FBEFD6] text-[#7A4A00]"
        />
        <KpiCard
          label="ประเมินล่าสุด"
          value={latest?.assessment_name ?? "-"}
          icon={CalendarDays}
          iconWrap="bg-[#E8EEF8] text-[#2B5197]"
          small
        />
      </section>

      {latestByType.length === 0 ? (
        <EmptyState onStart={() => router.push(ASSESSMENT_HREF)} />
      ) : (
        <>
          {/* ---------- Assessment cards ---------- */}
          <section className="flex flex-col gap-4">
            <SectionHead
              eyebrow="HEALTH ASSESSMENTS"
              title="สรุปผลการประเมิน"
              aside={
                sortedTypes.length > CARD_PREVIEW && (
                  <ToggleButton
                    open={allCardsOpen}
                    onClick={toggleAllCards}
                    controls="assessment-cards"
                    showLabel={`ดูทั้งหมด (${sortedTypes.length})`}
                    hideLabel="ย่อ"
                  />
                )
              }
            />
            <div id="assessment-cards" className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {visibleTypes.map((a) => (
                <AssessmentCard
                  key={a.assessment_id}
                  assessment={a}
                  previous={findPrevious(assessments, a)}
                  onOpen={() => openResult(a)}
                />
              ))}
              {(allCardsOpen || sortedTypes.length <= CARD_PREVIEW) && (
                <Link
                  href={ASSESSMENT_HREF}
                  className="min-h-[200px] rounded-[20px] border-[1.5px] border-dashed border-[#D9CFC9] p-6 flex flex-col items-center justify-center gap-2.5 text-center hover:bg-white"
                  style={{ color: ACCENT }}
                >
                  <span className="w-12 h-12 rounded-full bg-[#FBE9EB] flex items-center justify-center">
                    <Plus size={22} strokeWidth={2.4} />
                  </span>
                  <span className="font-[family-name:var(--font-anuphan)] font-bold text-[17px]">ทำแบบประเมินใหม่</span>
                </Link>
              )}
            </div>
          </section>

          {/* ---------- Tips ---------- */}
          <section className="flex flex-wrap gap-4">
            {/* มีผลพบความคิดทำร้ายตนเอง → เปิดคำแนะนำ (สายด่วน 1323) ไว้เสมอ */}
            <Recommendations
              items={latestByType}
              open={tipsOpen || urgent}
              onToggle={urgent ? undefined : toggleTips}
            />
          </section>

          {/* ---------- Trend (กราฟแมงมุม) ---------- */}
          <section className="flex flex-col gap-4">
            <SectionHead
              eyebrow="TREND"
              title="แนวโน้มคะแนน"
              aside={<ToggleButton open={trendOpen} onClick={toggleTrend} controls="dashboard-insights" />}
            />
            {trendOpen && (
              <div id="dashboard-insights">
                <TrendCard items={latestByType} assessments={assessments} />
              </div>
            )}
          </section>
        </>
      )}
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

const CARD_PREVIEW = 4;

// สถานะเปิด/ปิดของแต่ละส่วน จำไว้ใน localStorage (ใช้ไม่ได้ก็ใช้ค่าเริ่มต้น)
function useToggle(key: string, initial: boolean) {
  const [open, setOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? initial : saved === "1";
    } catch {
      return initial;
    }
  });
  const setOpen = (value: boolean) => {
    setOpenState(value);
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {}
  };
  return [open, () => setOpen(!open)] as const;
}

function ToggleButton({
  open,
  onClick,
  controls,
  showLabel = "แสดง",
  hideLabel = "ซ่อน",
}: {
  open: boolean;
  onClick: () => void;
  controls: string;
  showLabel?: string;
  hideLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      className="inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl bg-white border border-[#E7E4DC] font-semibold text-[#16181D] hover:bg-[#F6F5F1]"
    >
      {open ? hideLabel : showLabel}
      <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  iconWrap,
  small,
}: {
  label: string;
  value: string | number;
  unit?: string;
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
    </div>
  );
}

/* =========================================================
   TREND: กราฟแมงมุม (SVG ล้วน)
   - แต่ละแกน = แบบประเมิน 1 ด้าน
   - วงจากในออกนอก = ปกติ → ควรระวัง → ควรพบผู้เชี่ยวชาญ
   - เส้นทึบ = ผลล่าสุด, เส้นประ = ผลครั้งก่อน
========================================================= */

// แถบเลือก "ทั้งหมด" (กราฟแมงมุม) หรือดูทีละแบบประเมิน (กราฟเส้นตามเวลา)
function TrendCard({ items, assessments }: { items: Assessment[]; assessments: Assessment[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const history = (typeId: number) =>
    assessments
      .filter((a) => a.assessment_type_id === typeId && Number.isFinite(scoreOf(a)))
      .sort((a, b) => new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime())
      .slice(-8);
  const types = items.filter((a) => history(a.assessment_type_id).length > 0);
  const active = types.find((a) => a.assessment_type_id === selected);

  const tab = (key: number | null, label: string) => {
    const isActive = key === (active?.assessment_type_id ?? null);
    return (
      <button
        key={key ?? "all"}
        role="tab"
        aria-selected={isActive}
        onClick={() => setSelected(key)}
        className={`px-3.5 min-h-9 rounded-[9px] text-sm ${
          isActive ? "bg-white font-semibold shadow-sm" : "text-[#4A4F59] hover:text-[#16181D]"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="bg-white border border-[#E9E6DE] rounded-[20px] p-6 flex flex-col gap-5">
      <div role="tablist" aria-label="เลือกแบบประเมิน" className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-[#F3F1EC] self-start">
        {tab(null, "ทั้งหมด")}
        {types.map((a) => tab(a.assessment_type_id, a.assessment_name))}
      </div>
      {active ? (
        <TypeTrend key={active.assessment_type_id} list={history(active.assessment_type_id)} />
      ) : (
        <RadarCard items={items} assessments={assessments} />
      )}
    </div>
  );
}

type AnswerScore = { questionId: number; question: string; answer: string; score: number | null; maxScore: number | null };

// แบบประเมินเดียว: ถ้ามีคะแนนรายข้อตั้งแต่ 3 ข้อ แสดงกราฟแมงมุมรายข้อ ไม่อย่างนั้นใช้กราฟเส้นตามเวลา
function TypeTrend({ list }: { list: Assessment[] }) {
  const latest = list[list.length - 1];
  const previous = list.length > 1 ? list[list.length - 2] : undefined;
  const [answers, setAnswers] = useState<{ latest: AnswerScore[]; previous: AnswerScore[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = (id?: number) =>
      id
        ? fetch(`/api/history/answers?assessmentId=${id}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => (d?.success ? (d.answers as AnswerScore[]) : []))
        : Promise.resolve([] as AnswerScore[]);
    Promise.all([load(latest.assessment_id), load(previous?.assessment_id)])
      .then(([l, p]) => !cancelled && setAnswers({ latest: l, previous: p }))
      .catch(() => !cancelled && setAnswers({ latest: [], previous: [] }));
    return () => {
      cancelled = true;
    };
  }, [latest.assessment_id, previous?.assessment_id]);

  if (!answers) {
    return <p className="py-16 text-center text-sm text-[#5E6470]">กำลังโหลด...</p>;
  }

  const scored = answers.latest.filter((r) => r.score !== null && r.maxScore !== null && r.maxScore > 0);
  // ไม่มีคะแนนรายข้อพอ → ใช้แมงมุมตามครั้งที่ประเมิน (ต้องมีอย่างน้อย 3 ครั้ง) ไม่งั้นใช้กราฟเส้น
  if (scored.length < 3) return list.length >= 3 ? <HistoryRadar list={list} /> : <ScoreTrend list={list} />;

  const prevById = new Map(answers.previous.map((r) => [r.questionId, r]));
  const cfg = getConfig(latest.assessment_name);
  const scores = list.map((a) => scoreOf(a));
  const delta = scores.length > 1 ? Math.round((scores[scores.length - 1] - scores[scores.length - 2]) * 100) / 100 : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="font-[family-name:var(--font-anuphan)] text-[34px] font-bold">{displayScore(latest)}</span>
        <span className="text-[#5E6470]">{cfg.unit ?? (cfg.max ? `คะแนน (เต็ม ${cfg.max})` : "คะแนน")}</span>
        <span className={`px-2.5 py-1 rounded-full text-[13px] font-semibold ${LEVEL_STYLE[getLevel(latest)].pill}`}>
          {latest.risk_level || LEVEL_STYLE[getLevel(latest)].label}
        </span>
        <DeltaPill delta={delta} />
      </div>

      <QuestionRadar rows={scored} prevById={previous ? prevById : null} />

      <ol className="grid gap-x-8 sm:grid-cols-2 text-sm">
        {scored.map((r, i) => {
          const prev = prevById.get(r.questionId);
          return (
            <li key={r.questionId} className="flex gap-3 py-2.5 border-b border-[#F0EEE8]">
              <span className="w-6 shrink-0 font-semibold text-[#5E6470]">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[#16181D]">{r.question}</span>
                <span className="block text-[13px] text-[#5E6470]">{r.answer}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold">
                  {r.score}/{r.maxScore}
                </span>
                {prev?.score != null && <span className="block text-xs text-[#8B9099]">เดิม {prev.score}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// กราฟแมงมุมตามครั้งที่ประเมิน: แต่ละแฉก = 1 ครั้ง (เก่า → ใหม่ ตามเข็มนาฬิกา)
// วงพื้นหลัง = ช่วงเกณฑ์ของแบบประเมินนั้น ระยะจากกลาง = คะแนน
function HistoryRadar({ list }: { list: Assessment[] }) {
  const latest = list[list.length - 1];
  const cfg = getConfig(latest.assessment_name);
  const scores = list.map((a) => scoreOf(a));
  const min = cfg.min ?? 0;
  const max = cfg.chartMax ?? cfg.max ?? (Math.max(...scores) * 1.25 || 1);
  const range = max - min || 1;
  const ratio = (v: number) => Math.min(1, Math.max(0, (v - min) / range));
  const delta = Math.round((scores[scores.length - 1] - scores[scores.length - 2]) * 100) / 100;

  const n = list.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, r: number) => [Math.cos(angle(i)) * r * RADAR_R, Math.sin(angle(i)) * r * RADAR_R];
  const ring = (r: number) => list.map((_, i) => point(i, r).join(",")).join(" ");
  const pts = list.map((a, i) => point(i, ratio(scoreOf(a))));
  const bands = [...(cfg.bands ?? [])].sort((a, b) => b.to - a.to);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="font-[family-name:var(--font-anuphan)] text-[34px] font-bold">{displayScore(latest)}</span>
        <span className="text-[#5E6470]">{cfg.unit ?? (cfg.max ? `คะแนน (เต็ม ${cfg.max})` : "คะแนน")}</span>
        <span className={`px-2.5 py-1 rounded-full text-[13px] font-semibold ${LEVEL_STYLE[getLevel(latest)].pill}`}>
          {latest.risk_level || LEVEL_STYLE[getLevel(latest)].label}
        </span>
        <DeltaPill delta={delta} />
      </div>

      <div className="flex flex-col items-center gap-3">
        <svg
          viewBox="-170 -140 340 280"
          className="w-full max-w-[520px] h-auto"
          role="img"
          aria-label={`กราฟแมงมุมคะแนน ${latest.assessment_name} ${n} ครั้งล่าสุด: ${list
            .map((a) => `${formatShortDate(a.assessed_at)} ${displayScore(a)}`)
            .join(", ")}`}
        >
          {bands.length > 0
            ? bands.map((b) => <polygon key={b.label} points={ring(ratio(b.to))} fill={b.color} stroke="#E4DFD4" strokeWidth={1} />)
            : [1, 0.75, 0.5, 0.25].map((r, k) => (
                <polygon key={r} points={ring(r)} fill={k % 2 ? "#FFFFFF" : "#FBF8F4"} stroke="#E4DFD4" strokeWidth={1} />
              ))}
          {list.map((_, i) => {
            const [x, y] = point(i, 1);
            return <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="#E4DFD4" strokeWidth={1} />;
          })}
          <polygon
            points={pts.map((p) => p.join(",")).join(" ")}
            fill={ACCENT}
            fillOpacity={0.12}
            stroke={ACCENT}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {list.map((a, i) => {
            const isLatest = i === n - 1;
            return (
              <circle
                key={a.assessment_id}
                cx={pts[i][0]}
                cy={pts[i][1]}
                r={isLatest ? 6 : 4}
                fill={isLatest ? ACCENT : "#fff"}
                stroke={ACCENT}
                strokeWidth={2}
              >
                <title>{`${formatShortDate(a.assessed_at)}: ${displayScore(a)}`}</title>
              </circle>
            );
          })}
          {list.map((a, i) => {
            const [x, y] = point(i, 1.16);
            const cos = Math.cos(angle(i));
            const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
            const isLatest = i === n - 1;
            return (
              <text key={a.assessment_id} x={x} y={y - 4} textAnchor={anchor} fontSize={10}>
                <tspan x={x} fill="#5E6470">
                  {formatShortDate(a.assessed_at)}
                </tspan>
                <tspan x={x} dy={12} fill={isLatest ? ACCENT : "#16181D"} fontWeight={700}>
                  {displayScore(a)}
                </tspan>
              </text>
            );
          })}
        </svg>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[#4A4F59]">
          {bands
            .slice()
            .reverse()
            .map((b) => (
              <span key={b.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] border border-[#DDD8CD]" style={{ background: b.color }} />
                {b.label}
              </span>
            ))}
          <span>ยิ่งออกไปทางขอบ = ค่ายิ่งสูง · จุดทึบ = ครั้งล่าสุด</span>
        </div>
      </div>
    </div>
  );
}

// กราฟแมงมุมรายข้อ: ระยะจากกลาง = คะแนนข้อนั้นเทียบคะแนนเต็มของข้อ
function QuestionRadar({ rows, prevById }: { rows: AnswerScore[]; prevById: Map<number, AnswerScore> | null }) {
  const n = rows.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, r: number) => [Math.cos(angle(i)) * r * RADAR_R, Math.sin(angle(i)) * r * RADAR_R];
  const ring = (r: number) => rows.map((_, i) => point(i, r).join(",")).join(" ");
  const ratio = (r?: AnswerScore) => (r && r.score !== null && r.maxScore ? Math.min(1, Math.max(0, r.score / r.maxScore)) : 0);

  const current = rows.map((r, i) => point(i, ratio(r)));
  const hasPrev = !!prevById && rows.some((r) => prevById.get(r.questionId)?.score != null);
  const prevPoly = rows.map((r, i) => point(i, ratio(prevById?.get(r.questionId) ?? r)).join(",")).join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="-140 -130 280 260"
        className="w-full max-w-[440px] h-auto"
        role="img"
        aria-label={`กราฟแมงมุมคะแนนรายข้อ: ${rows.map((r, i) => `ข้อ ${i + 1} ${r.score}/${r.maxScore}`).join(", ")}`}
      >
        {[1, 0.75, 0.5, 0.25].map((r, k) => (
          <polygon key={r} points={ring(r)} fill={k % 2 ? "#FFFFFF" : "#FBF8F4"} stroke="#E4DFD4" strokeWidth={1} />
        ))}
        {rows.map((_, i) => {
          const [x, y] = point(i, 1);
          return <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="#E4DFD4" strokeWidth={1} />;
        })}
        {hasPrev && <polygon points={prevPoly} fill="none" stroke="#8B9099" strokeWidth={1.5} strokeDasharray="4 4" />}
        <polygon
          points={current.map((p) => p.join(",")).join(" ")}
          fill={ACCENT}
          fillOpacity={0.12}
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {rows.map((r, i) => (
          <circle key={r.questionId} cx={current[i][0]} cy={current[i][1]} r={4} fill={ACCENT} stroke="#fff" strokeWidth={1.5}>
            <title>{`ข้อ ${i + 1}: ${r.score}/${r.maxScore}`}</title>
          </circle>
        ))}
        {rows.map((r, i) => {
          const [x, y] = point(i, 1.13);
          return (
            <text key={r.questionId} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="#4A4F59">
              {i + 1}
            </text>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[#4A4F59]">
        <span>ยิ่งออกไปทางขอบ = คะแนนข้อนั้นยิ่งสูง</span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 rounded" style={{ background: ACCENT }} />
          ผลล่าสุด
        </span>
        {hasPrev && (
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-[1.5px] border-dashed border-[#8B9099]" />
            ครั้งก่อน
          </span>
        )}
      </div>
    </div>
  );
}

// กราฟเส้นคะแนนย้อนหลังของแบบประเมินเดียว พร้อมแถบเกณฑ์
function ScoreTrend({ list }: { list: Assessment[] }) {
  const cfg = getConfig(list[0].assessment_name);
  const scores = list.map((a) => scoreOf(a));
  const min = cfg.min ?? 0;
  const max = cfg.chartMax ?? cfg.max ?? (Math.max(...scores) * 1.25 || 1);
  const range = max - min || 1;

  const pts = list.map((a, i) => {
    const x = list.length === 1 ? 50 : 10 + i * (80 / (list.length - 1));
    const y = ((max - scoreOf(a)) / range) * 100;
    return { x, y: Math.min(100, Math.max(0, y)), a };
  });
  const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const dotPath = pts.map((p) => `M${p.x} ${p.y}h0`).join(" ");

  const last = scores[scores.length - 1];
  const prev = scores.length > 1 ? scores[scores.length - 2] : null;
  const delta = prev === null ? null : Math.round((last - prev) * 100) / 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="font-[family-name:var(--font-anuphan)] text-[34px] font-bold">{displayScore(list[list.length - 1])}</span>
        <span className="text-[#5E6470]">{cfg.unit ?? (cfg.max ? `คะแนน (เต็ม ${cfg.max})` : "คะแนน")}</span>
        <DeltaPill delta={delta} />
      </div>

      <div className="relative h-60 mt-9 mb-7">
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
          aria-label={`กราฟคะแนน ${list[0].assessment_name}`}
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
            <div className="absolute -bottom-7 -translate-x-1/2 text-xs text-[#5E6470] whitespace-nowrap" style={{ left: `${p.x}%` }}>
              {formatShortDate(p.a.assessed_at)}
            </div>
          </div>
        ))}
      </div>

      {list.length < 2 && (
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#F3F1EC] text-[#4A4F59] text-sm">
          <Info size={18} />
          มีข้อมูลเพียง 1 ครั้ง ทำแบบประเมินนี้อีกครั้งเพื่อดูแนวโน้ม
        </div>
      )}
    </div>
  );
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null || !Number.isFinite(delta))
    return <span className="px-2.5 py-1 rounded-full text-[13px] font-semibold bg-[#F3F1EC] text-[#4A4F59]">ข้อมูล 1 ครั้ง</span>;
  if (delta === 0)
    return <span className="px-2.5 py-1 rounded-full text-[13px] font-semibold bg-[#F3F1EC] text-[#4A4F59]">คงที่จากครั้งก่อน</span>;
  // ใช้สีแดงเมื่อคะแนนเพิ่ม เพราะแบบประเมินส่วนใหญ่ คะแนนสูง = เสี่ยงมาก
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

const RADAR_R = 100;
const LEVEL_COLOR: Record<Level, string> = { ok: "#2F8A4F", mid: "#D08A14", high: "#B4233A", unknown: "#9AA0A8" };
const ZONES: { level: Level; color: string }[] = [
  { level: "high", color: BAND.red },
  { level: "mid", color: BAND.amber },
  { level: "ok", color: BAND.green },
];

// วางจุดไว้กลางช่วงของระดับนั้น (ปกติ 0–⅓, ควรระวัง ⅓–⅔, ควรพบผู้เชี่ยวชาญ ⅔–1)
const radiusOf = (level: Level) => (LEVEL_STYLE[level].n * 2 - 1) / 6;

function RadarCard({ items, assessments }: { items: Assessment[]; assessments: Assessment[] }) {
  const axes = items.filter((a) => getLevel(a) !== "unknown");
  const unrated = items.filter((a) => getLevel(a) === "unknown");

  if (axes.length < 3) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#F3F1EC] text-sm text-[#4A4F59]">
        <Info size={18} />
        ต้องมีผลประเมินอย่างน้อย 3 ด้านจึงจะแสดงกราฟรวมได้ เลือกดูทีละแบบประเมินจากแถบด้านบนแทน
      </div>
    );
  }

  const n = axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, r: number) => [Math.cos(angle(i)) * r * RADAR_R, Math.sin(angle(i)) * r * RADAR_R];
  const ring = (r: number) => axes.map((_, i) => point(i, r).join(",")).join(" ");

  const current = axes.map((a, i) => ({ a, level: getLevel(a), xy: point(i, radiusOf(getLevel(a))) }));
  const prevs = axes.map((a) => findPrevious(assessments, a));
  const hasPrev = prevs.some(Boolean);
  // ด้านที่ไม่มีผลครั้งก่อน ใช้ผลล่าสุดแทน เพื่อให้เส้นประยังต่อกันครบ
  const prevPoly = prevs
    .map((p, i) => point(i, radiusOf(p ? getLevel(p) : current[i].level)).join(","))
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox="-230 -150 460 300"
        className="w-full max-w-[640px] h-auto"
        role="img"
        aria-label={`กราฟแมงมุมระดับความเสี่ยง: ${current.map((c) => `${c.a.assessment_name} ${LEVEL_STYLE[c.level].label}`).join(", ")}`}
      >
        {/* พื้นหลังแต่ละช่วง */}
        {ZONES.map((z) => (
          <polygon key={z.level} points={ring(LEVEL_STYLE[z.level].n / 3)} fill={z.color} stroke="#E4DFD4" strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, 1);
          return <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="#E4DFD4" strokeWidth={1} />;
        })}

        {hasPrev && (
          <polygon points={prevPoly} fill="none" stroke="#8B9099" strokeWidth={1.5} strokeDasharray="4 4" />
        )}
        <polygon
          points={current.map((c) => c.xy.join(",")).join(" ")}
          fill={ACCENT}
          fillOpacity={0.12}
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {current.map((c) => (
          <circle key={c.a.assessment_id} cx={c.xy[0]} cy={c.xy[1]} r={4.5} fill={LEVEL_COLOR[c.level]} stroke="#fff" strokeWidth={1.5}>
            <title>{`${c.a.assessment_name}: ${c.a.risk_level || "-"} (${displayScore(c.a)})`}</title>
          </circle>
        ))}

        {/* ชื่อแกน + ระดับปัจจุบัน */}
        {current.map((c, i) => {
          const [x, y] = point(i, 1.14);
          const cos = Math.cos(angle(i));
          const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
          const dy = Math.sin(angle(i)) < -0.5 ? -8 : Math.sin(angle(i)) > 0.5 ? 6 : 0;
          return (
            <text key={c.a.assessment_id} x={x} y={y + dy} textAnchor={anchor} fontSize={11}>
              <tspan x={x} fill="#16181D" fontWeight={600}>
                {c.a.assessment_name}
              </tspan>
              <tspan x={x} dy={13} fill={LEVEL_COLOR[c.level]} fontSize={10}>
                {c.a.risk_level || LEVEL_STYLE[c.level].label}
              </tspan>
            </text>
          );
        })}
      </svg>

      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-[#4A4F59]">
        {(["ok", "mid", "high"] as Level[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
            {LEVEL_STYLE[l].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 rounded" style={{ background: ACCENT }} />
          ผลล่าสุด
        </span>
        {hasPrev && (
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-[1.5px] border-dashed border-[#8B9099]" />
            ครั้งก่อน
          </span>
        )}
      </div>

      {unrated.length > 0 && (
        <p className="text-xs text-[#5E6470]">
          ไม่แสดงในกราฟ (ยังไม่มีเกณฑ์แบ่งระดับ): {unrated.map((a) => a.assessment_name).join(", ")}
        </p>
      )}
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
        {delta !== null && Number.isFinite(delta) && delta !== 0 ? (
          <span className={`ml-auto text-[13px] font-semibold ${delta > 0 ? "text-[#8E1428]" : "text-[#1D6436]"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} จากครั้งก่อน
          </span>
        ) : (
          <span className={`ml-auto text-sm font-semibold text-right line-clamp-1 ${s.text}`}>{a.risk_level}</span>
        )}
      </div>

      {pct !== null && Number.isFinite(pct) && (
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

function Recommendations({ items, open, onToggle }: { items: Assessment[]; open: boolean; onToggle?: () => void }) {
  const needAttention = items
    .filter((a) => getLevel(a) === "high" || getLevel(a) === "mid")
    // ข้อคิดทำร้ายตนเองขึ้นก่อนเสมอ
    .sort(
      (a, b) =>
        Number(!!b.self_harm_flag) - Number(!!a.self_harm_flag) ||
        LEVEL_STYLE[getLevel(b)].n - LEVEL_STYLE[getLevel(a)].n
    );
  const goodOnes = items.filter((a) => getLevel(a) === "ok");

  const tips = needAttention.slice(0, 4).map((a) => {
    const cfg = getConfig(a.assessment_name);
    if (a.self_harm_flag) {
      return {
        key: a.assessment_id,
        level: "high" as Level,
        source: `จาก ${a.assessment_name}`,
        title: "ขอความช่วยเหลือทันที",
        text:
          "ผลประเมินพบความคิดทำร้ายตนเอง โปรดโทรสายด่วนสุขภาพจิต 1323 (ฟรี 24 ชั่วโมง) " +
          "และไปพบแพทย์ที่สถานพยาบาลใกล้บ้านเพื่อประเมินความเสี่ยงการฆ่าตัวตาย (8Q)",
      };
    }
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
      <SectionHead
        eyebrow="FOR YOU"
        title="คำแนะนำจากผลประเมินของคุณ"
        aside={
          onToggle && (
            <ToggleButton open={open} onClick={onToggle} controls="recommendation-list" showLabel={`แสดง (${tips.length})`} />
          )
        }
      />
      {open && (
        <div id="recommendation-list" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
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
      )}
    </div>
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
      <h3 className="text-lg font-semibold mb-6">ยังไม่มีผลการประเมิน</h3>
      <button onClick={onStart} className="min-h-11 px-5 rounded-xl text-white font-semibold" style={{ background: ACCENT }}>
        เริ่มทำแบบประเมิน
      </button>
    </div>
  );
}