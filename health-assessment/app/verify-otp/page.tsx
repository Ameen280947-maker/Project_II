"use client";

import {
  FormEvent,
  Suspense,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

/* =========================================================
   TYPES
========================================================= */

type VerifyOtpResponse = {
  success: boolean;

  message?: string;

  resetToken?: string;
};

/* =========================================================
   CONTENT
========================================================= */

function VerifyOtpContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  /* =========================================================
     EMAIL

     รับมาจาก:
     /verify-otp?email=example@gmail.com
  ========================================================= */

  const email =
    searchParams.get(
      "email",
    ) ?? "";

  /* =========================================================
     STATE
  ========================================================= */

  const [
    otp,
    setOtp,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  /* =========================================================
     VERIFY OTP
  ========================================================= */

  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      try {
        setLoading(true);
        setError("");

        /* =========================
           EMAIL CHECK
        ========================= */

        if (!email) {
          throw new Error(
            "ไม่พบข้อมูลอีเมล กรุณาเริ่มขั้นตอนลืมรหัสผ่านใหม่อีกครั้ง",
          );
        }

        /* =========================
           OTP CHECK
        ========================= */

        const normalizedOtp =
          otp.trim();

        if (
          !/^\d{6}$/.test(
            normalizedOtp,
          )
        ) {
          throw new Error(
            "กรุณากรอกรหัส OTP ให้ครบ 6 หลัก",
          );
        }

        /* =========================
           API
        ========================= */

        const response =
          await fetch(
            "/api/auth/verify-otp",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  email:
                    email
                      .trim()
                      .toLowerCase(),

                  otp:
                    normalizedOtp,
                }),
            },
          );

        const data =
          (await response.json()) as VerifyOtpResponse;

        /* =========================
           VERIFY FAILED
        ========================= */

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว",
          );
        }

        /* =========================
           RESET TOKEN CHECK
        ========================= */

        if (
          !data.resetToken
        ) {
          throw new Error(
            "ระบบไม่สามารถสร้างข้อมูลสำหรับเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่",
          );
        }

        /* =====================================================
           ไปหน้า Reset Password

           URL:
           /reset-password?token=xxxxx&email=xxxxx
        ===================================================== */

        const params =
          new URLSearchParams({
            token:
              data.resetToken,

            email,
          });

        router.push(
          `/reset-password?${params.toString()}`,
        );
      } catch (
        verifyError
      ) {
        console.error(
          "VERIFY OTP ERROR:",
          verifyError,
        );

        setError(
          verifyError instanceof
            Error
            ? verifyError.message
            : "ไม่สามารถตรวจสอบ OTP ได้",
        );
      } finally {
        setLoading(false);
      }
    };

  /* =========================================================
     ไม่มี Email
  ========================================================= */

  if (!email) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbf7f7] px-5">

        <section className="w-full max-w-[480px] rounded-[30px] border border-[#eee5e6] bg-white p-8 text-center shadow-[0_25px_70px_rgba(35,25,30,0.08)] sm:p-10">

          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">

            <KeyRound
              size={38}
            />

          </div>

          <h1 className="mt-6 text-2xl font-black">
            ไม่พบข้อมูลการยืนยัน
          </h1>

          <p className="mt-3 text-sm leading-7 text-[#85858d]">
            กรุณากลับไปเริ่มขั้นตอนลืมรหัสผ่านใหม่อีกครั้ง
          </p>

          <Link
            href="/forgot-password"
            className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] font-bold text-white"
          >

            <ArrowLeft
              size={19}
            />

            กลับไปเริ่มใหม่

          </Link>

        </section>

      </main>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbf7f7] px-5 py-10">

      {/* =====================================================
          BACKGROUND
      ====================================================== */}

      <div className="pointer-events-none absolute -left-32 -top-32 h-[380px] w-[380px] rounded-full bg-[#fff0f2] blur-3xl" />

      <div className="pointer-events-none absolute -bottom-40 -right-28 h-[430px] w-[430px] rounded-full bg-[#f8e6e9] blur-3xl" />

      {/* =====================================================
          CONTAINER
      ====================================================== */}

      <div className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center">

        <section className="w-full max-w-[500px] rounded-[32px] border border-[#eee5e6] bg-white p-8 shadow-[0_25px_70px_rgba(35,25,30,0.08)] sm:p-10">

          {/* =================================================
              BACK
          ================================================== */}

          <Link
            href={`/forgot-password`}
            className="flex w-fit items-center gap-2 text-sm font-semibold text-[#777780] transition hover:text-[#b91c2b]"
          >

            <ArrowLeft
              size={18}
            />

            ย้อนกลับ

          </Link>

          {/* =================================================
              ICON
          ================================================== */}

          <div className="mt-8 text-center">

            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#f8e8ea] text-[#b91c2b]">

              <KeyRound
                size={44}
                strokeWidth={1.8}
              />

            </div>

            {/* =================================================
                TITLE
            ================================================== */}

            <h1 className="mt-7 text-3xl font-black">
              ยืนยันรหัส OTP
            </h1>

            <p className="mx-auto mt-3 max-w-[350px] text-sm leading-7 text-[#85858d]">
              กรุณากรอกรหัสยืนยัน 6 หลัก
              ที่ระบบสร้างสำหรับบัญชีของคุณ
            </p>

            {/* =================================================
                EMAIL
            ================================================== */}

            <div className="mt-5 rounded-2xl bg-[#faf8f8] px-5 py-4">

              <p className="text-xs text-[#92939b]">
                ยืนยันบัญชี
              </p>

              <p className="mt-1 break-all font-bold text-[#b91c2b]">
                {email}
              </p>

            </div>

          </div>

          {/* =================================================
              FORM
          ================================================== */}

          <form
            onSubmit={
              handleSubmit
            }
            className="mt-8"
          >

            {/* =================================================
                OTP
            ================================================== */}

            <label className="block">

              <span className="text-sm font-bold">
                รหัส OTP
              </span>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={
                  otp
                }
                disabled={
                  loading
                }
                onChange={(
                  event,
                ) => {
                  const value =
                    event.target.value.replace(
                      /\D/g,
                      "",
                    );

                  setOtp(
                    value.slice(
                      0,
                      6,
                    ),
                  );

                  if (error) {
                    setError(
                      "",
                    );
                  }
                }}
                placeholder="000000"
                className="mt-3 h-16 w-full rounded-2xl border border-[#e5e0e1] bg-[#fafafa] px-4 text-center text-3xl font-black tracking-[0.35em] text-[#b91c2b] outline-none transition placeholder:text-[#c8c8cd] focus:border-[#b91c2b] focus:bg-white focus:ring-4 focus:ring-[#b91c2b]/10 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-2 text-center text-xs text-[#999aa1]">
                กรุณากรอกตัวเลข 6 หลัก
              </p>

            </label>

            {/* =================================================
                ERROR
            ================================================== */}

            {error && (
              <div className="mt-5 rounded-2xl border border-[#f2d3d7] bg-[#fff0f2] p-4 text-center text-sm font-semibold text-[#b91c2b]">
                {error}
              </div>
            )}

            {/* =================================================
                SUBMIT
            ================================================== */}

            <button
              type="submit"
              disabled={
                loading ||
                otp.length !==
                  6
              }
              className="mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] font-bold text-white shadow-[0_15px_30px_rgba(185,28,43,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >

              {loading
                ? "กำลังตรวจสอบ..."
                : "ยืนยันรหัส OTP"}

              {!loading && (
                <ArrowRight
                  size={21}
                />
              )}

            </button>

          </form>

          {/* =================================================
              SECURITY INFO
          ================================================== */}

          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#faf8f8] p-4">

            <ShieldCheck
              size={20}
              className="mt-0.5 shrink-0 text-[#b91c2b]"
            />

            <p className="text-xs leading-6 text-[#85858d]">
              หลังจากยืนยัน OTP สำเร็จ
              ระบบจะสร้าง Token สำหรับอนุญาตให้เปลี่ยนรหัสผ่าน
              และพาคุณไปยังหน้าตั้งรหัสผ่านใหม่
            </p>

          </div>

        </section>

      </div>

    </main>
  );
}

/* =========================================================
   PAGE + SUSPENSE

   useSearchParams ต้องอยู่ภายใต้ Suspense
========================================================= */

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fbf7f7]">

          <div className="text-center">

            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#f0dadd] border-t-[#b91c2b]" />

            <p className="mt-4 text-sm font-semibold text-[#777780]">
              กำลังโหลด...
            </p>

          </div>

        </main>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}