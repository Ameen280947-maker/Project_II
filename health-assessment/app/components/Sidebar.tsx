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
  ChevronLeft,
  ClipboardList,
  Heart,
  History,
  LogOut,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";

import type { ReactNode } from "react";

import { countAlerts, NOTIFICATIONS_UPDATED_EVENT } from "@/app/components/NotificationBell";

/* =========================================================
   CONSTANTS
========================================================= */

const COLLAPSE_KEY = "sidebarCollapsed";

// ต้องตรงกับ FONT_SIZE_PX ในหน้าตั้งค่า
const FONT_SIZE_PX: Record<string, string> = {
  normal: "16px",
  large: "18px",
  xl: "20px",
};

// ข้อมูลผู้ใช้ที่เก็บไว้ในเครื่อง (ลบทิ้งตอนออกจากระบบ)
const USER_STORAGE_KEYS = [
  "userId",
  "username",
  "email",
  "roleId",
  "role",
  "user",
  "hasProfile",
  "rememberLogin",
];

function clearUserStorage() {
  for (const key of USER_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

/* =========================================================
   SIDEBAR
========================================================= */

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  // สถานะย่อ/ขยาย (จำค่าไว้ใน localStorage)
  const [collapsed, setCollapsed] = useState(false);
  // เปิด animation หลังอ่านค่าที่จำไว้แล้ว กันไม่ให้แถบ "กระตุก" ตอนเปิดหน้า
  const [ready, setReady] = useState(false);

  // เมนูแบบลิ้นชักบนมือถือ/แท็บเล็ต (จอแคบกว่า lg)
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // เปลี่ยนหน้าแล้วปิดลิ้นชัก (ปรับ state ระหว่าง render ตามแนวทาง React แทน useEffect)
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setMobileOpen(false);
  }

  // ตอนเปิดลิ้นชัก: ล็อกการเลื่อนหน้าด้านหลัง และกด Esc เพื่อปิด
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // ตรวจ session ฝั่ง server ทุกครั้งที่เปิดหน้า
  // ถ้าไม่มี (เช่น login ไว้ก่อนมีระบบ session หรือ session หมดอายุ) ให้เข้าสู่ระบบใหม่
  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => {
        if (!cancelled && res.status === 401) {
          clearUserStorage();
          router.replace("/login");
        }
      })
      .catch(() => {
        /* เครือข่ายมีปัญหา ไม่ต้องเด้งออก */
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");

      // ขนาดตัวอักษรที่เลือกไว้ในหน้าตั้งค่า (Tailwind ใช้หน่วย rem จึงขยายได้ทั้งหน้า)
      const fontSize = localStorage.getItem("fontSize");
      if (fontSize && fontSize in FONT_SIZE_PX) {
        document.documentElement.style.fontSize = FONT_SIZE_PX[fontSize];
      }
    } catch {
      /* ignore */
    }
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // คีย์ลัด Ctrl + B (Windows) / ⌘ + B (Mac) เพื่อย่อ/ขยาย
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (!typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          // แจ้งเตือนรายการที่ครบกำหนดหรือยังไม่ได้อ่าน (นับเหมือนกระดิ่ง)
          setUnreadNotifs(countAlerts(data.notifications || []));
        }
      } catch (err) {
        // silent fail in sidebar
      }
    };

    fetchUnread();

    // อัปเดตทันทีเมื่อกระดิ่งโหลดใหม่หรือมีการกดอ่าน
    const handleUpdate = (e: Event) => {
      setUnreadNotifs((e as CustomEvent<number>).detail);
    };
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdate);
  }, [pathname]);

  /* =========================================================
     LOGOUT
  ========================================================= */

  const logout = async () => {
    // ลบ session cookie ฝั่ง server ก่อน (ถ้าเรียกไม่สำเร็จก็ยังออกจากระบบในเครื่องต่อ)
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }

    clearUserStorage();

    router.replace("/login");
  };

  /* =========================================================
     ACTIVE ROUTES
  ========================================================= */

  const isProfileActive =
    pathname === "/profile" ||
    pathname.startsWith("/profile/");

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

  const isResultActive =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/result" ||
    pathname.startsWith("/result/");

  const isNotificationsActive =
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/");

  const isHistoryActive =
    pathname === "/history" ||
    pathname.startsWith("/history/");

  const isRecommendationActive =
    pathname === "/recommendation-health" ||
    pathname === "/recommendation" ||
    pathname.startsWith("/recommendation/") ||
    pathname.startsWith("/recommendation-CVD") ||
    pathname.startsWith("/recommendation_DB") ||
    pathname.startsWith("/recommendation_diabetes");

  const isSettingsActive =
    pathname === "/settings" ||
    pathname.startsWith("/settings/");

  const badge = unreadNotifs > 0 ? (unreadNotifs > 9 ? "9+" : unreadNotifs) : undefined;

  // ใช้ร่วมกันทั้งแถบด้านข้าง (จอใหญ่) และลิ้นชัก (มือถือ)
  const menuItems: Omit<SidebarItemProps, "collapsed">[] = [
    { href: "/profile", icon: <UserRound size={21} />, label: "ข้อมูลสุขภาพของคุณ", active: isProfileActive },
    { href: "/assessment-type", icon: <ClipboardList size={21} />, label: "แบบประเมินสุขภาพ", active: isAssessmentActive },
    { href: "/dashboard", icon: <BarChart3 size={21} />, label: "Dashboard", active: isResultActive },
    { href: "/notifications", icon: <Bell size={21} />, label: "การแจ้งเตือนและติดตามสุขภาพ", active: isNotificationsActive, badge },
    { href: "/history", icon: <History size={21} />, label: "ประวัติการประเมิน", active: isHistoryActive },
    { href: "/recommendation-health", icon: <Heart size={21} />, label: "คำแนะนำสุขภาพ", active: isRecommendationActive },
    { href: "/settings", icon: <Settings size={21} />, label: "ตั้งค่า", active: isSettingsActive },
  ];

  /* =========================================================
     UI
  ========================================================= */

  return (
    <>
    {/* =====================================================
        MOBILE TOP BAR (จอแคบกว่า lg)
        globals.css เว้นที่ด้านบนของหน้าให้แถบนี้ (.mobile-topbar)
    ===================================================== */}

    <header className="mobile-topbar fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-[#eee5e6] bg-white/95 px-3 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="เปิดเมนู"
        aria-expanded={mobileOpen}
        aria-controls="mobile-menu"
        className="relative grid h-10 w-10 place-items-center rounded-xl text-[#2f3037] transition hover:bg-[#f8f5f5]"
      >
        <Menu size={22} />
        {badge != null && (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#b91c2b] ring-2 ring-white" />
        )}
      </button>

      <Link href="/assessment-type" className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#b91c2b] to-[#8a1420] text-white">
          <Heart size={17} fill="currentColor" />
        </span>
        <span className="truncate font-bold text-[#2f3037]">Health Risk Assessment</span>
      </Link>
    </header>

    {/* =====================================================
        MOBILE DRAWER
    ===================================================== */}

    <div
      className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!mobileOpen}
    >
      {/* พื้นหลังมืด กดเพื่อปิด */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`absolute inset-0 bg-[#2f3037]/40 transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
      />

      <aside
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="เมนูหลัก"
        className={`absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto bg-white px-5 py-6 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-1">
          <Link href="/assessment-type" className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#b91c2b] to-[#8a1420] text-white">
              <Heart size={23} fill="currentColor" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-bold text-[#2f3037]">Health Risk</span>
              <span className="block text-xs text-[#96969e]">Assessment</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="ปิดเมนู"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#96969e] transition hover:bg-[#f8f5f5] hover:text-[#2f3037]"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="mt-8 space-y-2" aria-label="เมนูหลัก">
          {menuItems.map((item) => (
            <SidebarItem key={item.href} {...item} />
          ))}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="mt-auto flex h-12 w-full shrink-0 items-center gap-3 rounded-2xl bg-[#fff0f2] px-4 font-semibold text-[#b91c2b] transition hover:bg-[#ffe4e8]"
        >
          <LogOut size={20} className="shrink-0" />
          ออกจากระบบ
        </button>
      </aside>
    </div>

    <aside
      data-collapsed={collapsed}
      className={`group/sidebar sticky top-0 hidden h-screen shrink-0 border-r border-[#eee5e6] bg-white py-7 lg:flex lg:flex-col ${
        ready ? "transition-[width,padding] duration-300 ease-[cubic-bezier(.4,0,.2,1)]" : ""
      } ${collapsed ? "w-[88px] px-3" : "w-[235px] px-5"}`}
    >

      {/* =====================================================
          COLLAPSE TOGGLE (ปุ่มกลมที่ขอบแถบ)
      ===================================================== */}

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "ขยายแถบเมนู" : "ย่อแถบเมนู"}
        aria-expanded={!collapsed}
        title={collapsed ? "ขยายแถบเมนู (⌘/Ctrl + B)" : "ย่อแถบเมนู (⌘/Ctrl + B)"}
        className="absolute -right-3.5 top-[42px] z-20 grid h-7 w-7 place-items-center rounded-full border border-[#eee5e6] bg-white text-[#96969e] shadow-[0_2px_8px_rgba(47,48,55,0.10)] transition hover:scale-110 hover:border-[#f2c9cf] hover:text-[#b91c2b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c2b]/40"
      >
        <ChevronLeft
          size={16}
          strokeWidth={2.5}
          className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
        />
      </button>

      {/* =====================================================
          LOGO
      ===================================================== */}

      <Link
        href="/assessment-type"
        className={`flex items-center gap-3 ${collapsed ? "justify-center px-0" : "px-3"}`}
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#b91c2b] to-[#8a1420] text-white shadow-[0_12px_28px_rgba(138,20,32,0.20)]">
          <Heart
            size={26}
            fill="currentColor"
          />
        </div>

        <div
          className={`min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ${
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
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

      <nav className="mt-12 space-y-2" aria-label="เมนูหลัก">
        {menuItems.map((item) => (
          <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* =====================================================
          LOGOUT
      ===================================================== */}

      <button
        type="button"
        onClick={logout}
        aria-label="ออกจากระบบ"
        className={`group relative mt-auto flex h-12 w-full items-center gap-3 rounded-2xl bg-[#fff0f2] font-semibold text-[#b91c2b] transition hover:bg-[#ffe4e8] active:scale-[0.99] ${
          collapsed ? "justify-center px-0" : "px-4"
        }`}
      >
        <LogOut size={20} className="shrink-0" />

        <span
          className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
          ออกจากระบบ
        </span>

        {collapsed && <Tooltip label="ออกจากระบบ" />}
      </button>

    </aside>
    </>
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
  collapsed?: boolean;
};

function SidebarItem({
  href,
  icon,
  label,
  active = false,
  badge,
  collapsed = false,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? (badge != null ? `${label} (${badge} รายการ)` : label) : undefined}
      className={`group relative flex min-h-14 w-full items-center rounded-2xl text-left font-medium transition ${
        collapsed ? "justify-center px-0" : "justify-between px-4"
      } ${
        active
          ? "bg-[#f8e8ea] text-[#b91c2b]"
          : "text-[#666770] hover:bg-[#f8f5f5] hover:text-[#2f3037]"
      }`}
    >
      {/* แถบสีด้านซ้ายเมื่ออยู่หน้านี้ (ช่วยให้เห็นชัดตอนย่อ) */}
      {active && collapsed && (
        <span className="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#b91c2b]" />
      )}

      <div className={`flex min-w-0 items-center ${collapsed ? "gap-0" : "gap-4"}`}>
        <span className="relative shrink-0">
          {icon}

          {/* ตอนย่อ: badge เล็กติดมุมไอคอน */}
          {collapsed && badge != null && (
            <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#b91c2b] px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {badge}
            </span>
          )}
        </span>

        <span
          className={`truncate whitespace-nowrap transition-all duration-300 ${
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
          {label}
        </span>
      </div>

      {/* ตอนขยาย: badge ด้านขวาเหมือนเดิม */}
      {!collapsed && badge != null && (
        <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#b91c2b] px-1 text-[11px] font-bold text-white shadow-sm">
          {badge}
        </span>
      )}

      {collapsed && <Tooltip label={label} />}
    </Link>
  );
}

/* =========================================================
   TOOLTIP (แสดงชื่อเมนูเมื่อชี้ตอนย่อแถบ)
========================================================= */

function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-xl bg-[#2f3037] px-3 py-2 text-sm font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
    >
      {label}
      <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#2f3037]" />
    </span>
  );
}