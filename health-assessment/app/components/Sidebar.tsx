"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  BarChart3,
  Bell,
  ClipboardList,
  Heart,
  History,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";

import type { ReactNode } from "react";

/* =========================================================
   SIDEBAR
========================================================= */

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) return;
        const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (data.success) {
          // แจ้งเตือนรายการที่ครบกำหนดหรือยังไม่ได้อ่าน
          const totalAlerts = (data.summary?.dueCount || 0) + (data.summary?.unreadCount || 0);
          setUnreadNotifs(totalAlerts > 0 ? totalAlerts : 0);
        }
      } catch (err) {
        // silent fail in sidebar
      }
    };

    fetchUnread();
  }, [pathname]);

  /* =========================================================
     LOGOUT
  ========================================================= */

  const logout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("roleId");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("hasProfile");
    localStorage.removeItem("rememberLogin");

    router.replace("/login");
  };

  /* =========================================================
     ACTIVE ROUTES
  ========================================================= */

  // ---------------------------------------------------------
  // PROFILE
  // ---------------------------------------------------------

  const isProfileActive =
    pathname === "/profile" ||
    pathname.startsWith("/profile/");

  // ---------------------------------------------------------
  // ASSESSMENT
  // ---------------------------------------------------------

  const isAssessmentActive =
    pathname === "/assessment-type" ||
    pathname.startsWith("/assessment-type/") ||
    pathname.startsWith("/assessment-menu") ||
    pathname.startsWith("/assessment_CVD") ||
    pathname.startsWith("/assessment_DB") ||
    pathname.startsWith("/assessment_diabetes") ||
    pathname.startsWith("/assessment_smoking") ||
    pathname.startsWith("/assessment_depression_2q") ||
    pathname.startsWith("/assessment_depression_9q") ||
    pathname.startsWith("/assessment/");

  // ---------------------------------------------------------
  // DASHBOARD / RESULT
  // ---------------------------------------------------------

  const isResultActive =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/result" ||
    pathname.startsWith("/result/");

  // ---------------------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------------------

  const isNotificationsActive =
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/");

  // ---------------------------------------------------------
  // HISTORY
  // ---------------------------------------------------------

  const isHistoryActive =
    pathname === "/history" ||
    pathname.startsWith("/history/");

  // ---------------------------------------------------------
  // RECOMMENDATION
  // ---------------------------------------------------------

  const isRecommendationActive =
    pathname === "/recommendation" ||
    pathname.startsWith("/recommendation/") ||
    pathname.startsWith("/recommendation-health") ||
    pathname.startsWith("/recommendation_DB") ||
    pathname.startsWith("/recommendation_diabetes");

  // ---------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------

  const isSettingsActive =
    pathname === "/settings" ||
    pathname.startsWith("/settings/");

  /* =========================================================
     UI
  ========================================================= */

  return (
    <aside className="hidden w-[235px] shrink-0 border-r border-[#eee5e6] bg-white px-5 py-7 lg:flex lg:flex-col">

      {/* =====================================================
          LOGO
      ===================================================== */}

      <Link
        href="/assessment-type"
        className="flex items-center gap-3 px-3"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#b91c2b] to-[#8a1420] text-white shadow-[0_12px_28px_rgba(138,20,32,0.20)]">
          <Heart
            size={26}
            fill="currentColor"
          />
        </div>

        <div className="min-w-0">
          <p className="truncate font-bold text-[#2f3037]">
            Health Risk
          </p>

          <p className="text-xs text-[#96969e]">
            Assessment
          </p>
        </div>
      </Link>

      {/* =====================================================
          MENU
      ===================================================== */}

      <nav className="mt-12 space-y-2">

        {/* ---------------------------------------------------
            PROFILE
        --------------------------------------------------- */}

        <SidebarItem
          href="/profile"
          icon={
            <UserRound size={21} />
          }
          label="ข้อมูลสุขภาพของคุณ"
          active={isProfileActive}
        />

        {/* ---------------------------------------------------
            ASSESSMENT
        --------------------------------------------------- */}

        <SidebarItem
          href="/assessment-type"
          icon={
            <ClipboardList size={21} />
          }
          label="แบบประเมินสุขภาพ"
          active={isAssessmentActive}
        />

        {/* ---------------------------------------------------
            DASHBOARD
        --------------------------------------------------- */}

        <SidebarItem
          href="/dashboard"
          icon={
            <BarChart3 size={21} />
          }
          label="Dashboard"
          active={isResultActive}
        />

        {/* ---------------------------------------------------
            NOTIFICATIONS
        --------------------------------------------------- */}

        <SidebarItem
          href="/notifications"
          icon={
            <Bell size={21} />
          }
          label="การแจ้งเตือน"
          active={isNotificationsActive}
          badge={unreadNotifs > 0 ? (unreadNotifs > 9 ? "9+" : unreadNotifs) : undefined}
        />

        {/* ---------------------------------------------------
            HISTORY
        --------------------------------------------------- */}

        <SidebarItem
          href="/history"
          icon={
            <History size={21} />
          }
          label="ประวัติการประเมิน"
          active={isHistoryActive}
        />

        {/* ---------------------------------------------------
            RECOMMENDATION
        --------------------------------------------------- */}

        <SidebarItem
          href="/recommendation"
          icon={
            <Heart size={21} />
          }
          label="คำแนะนำสุขภาพ"
          active={isRecommendationActive}
        />

        {/* ---------------------------------------------------
            SETTINGS
        --------------------------------------------------- */}

        <SidebarItem
          href="/settings"
          icon={
            <Settings size={21} />
          }
          label="ตั้งค่า"
          active={isSettingsActive}
        />

      </nav>

      {/* =====================================================
          LOGOUT
      ===================================================== */}

      <button
        type="button"
        onClick={logout}
        className="mt-auto flex h-12 w-full items-center gap-3 rounded-2xl bg-[#fff0f2] px-4 font-semibold text-[#b91c2b] transition hover:bg-[#ffe4e8] active:scale-[0.99]"
      >
        <LogOut size={20} />

        <span>
          ออกจากระบบ
        </span>
      </button>

    </aside>
  );
}

/* =========================================================
   SIDEBAR ITEM
========================================================= */

type SidebarItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: string | number;
};

function SidebarItem({
  href,
  icon,
  label,
  active = false,
  badge,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      aria-current={
        active
          ? "page"
          : undefined
      }
      className={`flex min-h-14 w-full items-center justify-between rounded-2xl px-4 text-left font-medium transition ${
        active
          ? "bg-[#f8e8ea] text-[#b91c2b]"
          : "text-[#666770] hover:bg-[#f8f5f5] hover:text-[#2f3037]"
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <span className="shrink-0">
          {icon}
        </span>

        <span className="truncate">
          {label}
        </span>
      </div>

      {badge != null && (
        <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#b91c2b] px-1 text-[11px] font-bold text-white shadow-sm">
          {badge}
        </span>
      )}
    </Link>
  );
}