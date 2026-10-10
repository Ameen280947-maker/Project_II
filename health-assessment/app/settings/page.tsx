"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { CONSENT_TEXT } from "@/lib/consents";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  HelpCircle,
  KeyRound,
  LogOut,
  Pencil,
  Phone,
  Shield,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type Settings = {
  notify_reassess: boolean;
  notify_weekly: boolean;
  notify_goals: boolean;
  notify_tips: boolean;
  notify_channel: "app_email" | "app" | "email";
  notify_time: string;
  reassess_overrides: Record<string, string>;
  font_size: "normal" | "large" | "xl";
  language: "th" | "en";
  year_format: "be" | "ce";
  require_otp: boolean;
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
  consent_health: boolean;
  consent_health_at: string | null;
  consent_research: boolean;
  consent_research_at: string | null;
  consent_staff: boolean;
  consent_staff_at: string | null;
};

type Profile = {
  username: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string | null;
};

// ข้อมูลจาก /api/settings/export (แต่ละแถวเป็น object ตามคอลัมน์)
type ExportData = {
  profiles: Record<string, unknown>[];
  assessments: Record<string, unknown>[];
  answers: Record<string, unknown>[];
};

/* =========================================================
   CONSTANTS
========================================================= */

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "account", label: "บัญชีผู้ใช้", icon: User },
  { id: "security", label: "ความปลอดภัย", icon: Shield },
  { id: "display", label: "การแสดงผล", icon: Eye },
  { id: "emergency", label: "ผู้ติดต่อฉุกเฉิน", icon: Phone },
  { id: "privacy", label: "ความเป็นส่วนตัว", icon: KeyRound },
  { id: "about", label: "ช่วยเหลือ", icon: HelpCircle },
  { id: "danger", label: "จัดการข้อมูลถาวร", icon: Trash2 },
];

const FONT_SIZE_PX: Record<Settings["font_size"], string> = {
  normal: "16px",
  large: "18px",
  xl: "20px",
};

/*
  หมายเหตุ: ซ่อนตัวเลือกที่บันทึกได้แต่ยังไม่มีผลกับระบบจริง
  (การแจ้งเตือน/ช่องทาง/เวลา/รอบประเมินซ้ำ, OTP ตอนเข้าสู่ระบบ, ภาษา, รูปแบบปี)
  ฟิลด์ยังอยู่ใน DB และ API ถ้าเชื่อมใช้งานจริงแล้วค่อยเปิดกลับมา
*/

/* =========================================================
   HELPERS
========================================================= */

