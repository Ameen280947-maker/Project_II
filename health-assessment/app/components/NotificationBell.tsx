"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowRight,
  Check,
  CheckCheck,
  X,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import type { CalculatedNotification } from "@/lib/notificationRules";

interface NotificationBellProps {
  className?: string;
  onNavigate?: () => void;
}

export default function NotificationBell({ className = "", onNavigate }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<CalculatedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "due" | "upcoming">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) return;

      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.summary?.unreadCount || 0);
        setDueCount(data.summary?.dueCount || 0);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // refresh every 1 min
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = async (notificationId?: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) return;

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          notificationId,
          markAll: !notificationId,
        }),
      });

      if (!notificationId) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      } else {
        setNotifications((prev) =>
          prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleAction = (notif: CalculatedNotification) => {
    if (!notif.isRead && notif.notificationId) {
      markAsRead(notif.notificationId);
    }
    setIsOpen(false);
    if (onNavigate) onNavigate();
    router.push(notif.actionUrl);
  };

  // Filter items based on activeTab
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "due") return n.status === "overdue" || n.status === "due_today";
    if (activeTab === "upcoming") return n.status === "upcoming";
    return true;
  });

  const getUrgencyBadge = (urgency: string, status: string) => {
    if (status === "overdue") {
      return {
        bg: "bg-red-50 text-red-700 border-red-200",
        label: "ครบกำหนดแล้ว",
        icon: AlertTriangle,
      };
    }
    if (status === "due_today") {
      return {
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        label: "ถึงกำหนดวันนี้",
        icon: Clock,
      };
    }
    if (urgency === "critical") {
      return {
        bg: "bg-rose-50 text-rose-700 border-rose-200",
        label: "เร่งด่วน",
        icon: ShieldAlert,
      };
    }
    if (status === "upcoming") {
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        label: "ใกล้ถึงกำหนด",
        icon: Calendar,
      };
    }
    return {
      bg: "bg-slate-50 text-slate-600 border-slate-200",
      label: "ตามรอบนัด",
      icon: Clock,
    };
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        aria-label="การแจ้งเตือน"
        className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#b91c2b]/30"
      >
        <Bell size={20} className={dueCount > 0 ? "text-[#b91c2b] animate-pulse" : "text-gray-600"} />

        {/* Unread / Due Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b91c2b] px-1 text-[11px] font-bold text-white shadow-md animate-bounce">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-[360px] sm:w-[420px] max-w-[90vw] bg-white border border-gray-100 rounded-3xl shadow-2xl z-50 overflow-hidden transform transition-all duration-200 animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-[#faf5f5] to-white border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-[#b91c2b]">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">การแจ้งเตือนติดตามสุขภาพ</h3>
                <p className="text-xs text-gray-500">
                  {dueCount > 0 ? (
                    <span className="text-[#b91c2b] font-medium">มี {dueCount} รายการที่ครบกำหนด</span>
                  ) : (
                    "กำหนดประเมินซ้ำตามเกณฑ์โรค"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAsRead()}
                  title="ทำเครื่องหมายอ่านทั้งหมด"
                  className="p-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition flex items-center gap-1"
                >
                  <CheckCheck size={15} />
                  <span className="hidden sm:inline">อ่านหมด</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-gray-100 bg-[#fbf9f9] px-3 pt-2 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-2.5 px-3 border-b-2 transition ${
                activeTab === "all"
                  ? "border-[#b91c2b] text-[#b91c2b]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              ทั้งหมด ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab("due")}
              className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "due"
                  ? "border-[#b91c2b] text-[#b91c2b]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <span>ครบกำหนด</span>
              {dueCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-[#b91c2b] text-[10px]">
                  {dueCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`pb-2.5 px-3 border-b-2 transition ${
                activeTab === "upcoming"
                  ? "border-[#b91c2b] text-[#b91c2b]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              เร็วๆ นี้
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Check className="mx-auto mb-2 text-green-500" size={32} />
                <p className="text-sm font-medium text-gray-600">ไม่มีการแจ้งเตือนในหมวดนี้</p>
                <p className="text-xs text-gray-400 mt-1">
                  ผลการประเมินของคุณยังไม่ถึงกำหนดติดตามซ้ำ
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const badge = getUrgencyBadge(notif.urgency, notif.status);
                const BadgeIcon = badge.icon;
                const isDue = notif.status === "overdue" || notif.status === "due_today";

                return (
                  <div
                    key={notif.notificationId || `${notif.assessmentTypeId}-${notif.assessmentId}`}
                    onClick={() => handleAction(notif)}
                    className={`p-4 transition hover:bg-gray-50 cursor-pointer ${
                      !notif.isRead ? "bg-red-50/20" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}
                        >
                          <BadgeIcon size={12} />
                          {badge.label}
                        </span>

                        <span className="text-[11px] font-medium text-gray-400">
                          {notif.intervalLabel}
                        </span>
                      </div>

                      {/* Overdue/Remaining text */}
                      <span
                        className={`text-xs font-semibold ${
                          isDue ? "text-[#b91c2b]" : "text-gray-500"
                        }`}
                      >
                        {notif.statusText}
                      </span>
                    </div>

                    {/* Title & Assessment */}
                    <div className="mt-2">
                      <h4 className="text-sm font-bold text-gray-800 leading-tight">
                        {notif.assessmentName}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Meta info & Action */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="text-[11px] text-gray-400">
                        ผลล่าสุด:{" "}
                        <span className="font-semibold text-gray-700">{notif.riskLevel}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!notif.isRead && (
                          <button
                            type="button"
                            onClick={(e) => markAsRead(notif.notificationId, e)}
                            title="ทำเครื่องหมายว่าอ่านแล้ว"
                            className="p-1 text-gray-400 hover:text-green-600 transition"
                          >
                            <Check size={14} />
                          </button>
                        )}

                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#b91c2b] hover:underline">
                          ประเมินซ้ำ
                          <ArrowRight size={13} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50/80 border-t border-gray-100 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-gray-700 hover:text-[#b91c2b] transition inline-flex items-center gap-1.5"
            >
              <span>ดูตารางนัดหมายและประวัติการแจ้งเตือนทั้งหมด</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
