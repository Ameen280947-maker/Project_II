"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Answer = {
  answer_id: number;
  question_text: string;
  answer_value: string;
  choice_text: string;
  answer_score: number;
};

type Result = {
  assessment_id: number;
  username: string;
  total_score: number;
  risk_level: string;
  recommendation_text: string;
  assessed_at: string;
  answers: Answer[];
};

/* =========================================================
   ICONS
========================================================= */

function HeartIcon() {
  return (
    <svg
      width="27"
      height="27"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.8 8.6c0 5.5-8.8 11-8.8 11S3.2 14.1 3.2 8.6A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.3Z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4.1 3.4-6 8-6s7.2 1.9 8 6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19V5" />
      <path d="M4 19h17" />
      <path d="M7 16v-4" />
      <path d="M11 16V8" />
      <path d="M15 16v-6" />
      <path d="M19 16V5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function RecommendationIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.8 8.6c0 5.5-8.8 11-8.8 11S3.2 14.1 3.2 8.6A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 2.3Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.7v-2.4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h2.4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v2.4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 16c1.5-2.5 3-5 4.5-7.5" />
      <path d="M10.5 8.5 13 12l2.5-3.5" />
      <path d="M13 12l2.5 4" />
      <circle cx="8" cy="5" r="2" />
      <path d="M5 20h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

/* =========================================================
   SIDEBAR ITEM
========================================================= */

type SidebarItemProps = {
  icon: React.ReactNode;
  label: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
};

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition ${
        active
          ? "bg-[#f8f8f7] text-[#333]"
          : "text-[#5f6065] hover:bg-[#fafafa]"
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>

      <span className="text-[16px] leading-5 font-medium">
        {label}
      </span>
    </button>
  );
}

/* =========================================================
   MAIN CONTENT
========================================================= */

function PhysicalActivityResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const assessmentId =
    searchParams.get("assessmentId");

  const [result, setResult] =
    useState<Result | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================================================
     LOAD RESULT
  ========================================================= */

  useEffect(() => {
    const loadResult = async () => {
      try {
        setLoading(true);
        setError("");

        if (!assessmentId) {
          throw new Error(
            "ไม่พบ Assessment ID"
          );
        }

        const userId =
          localStorage.getItem("userId");

        if (!userId) {
          throw new Error(
            "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่"
          );
        }

        const response = await fetch(
          `/api/assessments/physical_activity?assessmentId=${encodeURIComponent(
            assessmentId
          )}&userId=${encodeURIComponent(userId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "ไม่สามารถโหลดผลการประเมินได้"
          );
        }

        setResult(data);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดผลการประเมินได้"
        );
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [assessmentId]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-[#e5e5e5] border-t-[#6d9b6b] animate-spin mx-auto mb-4" />

          <p className="text-gray-500">
            กำลังโหลดผลการประเมิน...
          </p>
        </div>
      </main>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error || !result) {
    return (
      <main className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-3xl p-10 max-w-lg w-full text-center shadow-sm">

          <div className="text-5xl mb-5">
            ⚠️
          </div>

          <h1 className="text-2xl font-bold text-gray-800 mb-3">
            ไม่สามารถโหลดผลการประเมิน
          </h1>

          <p className="text-gray-500 mb-7">
            {error || "ไม่พบข้อมูลผลการประเมิน"}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/assessment_physical_activity"
              )
            }
            className="px-7 py-3.5 bg-[#6d9b6b] text-white rounded-xl font-semibold hover:bg-[#5e8b5c] transition"
          >
            กลับไปทำแบบประเมิน
          </button>

        </div>
      </main>
    );
  }

  /* =========================================================
     RISK STYLE
  ========================================================= */

  let riskColor = "#6d9b6b";
  let riskBg = "#edf7e9";
  let riskBorder = "#dcefd6";

  if (result.risk_level === "ไม่เพียงพอ") {
    riskColor = "#c48a32";
    riskBg = "#fff7e8";
    riskBorder = "#f4e1b8";
  }

  if (
    result.risk_level ===
    "ไม่มีกิจกรรมทางกาย"
  ) {
    riskColor = "#b91c2b";
    riskBg = "#fff0f1";
    riskBorder = "#f3d0d3";
  }

  /* =========================================================
     DATE
  ========================================================= */

  const assessedDate = result.assessed_at
    ? new Date(
        result.assessed_at
      ).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

  /* =========================================================
     MAX SCORE
     
     Physical Activity มี 2 ข้อ
     คะแนนสูงสุดข้อ ละ 3 คะแนน
  ========================================================= */

  const maxScore = 6;

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#333]">

      <div className="flex min-h-screen">

        {/* ===================================================
            SIDEBAR
        =================================================== */}

        <aside className="hidden lg:flex w-[255px] flex-shrink-0 bg-white border-r border-[#e7e5e2] flex-col">

          {/* Logo */}

          <div className="px-8 pt-8 pb-7">

            <div className="flex items-center gap-3">

              <div className="w-[50px] h-[50px] rounded-[13px] bg-[#b91c2b] text-white flex items-center justify-center shadow-sm">
                <HeartIcon />
              </div>

              <div>
                <h1 className="text-[17px] font-bold text-[#303136]">
                  Health Risk
                </h1>

                <p className="text-[14px] text-[#999]">
                  Assessment
                </p>
              </div>

            </div>

          </div>

          {/* Menu */}

          <nav className="px-5 space-y-2">

            <SidebarItem
              icon={<UserIcon />}
              label={
                <>
                  ข้อมูลสุขภาพ
                  <br />
                  ของคุณ
                </>
              }
              onClick={() =>
                router.push("/profile")
              }
            />

            <SidebarItem
              icon={<ClipboardIcon />}
              label={
                <>
                  แบบประเมิน
                  <br />
                  สุขภาพ
                </>
              }
              onClick={() =>
                router.push("/assessment")
              }
            />

            <SidebarItem
              icon={<DashboardIcon />}
              label="Dashboard"
              onClick={() =>
                router.push("/dashboard")
              }
            />

            <SidebarItem
              icon={<HistoryIcon />}
              label="ประวัติการประเมิน"
              onClick={() =>
                router.push(
                  "/assessment-history"
                )
              }
            />

            <SidebarItem
              icon={<RecommendationIcon />}
              label="คำแนะนำสุขภาพ"
              onClick={() =>
                router.push(
                  "/recommendation"
                )
              }
            />

            <SidebarItem
              icon={<SettingsIcon />}
              label="ตั้งค่า"
              onClick={() =>
                router.push("/settings")
              }
            />

          </nav>

          {/* Logout */}

          <div className="mt-auto px-5 pb-7">

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("userId");
                router.push("/login");
              }}
              className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-[#fff0f1] text-[#b91c2b] font-medium hover:bg-[#ffe5e7] transition"
            >
              <span className="text-xl">
                ↪
              </span>

              <span>
                ออกจากระบบ
              </span>
            </button>

          </div>

        </aside>

        {/* ===================================================
            CONTENT
        =================================================== */}

        <section className="flex-1 min-w-0">

          <div className="max-w-[1220px] mx-auto px-6 md:px-10 lg:px-12 py-10">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="mb-8">

              <p className="text-[14px] tracking-[2px] font-bold text-[#6d9b6b] mb-3">
                ASSESSMENT RESULT
              </p>

              <h1 className="text-[38px] md:text-[42px] leading-tight font-bold tracking-[-1px] text-[#2d2e32]">
                ผลการประเมิน
                <span className="text-[#6d9b6b]">
                  กิจกรรมทางกาย
                </span>
              </h1>

              <p className="text-[17px] font-medium text-[#55565b] mt-3">
                แบบประเมินกิจกรรมทางกาย
              </p>

            </div>

            {/* =================================================
                RESULT CARDS
            ================================================= */}

            <div className="grid grid-cols-1 xl:grid-cols-[460px_1fr] gap-6">

              {/* =================================================
                  SCORE CARD
              ================================================= */}

              <div className="bg-white rounded-[28px] border border-[#e9e7e4] shadow-[0_4px_20px_rgba(0,0,0,0.025)] min-h-[340px] flex flex-col items-center justify-center px-8 py-10">

                {/* Icon */}

                <div
                  className="w-[66px] h-[66px] rounded-[17px] flex items-center justify-center mb-5"
                  style={{
                    backgroundColor: riskBg,
                    color: riskColor,
                  }}
                >
                  <ActivityIcon />
                </div>

                {/* Label */}

                <p className="text-[15px] font-semibold text-[#6a6a6d]">
                  คะแนนรวม
                </p>

                {/* Score */}

                <div className="flex items-baseline gap-2 mt-2">

                  <span className="text-[60px] leading-none font-bold text-[#292a2e]">
                    {result.total_score}
                  </span>

                  <span className="text-[19px] text-[#888]">
                    / {maxScore} คะแนน
                  </span>

                </div>

                {/* Risk */}

                <div
                  className="mt-6 px-6 py-2.5 rounded-full font-semibold text-[16px]"
                  style={{
                    backgroundColor: riskBg,
                    color: riskColor,
                  }}
                >
                  {result.risk_level}
                </div>

                {/* Date */}

                <div className="flex items-center gap-2 text-[#888] mt-6 text-[14px]">
                  <CalendarIcon />
                  <span>{assessedDate}</span>
                </div>

              </div>

              {/* =================================================
                  RECOMMENDATION CARD
              ================================================= */}

              <div className="bg-white rounded-[28px] border border-[#e9e7e4] shadow-[0_4px_20px_rgba(0,0,0,0.025)] min-h-[340px] px-8 md:px-10 py-9">

                <h2 className="text-[22px] font-bold text-[#343539]">
                  คำแนะนำสำหรับคุณ
                </h2>

                <p className="text-[14px] text-[#999] mt-2">
                  คำแนะนำต่อไปนี้อ้างอิงจากระดับกิจกรรมทางกาย
                  ที่ได้จากการประเมินของคุณ
                </p>

                {/* Recommendation */}

                <div
                  className="mt-8 rounded-2xl px-5 py-5 flex items-start gap-4"
                  style={{
                    backgroundColor: riskBg,
                  }}
                >

                  <div
                    className="flex-shrink-0 mt-0.5"
                    style={{
                      color: riskColor,
                    }}
                  >
                    <CheckIcon />
                  </div>

                  <p className="text-[15px] md:text-[16px] leading-7 text-[#55565b] whitespace-pre-line">
                    {result.recommendation_text ||
                      "ไม่พบคำแนะนำในฐานข้อมูล"}
                  </p>

                </div>

              </div>

            </div>

            {/* =================================================
                NOTE
            ================================================= */}

            <div className="mt-7 rounded-[24px] border border-[#dfe8f3] bg-[#f5f8fc] px-7 py-5">

              <div className="flex items-start gap-4">

                <div className="w-[43px] h-[43px] rounded-xl bg-[#e7f0fb] text-[#6c9ed1] flex items-center justify-center flex-shrink-0">
                  <ActivityIcon />
                </div>

                <div>

                  <h3 className="font-bold text-[#555b65] text-[15px] mb-1">
                    หมายเหตุ
                  </h3>

                  <p className="text-[13px] md:text-[14px] leading-6 text-[#7c8189]">
                    ผลการประเมินนี้เป็นการคัดกรองเบื้องต้น
                    ไม่ใช่การวินิจฉัยทางการแพทย์
                    หากมีข้อสงสัยหรือมีอาการผิดปกติ
                    ควรปรึกษาผู้เชี่ยวชาญด้านสุขภาพ
                  </p>

                </div>

              </div>

            </div>

            {/* =================================================
                BOTTOM BUTTONS
            ================================================= */}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 mt-7">

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/assessment-history"
                  )
                }
                className="px-7 py-4 rounded-2xl border border-[#e4e0dc] bg-white text-[#55565b] font-semibold text-[15px] hover:bg-[#fafafa] transition"
              >
                ดูประวัติการประเมิน
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/assessment_physical_activity"
                  )
                }
                className="px-7 py-4 rounded-2xl bg-[#edf8e9] text-[#6d9b6b] font-semibold text-[15px] hover:bg-[#e2f3dc] transition flex items-center justify-center gap-2"
              >
                <ArrowLeftIcon />
                กลับไปแบบประเมิน
              </button>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}

/* =========================================================
   SUSPENSE
========================================================= */

export default function PhysicalActivityRecommendationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
          <div className="text-center">

            <div className="w-10 h-10 rounded-full border-4 border-[#e5e5e5] border-t-[#6d9b6b] animate-spin mx-auto mb-4" />

            <p className="text-gray-500">
              กำลังโหลด...
            </p>

          </div>
        </main>
      }
    >
      <PhysicalActivityResultContent />
    </Suspense>
  );
}