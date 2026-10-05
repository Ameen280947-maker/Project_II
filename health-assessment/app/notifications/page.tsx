"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Filter,
  RefreshCw,
  Info,
  HeartPulse,
  Activity,
  Brain,
  ChevronRight,
  ShieldCheck,
  CheckCheck,
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
                <p className="text-sm text-gray-500 mt-1">
                  ระบบแจ้งเตือนรอบการประเมินซ้ำตามเกณฑ์ทางการแพทย์ของแต่ละโรค
                </p>
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
              <div className="bg-white border border-red-100 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400">ครบกำหนดประเมินซ้ำ</p>
                    <p className="text-3xl font-extrabold text-[#b91c2b] mt-1">{dueCount}</p>
                    <p className="text-xs text-red-500 font-medium mt-1">
                      {dueCount > 0 ? "ควรทำแบบประเมินทันที" : "ไม่มีรายการค้าง"}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-[#b91c2b]">
                    <AlertTriangle size={20} />
                  </div>
                </div>
              </div>

              {/* Upcoming */}
              <div className="bg-white border border-amber-100 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400">ใกล้ถึงกำหนด (ใน 7 วัน)</p>
                    <p className="text-3xl font-extrabold text-amber-600 mt-1">{upcomingCount}</p>
                    <p className="text-xs text-amber-600 font-medium mt-1">เตรียมตัวประเมิน</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Calendar size={20} />
                  </div>
                </div>
              </div>

              {/* Total Active Assessments */}
              <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400">โรคที่อยู่ในระบบติดตาม</p>
                    <p className="text-3xl font-extrabold text-gray-800 mt-1">
                      {notifications.length}
                    </p>
                    <p className="text-xs text-gray-400 font-medium mt-1">รายการที่ประเมินแล้ว</p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
                    <HeartPulse size={20} />
                  </div>
                </div>
              </div>

              {/* Unread */}
              <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400">การแจ้งเตือนใหม่</p>
                    <p className="text-3xl font-extrabold text-blue-600 mt-1">{unreadCount}</p>
                    <p className="text-xs text-gray-400 font-medium mt-1">
                      {unreadCount > 0 ? (
                        <button
                          onClick={markAllRead}
                          className="text-blue-600 underline font-semibold hover:text-blue-700"
                        >
                          อ่านทั้งหมด
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

            {/* Guideline Banner Toggle */}
            <div className="mb-6 bg-gradient-to-r from-[#edf5ff] to-[#f4f8ff] border border-blue-100 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shrink-0">
                  <Info size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm md:text-base">
                    เกณฑ์กำหนดระยะเวลาการแจ้งเตือนของแต่ละโรค (Clinical Follow-up Protocol)
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    ระบบคำนวณระยะการประเมินซ้ำตามความเสี่ยงของแต่ละโรคโดยอัตโนมัติ (เช่น
                    กลุ่มเสี่ยงสูง 14-30 วัน, เสี่ยงปานกลาง 2-6 เดือน, เสี่ยงต่ำ 6 เดือน - 1 ปี)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuidelines(!showGuidelines)}
                className="px-4 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 font-semibold text-xs hover:bg-blue-50 transition shrink-0"
              >
                {showGuidelines ? "ซ่อนตารางเกณฑ์" : "ดูตารางเกณฑ์แต่ละโรค"}
              </button>
            </div>

            {/* Guideline Table Modal/Drawer */}
            {showGuidelines && (
              <div className="mb-8 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm overflow-hidden animate-in fade-in duration-200">
                <h4 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <ShieldCheck className="text-[#6c9470]" size={20} />
                  ตารางเกณฑ์การแจ้งเตือนและระยะเวลาติดตามประเมินซ้ำตามมาตรฐานทางการแพทย์
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 font-bold">
                        <th className="py-3 px-4 rounded-l-xl">ประเภทโรค / แบบประเมิน</th>
                        <th className="py-3 px-4">ระดับความเสี่ยง</th>
                        <th className="py-3 px-4">ระยะเวลาติดตามประเมินซ้ำ</th>
                        <th className="py-3 px-4 rounded-r-xl">เป้าหมายและการดูแล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      <tr>
                        <td className="py-3 px-4 font-semibold text-gray-900" rowSpan={3}>
                          ความดันโลหิต
                        </td>
                        <td className="py-3 px-4 text-red-600 font-medium">สูงอันตราย (Emergency)</td>
                        <td className="py-3 px-4 font-bold text-red-600">ทันที / ภายใน 24 ชม.</td>
                        <td className="py-3 px-4 text-gray-500">พบแพทย์ทันที ป้องกันภาวะแทรกซ้อนหลอดเลือดสมอง</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-orange-600 font-medium">น่าจะเป็น / อาจเป็นโรคความดัน</td>
                        <td className="py-3 px-4 font-bold">1 - 3 เดือน (30-90 วัน)</td>
                        <td className="py-3 px-4 text-gray-500">ตรวจติดตามและปรับเปลี่ยนพฤติกรรม ลดเค็ม</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-green-600 font-medium">เริ่มสูง / ปกติ</td>
                        <td className="py-3 px-4 font-bold">6 เดือน - 1 ปี (180-365 วัน)</td>
                        <td className="py-3 px-4 text-gray-500">ตรวจวัดสม่ำเสมอประจำปี</td>
                      </tr>

                      <tr className="bg-gray-50/50">
                        <td className="py-3 px-4 font-semibold text-gray-900" rowSpan={2}>
                          ความเสี่ยงหัวใจ & หลอดเลือด (Thai CVD)
                        </td>
                        <td className="py-3 px-4 text-red-600 font-medium">เสี่ยงสูง (≥30%)</td>
                        <td className="py-3 px-4 font-bold text-red-600">ทุก 2 เดือน (60 วัน)</td>
                        <td className="py-3 px-4 text-gray-500">พบแพทย์ ควบคุมเบาหวาน ความดัน คอเลสเตอรอล</td>
                      </tr>
                      <tr className="bg-gray-50/50">
                        <td className="py-3 px-4 text-green-600 font-medium">เสี่ยงปานกลาง / น้อย</td>
                        <td className="py-3 px-4 font-bold">6 เดือน - 1 ปี</td>
                        <td className="py-3 px-4 text-gray-500">ออกกำลังกาย คุมน้ำหนัก ตรวจสุขภาพประจำปี</td>
                      </tr>

                      <tr>
                        <td className="py-3 px-4 font-semibold text-gray-900" rowSpan={2}>
                          ความเสี่ยงเบาหวาน (TDS / DM Risk)
                        </td>
                        <td className="py-3 px-4 text-red-600 font-medium">เสี่ยงสูงมาก / มีปัจจัยเสี่ยง</td>
                        <td className="py-3 px-4 font-bold text-red-600">3 - 6 เดือน (90-180 วัน)</td>
                        <td className="py-3 px-4 text-gray-500">ตรวจระดับน้ำตาลในเลือด (FPG/HbA1c)</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-green-600 font-medium">เสี่ยงปานกลาง / น้อย</td>
                        <td className="py-3 px-4 font-bold">1 - 2 ปี (365-730 วัน)</td>
                        <td className="py-3 px-4 text-gray-500">ตรวจคัดกรองตามรอบและควบคุมอาหาร</td>
                      </tr>

                      <tr className="bg-gray-50/50">
                        <td className="py-3 px-4 font-semibold text-gray-900" rowSpan={2}>
                          สุขภาพจิต (ความเครียด ST-5 & ซึมเศร้า 9Q)
                        </td>
                        <td className="py-3 px-4 text-red-600 font-medium">เครียดรุนแรง / ซึมเศร้ารุนแรง</td>
                        <td className="py-3 px-4 font-bold text-red-600">ทุก 7 - 14 วัน (ด่วน)</td>
                        <td className="py-3 px-4 text-gray-500">พบแพทย์หรือโทร 1323 ติดตามความเสี่ยงทำร้ายตนเอง</td>
                      </tr>
                      <tr className="bg-gray-50/50">
                        <td className="py-3 px-4 text-green-600 font-medium">ปานกลาง / น้อย / ปกติ</td>
                        <td className="py-3 px-4 font-bold">1 - 3 เดือน (30-90 วัน)</td>
                        <td className="py-3 px-4 text-gray-500">สังเกตอารมณ์และฝึกคลายเครียดสม่ำเสมอ</td>
                      </tr>

                      <tr>
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          พฤติกรรม (บุหรี่ / แอลกอฮอล์ / นอนหลับ / อาหาร)
                        </td>
                        <td className="py-3 px-4 text-orange-600 font-medium">เสี่ยงสูง / ติดนิโคติน / ไม่เพียงพอ</td>
                        <td className="py-3 px-4 font-bold text-orange-600">ทุก 1 เดือน (30 วัน)</td>
                        <td className="py-3 px-4 text-gray-500">ติดตามความก้าวหน้าในการปรับเปลี่ยนพฤติกรรม</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 p-1.5 rounded-2xl shadow-sm">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    categoryFilter === "mental"
                      ? "bg-[#b91c2b] text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  สุขภาพจิต
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-gray-200 p-1.5 rounded-2xl shadow-sm text-xs font-medium text-gray-600">
                <Filter size={14} className="text-gray-400 ml-2" />
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1 rounded-xl transition ${
                    statusFilter === "all" ? "bg-gray-100 text-gray-900 font-bold" : "hover:text-gray-900"
                  }`}
                >
                  สถานะทั้งหมด
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
                  ครบกำหนด ({dueCount})
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
                  เร็วๆ นี้ ({upcomingCount})
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredNotifications.map((item) => {
                  const isDue = item.status === "overdue" || item.status === "due_today";
                  const isUpcoming = item.status === "upcoming";

                  const cardBorder = isDue
                    ? "border-red-200 shadow-[0_8px_25px_rgba(238,63,91,0.08)] bg-gradient-to-br from-white to-red-50/20"
                    : isUpcoming
                    ? "border-amber-200 bg-gradient-to-br from-white to-amber-50/20"
                    : "border-gray-100 bg-white";

                  return (
                    <div
                      key={item.notificationId || `${item.assessmentTypeId}-${item.assessmentId}`}
                      className={`rounded-3xl p-6 border transition hover:shadow-md flex flex-col justify-between ${cardBorder}`}
                    >
                      <div>
                        {/* Status Header */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                                isDue
                                  ? "bg-red-100 text-[#b91c2b]"
                                  : isUpcoming
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {item.statusText}
                            </span>

                            <span className="text-xs font-medium text-gray-400">
                              รอบติดตาม: {item.intervalLabel}
                            </span>
                          </div>

                          <span className="text-xs text-gray-400">
                            ครบกำหนด: {formatDate(item.dueDate)}
                          </span>
                        </div>

                        {/* Title & Assessment */}
                        <h3 className="text-lg font-bold text-gray-900 leading-snug">
                          {item.assessmentName}
                        </h3>

                        <div className="mt-2.5 flex items-center gap-2 text-xs">
                          <span className="text-gray-400">ผลล่าสุด:</span>
                          <span className="font-bold text-gray-800 bg-gray-100 px-2.5 py-0.5 rounded-lg">
                            {item.riskLevel}
                          </span>
                          <span className="text-gray-400">
                            (ประเมินเมื่อ {formatDate(item.assessedAt)})
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-gray-600 leading-relaxed bg-white/70 p-3 rounded-2xl border border-gray-100">
                          {item.message}
                        </p>
                      </div>

                      {/* Action CTA */}
                      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-400">
                          เกณฑ์ประเมินซ้ำ: {item.intervalDays} วัน
                        </span>

                        <Link
                          href={item.actionUrl}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition shadow-sm active:scale-95 ${
                            isDue
                              ? "bg-gradient-to-r from-[#ee3f5b] to-[#b91c2b] text-white hover:opacity-95 shadow-[0_8px_20px_rgba(185,28,43,0.25)]"
                              : "bg-[#2f3037] text-white hover:bg-black"
                          }`}
                        >
                          <span>{isDue ? "ทำแบบประเมินซ้ำตอนนี้" : "เริ่มทำแบบประเมิน"}</span>
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
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
