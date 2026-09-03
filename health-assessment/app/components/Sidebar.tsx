"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  BarChart3,
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
    pathname.startsWith("/assessment/");

  // ---------------------------------------------------------
  // DASHBOARD / RESULT
  // ---------------------------------------------------------

  const isResultActive =
    pathname === "/result" ||
    pathname.startsWith("/result/");

  // ---------------------------------------------------------
  // HISTORY
  // ---------------------------------------------------------

  const isHistoryActive =
    pathname === "/history" ||
    pathname.startsWith("/history/");

  // ---------------------------------------------------------
  // RECOMMENDATION
  //
  // IMPORTANT:
  // /recommendation_smoking จะไม่ Active
  // เพราะเป็นหน้าผลการประเมินการสูบบุหรี่
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
};

function SidebarItem({
  href,
  icon,
  label,
  active = false,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      aria-current={
        active
          ? "page"
          : undefined
      }
      className={`flex min-h-14 w-full items-center gap-4 rounded-2xl px-4 text-left font-medium transition ${
        active
          ? "bg-[#f8e8ea] text-[#b91c2b]"
          : "text-[#666770] hover:bg-[#f8f5f5] hover:text-[#2f3037]"
      }`}
    >
      <span className="shrink-0">
        {icon}
      </span>

      <span className="min-w-0">
        {label}
      </span>
    </Link>
  );
}