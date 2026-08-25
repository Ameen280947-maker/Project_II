"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HeartPulse,
  Mail,
} from "lucide-react";
import { FormEvent, useState } from "react";

type ForgotPasswordResponse = {
  success: boolean;
  message?: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  /* =========================================================
     SUBMIT EMAIL
  ========================================================= */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const normalizedEmail = email
        .trim()
        .toLowerCase();

      /* ================= Validation ================= */

      if (!normalizedEmail) {
        throw new Error(
          "กรุณากรอกอีเมล",
        );
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailPattern.test(
          normalizedEmail,
        )
      ) {
        throw new Error(
          "รูปแบบอีเมลไม่ถูกต้อง",
        );
      }

      /* =====================================================
         POST /api/auth/forgot-password
      ===================================================== */

      const response = await fetch(
        "/api/auth/forgot-password",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email: normalizedEmail,
          }),
        },
      );

      const data =
        (await response.json()) as ForgotPasswordResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
        );
      }

      /* =====================================================
         สำเร็จ

         เก็บ email ที่ส่ง OTP ไปแล้ว
         เพื่อใช้ส่งต่อไปหน้า verify-otp
      ===================================================== */

      setSubmittedEmail(
        normalizedEmail,
      );

      setSuccess(true);

      setMessage(
        data.message ??
          "ระบบได้สร้างรหัสยืนยันสำหรับตั้งรหัสผ่านใหม่แล้ว",
      );
    } catch (submitError) {
      console.error(
        "FORGOT PASSWORD ERROR:",
        submitError,
      );

      setError(
        submitError instanceof Error
          ? submitError.message
          : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     ไปหน้า Verify OTP
  ========================================================= */

  const goToVerifyOtp = () => {
    if (!submittedEmail) {
      setError(
        "ไม่พบอีเมล กรุณาดำเนินการใหม่อีกครั้ง",
      );

      setSuccess(false);

      return;
    }

    router.push(
      `/verify-otp?email=${encodeURIComponent(
        submittedEmail,
      )}`,
    );
  };

  /* =========================================================
     ใช้อีเมลอื่น
  ========================================================= */

  const useAnotherEmail = () => {
    setSuccess(false);
    setMessage("");
    setError("");
    setSubmittedEmail("");
    setEmail("");
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbf9f9] text-[#2f3037]">
      <div className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">

        {/* =====================================================
            Background Decoration
        ===================================================== */}

        <div className="pointer-events-none absolute left-[-120px] top-[-120px] h-[350px] w-[350px] rounded-full bg-[#fff0f2] blur-3xl" />

        <div className="pointer-events-none absolute bottom-[-140px] right-[-100px] h-[400px] w-[400px] rounded-full bg-[#f9e5e8] blur-3xl" />

        <div className="pointer-events-none absolute left-[15%] top-[28%] h-2 w-2 rounded-full bg-[#d88c98]" />

        <div className="pointer-events-none absolute bottom-[20%] right-[18%] h-2 w-2 rounded-full bg-[#d88c98]" />

        {/* =====================================================
            Main Container
        ===================================================== */}

        <div className="relative z-10 grid w-full max-w-[1050px] overflow-hidden rounded-[36px] border border-[#eee5e6] bg-white shadow-[0_30px_80px_rgba(70,35,40,0.08)] lg:grid-cols-[1fr_520px]">

          {/* =================================================
              LEFT SIDE
          ================================================== */}

          <section className="hidden bg-gradient-to-br from-[#fffafa] via-white to-[#fff2f4] p-12 lg:flex lg:flex-col lg:justify-center">

            {/* Logo */}

            <div className="grid h-20 w-20 place-items-center rounded-[25px] bg-white text-[#b91c2b] shadow-[0_15px_35px_rgba(185,28,43,0.12)]">
              <HeartPulse
                size={42}
                strokeWidth={1.8}
              />
            </div>

            <p className="mt-9 text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Health Risk Assessment
            </p>

            <h1 className="mt-4 text-4xl font-black leading-[1.25]">
              ไม่ต้องกังวล

              <span className="block text-[#b91c2b]">
                หากลืมรหัสผ่าน
              </span>
            </h1>

            <p className="mt-6 max-w-[390px] text-base leading-8 text-[#74757d]">
              กรอกอีเมลที่ใช้สมัครสมาชิก
              ระบบจะตรวจสอบบัญชีและส่งขั้นตอนสำหรับตั้งรหัสผ่านใหม่ให้คุณ
            </p>

            {/* Steps */}

            <div className="mt-10 space-y-5">

              <Step
                number="1"
                title="กรอกอีเมล"
                description="ใช้อีเมลเดียวกับที่ใช้สมัครสมาชิก"
              />

              <Step
                number="2"
                title="ยืนยันรหัส OTP"
                description="กรอกรหัสยืนยัน 6 หลักจากระบบ"
              />

              <Step
                number="3"
                title="ตั้งรหัสผ่านใหม่"
                description="สร้างรหัสผ่านใหม่และเข้าสู่ระบบอีกครั้ง"
              />

            </div>

          </section>

          {/* =================================================
              RIGHT SIDE
          ================================================== */}

          <section className="flex min-h-[620px] flex-col justify-center p-7 sm:p-10 lg:p-12">

            {/* Back */}

            <Link
              href="/login"
              className="mb-8 flex w-fit items-center gap-2 text-sm font-semibold text-[#777780] transition hover:text-[#b91c2b]"
            >
              <ArrowLeft
                size={18}
              />

              กลับไปหน้าเข้าสู่ระบบ
            </Link>

            {/* =================================================
                SUCCESS STATE
            ================================================== */}

            {success ? (
              <div className="text-center">

                <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#edf8ec] text-[#5c9c62]">
                  <CheckCircle2
                    size={50}
                    strokeWidth={1.7}
                  />
                </div>

                <h2 className="mt-7 text-3xl font-black">
                  ยืนยันรหัส OTP
                </h2>

                <p className="mx-auto mt-4 max-w-[390px] text-sm leading-7 text-[#85858d]">
                  {message}
                </p>

                <div className="mt-5 rounded-2xl bg-[#faf8f8] px-5 py-4">

                  <p className="text-xs text-[#92939b]">
                    อีเมลสำหรับยืนยัน
                  </p>

                  <p className="mt-1 break-all font-bold text-[#b91c2b]">
                    {submittedEmail}
                  </p>

                </div>

                {/* =================================================
                    สำคัญ:
                    จากเดิมกลับ /login
                    เปลี่ยนเป็น /verify-otp
                ================================================== */}

                <button
                  type="button"
                  onClick={goToVerifyOtp}
                  className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] font-bold text-white shadow-[0_15px_30px_rgba(185,28,43,0.25)] transition hover:-translate-y-0.5"
                >
                  กรอกรหัสยืนยัน

                  <ArrowRight
                    size={20}
                  />
                </button>

                <button
                  type="button"
                  onClick={
                    useAnotherEmail
                  }
                  className="mt-5 text-sm font-semibold text-[#b91c2b] hover:underline"
                >
                  ใช้อีเมลอื่น
                </button>

              </div>
            ) : (
              /* =================================================
                  FORM STATE
              ================================================== */

              <>

                <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-[#fff0f2] text-[#b91c2b]">
                  <HeartPulse
                    size={32}
                    strokeWidth={1.8}
                  />
                </div>

                <h2 className="mt-7 text-3xl font-black">
                  ลืมรหัสผ่าน?
                </h2>

                <p className="mt-3 max-w-[420px] text-sm leading-7 text-[#85858d]">
                  กรอกอีเมลที่เชื่อมกับบัญชีของคุณ
                  เพื่อดำเนินการตั้งรหัสผ่านใหม่
                </p>

                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="mt-9"
                >

                  {/* ================= Email ================= */}

                  <label className="block">

                    <span className="text-sm font-bold">
                      อีเมล
                    </span>

                    <div className="mt-3 flex h-15 items-center rounded-2xl border border-[#e5dfe0] bg-[#fafafa] px-4 transition focus-within:border-[#b91c2b] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#b91c2b]/5">

                      <Mail
                        size={21}
                        className="shrink-0 text-[#9a9ba2]"
                      />

                      <input
                        type="email"
                        value={email}
                        onChange={(
                          event,
                        ) => {
                          setEmail(
                            event.target
                              .value,
                          );

                          if (error) {
                            setError("");
                          }
                        }}
                        placeholder="example@email.com"
                        autoComplete="email"
                        disabled={
                          loading
                        }
                        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#b4b4ba] disabled:cursor-not-allowed"
                      />

                    </div>

                  </label>

                  {/* ================= Error ================= */}

                  {error && (
                    <div className="mt-5 rounded-2xl border border-[#f2d3d7] bg-[#fff0f2] px-4 py-3 text-sm font-medium text-[#b91c2b]">
                      {error}
                    </div>
                  )}

                  {/* ================= Submit ================= */}

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !email.trim()
                    }
                    className="mt-7 flex h-15 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] font-bold text-white shadow-[0_15px_30px_rgba(185,28,43,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >

                    {loading
                      ? "กำลังตรวจสอบ..."
                      : "ดำเนินการต่อ"}

                    {!loading && (
                      <ArrowRight
                        size={20}
                      />
                    )}

                  </button>

                </form>

                {/* Divider */}

                <div className="my-8 flex items-center gap-4">

                  <div className="h-px flex-1 bg-[#eee8e9]" />

                  <span className="text-xs text-[#a0a0a6]">
                    หรือ
                  </span>

                  <div className="h-px flex-1 bg-[#eee8e9]" />

                </div>

                {/* Login */}

                <p className="text-center text-sm text-[#7b7c84]">
                  จำรหัสผ่านได้แล้ว?{" "}

                  <Link
                    href="/login"
                    className="font-bold text-[#b91c2b] hover:underline"
                  >
                    เข้าสู่ระบบ
                  </Link>
                </p>

              </>
            )}

          </section>

        </div>

      </div>
    </main>
  );
}

/* =========================================================
   STEP COMPONENT
========================================================= */

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4">

      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff0f2] text-sm font-black text-[#b91c2b]">
        {number}
      </div>

      <div>

        <p className="font-bold">
          {title}
        </p>

        <p className="mt-1 text-sm text-[#8b8c94]">
          {description}
        </p>

      </div>

    </div>
  );
}