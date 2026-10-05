"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Activity,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ArrowRight,
  Bell,
  Calendar,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationBell from "@/app/components/NotificationBell";
import type { CalculatedNotification } from "@/lib/notificationRules";

/* =========================================================
   TYPES
========================================================= */

type Assessment = {
  assessment_id: number;
  assessment_type_id: number;
  assessment_name: string;
  total_score: number;
  risk_level: string;
  assessed_at: string;
  recommendation_text?: string | null;
};

type DashboardData = {
  success: boolean;

  summary: {
    totalAssessments: number;
    totalTypes: number;
    riskAssessments: number;
    latestAssessment:
      | Assessment
      | null;
  };

  latestByType: Assessment[];

  assessments: Assessment[];
};

/* =========================================================
   PAGE
========================================================= */

export default function DashboardPage() {
  const router = useRouter();

  const [data, setData] =
    useState<DashboardData | null>(null);

  const [notifs, setNotifs] =
    useState<CalculatedNotification[]>([]);

  const [notifSummary, setNotifSummary] =
    useState<{
      total: number;
      unreadCount: number;
      dueCount: number;
      upcomingCount: number;
    } | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const userId =
          localStorage.getItem("userId");

        if (!userId) {
          throw new Error(
            "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่"
          );
        }

        const [dashRes, notifRes] = await Promise.all([
          fetch(
            `/api/dashboard?userId=${encodeURIComponent(userId)}`,
            { method: "GET", cache: "no-store" }
          ),
          fetch(
            `/api/notifications?userId=${encodeURIComponent(userId)}`,
            { method: "GET", cache: "no-store" }
          ),
        ]);

        const result = await dashRes.json();
        const notifResult = await notifRes.json();

        if (!dashRes.ok) {
          throw new Error(
            result.message ||
              "ไม่สามารถโหลด Dashboard ได้"
          );
        }

        setData(result);

        if (notifResult.success) {
          setNotifs(notifResult.notifications || []);
          setNotifSummary(notifResult.summary || null);
        }
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถโหลดข้อมูลได้"
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-[#b91c2b] rounded-full animate-spin mx-auto mb-4" />

          <p className="text-gray-500">
            กำลังโหลด Dashboard...
          </p>
        </div>
      </main>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <main className="min-h-screen bg-[#faf9f7] p-8">
        <div className="max-w-4xl mx-auto bg-white border border-red-100 rounded-3xl p-8 text-center">
          <AlertTriangle
            size={48}
            className="text-red-500 mx-auto mb-4"
          />

          <h1 className="text-xl font-bold text-gray-800 mb-2">
            ไม่สามารถโหลดข้อมูลได้
          </h1>

          <p className="text-gray-500">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  /* =======================================================
     DATA
  ======================================================= */

  const summary = data.summary;

  const latest =
    summary.latestAssessment;

  /* =======================================================
     DATE FORMAT
  ======================================================= */

  const formatDate = (
    date?: string | null
  ) => {
    if (!date) return "-";

    return new Date(date).toLocaleString(
      "th-TH",
      {
        dateStyle: "long",
        timeStyle: "short",
      }
    );
  };

  /* =======================================================
     RISK STYLE
  ======================================================= */

  const getRiskStyle = (
    risk?: string | null
  ) => {
    const value = String(
      risk || ""
    ).toLowerCase();

    if (
      value.includes("เพียงพอ") ||
      value.includes("ปกติ") ||
      value.includes("น้อย") ||
      value.includes("ไม่มีความเสี่ยง")
    ) {
      return {
        bg: "bg-green-50",
        border: "border-green-100",
        text: "text-green-700",
        icon: CheckCircle2,
      };
    }

    if (
      value.includes("ปานกลาง") ||
      value.includes("ไม่เพียงพอ")
    ) {
      return {
        bg: "bg-yellow-50",
        border: "border-yellow-100",
        text: "text-yellow-700",
        icon: Clock3,
      };
    }

    if (
      value.includes("สูง") ||
      value.includes("อันตราย") ||
      value.includes("ไม่มี")
    ) {
      return {
        bg: "bg-red-50",
        border: "border-red-100",
        text: "text-red-700",
        icon: AlertTriangle,
      };
    }

    return {
      bg: "bg-gray-50",
      border: "border-gray-100",
      text: "text-gray-700",
      icon: Activity,
    };
  };

  /* =======================================================
     GET RESULT PAGE
  ======================================================= */

  const openResult = (
    assessment: Assessment
  ) => {
    const type =
      assessment.assessment_name
        ?.toLowerCase()
        .trim();

    /*
      กิจกรรมทางกาย
    */

    if (
      type === "physical activity" ||
      type === "กิจกรรมทางกาย"
    ) {
      router.push(
        `/recommendation_physical_activity?assessmentId=${assessment.assessment_id}`
      );

      return;
    }

    /*
      ถ้ายังไม่มีหน้า Result ของประเภทนั้น
      ให้ไปประวัติการประเมินก่อน
    */

    router.push(
      `/history?assessmentId=${assessment.assessment_id}`
    );
  };

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <main className="min-h-screen bg-[#faf9f7] px-6 py-8 lg:px-10">
      <div className="max-w-7xl mx-auto">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-[#6c9470] uppercase">
              HEALTH DASHBOARD
            </p>

            <h1 className="text-4xl lg:text-5xl font-bold text-gray-800 mt-2">
              Dashboard
            </h1>

            <p className="text-gray-500 mt-2 text-base sm:text-lg">
              สรุปผลการประเมินสุขภาพและกำหนดติดตามรอบถัดไป
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Link
              href="/assessment-type"
              className="px-4 py-2.5 rounded-2xl bg-[#2f3037] text-white text-xs sm:text-sm font-bold hover:bg-black transition shadow-sm"
            >
              ทำแบบประเมิน
            </Link>

            <Link
              href="/notifications"
              className="px-4 py-2.5 rounded-2xl bg-white border border-gray-200 text-gray-700 text-xs sm:text-sm font-bold hover:bg-gray-50 transition shadow-sm flex items-center gap-1.5"
            >
              <span>รอบติดตาม</span>
              {notifSummary && notifSummary.dueCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#b91c2b] text-white text-[10px] font-bold">
                  {notifSummary.dueCount}
                </span>
              )}
            </Link>

            <NotificationBell />
          </div>
        </div>

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">

          {/* Total */}

          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start justify-between">

              <div>
                <p className="text-gray-500 text-sm">
                  การประเมินทั้งหมด
                </p>

                <p className="text-4xl font-bold text-gray-800 mt-3">
                  {summary.totalAssessments}
                </p>

                <p className="text-gray-400 text-sm mt-1">
                  ครั้ง
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <ClipboardList
                  size={24}
                  className="text-[#b91c2b]"
                />
              </div>

            </div>
          </div>

          {/* Types */}

          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start justify-between">

              <div>
                <p className="text-gray-500 text-sm">
                  ประเภทที่ประเมิน
                </p>

                <p className="text-4xl font-bold text-gray-800 mt-3">
                  {summary.totalTypes}
                </p>

                <p className="text-gray-400 text-sm mt-1">
                  ประเภท
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
                <HeartPulse
                  size={24}
                  className="text-[#6c9470]"
                />
              </div>

            </div>
          </div>

          {/* Latest */}

          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start justify-between">

              <div>
                <p className="text-gray-500 text-sm">
                  ประเมินล่าสุด
                </p>

                <p className="text-lg font-bold text-gray-800 mt-4">
                  {latest
                    ? latest.assessment_name
                    : "-"}
                </p>

                <p className="text-gray-400 text-sm mt-1">
                  {latest
                    ? formatDate(
                        latest.assessed_at
                      )
                    : "-"}
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <CalendarDays
                  size={24}
                  className="text-blue-500"
                />
              </div>

            </div>
          </div>

          {/* Risk */}

          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-start justify-between">

              <div>
                <p className="text-gray-500 text-sm">
                  ผลที่ควรติดตาม
                </p>

                <p className="text-4xl font-bold text-gray-800 mt-3">
                  {summary.riskAssessments}
                </p>

                <p className="text-gray-400 text-sm mt-1">
                  รายการ
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center">
                <AlertTriangle
                  size={24}
                  className="text-yellow-500"
                />
              </div>

            </div>
          </div>

        </div>

        {/* =================================================
            HEALTH FOLLOW-UP & NOTIFICATIONS SECTION
        ================================================= */}

        {notifs.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-red-50 flex items-center justify-center text-[#b91c2b]">
                  <Bell size={18} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    การแจ้งเตือนและกำหนดติดตามสุขภาพ
                  </h2>
                  <p className="text-xs text-gray-500">
                    กำหนดรอบประเมินซ้ำตามเกณฑ์ทางการแพทย์ของแต่ละโรค
                  </p>
                </div>
              </div>

              <Link
                href="/notifications"
                className="text-xs font-bold text-[#b91c2b] hover:underline flex items-center gap-1"
              >
                <span>ดูทั้งหมด ({notifs.length})</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Overdue/Due Banner */}
            {notifSummary && notifSummary.dueCount > 0 && (
              <div className="mb-5 bg-gradient-to-r from-red-500 to-[#b91c2b] text-white rounded-3xl p-5 shadow-[0_10px_30px_rgba(185,28,43,0.20)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <ShieldAlert size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base">
                      มี {notifSummary.dueCount} แบบประเมินที่ครบกำหนดติดตามซ้ำแล้ว!
                    </h3>
                    <p className="text-xs text-red-100 mt-0.5">
                      กรุณาทำแบบประเมินซ้ำเพื่อเปรียบเทียบผลและเฝ้าระวังความเสี่ยงอย่างต่อเนื่อง
                    </p>
                  </div>
                </div>

                <Link
                  href="/notifications"
                  className="px-5 py-2.5 rounded-2xl bg-white text-[#b91c2b] font-bold text-xs sm:text-sm hover:bg-red-50 transition shrink-0 self-start sm:self-auto shadow-sm"
                >
                  ดูรายการที่ครบกำหนด
                </Link>
              </div>
            )}

            {/* Grid of Follow-up Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notifs.slice(0, 3).map((item) => {
                const isDue = item.status === "overdue" || item.status === "due_today";
                const isUpcoming = item.status === "upcoming";

                return (
                  <div
                    key={item.notificationId || `${item.assessmentTypeId}-${item.assessmentId}`}
                    className={`rounded-3xl p-5 border transition flex flex-col justify-between ${
                      isDue
                        ? "bg-white border-red-200 shadow-sm ring-1 ring-red-100"
                        : isUpcoming
                        ? "bg-white border-amber-200 shadow-sm"
                        : "bg-white border-gray-100 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            isDue
                              ? "bg-red-100 text-[#b91c2b]"
                              : isUpcoming
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {item.statusText}
                        </span>

                        <span className="text-[11px] font-medium text-gray-400">
                          {item.intervalLabel}
                        </span>
                      </div>

                      <h3 className="font-bold text-gray-900 text-base leading-snug">
                        {item.assessmentName}
                      </h3>

                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-gray-400">ผลล่าสุด:</span>
                        <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                          {item.riskLevel}
                        </span>
                      </div>

                      <p className="mt-2.5 text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        {new Date(item.dueDate).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>

                      <Link
                        href={item.actionUrl}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition ${
                          isDue
                            ? "bg-[#b91c2b] text-white hover:bg-[#8a1420]"
                            : "bg-gray-900 text-white hover:bg-black"
                        }`}
                      >
                        <span>ประเมินซ้ำ</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================
            LATEST RESULT
        ================================================= */}

        {latest && (
          <div className="bg-white border border-gray-100 rounded-3xl p-7 shadow-sm mb-8">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

              <div>
                <p className="text-sm font-semibold text-[#6c9470] uppercase tracking-wider">
                  LATEST ASSESSMENT
                </p>

                <h2 className="text-2xl font-bold text-gray-800 mt-2">
                  {latest.assessment_name}
                </h2>

                <p className="text-gray-400 mt-1">
                  {formatDate(
                    latest.assessed_at
                  )}
                </p>
              </div>

              {(() => {
                const style =
                  getRiskStyle(
                    latest.risk_level
                  );

                const Icon =
                  style.icon;

                return (
                  <div
                    className={`${style.bg} ${style.border} border rounded-2xl px-5 py-4 flex items-center gap-3`}
                  >
                    <Icon
                      size={22}
                      className={
                        style.text
                      }
                    />

                    <div>
                      <p className="text-xs text-gray-500">
                        ระดับผลการประเมิน
                      </p>

                      <p
                        className={`font-bold ${style.text}`}
                      >
                        {latest.risk_level ||
                          "-"}
                      </p>
                    </div>
                  </div>
                );
              })()}

            </div>

            <div className="border-t border-gray-100 mt-6 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">

              <div>
                <p className="text-sm text-gray-500">
                  คะแนนรวม
                </p>

                <p className="text-3xl font-bold text-[#b91c2b]">
                  {latest.total_score}
                </p>
              </div>

              <button
                onClick={() =>
                  openResult(latest)
                }
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#b91c2b] text-white font-semibold hover:bg-[#991b1b] transition"
              >
                ดูผลการประเมิน
                <ArrowRight size={18} />
              </button>

            </div>

          </div>
        )}

        {/* =================================================
            LATEST BY TYPE
        ================================================= */}

        <section className="mb-8">

          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-[#6c9470] uppercase tracking-wider">
                HEALTH ASSESSMENTS
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-1">
                สรุปผลการประเมิน
              </h2>
            </div>
          </div>

          {data.latestByType.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center">
              <ClipboardList
                size={48}
                className="text-gray-300 mx-auto mb-4"
              />

              <h3 className="text-lg font-semibold text-gray-700">
                ยังไม่มีผลการประเมิน
              </h3>

              <p className="text-gray-400 mt-2">
                เมื่อทำแบบประเมินแล้ว
                ผลจะปรากฏที่นี่
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

              {data.latestByType.map(
                (assessment) => {
                  const style =
                    getRiskStyle(
                      assessment.risk_level
                    );

                  const Icon =
                    style.icon;

                  return (
                    <div
                      key={
                        assessment.assessment_id
                      }
                      className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition"
                    >

                      <div className="flex items-start justify-between">

                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                          <Activity
                            size={24}
                            className="text-[#b91c2b]"
                          />
                        </div>

                        <div
                          className={`${style.bg} ${style.border} border rounded-xl px-3 py-2 flex items-center gap-2`}
                        >
                          <Icon
                            size={16}
                            className={
                              style.text
                            }
                          />

                          <span
                            className={`text-sm font-semibold ${style.text}`}
                          >
                            {
                              assessment.risk_level
                            }
                          </span>
                        </div>

                      </div>

                      <h3 className="text-xl font-bold text-gray-800 mt-5">
                        {
                          assessment.assessment_name
                        }
                      </h3>

                      <p className="text-sm text-gray-400 mt-1">
                        ประเมินเมื่อ{" "}
                        {formatDate(
                          assessment.assessed_at
                        )}
                      </p>

                      <div className="mt-5 pt-5 border-t border-gray-100">

                        <div className="flex items-end justify-between">

                          <div>
                            <p className="text-sm text-gray-400">
                              คะแนน
                            </p>

                            <p className="text-3xl font-bold text-[#b91c2b]">
                              {
                                assessment.total_score
                              }
                            </p>
                          </div>

                          <button
                            onClick={() =>
                              openResult(
                                assessment
                              )
                            }
                            className="text-sm font-semibold text-[#b91c2b] hover:underline flex items-center gap-1"
                          >
                            ดูผล
                            <ArrowRight
                              size={16}
                            />
                          </button>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

        {/* =================================================
            RECENT HISTORY
        ================================================= */}

        <section>

          <div className="flex items-end justify-between mb-5">

            <div>
              <p className="text-sm font-semibold text-[#6c9470] uppercase tracking-wider">
                RECENT HISTORY
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-1">
                ประวัติการประเมินล่าสุด
              </h2>
            </div>

            <button
              onClick={() =>
                router.push("/history")
              }
              className="text-sm font-semibold text-[#b91c2b] hover:underline"
            >
              ดูทั้งหมด
            </button>

          </div>

          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">

            {data.assessments.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                ยังไม่มีประวัติการประเมิน
              </div>
            ) : (
              <div className="divide-y divide-gray-100">

                {data.assessments
                  .slice(0, 6)
                  .map(
                    (assessment) => {
                      const style =
                        getRiskStyle(
                          assessment.risk_level
                        );

                      return (
                        <div
                          key={
                            assessment.assessment_id
                          }
                          className="p-5 flex flex-col md:flex-row md:items-center gap-4 md:justify-between hover:bg-gray-50 transition"
                        >

                          <div className="flex items-center gap-4">

                            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                              <Activity
                                size={21}
                                className="text-[#b91c2b]"
                              />
                            </div>

                            <div>
                              <p className="font-semibold text-gray-800">
                                {
                                  assessment.assessment_name
                                }
                              </p>

                              <p className="text-sm text-gray-400 mt-1">
                                {formatDate(
                                  assessment.assessed_at
                                )}
                              </p>
                            </div>

                          </div>

                          <div className="flex items-center gap-5">

                            <div className="text-right">
                              <p className="text-xs text-gray-400">
                                คะแนน
                              </p>

                              <p className="font-bold text-gray-800">
                                {
                                  assessment.total_score
                                }
                              </p>
                            </div>

                            <span
                              className={`${style.bg} ${style.text} px-4 py-2 rounded-full text-sm font-semibold`}
                            >
                              {
                                assessment.risk_level ||
                                "-"
                              }
                            </span>

                            <button
                              onClick={() =>
                                openResult(
                                  assessment
                                )
                              }
                              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                            >
                              <ArrowRight
                                size={17}
                                className="text-gray-500"
                              />
                            </button>

                          </div>

                        </div>
                      )
                    }
                  )}

              </div>
            )}

          </div>

        </section>

      </div>
    </main>
  );
}