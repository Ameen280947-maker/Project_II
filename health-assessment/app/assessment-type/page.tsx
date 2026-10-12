"use client";

import Link from "next/link";
import {
  Activity,
  Apple,
  ArrowRight,
  Brain,
  Cigarette,
  ClipboardList,
  Dumbbell,
  Heart,
  Stethoscope,
  Wine,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import Sidebar from "@/app/components/Sidebar";
import NotificationBell from "@/app/components/NotificationBell";
import type { AssessmentCategory, CategoryAssessment, CategoryTheme } from "@/lib/assessmentCategories";

/* =========================================================
   เนื้อหาของหมวดเดิม 3 หมวด (หัวข้อย่อย + ภาพ) — ผูกกับ route_path ในตาราง assessment_categories
   แบบประเมินที่เจ้าหน้าที่สร้างเพิ่มในหมวดเหล่านี้จะต่อท้ายรายการหัวข้อย่อย
========================================================= */

type Illustration = "ncd" | "behavior" | "mental" | "generic";

const BUILTIN_CONTENT: Record<string, { descriptionItems: string[]; illustration: Illustration }> = {
  "/assessment-menu": {
    descriptionItems: [
      "โรคหัวใจและหลอดเลือด",
      "โรคเบาหวาน",
      "ความดันโลหิตสูง",
      "ภาวะน้ำหนักเกิน",
    ],
    illustration: "ncd",
  },
  "/assessment-menu-behavior": {
    descriptionItems: [
      "การสูบบุหรี่",
      "แอลกอฮอล์",
      "การออกกำลังกาย",
      "การนอนหลับ",
      "การรับประทานอาหาร",
    ],
    illustration: "behavior",
  },
  "/assessment-menu-mental-health": {
    descriptionItems: [
      "ความเครียดสะสม",
      "ภาวะซึมเศร้า",
    ],
    illustration: "mental",
  },
};

// แสดงระหว่างรอโหลดหมวดจากฐานข้อมูล (และกรณีโหลดไม่สำเร็จ) = หมวดเดิม 3 หมวด
const FALLBACK_CATEGORIES: AssessmentCategory[] = [
  { id: 1, name: "โรคไม่ติดต่อเรื้อรัง", subtitle: "(NCDs)", theme: "red", routePath: "/assessment-menu", builtIn: true, href: "/assessment-menu", assessments: [] },
  { id: 2, name: "ความเสี่ยงด้านพฤติกรรม", subtitle: null, theme: "green", routePath: "/assessment-menu-behavior", builtIn: true, href: "/assessment-menu-behavior", assessments: [] },
  { id: 3, name: "ความเสี่ยงด้านสุขภาพจิต", subtitle: null, theme: "blue", routePath: "/assessment-menu-mental-health", builtIn: true, href: "/assessment-menu-mental-health", assessments: [] },
];

// หน้าเลือกประเภทแบบประเมิน: โหลดหมวดหมู่และแบบประเมินเพิ่มเติมจาก API มาแสดงเป็นการ์ด
export default function AssessmentTypePage() {
  // หมวดหมู่จากฐานข้อมูล + แบบประเมินที่เจ้าหน้าที่สร้างเพิ่ม
  // (หมวดที่ staff สร้างแต่ยังไม่มีแบบประเมินที่เปิดใช้งาน API จะไม่ส่งมา)
  const [categories, setCategories] = useState<AssessmentCategory[]>(FALLBACK_CATEGORIES);
  // แบบประเมินที่ยังไม่มีหมวด (ไม่มีจะไม่แสดงหัวข้อ "แบบประเมินเพิ่มเติม")
  const [extra, setExtra] = useState<CategoryAssessment[]>([]);
  useEffect(() => {
    fetch("/api/assessments/categories", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setCategories(d.categories);
        setExtra(d.uncategorized);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">

        {/* =====================================================
            SIDEBAR กลาง
        ====================================================== */}

        <Sidebar />

        {/* =====================================================
            MAIN CONTENT
        ====================================================== */}

        <section className="min-w-0 flex-1 px-5 py-5 sm:px-6 lg:px-8">

          {/* Header */}
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Assessment-
                <span className="text-[#ef4962]">
                  Type
                </span>
              </h1>

              <h2 className="mt-3 text-2xl font-bold">
                เข้าสู่แบบประเมิน
              </h2>

            </div>

            <div className="mt-2 shrink-0">
              <NotificationBell />
            </div>
          </header>

          {/* =================================================
              ASSESSMENT CARDS
          ================================================== */}

          <div className="mt-6 grid gap-5 xl:grid-cols-3">

            {categories.map((category) => {
              const builtin = category.routePath ? BUILTIN_CONTENT[category.routePath] : undefined;
              return (
                <AssessmentTypeCard
                  key={category.id}
                  title={category.name}
                  subtitle={category.subtitle ?? undefined}
                  descriptionItems={[
                    ...(builtin?.descriptionItems ?? []),
                    ...category.assessments.map((a) => a.name),
                  ]}
                  href={category.href}
                  theme={category.theme}
                  illustration={builtin?.illustration ?? "generic"}
                />
              );
            })}

          </div>

          {extra.length > 0 && (
            <div className="mt-10">
              <h2 className="text-xl font-bold">แบบประเมินเพิ่มเติม</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {extra.map((a) => (
                  <Link
                    key={a.id}
                    href={`/assessment/${a.id}`}
                    className="group flex items-center gap-4 rounded-[24px] border border-[#eee8e9] bg-white p-5 shadow-[0_12px_35px_rgba(35,25,30,0.04)] transition hover:-translate-y-0.5 hover:border-[#f3b6c0]"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
                      <Activity size={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{a.name}</span>
                      <span className="line-clamp-2 text-sm text-[#7c7d85]">
                        {a.description || `${a.questions} ข้อ`}
                      </span>
                    </span>
                    <ArrowRight size={18} className="shrink-0 text-[#b91c2b] transition group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </div>
          )}

        </section>

      </div>
    </main>
  );
}

/* =========================================================
   ASSESSMENT TYPE CARD
========================================================= */

type AssessmentTypeCardProps = {
  title: string;
  subtitle?: string;

  descriptionItems: string[];

  href: string;

  theme: CategoryTheme;

  illustration: Illustration;
};

// การ์ดหมวดหมู่แบบประเมิน แสดงภาพ หัวข้อ รายละเอียด และปุ่มเข้าตามธีมสี
function AssessmentTypeCard({
  title,
  subtitle,
  descriptionItems,
  href,
  theme,
  illustration,
}: AssessmentTypeCardProps) {
  const themeStyles = {
    red: {
      imageArea:
        "bg-[#fff0f2]",

      icon:
        "text-[#ef4962]",

      bullet:
        "bg-[#ef4962]",

      button:
        "bg-gradient-to-r from-[#ef3153] to-[#f5526a] text-white shadow-[0_12px_26px_rgba(239,49,83,0.22)]",

      accent:
        "text-[#ef4962]",
    },

    green: {
      imageArea:
        "bg-[#eff8ec]",

      icon:
        "text-[#67a556]",

      bullet:
        "bg-[#67a556]",

      button:
        "bg-gradient-to-r from-[#eef7e9] to-[#dfeeda] text-[#5b963f]",

      accent:
        "text-[#67a556]",
    },

    blue: {
      imageArea:
        "bg-[#edf5ff]",

      icon:
        "text-[#6594c8]",

      bullet:
        "bg-[#6594c8]",

      button:
        "bg-gradient-to-r from-[#edf5ff] to-[#dceafb] text-[#527da9]",

      accent:
        "text-[#6594c8]",
    },

    /* ===== สีของหมวดที่เจ้าหน้าที่สร้างเพิ่ม ===== */

    amber: {
      imageArea:
        "bg-[#fdf5e4]",

      icon:
        "text-[#d0961f]",

      bullet:
        "bg-[#d0961f]",

      button:
        "bg-gradient-to-r from-[#fdf3dc] to-[#f8e6bf] text-[#a87414]",

      accent:
        "text-[#d0961f]",
    },

    violet: {
      imageArea:
        "bg-[#f3effc]",

      icon:
        "text-[#8b6fd0]",

      bullet:
        "bg-[#8b6fd0]",

      button:
        "bg-gradient-to-r from-[#f3effc] to-[#e5dcf7] text-[#6e52b5]",

      accent:
        "text-[#8b6fd0]",
    },

    teal: {
      imageArea:
        "bg-[#eaf6f3]",

      icon:
        "text-[#3aa898]",

      bullet:
        "bg-[#3aa898]",

      button:
        "bg-gradient-to-r from-[#eaf6f3] to-[#d5ede7] text-[#2a8676]",

      accent:
        "text-[#3aa898]",
    },

    pink: {
      imageArea:
        "bg-[#fdf0f5]",

      icon:
        "text-[#e0679a]",

      bullet:
        "bg-[#e0679a]",

      button:
        "bg-gradient-to-r from-[#fdeef4] to-[#f9dbe7] text-[#c24f80]",

      accent:
        "text-[#e0679a]",
    },
  }[theme];

  return (
    <article className="flex min-h-[535px] flex-col overflow-hidden rounded-[26px] border border-[#eee8e9] bg-white p-5 shadow-[0_14px_36px_rgba(35,25,30,0.045)]">

      {/* Illustration */}

      <div
        className={`relative flex h-[170px] items-center justify-center overflow-hidden rounded-[22px] ${themeStyles.imageArea}`}
      >
        <AssessmentIllustration
          kind={illustration}
          iconClass={themeStyles.icon}
          softBg={themeStyles.imageArea}
        />
      </div>

      {/* Content */}

      <div className="mt-5">

        <h3 className="text-[25px] font-bold leading-tight">
          {title}
        </h3>

        {subtitle && (
          <p
            className={`mt-1.5 text-xl font-bold ${themeStyles.accent}`}
          >
            {subtitle}
          </p>
        )}

        <div className="mt-5 space-y-3">

          {descriptionItems.map(
            (item, i) => (
              <div
                key={`${i}-${item}`}
                className="flex items-start gap-3 text-sm text-[#5f6068]"
              >

                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${themeStyles.bullet}`}
                />

                <span>
                  {item}
                </span>

              </div>
            ),
          )}

        </div>

      </div>

      {/* Start button */}

      <Link
        href={href}
        className={`mt-auto flex h-13 min-h-13 items-center justify-center gap-3 rounded-2xl px-5 text-base font-bold transition hover:-translate-y-0.5 ${themeStyles.button}`}
      >
        เริ่มประเมิน

        <ArrowRight
          size={20}
        />
      </Link>

    </article>
  );
}

/* =========================================================
   ASSESSMENT ILLUSTRATION
========================================================= */

// ภาพประกอบของแต่ละหมวดแบบประเมิน เลือกไอคอนตามชนิด (kind)
function AssessmentIllustration({
  kind,
  iconClass,
  softBg,
}: {
  kind: Illustration;
  // สีไอคอน/พื้นของหมวด (ใช้กับภาพของหมวดที่เจ้าหน้าที่สร้างเพิ่ม)
  iconClass: string;
  softBg: string;
}) {
  /* ================= หมวดที่เจ้าหน้าที่สร้างเพิ่ม ================= */

  if (kind === "generic") {
    return (
      <div className={`relative grid h-36 w-36 place-items-center rounded-full bg-white/75 shadow-[0_14px_34px_rgba(35,25,30,0.08)] ${iconClass}`}>

        <ClipboardList
          size={76}
          strokeWidth={1.4}
        />

        <div className={`absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full ${softBg}`}>

          <Stethoscope
            size={24}
          />

        </div>

      </div>
    );
  }

  /* ================= NCD ================= */

  if (kind === "ncd") {
    return (
      <div className="relative grid h-32 w-32 place-items-center rounded-full bg-white/75 text-[#ef4962] shadow-[0_14px_34px_rgba(239,73,98,0.1)]">

        <Heart
          size={78}
          fill="currentColor"
          strokeWidth={1.2}
        />

        <Activity
          size={62}
          className="absolute text-white"
          strokeWidth={1.8}
        />

      </div>
    );
  }

  /* ================= Behavior ================= */

  if (kind === "behavior") {
    return (
      <div className="grid grid-cols-2 gap-3">

        <IconCircle>
          <Apple size={38} />
        </IconCircle>

        <IconCircle>
          <Dumbbell size={38} />
        </IconCircle>

        <IconCircle>
          <Cigarette size={36} />
        </IconCircle>

        <IconCircle>
          <Wine size={36} />
        </IconCircle>

      </div>
    );
  }

  /* ================= Mental Health ================= */

  return (
    <div className="relative grid h-36 w-36 place-items-center rounded-full bg-white/75 text-[#6594c8] shadow-[0_14px_34px_rgba(101,148,200,0.12)]">

      <Brain
        size={80}
        strokeWidth={1.4}
      />

      <div className="absolute bottom-2 right-2 grid h-11 w-11 place-items-center rounded-full bg-[#edf5ff]">

        <Heart
          size={24}
        />

      </div>

    </div>
  );
}

/* =========================================================
   ICON CIRCLE
========================================================= */

// กรอบวงกลมสำหรับวางไอคอนในภาพประกอบ
function IconCircle({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid h-20 w-20 place-items-center rounded-full bg-white/80 text-[#67a556] shadow-[0_8px_20px_rgba(60,110,50,0.08)]">
      {children}
    </div>
  );
}