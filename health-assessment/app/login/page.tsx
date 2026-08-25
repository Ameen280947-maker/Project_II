"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  BarChart3,
  Heart,
  HeartPulse,
  Lock,
  LockKeyhole,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";

/* ============================================================
   TYPES
============================================================ */

type LoginResponse = {
  success?: boolean;
  message?: string;

  user?: {
    user_id: number;
    username: string;
    email: string | null;
    role_id: number | null;
    role_name: string | null;

    hasProfile?: boolean;
  };
};

type ProfileCheckResponse = {
  success: boolean;
  message?: string;

  profile?: {
    profile_id?: number;
    user_id?: number;
    age?: number | null;
    gender?: string | null;
    height_cm?: string | number | null;
    weight_kg?: string | number | null;
    waist_cm?: string | number | null;
    smoking?: boolean | null;
    has_diabetes?: boolean | null;
    family_diabetes?: boolean | null;
  } | null;
};

/* ============================================================
   PAGE
============================================================ */

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  /* =========================================================
     LOGIN
  ========================================================= */

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");

    const normalizedUsername =
      username.trim();

    if (
      !normalizedUsername ||
      !password
    ) {
      setError(
        "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน",
      );

      return;
    }

    try {
      setLoading(true);

      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                username:
                  normalizedUsername,

                password,
              }),
          },
        );

      const data =
        (await response.json()) as LoginResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ??
            "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        );

        return;
      }

      if (!data.user) {
        setError(
          "ไม่พบข้อมูลผู้ใช้งาน",
        );

        return;
      }

      const user =
        data.user;

      console.log(
        "LOGIN SUCCESS:",
        user,
      );

      /* =====================================================
         SAVE USER
      ===================================================== */

      localStorage.setItem(
        "userId",
        String(
          user.user_id,
        ),
      );

      localStorage.setItem(
        "username",
        user.username,
      );

      localStorage.setItem(
        "email",
        user.email ?? "",
      );

      localStorage.setItem(
        "roleId",
        user.role_id !== null
          ? String(
              user.role_id,
            )
          : "",
      );

      localStorage.setItem(
        "role",
        user.role_name ?? "",
      );

      localStorage.setItem(
        "user",
        JSON.stringify(
          user,
        ),
      );

      /* =====================================================
         ROLE
      ===================================================== */

      const roleName =
        user.role_name;

      /* ADMIN */

      if (
        roleName ===
        "system_admin"
      ) {
        router.push(
          "/admin",
        );

        return;
      }

      /* STAFF */

      if (
        roleName === "staff"
      ) {
        router.push(
          "/staff",
        );

        return;
      }

      /* USER */

      if (
        roleName === "user"
      ) {
        /* =================================================
           LOGIN API ส่ง hasProfile มาแล้ว
        ================================================= */

        if (
          typeof user.hasProfile ===
          "boolean"
        ) {
          localStorage.setItem(
            "hasProfile",
            String(
              user.hasProfile,
            ),
          );

          /* สมาชิกเก่า */

          if (
            user.hasProfile
          ) {
            console.log(
              "PROFILE EXISTS -> ASSESSMENT TYPE",
            );

            router.push(
              "/assessment-type",
            );

            return;
          }

          /* สมาชิกใหม่ */

          console.log(
            "NO PROFILE -> PROFILE PAGE",
          );

          router.push(
            "/profile",
          );

          return;
        }

        /* =================================================
           FALLBACK
           ตรวจ Profile จาก API
        ================================================= */

        try {
          const profileResponse =
            await fetch(
              `/api/profile?userId=${user.user_id}`,
              {
                method:
                  "GET",

                cache:
                  "no-store",
              },
            );

          const profileData =
            (await profileResponse.json()) as ProfileCheckResponse;

          if (
            !profileResponse.ok ||
            !profileData.success
          ) {
            throw new Error(
              profileData.message ??
                "ไม่สามารถตรวจสอบข้อมูลสุขภาพได้",
            );
          }

          const hasProfile =
            Boolean(
              profileData.profile,
            );

          localStorage.setItem(
            "hasProfile",
            String(
              hasProfile,
            ),
          );

          /* สมาชิกเก่า */

          if (
            hasProfile
          ) {
            console.log(
              "PROFILE EXISTS -> ASSESSMENT TYPE",
            );

            router.push(
              "/assessment-type",
            );

            return;
          }

          /* สมาชิกใหม่ */

          console.log(
            "NO PROFILE -> PROFILE PAGE",
          );

          router.push(
            "/profile",
          );

          return;
        } catch (
          profileError
        ) {
          console.error(
            "CHECK PROFILE ERROR:",
            profileError,
          );

          setError(
            profileError instanceof
              Error
              ? profileError.message
              : "ไม่สามารถตรวจสอบข้อมูลสุขภาพได้",
          );

          return;
        }
      }

      setError(
        "ไม่พบสิทธิ์การใช้งานของบัญชีนี้",
      );
    } catch (
      loginError
    ) {
      console.error(
        "LOGIN FRONTEND ERROR:",
        loginError,
      );

      setError(
        "ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbf7f7]">

      {/* BACKGROUND */}

      <div
        className="pointer-events-none absolute -left-40 -top-32 h-[420px] w-[620px] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, rgba(219,150,157,0.30), rgba(251,247,247,0))",
        }}
      />

      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-[420px] w-[700px] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(219,150,157,0.30), rgba(251,247,247,0))",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col items-center gap-10 px-6 py-10 lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:px-16">

        {/* LEFT */}

        <div className="relative flex w-full max-w-xl flex-col items-center justify-center py-10 text-center lg:w-1/2">

          <span className="absolute left-[10%] top-[16%] hidden h-1.5 w-1.5 rounded-full bg-[#d7a6ab] lg:block" />

          <span className="absolute right-[6%] top-[52%] hidden h-1.5 w-1.5 rounded-full bg-[#d7a6ab] lg:block" />

          <div className="mt-10 flex h-20 w-20 items-center justify-center rounded-[24px] bg-white text-[#b91c2b] shadow-[0_15px_35px_rgba(139,20,32,0.10)]">
            <HeartPulse
              size={42}
              strokeWidth={1.8}
            />
          </div>

          <h1 className="mt-6 text-3xl font-bold text-[#3a3a40] sm:text-4xl">
            เริ่มต้นการดูแล
          </h1>

          <h1 className="text-3xl font-bold text-[#B91C2B] sm:text-4xl">
            สุขภาพของคุณ
          </h1>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px w-20 bg-[#e3b9bd]" />

            <HeartPulse
              size={24}
              strokeWidth={1.8}
              className="text-[#B91C2B]"
            />

            <span className="h-px w-20 bg-[#e3b9bd]" />
          </div>

          <p className="max-w-sm text-[15px] leading-relaxed text-[#6b6b72]">
            ก้าวแรกสู่การมีสุขภาพที่ดี
            <br />
            ด้วยการประเมินความเสี่ยงที่แม่นยำ
            <br />
            เพื่ออนาคตที่ดีกว่า
          </p>

          <div className="relative mt-14 hidden w-full items-center justify-center gap-24 lg:flex">

            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_10px_25px_rgba(139,20,32,0.10)]">
              <HeartPulse
                size={30}
                className="text-[#B91C2B]"
                strokeWidth={1.8}
              />
            </div>

            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_10px_25px_rgba(139,20,32,0.10)]">
              <BarChart3
                size={30}
                className="text-[#B91C2B]"
                strokeWidth={1.8}
              />
            </div>

          </div>

        </div>

        {/* RIGHT */}

        <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-[0_25px_60px_rgba(139,20,32,0.10)] sm:p-10">

          <div className="flex flex-col items-center text-center">

            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#fbe9ea]">
              <HeartPulse
                size={40}
                className="text-[#B91C2B]"
                strokeWidth={1.7}
              />
            </div>

            <h2 className="mt-5 text-2xl font-bold text-[#3a3a40]">
              เข้าสู่ระบบ
            </h2>

            <p className="mt-1 flex items-center gap-1 text-sm text-[#9a9aa2]">
              ยินดีต้อนรับกลับมา

              <Heart
                size={14}
                className="fill-[#B91C2B] text-[#B91C2B]"
              />
            </p>

          </div>

          <form
            className="mt-8 flex flex-col gap-5"
            onSubmit={handleSubmit}
          >

            {/* USERNAME */}

            <div>

              <label
                htmlFor="username"
                className="mb-2 block text-sm font-semibold text-[#3a3a40]"
              >
                ชื่อผู้ใช้งาน
              </label>

              <div className="flex items-center gap-3 rounded-2xl border border-[#ece7e7] px-4 py-3.5 transition focus-within:border-[#B91C2B] focus-within:ring-2 focus-within:ring-[#B91C2B]/10">

                <User
                  size={21}
                  className="shrink-0 text-[#9b9ba3]"
                />

                <input
                  id="username"
                  type="text"
                  placeholder="ใส่ชื่อผู้ใช้งาน"
                  autoComplete="username"
                  value={username}
                  disabled={loading}
                  onChange={(event) => {
                    setUsername(
                      event.target.value,
                    );

                    if (error) {
                      setError("");
                    }
                  }}
                  className="w-full bg-transparent text-sm text-[#3a3a40] outline-none placeholder:text-[#b7b7bd]"
                />

              </div>

            </div>

            {/* PASSWORD */}

            <div>

              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-[#3a3a40]"
              >
                รหัสผ่าน
              </label>

              <div className="flex items-center gap-3 rounded-2xl border border-[#ece7e7] px-4 py-3.5 transition focus-within:border-[#B91C2B] focus-within:ring-2 focus-within:ring-[#B91C2B]/10">

                <Lock
                  size={21}
                  className="shrink-0 text-[#9b9ba3]"
                />

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="ใส่รหัสผ่าน"
                  autoComplete="current-password"
                  value={password}
                  disabled={loading}
                  onChange={(event) => {
                    setPassword(
                      event.target.value,
                    );

                    if (error) {
                      setError("");
                    }
                  }}
                  className="w-full bg-transparent text-sm text-[#3a3a40] outline-none placeholder:text-[#b7b7bd]"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (value) =>
                        !value,
                    )
                  }
                  className="text-sm font-semibold text-[#B91C2B]"
                >
                  {showPassword
                    ? "ซ่อน"
                    : "แสดง"}
                </button>

              </div>

            </div>

            {/* ERROR */}

            {error && (
              <div className="rounded-2xl border border-[#f3cdd1] bg-[#fff3f4] px-4 py-3">
                <p className="text-center text-sm font-medium text-[#B91C2B]">
                  {error}
                </p>
              </div>
            )}

            {/* FORGOT */}

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-[#B91C2B] hover:underline"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>

            {/* LOGIN */}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#B91C2B] to-[#8A1420] py-4 text-base font-bold text-white shadow-[0_10px_25px_rgba(139,20,32,0.30)] transition-all hover:scale-[1.01] disabled:opacity-60"
            >
              {loading
                ? "กำลังเข้าสู่ระบบ..."
                : (
                  <>
                    เข้าสู่ระบบ
                    <ArrowRight size={20} />
                  </>
                )}
            </button>

            {/* DIVIDER */}

            <div className="my-1 flex items-center gap-3">
              <span className="h-px flex-1 bg-[#ece7e7]" />

              <span className="text-xs text-[#b7b7bd]">
                หรือ
              </span>

              <span className="h-px flex-1 bg-[#ece7e7]" />
            </div>

            {/* REGISTER */}

            <Link
              href="/register"
              className="flex items-center justify-center gap-2 rounded-2xl border border-[#B91C2B] py-4 text-base font-bold text-[#B91C2B] transition-transform hover:scale-[1.01]"
            >
              <UserPlus size={21} />
              สมัครสมาชิก
            </Link>

          </form>

        </div>

      </div>

      {/* FEATURES */}

      <div className="relative mx-auto grid max-w-4xl grid-cols-1 gap-8 px-8 pb-14 sm:grid-cols-3 sm:gap-6">

        <Feature
          icon={
            <ShieldCheck size={27} />
          }
          title="ปลอดภัย"
          desc="ข้อมูลของคุณปลอดภัยและเป็นความลับ"
        />

        <Feature
          icon={
            <LockKeyhole size={27} />
          }
          title="เชื่อถือได้"
          desc="ประเมินด้วยมาตรฐานทางการแพทย์"
        />

        <Feature
          icon={
            <BarChart3 size={27} />
          }
          title="เข้าใจง่าย"
          desc="ผลลัพธ์ชัดเจนพร้อมคำแนะนำ"
        />

      </div>

    </main>
  );
}

/* ============================================================
   FEATURE
============================================================ */

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3 text-center sm:items-start sm:text-left">

      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#B91C2B] shadow-[0_8px_20px_rgba(139,20,32,0.08)]">
        {icon}
      </div>

      <div>
        <h3 className="text-sm font-bold text-[#3a3a40]">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-[#909199]">
          {desc}
        </p>
      </div>

    </div>
  );
}