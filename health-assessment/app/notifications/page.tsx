"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  Calendar,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Filter,
  RefreshCw,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";
import Sidebar from "@/app/components/Sidebar";
import NotificationBell from "@/app/components/NotificationBell";
import type { CalculatedNotification } from "@/lib/notificationRules";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<CalculatedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "ncd" | "behavior" | "mental">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "due" | "upcoming" | "scheduled">("all");
  const [showGuidelines, setShowGuidelines] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError("");

      const userId = localStorage.getItem("userId");
      if (!userId) {
        throw new Error("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
      }

      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const detail = data.error ? ` (${data.error})` : "";
        throw new Error((data.message || "ไม่สามารถโหลดข้อมูลการแจ้งเตือนได้") + detail);
      }

      setNotifications(data.notifications || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) return;

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(userId), markAll: true }),
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  // Filter
  const filteredNotifications = notifications.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (statusFilter === "due" && !(item.status === "overdue" || item.status === "due_today")) {
      return false;
    }
    if (statusFilter === "upcoming" && item.status !== "upcoming") return false;
    if (statusFilter === "scheduled" && item.status !== "scheduled") return false;
    return true;
  });

  const dueCount = notifications.filter(
    (n) => n.status === "overdue" || n.status === "due_today"
  ).length;

  const upcomingCount = notifications.filter((n) => n.status === "upcoming").length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-[#faf9f7] text-[#2f3037]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Content */}
        <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">
          <div className="max-w-6xl mx-auto">
            {/* Top Bar with Bell */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold tracking-widest text-[#6c9470] uppercase">
                  HEALTH MONITORING SYSTEM
                </p>
                <h1 className="text-3xl sm:text-4xl font-black text-gray-800 mt-1">
                  การแจ้งเตือนและติดตามสุขภาพ
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <NotificationBell />
                <button
                  type="button"
                  onClick={fetchNotifications}
                  title="รีเฟรชข้อมูล"
                  className="w-11 h-11 rounded-2xl bg-white border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-50 transition active:scale-95 shadow-sm"
                >
                  <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {/* Due / Overdue */}
              <div className="bg-white border border-gray-100 rounded-3xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">ถึงเวลาประเมินซ้ำ</p>
                    <p className="text-3xl font-extrabold text-[#b91c2b] mt-1">{dueCount}</p>
                    <p className="text-sm text-red-600 mt-1">
                      {dueCount > 0 ? "ควรทำแบบประเมินโดยเร็ว" : "ไม่มีรายการค้าง"}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-[#b91c2b]">
                    <AlertTriangle size={20} />
                  </div>
                </div>
              </div>

              {/* Upcoming */}
              <div className="bg-white border border-gray-100 rounded-3xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">ใกล้ถึงกำหนด</p>
                    <p className="text-3xl font-extrabold text-amber-600 mt-1">{upcomingCount}</p>
                    <p className="text-sm text-amber-700 mt-1">ภายใน 7 วันข้างหน้า</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Calendar size={20} />
                  </div>
                </div>
              </div>

              {/* Total Active Assessments */}
              <div className="bg-white border border-gray-100 rounded-3xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">แบบประเมินที่ติดตาม</p>
                    <p className="text-3xl font-extrabold text-gray-800 mt-1">
                      {notifications.length}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">จากที่คุณเคยทำ</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
                    <HeartPulse size={20} />
                  </div>
                </div>
              </div>

              {/* Unread */}
              <div className="bg-white border border-gray-100 rounded-3xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600">ยังไม่ได้อ่าน</p>
                    <p className="text-3xl font-extrabold text-blue-600 mt-1">{unreadCount}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {unreadCount > 0 ? (
                        <button
                          onClick={markAllRead}
                          className="text-blue-600 underline font-semibold hover:text-blue-700"
                        >
                          ทำเครื่องหมายว่าอ่านแล้ว
                        </button>
                      ) : (
                        "อ่านครบแล้ว"
                      )}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Bell size={20} />
                  </div>
                </div>
              </div>
            </div>

            {/* เกณฑ์ติดตามแต่ละโรค (พับไว้ กดดูได้) */}
            <section className="mb-6 bg-gradient-to-r from-[#edf5ff] to-[#f4f8ff] border border-blue-100 rounded-3xl p-5">
              <button
                type="button"
                onClick={() => setShowGuidelines(!showGuidelines)}
                aria-expanded={showGuidelines}
                aria-controls="follow-up-guidelines"
                className="w-full flex items-center justify-between gap-4 text-left"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shrink-0">
                    <ShieldCheck size={22} />
                  </span>
                  <span className="font-bold text-gray-800 md:text-base">
                    ควรประเมินซ้ำบ่อยแค่ไหน?
                  </span>
                </span>
                <span className="shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-50 transition">
                  <span className="hidden sm:inline">{showGuidelines ? "ซ่อนเกณฑ์" : "ดูเกณฑ์แต่ละโรค"}</span>
                  <ChevronDown size={18} className={`transition-transform ${showGuidelines ? "rotate-180" : ""}`} />
                </span>
              </button>

              {showGuidelines && (
                <div id="follow-up-guidelines" className="mt-5 p-5 bg-white rounded-2xl border border-blue-100">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    ระบบจะเตือนให้ประเมินซ้ำตามระดับความเสี่ยงของคุณ ยิ่งเสี่ยงมากยิ่งต้องประเมินถี่ขึ้น เช่น
                    เสี่ยงสูง ทุก 14-30 วัน · เสี่ยงปานกลาง ทุก 2-6 เดือน · เสี่ยงต่ำ ทุก 6 เดือน - 1 ปี
                    <span className="text-gray-400"> (อ้างอิงเกณฑ์ทางการแพทย์ของแต่ละโรค — Clinical Follow-up Protocol)</span>
                  </p>

                  <div className="mt-5 flex flex-col gap-6">
                    {GUIDELINES.map((g) => (
                      <div key={g.disease}>
                        <h4 className="text-sm font-bold text-gray-900">{g.disease}</h4>
                        <ul className="mt-2 divide-y divide-gray-100">
                          {g.rows.map((r) => (
                            <li key={r.level} className="py-2.5 grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
                              <span className="flex items-start gap-2 text-gray-700">
                                <span className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${RISK_DOT[r.risk]}`} />
                                {r.level}
                              </span>
                              <span className="pl-4 sm:pl-0 font-semibold text-gray-900">{r.interval}</span>
                              <span className="pl-4 sm:pl-0 text-gray-500">{r.goal}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 p-1.5 rounded-2xl shadow-sm">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition ${
                    categoryFilter === "all"
                      ? "bg-[#b91c2b] text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("ncd")}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition ${
                    categoryFilter === "ncd"
                      ? "bg-[#b91c2b] text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  โรคไม่ติดต่อ (NCDs)
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("behavior")}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition ${
                    categoryFilter === "behavior"
                      ? "bg-[#b91c2b] text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  พฤติกรรมสุขภาพ
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("mental")}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition ${
                    categoryFilter === "mental"
                      ? "bg-[#b91c2b] text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  สุขภาพจิต
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 p-1.5 rounded-2xl shadow-sm text-sm font-medium text-gray-600">
                <Filter size={14} className="text-gray-400 ml-2" />
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1 rounded-xl transition ${
                    statusFilter === "all" ? "bg-gray-100 text-gray-900 font-bold" : "hover:text-gray-900"
                  }`}
                >
                  ทุกสถานะ
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("due")}
                  className={`px-3 py-1 rounded-xl transition ${
                    statusFilter === "due"
                      ? "bg-red-50 text-[#b91c2b] font-bold"
                      : "hover:text-gray-900"
                  }`}
                >
                  ถึงเวลาแล้ว ({dueCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("upcoming")}
                  className={`px-3 py-1 rounded-xl transition ${
                    statusFilter === "upcoming"
                      ? "bg-amber-50 text-amber-700 font-bold"
                      : "hover:text-gray-900"
                  }`}
                >
                  ใกล้ถึงกำหนด ({upcomingCount})
                </button>
              </div>
            </div>

            {/* Notifications Cards Grid */}
            {loading ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-[#b91c2b] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-medium">กำลังคำนวณและดึงข้อมูลการแจ้งเตือน...</p>
              </div>
            ) : error ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-red-100 shadow-sm">
                <AlertTriangle className="text-red-500 mx-auto mb-3" size={40} />
                <h3 className="text-lg font-bold text-gray-800">เกิดข้อผิดพลาด</h3>
                <p className="text-gray-500 text-sm mt-1">{error}</p>
                <button
                  onClick={fetchNotifications}
                  className="mt-4 px-5 py-2 rounded-xl bg-[#b91c2b] text-white text-sm font-semibold hover:bg-[#8a1420] transition"
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                <CheckCircle2 className="text-green-500 mx-auto mb-3" size={48} />
                <h3 className="text-lg font-bold text-gray-800">ไม่พบรายการแจ้งเตือนตามเงื่อนไข</h3>
                <p className="text-gray-500 text-sm mt-1">
                  การประเมินสุขภาพของคุณอยู่ในเกณฑ์ปกติ หรือยังไม่ถึงกำหนดติดตามซ้ำ
                </p>
                <Link
                  href="/assessment-type"
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#b91c2b] text-white font-bold text-sm hover:bg-[#8a1420] transition shadow-sm"
                >
                  <span>ทำแบบประเมินสุขภาพ</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {GROUPS.map((g) => {
                  const items = filteredNotifications.filter((n) => g.statuses.includes(n.status));
                  if (items.length === 0) return null;
                  return (
                    <section key={g.key} aria-label={g.title}>
                      <div className="mb-2 px-1">
                        <h2 className="flex items-center gap-2 font-bold text-gray-800">
                          <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                          {g.title}
                          <span className="text-gray-400 font-medium">({items.length})</span>
                        </h2>
                        <p className="mt-0.5 pl-4 text-sm text-gray-500">{g.desc}</p>
                      </div>
                      <ul className="bg-white border border-gray-100 rounded-3xl divide-y divide-gray-100">
                        {items.map((item) => (
                          <NotificationRow
                            key={item.notificationId || `${item.assessmentTypeId}-${item.assessmentId}`}
                            item={item}
                            formatDate={formatDate}
                          />
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

// จัดกลุ่มตามความเร่งด่วน: ต้องทำตอนนี้ → ใกล้ถึงกำหนด → ตามรอบปกติ
const GROUPS: {
  key: string;
  title: string;
  desc: string;
  dot: string;
  statuses: CalculatedNotification["status"][];
}[] = [
  {
    key: "due",
    title: "ถึงเวลาประเมินซ้ำ",
    desc: "ครบรอบแล้ว ควรทำแบบประเมินซ้ำเพื่อดูว่าผลดีขึ้นหรือแย่ลง",
    dot: "bg-[#b91c2b]",
    statuses: ["overdue", "due_today"],
  },
  {
    key: "upcoming",
    title: "ใกล้ถึงกำหนด (ภายใน 7 วัน)",
    desc: "จะครบรอบในอีกไม่กี่วัน เตรียมทำแบบประเมินได้เลย",
    dot: "bg-amber-500",
    statuses: ["upcoming"],
  },
  {
    key: "scheduled",
    title: "ยังไม่ถึงกำหนด",
    desc: "ยังอยู่ในรอบติดตาม ระบบจะแจ้งเตือนเมื่อถึงวันที่ควรประเมินซ้ำ",
    dot: "bg-gray-300",
    statuses: ["scheduled"],
  },
];

// แถวสรุปของแต่ละแบบประเมิน กด "รายละเอียด" เพื่อดูคำแนะนำและรอบการติดตาม
function NotificationRow({
  item,
  formatDate,
}: {
  item: CalculatedNotification;
  formatDate: (date?: string | null) => string;
}) {
  const [open, setOpen] = useState(false);
  const isDue = item.status === "overdue" || item.status === "due_today";
  const isUpcoming = item.status === "upcoming";
  const detailId = `notif-detail-${item.assessmentTypeId}-${item.assessmentId}`;

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-[1_1_280px]">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isDue ? "bg-red-100 text-[#b91c2b]" : isUpcoming ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {item.statusText}
            </span>
            <h3 className="font-bold text-gray-900 leading-snug">{item.assessmentName}</h3>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            ผลครั้งล่าสุด: <span className="font-semibold text-gray-800">{item.riskLevel}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            {isDue ? "ควรประเมินตั้งแต่" : "ประเมินครั้งถัดไป"} {formatDate(item.dueDate)}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={detailId}
            className="h-10 px-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 inline-flex items-center gap-1"
          >
            รายละเอียด
            <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <Link
            href={item.actionUrl}
            className={`h-10 inline-flex items-center gap-2 px-4 rounded-xl font-bold text-sm transition active:scale-95 ${
              isDue ? "bg-[#b91c2b] text-white hover:bg-[#8a1420]" : "bg-[#2f3037] text-white hover:bg-black"
            }`}
          >
            <span>{isDue ? "ประเมินซ้ำ" : "ทำแบบประเมิน"}</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {open && (
        <div id={detailId} className="mt-3 p-4 rounded-2xl bg-gray-50 text-sm">
          <p className="text-gray-700 leading-relaxed">{item.message}</p>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-500">
            <div>
              <dt className="inline">ควรประเมินซ้ำ: </dt>
              <dd className="inline font-semibold text-gray-700">
                {item.intervalLabel} ({item.intervalDays} วัน)
              </dd>
            </div>
            <div>
              <dt className="inline">ทำครั้งล่าสุดเมื่อ: </dt>
              <dd className="inline font-semibold text-gray-700">{formatDate(item.assessedAt)}</dd>
            </div>
          </dl>
        </div>
      )}
    </li>
  );
}

// ตารางเกณฑ์ระยะเวลาติดตามประเมินซ้ำตามมาตรฐานทางการแพทย์
const RISK_DOT = { high: "bg-red-500", mid: "bg-orange-400", low: "bg-green-500" } as const;

const GUIDELINES: {
  disease: string;
  rows: { risk: keyof typeof RISK_DOT; level: string; interval: string; goal: string }[];
}[] = [
  {
    disease: "ความดันโลหิต",
    rows: [
      { risk: "high", level: "สูงอันตราย (Emergency)", interval: "ทันที / ภายใน 24 ชม.", goal: "พบแพทย์ทันที ป้องกันภาวะแทรกซ้อนหลอดเลือดสมอง" },
      { risk: "mid", level: "น่าจะเป็น / อาจเป็นโรคความดัน", interval: "1 - 3 เดือน (30-90 วัน)", goal: "ตรวจติดตามและปรับเปลี่ยนพฤติกรรม ลดเค็ม" },
      { risk: "low", level: "เริ่มสูง / ปกติ", interval: "6 เดือน - 1 ปี (180-365 วัน)", goal: "ตรวจวัดสม่ำเสมอประจำปี" },
    ],
  },
  {
    disease: "ความเสี่ยงหัวใจ & หลอดเลือด (Thai CVD)",
    rows: [
      { risk: "high", level: "เสี่ยงสูง (≥30%)", interval: "ทุก 2 เดือน (60 วัน)", goal: "พบแพทย์ ควบคุมเบาหวาน ความดัน คอเลสเตอรอล" },
      { risk: "low", level: "เสี่ยงปานกลาง / น้อย", interval: "6 เดือน - 1 ปี", goal: "ออกกำลังกาย คุมน้ำหนัก ตรวจสุขภาพประจำปี" },
    ],
  },
  {
    disease: "ความเสี่ยงเบาหวาน (TDS / DM Risk)",
    rows: [
      { risk: "high", level: "เสี่ยงสูงมาก / มีปัจจัยเสี่ยง", interval: "3 - 6 เดือน (90-180 วัน)", goal: "ตรวจระดับน้ำตาลในเลือด (FPG/HbA1c)" },
      { risk: "low", level: "เสี่ยงปานกลาง / น้อย", interval: "1 - 2 ปี (365-730 วัน)", goal: "ตรวจคัดกรองตามรอบและควบคุมอาหาร" },
    ],
  },
  {
    disease: "สุขภาพจิต (ความเครียด ST-5 & ซึมเศร้า 9Q)",
    rows: [
      { risk: "high", level: "เครียดรุนแรง / ซึมเศร้ารุนแรง", interval: "ทุก 7 - 14 วัน (ด่วน)", goal: "พบแพทย์หรือโทร 1323 ติดตามความเสี่ยงทำร้ายตนเอง" },
      { risk: "low", level: "ปานกลาง / น้อย / ปกติ", interval: "1 - 3 เดือน (30-90 วัน)", goal: "สังเกตอารมณ์และฝึกคลายเครียดสม่ำเสมอ" },
    ],
  },
  {
    disease: "พฤติกรรม (บุหรี่ / แอลกอฮอล์ / นอนหลับ / อาหาร)",
    rows: [
      { risk: "mid", level: "เสี่ยงสูง / ติดนิโคติน / ไม่เพียงพอ", interval: "ทุก 1 เดือน (30 วัน)", goal: "ติดตามความก้าวหน้าในการปรับเปลี่ยนพฤติกรรม" },
    ],
  },
];