const formatDate = (d?: string | null, yearFormat: Settings["year_format"] = "be") => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString(yearFormat === "be" ? "th-TH" : "th-TH-u-ca-gregory", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// อ่านข้อมูลบัญชีจาก /api/profile
// ข้อมูลบัญชี (username, email, วันที่สมัคร) อยู่ใน raw.user
// ส่วน raw.profile เป็นข้อมูลสุขภาพ จึงต้องอ่าน user ก่อน
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readProfile = (raw: any): Profile => {
  const u = raw?.user ?? {};
  const p = raw?.profile ?? raw?.data ?? {};
  const first = u.first_name ?? p.first_name ?? "";
  const last = u.last_name ?? p.last_name ?? "";
  const username = u.username ?? p.username ?? "";
  return {
    username,
    name: [first, last].filter(Boolean).join(" ") || username,
    email: u.email ?? p.email ?? "",
    phone: u.phone ?? p.phone ?? p.phone_number ?? p.tel ?? "",
    createdAt: u.created_at ?? u.createdAt ?? p.created_at ?? null,
  };
};

// ไฟล์ CSV เดียว แบ่ง 3 ส่วน (โปรไฟล์สุขภาพ / ประวัติการประเมิน / คำตอบรายข้อ) คั่นด้วยบรรทัดว่าง
const CSV_SECTIONS: { title: string; key: keyof ExportData; columns: [string, string][] }[] = [
  {
    title: "โปรไฟล์สุขภาพ (แถวบนสุดคือข้อมูลปัจจุบัน)",
    key: "profiles",
    columns: [
      ["created_at", "วันที่บันทึก"],
      ["age", "อายุ"],
      ["gender", "เพศ"],
      ["height_cm", "ส่วนสูง (ซม.)"],
      ["weight_kg", "น้ำหนัก (กก.)"],
      ["waist_cm", "รอบเอว (ซม.)"],
      ["smoking", "สูบบุหรี่"],
      ["has_diabetes", "เป็นเบาหวาน"],
      ["family_diabetes", "ประวัติเบาหวานในครอบครัว"],
    ],
  },
  {
    title: "ประวัติการประเมิน",
    key: "assessments",
    columns: [
      ["assessment_id", "รหัสการประเมิน"],
      ["assessment_name", "แบบประเมิน"],
      ["total_score", "คะแนนรวม"],
      ["risk_level", "ระดับ"],
      ["assessed_at", "วันที่ประเมิน"],
    ],
  },
  {
    title: "คำตอบรายข้อ",
    key: "answers",
    columns: [
      ["assessment_id", "รหัสการประเมิน"],
      ["assessment_name", "แบบประเมิน"],
      ["assessed_at", "วันที่ประเมิน"],
      ["question_no", "ข้อ"],
      ["question_text", "คำถาม"],
      ["answer", "คำตอบ"],
      ["score", "คะแนน"],
    ],
  },
];

const toCsv = (data: ExportData) => {
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return CSV_SECTIONS.map(({ title, key, columns }) =>
    [
      escape(title),
      columns.map(([, label]) => escape(label)).join(","),
      ...(data[key] ?? []).map((r) => columns.map(([col]) => escape(r[col])).join(",")),
    ].join("\n"),
  ).join("\n\n");
};

/* =========================================================
   PAGE
========================================================= */

export default function SettingsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState("account");
  const [dialog, setDialog] = useState<null | "clear" | "delete">(null);

  const [emergency, setEmergency] = useState({ name: "", relation: "", phone: "" });

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  // เปลี่ยนอีเมลต้องยืนยันรหัสผ่าน เพราะอีเมลใช้รับ OTP ตอนลืมรหัสผ่าน
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // ประกาศก่อน useEffect ที่เรียกใช้
  const applyFontSize = (size: Settings["font_size"]) => {
    // Tailwind ใช้หน่วย rem จึงขยายได้ทั้งหน้า
    document.documentElement.style.fontSize = FONT_SIZE_PX[size];
    localStorage.setItem("fontSize", size);
  };

  /* ---------- load ---------- */
  useEffect(() => {
    const load = async () => {
      try {
        const uid = localStorage.getItem("userId");
        if (!uid) throw new Error("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        setUserId(uid);

        const q = `userId=${encodeURIComponent(uid)}`;
        const [settingsRes, profileRes] = await Promise.all([
          fetch(`/api/settings?${q}`, { cache: "no-store" }),
          fetch(`/api/profile?${q}`, { cache: "no-store" }).catch(() => null),
        ]);

        const settingsJson = await settingsRes.json();
        if (!settingsRes.ok) throw new Error(settingsJson.message || "ไม่สามารถโหลดการตั้งค่าได้");
        const s: Settings = settingsJson.settings;
        setSettings(s);
        setEmergency({
          name: s.emergency_name ?? "",
          relation: s.emergency_relation ?? "",
          phone: s.emergency_phone ?? "",
        });
        applyFontSize(s.font_size);

        if (profileRes?.ok) setProfile(readProfile(await profileRes.json()));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลได้");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- actions ---------- */
  const save = async (patch: Partial<Settings>, okText = "บันทึกแล้ว") => {
    if (!userId || !settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch }); // อัปเดตหน้าจอทันที
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setSettings(json.settings);
      setToast({ type: "ok", text: okText });
    } catch (err) {
      console.error(err);
      setSettings(previous); // บันทึกไม่สำเร็จ คืนค่าเดิม
      setToast({ type: "error", text: err instanceof Error && err.message ? err.message : "บันทึกไม่สำเร็จ ลองอีกครั้ง" });
    }
  };

  const saveUsername = async () => {
    if (!userId || !profile) return;
    const username = usernameDraft.trim();
    if (username === profile.username) {
      setEditingUsername(false);
      return;
    }
    setSavingUsername(true);
    try {
      const res = await fetch("/api/settings/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      const newName = json.user.username as string;
      setProfile({
        ...profile,
        username: newName,
        // ชื่อที่แสดงใช้ username เมื่อไม่มีชื่อจริง
        name: profile.name === profile.username ? newName : profile.name,
      });

      // หน้าอื่น (Dashboard, Sidebar) อ่านชื่อจาก localStorage
      localStorage.setItem("username", newName);
      try {
        const stored = JSON.parse(localStorage.getItem("user") ?? "null");
        if (stored) localStorage.setItem("user", JSON.stringify({ ...stored, username: newName }));
      } catch {
        // ข้อมูลเดิมเสีย ไม่ต้องอัปเดต
      }

      setEditingUsername(false);
      setToast({ type: "ok", text: "เปลี่ยนชื่อผู้ใช้แล้ว ใช้ชื่อใหม่ในการเข้าสู่ระบบครั้งถัดไป" });
    } catch (err) {
      console.error(err);
      setToast({ type: "error", text: err instanceof Error && err.message ? err.message : "เปลี่ยนชื่อผู้ใช้ไม่สำเร็จ" });
    } finally {
      setSavingUsername(false);
    }
  };

  const cancelEditEmail = () => {
    setEditingEmail(false);
    setEmailPassword("");
  };

  const saveEmail = async () => {
    if (!userId || !profile) return;
    const email = emailDraft.trim().toLowerCase();
    if (email === profile.email.toLowerCase()) {
      cancelEditEmail();
      return;
    }
    setSavingEmail(true);
    try {
      const res = await fetch("/api/settings/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email, password: emailPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      const newEmail = json.user.email as string;
      setProfile({ ...profile, email: newEmail });

      localStorage.setItem("email", newEmail);
      try {
        const stored = JSON.parse(localStorage.getItem("user") ?? "null");
        if (stored) localStorage.setItem("user", JSON.stringify({ ...stored, email: newEmail }));
      } catch {
        // ข้อมูลเดิมเสีย ไม่ต้องอัปเดต
      }

      cancelEditEmail();
      setToast({ type: "ok", text: "เปลี่ยนอีเมลแล้ว รหัส OTP ลืมรหัสผ่านจะส่งไปที่อีเมลใหม่" });
    } catch (err) {
      console.error(err);
      setToast({ type: "error", text: err instanceof Error && err.message ? err.message : "เปลี่ยนอีเมลไม่สำเร็จ" });
    } finally {
      setSavingEmail(false);
    }
  };

  const logout = async () => {
    // ลบ session cookie ฝั่ง server ก่อน (ถ้าเรียกไม่สำเร็จก็ยังออกจากระบบในเครื่องต่อ)
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    for (const key of ["userId", "username", "userName", "email", "roleId", "role", "user", "hasProfile", "rememberLogin"]) {
      localStorage.removeItem(key);
    }
    router.replace("/login");
  };

  const downloadData = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/settings/export?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      const blob = new Blob(["\uFEFF" + toCsv(json)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-health-data-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ type: "error", text: "ดาวน์โหลดข้อมูลไม่สำเร็จ" });
    }
  };

  const confirmDanger = async (password: string): Promise<string | null> => {
    if (!userId || !dialog) return "ไม่พบข้อมูลผู้ใช้";
    try {
      const res = await fetch("/api/settings/danger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password, action: dialog === "clear" ? "clear" : "delete" }),
      });
      const json = await res.json();
      if (!res.ok) return json.message || "ดำเนินการไม่สำเร็จ";

      if (dialog === "delete") {
        // ลบเฉพาะค่าของผู้ใช้คนนี้ ไม่ลบของ staff ที่อาจเปิดอยู่ในแท็บอื่น
        for (const key of ["userId", "username", "userName", "email", "roleId", "role", "user", "hasProfile", "rememberLogin"]) {
          localStorage.removeItem(key);
        }
        router.push("/login");
        return null;
      }
      setDialog(null);
      setToast({ type: "ok", text: json.message || "ล้างประวัติเรียบร้อยแล้ว" });
      return null;
    } catch {
      return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองอีกครั้ง";
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="flex min-h-screen bg-[#faf9f7]">
      <Sidebar />

      <main className="flex-1 min-w-0 px-6 py-8 lg:px-10">
        <div className="max-w-7xl mx-auto">
          {/* HEADER */}
          <div className="mb-8">
            <p className="text-sm font-bold tracking-[0.25em] text-[#b91c2b] uppercase">Settings</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mt-3">
              ตั้ง<span className="text-[#b91c2b]">ค่า</span>
            </h1>
          </div>

          {loading ? (
            <div className="py-24 text-center" role="status">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-[#b91c2b] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">กำลังโหลดการตั้งค่า...</p>
            </div>
          ) : error || !settings ? (
            <div className="max-w-xl bg-white border border-red-100 rounded-3xl p-8 text-center">
              <AlertTriangle size={44} className="text-red-500 mx-auto mb-4" />
              <p className="text-gray-600">{error || "ไม่สามารถโหลดการตั้งค่าได้"}</p>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* SUB NAV */}
              <nav
                aria-label="หมวดการตั้งค่า"
                className="w-full lg:w-60 shrink-0 bg-white border border-gray-100 rounded-3xl p-2 shadow-sm flex lg:flex-col gap-1 overflow-x-auto"
              >
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={() => setActiveSection(s.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm whitespace-nowrap transition ${
                      activeSection === s.id
                        ? "bg-red-50 text-[#b91c2b] font-semibold"
                        : s.id === "danger"
                        ? "text-red-600 hover:bg-red-50"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <s.icon size={17} />
                    {s.label}
                  </a>
                ))}
              </nav>

              {/* PANELS */}
              <div className="flex-1 min-w-0 flex flex-col gap-5 w-full">
                {/* 1. ACCOUNT */}
                <Card id="account" title="บัญชีผู้ใช้">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-50 text-[#b91c2b] text-2xl font-bold flex items-center justify-center shrink-0">
                      {(profile?.username || "U").trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingUsername ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            autoFocus
                            value={usernameDraft}
                            maxLength={30}
                            onChange={(e) => setUsernameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveUsername();
                              if (e.key === "Escape") setEditingUsername(false);
                            }}
                            aria-label="ชื่อผู้ใช้"
                            className="h-10 w-full max-w-xs rounded-xl border border-gray-200 px-3 font-semibold text-gray-800 outline-none focus:border-[#b91c2b]"
                          />
                          <button
                            type="button"
                            onClick={saveUsername}
                            disabled={savingUsername || !usernameDraft.trim()}
                            className="h-10 px-4 rounded-xl bg-[#b91c2b] text-white text-sm font-semibold hover:bg-[#9f1624] transition disabled:opacity-50"
                          >
                            {savingUsername ? "กำลังบันทึก..." : "บันทึก"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUsername(false)}
                            disabled={savingUsername}
                            aria-label="ยกเลิก"
                            className="h-10 w-10 grid place-items-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-gray-800 truncate">{profile?.username || "-"}</p>
                          {profile && (
                            <button
                              type="button"
                              onClick={() => {
                                setUsernameDraft(profile.username);
                                setEditingUsername(true);
                              }}
                              aria-label="แก้ไขชื่อผู้ใช้"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#b91c2b] hover:bg-red-50 transition"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                        </div>
                      )}
                      {editingEmail ? (
                        <div className="mt-2 flex flex-col gap-2 max-w-md">
                          <input
                            autoFocus
                            type="email"
                            value={emailDraft}
                            maxLength={254}
                            onChange={(e) => setEmailDraft(e.target.value)}
                            aria-label="อีเมลใหม่"
                            placeholder="อีเมลใหม่"
                            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none focus:border-[#b91c2b]"
                          />
                          <input
                            type="password"
                            value={emailPassword}
                            onChange={(e) => setEmailPassword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEmail();
                              if (e.key === "Escape") cancelEditEmail();
                            }}
                            aria-label="รหัสผ่านปัจจุบัน"
                            placeholder="รหัสผ่านปัจจุบัน (เพื่อยืนยัน)"
                            autoComplete="current-password"
                            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none focus:border-[#b91c2b]"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveEmail}
                              disabled={savingEmail || !emailDraft.trim() || !emailPassword}
                              className="h-10 px-4 rounded-xl bg-[#b91c2b] text-white text-sm font-semibold hover:bg-[#9f1624] transition disabled:opacity-50"
                            >
                              {savingEmail ? "กำลังบันทึก..." : "บันทึกอีเมล"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditEmail}
                              disabled={savingEmail}
                              className="h-10 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-500 truncate">{profile?.email || "-"}</p>
                          {profile && (
                            <button
                              type="button"
                              onClick={() => {
                                setEmailDraft(profile.email);
                                setEmailPassword("");
                                setEditingEmail(true);
                              }}
                              aria-label="แก้ไขอีเมล"
                              className="p-1 rounded-lg text-gray-400 hover:text-[#b91c2b] hover:bg-red-50 transition"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-gray-400">
                        {profile?.phone ? `${profile.phone} · ` : ""}สมาชิกตั้งแต่ {formatDate(profile?.createdAt)}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                    >
                      แก้ไขข้อมูลส่วนตัว
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </Card>

                {/* 2. SECURITY */}
                <Card id="security" title="ความปลอดภัย" desc="ปกป้องบัญชีและข้อมูลสุขภาพของคุณ">
                  <Row title="รหัสผ่าน" desc="ระบบจะส่งรหัส OTP ไปที่อีเมลเพื่อตั้งรหัสผ่านใหม่">
                    <Link
                      href="/forgot-password"
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
                    >
                      เปลี่ยนรหัสผ่าน
                    </Link>
                  </Row>
                  <Row title="อุปกรณ์นี้" desc="ออกจากระบบบนอุปกรณ์ที่ใช้อยู่ตอนนี้" last>
                    <button
                      onClick={logout}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-[#b91c2b] font-semibold hover:bg-red-100 transition"
                    >
                      <LogOut size={16} />
                      ออกจากระบบ
                    </button>
                  </Row>
                </Card>

                {/* 4. DISPLAY */}
                <Card id="display" title="การแสดงผลและการเข้าถึง" desc="ปรับให้อ่านง่ายและเหมาะกับการใช้งานของคุณ">
                  <Row title="ขนาดตัวอักษร" desc="มีผลกับทุกหน้าที่มีแถบเมนู" last>
                    <Segmented
                      label="ขนาดตัวอักษร"
                      value={settings.font_size}
                      options={[
                        ["normal", "ปกติ"],
                        ["large", "ใหญ่"],
                        ["xl", "ใหญ่มาก"],
                      ]}
                      onChange={(v) => {
                        applyFontSize(v as Settings["font_size"]);
                        save({ font_size: v as Settings["font_size"] });
                      }}
                    />
                  </Row>
                </Card>

                {/* 5. EMERGENCY CONTACT */}
                <Card
                  id="emergency"
                  title="ผู้ติดต่อกรณีฉุกเฉิน"
                  badge="ไม่บังคับ"
                  desc="ใช้แสดงในหน้าคำแนะนำ เพื่อให้คุณโทรหาคนใกล้ชิดได้ทันที ระบบจะไม่ติดต่อบุคคลนี้เอง"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="ชื่อ">
                      <input
                        value={emergency.name}
                        onChange={(e) => setEmergency({ ...emergency, name: e.target.value })}
                        placeholder="เช่น คุณแม่"
                        className="h-12 px-4 rounded-xl border border-gray-200 bg-[#faf9f7]"
                      />
                    </Field>
                    <Field label="ความสัมพันธ์">
                      <input
                        value={emergency.relation}
                        onChange={(e) => setEmergency({ ...emergency, relation: e.target.value })}
                        placeholder="เช่น ครอบครัว เพื่อน"
                        className="h-12 px-4 rounded-xl border border-gray-200 bg-[#faf9f7]"
                      />
                    </Field>
                    <Field label="เบอร์โทรศัพท์">
                      <input
                        type="tel"
                        inputMode="tel"
                        value={emergency.phone}
                        onChange={(e) => setEmergency({ ...emergency, phone: e.target.value.replace(/[^\d-]/g, "") })}
                        placeholder="08x-xxx-xxxx"
                        className="h-12 px-4 rounded-xl border border-gray-200 bg-[#faf9f7]"
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end mt-5">
                    <button
                      onClick={() =>
                        save(
                          {
                            emergency_name: emergency.name.trim() || null,
                            emergency_relation: emergency.relation.trim() || null,
                            emergency_phone: emergency.phone.trim() || null,
                          },
                          "บันทึกผู้ติดต่อฉุกเฉินแล้ว"
                        )
                      }
                      className="px-6 py-3 rounded-xl bg-[#b91c2b] text-white font-semibold hover:bg-[#991b1b] transition"
                    >
                      บันทึก
                    </button>
                  </div>
                </Card>

                {/* 6. PRIVACY (PDPA) */}
                <Card
                  id="privacy"
                  title="ความเป็นส่วนตัวและข้อมูลของฉัน"
                  desc="ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหวตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA) คุณจัดการความยินยอมและข้อมูลของตัวเองได้ที่นี่"
                >
                  <Row
                    title={CONSENT_TEXT.health.title}
                    desc={`${CONSENT_TEXT.health.desc} · อัปเดตเมื่อ ${formatDate(settings.consent_health_at)}`}
                  >
                    <Toggle
                      label="ยินยอมให้เก็บข้อมูลสุขภาพ"
                      checked={settings.consent_health}
                      onChange={(v) => {
                        if (!v && !window.confirm("หากถอนความยินยอม ระบบจะไม่สามารถประเมินและให้คำแนะนำได้ ต้องการดำเนินการต่อหรือไม่?")) return;
                        save({ consent_health: v });
                      }}
                    />
                  </Row>
                  <Row
                    title={CONSENT_TEXT.staff.title}
                    desc={
                      settings.consent_staff
                        ? `เมื่อผลอยู่ในระดับเสี่ยงสูง เจ้าหน้าที่จะติดต่อเพื่อให้คำแนะนำ · ยินยอมเมื่อ ${formatDate(settings.consent_staff_at)}`
                        : CONSENT_TEXT.staff.desc
                    }
                  >
                    <Toggle
                      label="ยินยอมให้เจ้าหน้าที่ติดตามดูแล"
                      checked={settings.consent_staff}
                      onChange={(v) => save({ consent_staff: v })}
                    />
                  </Row>
                  <Row
                    title={CONSENT_TEXT.research.title}
                    desc={CONSENT_TEXT.research.desc}
                    last
                  >
                    <Toggle
                      label="อนุญาตให้ใช้ข้อมูลเพื่อการศึกษา"
                      checked={settings.consent_research}
                      onChange={(v) => save({ consent_research: v })}
                    />
                  </Row>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                    <button
                      onClick={downloadData}
                      className="text-left flex items-start gap-3 p-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition"
                    >
                      <Download size={20} className="text-gray-500 mt-0.5" />
                      <span>
                        <span className="block font-semibold text-gray-800">ดาวน์โหลดข้อมูลของฉัน</span>
                        <span className="block text-sm text-gray-500">โปรไฟล์สุขภาพ ประวัติการประเมิน และคำตอบรายข้อ เป็นไฟล์ CSV เปิดด้วย Excel ได้</span>
                      </span>
                    </button>
                    <Link
                      href="/privacy-policy"
                      className="flex items-start gap-3 p-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition"
                    >
                      <Shield size={20} className="text-gray-500 mt-0.5" />
                      <span>
                        <span className="block font-semibold text-gray-800">นโยบายความเป็นส่วนตัว</span>
                        <span className="block text-sm text-gray-500">เก็บข้อมูลอะไร ใช้ทำอะไร และเก็บนานแค่ไหน</span>
                      </span>
                    </Link>
                  </div>
                </Card>

                {/* 7. ABOUT */}
                <Card id="about" title="ช่วยเหลือและเกี่ยวกับระบบ">
                  {[
                    { label: "คู่มือการใช้งาน", href: "/help" },
                    { label: "ที่มาของแบบประเมินและเกณฑ์ที่ใช้", href: "/about-assessments" },
                    { label: "ข้อตกลงการใช้งาน", href: "/terms" },
                    { label: "แจ้งปัญหา / ติดต่อทีมพัฒนา", href: "mailto:[อีเมลทีมพัฒนา]" },
                  ].map((l) => (
                    <Link
                      key={l.label}
                      href={l.href}
                      className="flex items-center justify-between py-3.5 border-b border-gray-100 text-gray-800 font-semibold hover:text-[#b91c2b] transition"
                    >
                      {l.label}
                      <ChevronRight size={18} className="text-gray-300" />
                    </Link>
                  ))}
                  <div className="flex justify-between pt-3.5 text-sm text-gray-500">
                    <span>เวอร์ชัน</span>
                    <span>1.0.0 · 308-325 Project ICT II</span>
                  </div>
                </Card>

                {/* 8. DANGER ZONE */}
                <section id="danger" className="scroll-mt-6 bg-white border border-red-200 rounded-3xl p-6 sm:p-7">
                  <h2 className="text-xl font-bold text-red-700">จัดการข้อมูลถาวร</h2>
                  <p className="text-sm text-gray-500 mt-1 mb-2">การกระทำในส่วนนี้ย้อนกลับไม่ได้ ควรดาวน์โหลดข้อมูลเก็บไว้ก่อน</p>
                  <Row title="ล้างประวัติการประเมินทั้งหมด" desc="บัญชียังอยู่ แต่ผลประเมินและคำแนะนำทั้งหมดจะถูกลบ">
                    <button
                      onClick={() => setDialog("clear")}
                      className="px-4 py-2.5 rounded-xl border border-red-200 text-red-700 font-semibold hover:bg-red-50 transition"
                    >
                      ล้างประวัติ
                    </button>
                  </Row>
                  <Row title="ลบบัญชี" desc="ลบบัญชีและข้อมูลสุขภาพทั้งหมดออกจากระบบอย่างถาวร" last>
                    <button
                      onClick={() => setDialog("delete")}
                      className="px-4 py-2.5 rounded-xl bg-red-700 text-white font-semibold hover:bg-red-800 transition"
                    >
                      ลบบัญชี
                    </button>
                  </Row>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CONFIRM DIALOG */}
      {dialog && (
        <ConfirmDialog
          title={dialog === "clear" ? "ล้างประวัติการประเมินทั้งหมด?" : "ลบบัญชีถาวร?"}
          text={
            dialog === "clear"
              ? "ผลการประเมิน คำแนะนำ และการแจ้งเตือนทั้งหมดจะถูกลบ และกู้คืนไม่ได้"
              : "บัญชีและข้อมูลสุขภาพทั้งหมดของคุณจะถูกลบออกจากระบบ และกู้คืนไม่ได้"
          }
          confirmLabel={dialog === "clear" ? "ล้างประวัติ" : "ลบบัญชี"}
          onCancel={() => setDialog(null)}
          onConfirm={confirmDanger}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold ${
            toast.type === "ok" ? "bg-gray-900 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "ok" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function Card({
  id,
  title,
  desc,
  badge,
  children,
}: {
  id: string;
  title: string;
  desc?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 bg-white border border-gray-100 rounded-3xl p-6 sm:p-7 shadow-sm">
      <h2 className="text-xl font-bold text-gray-800">
        {title}
        {badge && <span className="ml-2 text-sm font-medium text-gray-400">({badge})</span>}
      </h2>
      {desc && <p className="text-sm text-gray-500 mt-1 mb-3">{desc}</p>}
      <div className={desc ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

function Row({ title, desc, last, children }: { title: string; desc?: string; last?: boolean; children: ReactNode }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 py-4 ${last ? "" : "border-b border-gray-100"}`}>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800">{title}</p>
        {desc && <p className="text-sm text-gray-500">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
      {label}
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-[52px] h-[30px] rounded-full p-[3px] flex transition ${
        checked ? "bg-[#b91c2b] justify-end" : "bg-gray-300 justify-start"
      }`}
    >
      <span className="w-6 h-6 rounded-full bg-white shadow" />
    </button>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 p-1 rounded-2xl bg-gray-100">
      {options.map(([v, text]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            value === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (password: string) => Promise<string | null>; // คืนข้อความ error หรือ null ถ้าสำเร็จ
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setErr("");
    const message = await onConfirm(password);
    if (message) {
      setErr(message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/50 flex items-center justify-center p-5" onClick={busy ? undefined : onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl p-7 shadow-2xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mb-4">
          <AlertTriangle size={24} />
        </div>
        <h3 id="confirm-title" className="text-xl font-bold text-gray-900">
          {title}
        </h3>
        <p className="text-sm text-gray-600 mt-1 mb-4">{text}</p>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-700">
          ยืนยันด้วยรหัสผ่าน
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
            autoComplete="current-password"
            placeholder="รหัสผ่านของคุณ"
            className="h-12 px-4 rounded-xl border border-gray-200"
          />
        </label>
        {err && <p className="text-sm text-red-600 mt-2" role="alert">{err}</p>}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            ยกเลิก
          </button>
          <button
            onClick={submit}
            disabled={!password || busy}
            className="px-5 py-2.5 rounded-xl bg-red-700 text-white font-semibold hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "กำลังดำเนินการ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
