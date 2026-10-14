"use client";

import {
  FormEvent,
  Suspense,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
} from "lucide-react";

import Link from "next/link";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

// รูปแบบ response ของ /api/auth/reset-password
type ResetPasswordResponse = {
  success: boolean;
  message?: string;

  user?: {
    user_id: number;
    username: string;
    email: string;
  };
};

// เนื้อหาหน้า: ฟอร์มตั้งรหัสผ่านใหม่โดยใช้ email และ token จาก URL
// มี 3 สถานะ: ลิงก์ไม่ครบ → ให้เริ่มใหม่, เปลี่ยนสำเร็จ → ไปหน้า login, ปกติ → แสดงฟอร์ม
function ResetPasswordContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  // อ่าน email และ token สำหรับรีเซ็ตจาก URL
  const email =
    searchParams.get(
      "email",
    ) ?? "";

  const resetToken =
    searchParams.get(
      "token",
    ) ?? "";

  // state ของฟอร์ม: รหัสผ่าน การแสดงรหัส สถานะโหลด error และผลสำเร็จ
  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState(false);

  // ตรวจรหัสผ่านใหม่แล้วส่งไป /api/auth/reset-password สำเร็จจะพาไปหน้า login
  // ตรวจ: มี email/token, รหัส ≥8 ตัว, ยืนยันตรงกัน → POST → ล้างฟอร์มและตั้ง success
  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      try {
        setLoading(true);
        setError("");

        if (
          !email ||
          !resetToken
        ) {
          throw new Error(
            "ข้อมูลสำหรับตั้งรหัสผ่านใหม่ไม่ครบ กรุณาเริ่มใหม่",
          );
        }

        if (!password) {
          throw new Error(
            "กรุณากรอกรหัสผ่านใหม่",
          );
        }

        if (
          password.length < 8
        ) {
          throw new Error(
            "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
          );
        }

        if (
          !confirmPassword
        ) {
          throw new Error(
            "กรุณายืนยันรหัสผ่านใหม่",
          );
        }

        if (
          password !==
          confirmPassword
        ) {
          throw new Error(
            "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
          );
        }

        // ส่งรหัสผ่านใหม่ไป API
        const response =
          await fetch(
            "/api/auth/reset-password",
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

                  resetToken,

                  newPassword:
                    password,
                }),
            },
          );

        const data =
          (await response.json()) as ResetPasswordResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "ไม่สามารถเปลี่ยนรหัสผ่านได้",
          );
        }

        setPassword("");
        setConfirmPassword("");

        setSuccess(true);
      } catch (
        resetError
      ) {
        console.error(
          "RESET PASSWORD FRONTEND ERROR:",
          resetError,
        );

        setError(
          resetError instanceof
            Error
            ? resetError.message
            : "ไม่สามารถเปลี่ยนรหัสผ่านได้",
        );
      } finally {
        setLoading(false);
      }
    };

  // หน้าจอเมื่อลิงก์ไม่มี email/token → ให้เริ่มขั้นตอนลืมรหัสผ่านใหม่
  if (
    !email ||
    !resetToken
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbf9f9] px-5">

        <section className="w-full max-w-[460px] rounded-[30px] border border-[#eee5e6] bg-white p-8 text-center shadow-[0_25px_70px_rgba(35,25,30,0.08)]">

          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">

            <LockKeyhole
              size={38}
            />

          </div>

          <h1 className="mt-6 text-2xl font-black">
            ไม่สามารถตั้งรหัสผ่านใหม่ได้
          </h1>

          <p className="mt-3 text-sm leading-7 text-[#85858d]">
            ไม่พบข้อมูลยืนยันสำหรับเปลี่ยนรหัสผ่าน
            กรุณาเริ่มขั้นตอนลืมรหัสผ่านใหม่อีกครั้ง
          </p>

          <Link
            href="/forgot-password"
            className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] font-bold text-white"
          >
            <ArrowLeft
              size={19}
            />

            เริ่มใหม่
          </Link>

        </section>

      </main>
    );
  }

  // หน้าจอเมื่อเปลี่ยนรหัสผ่านสำเร็จ
  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbf9f9] px-5">

        <section className="w-full max-w-[470px] rounded-[30px] border border-[#eee5e6] bg-white p-9 text-center shadow-[0_25px_70px_rgba(35,25,30,0.08)]">

          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#edf8ec] text-[#55975c]">

            <CheckCircle2
              size={50}
            />

          </div>

          <h1 className="mt-7 text-3xl font-black">
            เปลี่ยนรหัสผ่านสำเร็จ
          </h1>

          <p className="mt-4 text-sm leading-7 text-[#85858d]">
            รหัสผ่านใหม่ถูกบันทึกลงในบัญชีของคุณเรียบร้อยแล้ว
            กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
          </p>

          <button
            type="button"
            onClick={() =>
              router.replace(
                "/login",
              )
            }
            className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] font-bold text-white shadow-[0_15px_30px_rgba(185,28,43,0.25)]"
          >

            เข้าสู่ระบบ

            <ArrowRight
              size={20}
            />

          </button>

        </section>

      </main>
    );
  }

  // หน้าจอหลัก: ฟอร์มตั้งรหัสผ่านใหม่
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbf9f9] text-[#2f3037]">

      <div className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">

        <div className="pointer-events-none absolute left-[-120px] top-[-120px] h-[350px] w-[350px] rounded-full bg-[#fff0f2] blur-3xl" />

        <div className="pointer-events-none absolute bottom-[-140px] right-[-100px] h-[400px] w-[400px] rounded-full bg-[#f9e5e8] blur-3xl" />

        <div className="relative z-10 grid w-full max-w-[1050px] overflow-hidden rounded-[36px] border border-[#eee5e6] bg-white shadow-[0_30px_80px_rgba(70,35,40,0.08)] lg:grid-cols-[1fr_520px]">

          {/* แผงซ้าย: ข้อความแนะนำและอีเมลบัญชี (จอใหญ่) */}
          <section className="hidden bg-gradient-to-br from-[#fffafa] via-white to-[#fff2f4] p-12 lg:flex lg:flex-col lg:justify-center">

            <div className="grid h-20 w-20 place-items-center rounded-[25px] bg-white text-[#b91c2b] shadow-[0_15px_35px_rgba(185,28,43,0.12)]">

              <HeartPulse
                size={42}
                strokeWidth={
                  1.8
                }
              />

            </div>

            <p className="mt-9 text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Health Risk Assessment
            </p>

            <h1 className="mt-4 text-4xl font-black leading-[1.25]">

              ตั้งรหัสผ่าน

              <span className="block text-[#b91c2b]">
                ใหม่ของคุณ
              </span>

            </h1>

            <p className="mt-6 max-w-[390px] text-base leading-8 text-[#74757d]">
              สร้างรหัสผ่านใหม่สำหรับบัญชีของคุณ
              หลังจากบันทึกแล้ว
              คุณสามารถใช้รหัสผ่านใหม่นี้เข้าสู่ระบบได้ทันที
            </p>

            <div className="mt-9 rounded-[24px] bg-white/70 p-5">

              <p className="text-xs font-semibold text-[#999aa1]">
                บัญชีที่กำลังเปลี่ยนรหัสผ่าน
              </p>

              <p className="mt-2 break-all font-bold text-[#b91c2b]">
                {email}
              </p>

            </div>

          </section>

          {/* แผงขวา: ลิงก์ย้อนกลับ หัวข้อ และฟอร์ม */}
          <section className="flex min-h-[620px] flex-col justify-center p-7 sm:p-10 lg:p-12">

            <Link
              href={`/verify-otp?email=${encodeURIComponent(
                email,
              )}`}
              className="mb-8 flex w-fit items-center gap-2 text-sm font-semibold text-[#777780] transition hover:text-[#b91c2b]"
            >

              <ArrowLeft
                size={18}
              />

              ย้อนกลับ

            </Link>

            <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-[#fff0f2] text-[#b91c2b]">

              <LockKeyhole
                size={32}
              />

            </div>

            <h2 className="mt-7 text-3xl font-black">
              ตั้งรหัสผ่านใหม่
            </h2>

            <p className="mt-3 max-w-[420px] text-sm leading-7 text-[#85858d]">
              กรุณากำหนดรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร
            </p>

            <div className="mt-5 rounded-2xl bg-[#faf8f8] px-5 py-4">

              <p className="text-xs text-[#92939b]">
                บัญชี
              </p>

              <p className="mt-1 break-all font-bold text-[#b91c2b]">
                {email}
              </p>

            </div>

            {/* ฟอร์ม: รหัสผ่านใหม่ ยืนยันรหัส ข้อความเตือน และปุ่มบันทึก */}
            <form
              onSubmit={
                handleSubmit
              }
              className="mt-7 space-y-5"
            >

              <PasswordField
                label="รหัสผ่านใหม่"
                value={
                  password
                }
                visible={
                  showPassword
                }
                onChange={(
                  value,
                ) => {
                  setPassword(
                    value,
                  );

                  if (error) {
                    setError(
                      "",
                    );
                  }
                }}
                onToggle={() =>
                  setShowPassword(
                    (value) =>
                      !value,
                  )
                }
                placeholder="กรอกรหัสผ่านใหม่"
                disabled={
                  loading
                }
              />

              <PasswordField
                label="ยืนยันรหัสผ่านใหม่"
                value={
                  confirmPassword
                }
                visible={
                  showConfirmPassword
                }
                onChange={(
                  value,
                ) => {
                  setConfirmPassword(
                    value,
                  );

                  if (error) {
                    setError(
                      "",
                    );
                  }
                }}
                onToggle={() =>
                  setShowConfirmPassword(
                    (value) =>
                      !value,
                  )
                }
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                disabled={
                  loading
                }
              />

              {/* ข้อความตรวจสอบรหัสผ่านแบบทันที และ error จาก API */}
              {password &&
                password.length <
                  8 && (
                  <p className="text-xs font-medium text-[#b91c2b]">
                    รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร
                  </p>
                )}

              {confirmPassword &&
                password !==
                  confirmPassword && (
                  <p className="text-xs font-medium text-[#b91c2b]">
                    รหัสผ่านทั้งสองช่องไม่ตรงกัน
                  </p>
                )}

              {error && (
                <div className="rounded-2xl border border-[#f2d3d7] bg-[#fff0f2] px-4 py-3 text-sm font-medium text-[#b91c2b]">

                  {error}

                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  !password ||
                  !confirmPassword ||
                  password.length <
                    8 ||
                  password !==
                    confirmPassword
                }
                className="flex h-15 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] font-bold text-white shadow-[0_15px_30px_rgba(185,28,43,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >

                {loading
                  ? "กำลังเปลี่ยนรหัสผ่าน..."
                  : "บันทึกรหัสผ่านใหม่"}

                {!loading && (
                  <ArrowRight
                    size={20}
                  />
                )}

              </button>

            </form>

          </section>

        </div>

      </div>

    </main>
  );
}

// ช่องกรอกรหัสผ่านพร้อมป้ายชื่อและปุ่มสลับแสดง/ซ่อน
function PasswordField({
  label,
  value,
  visible,
  onChange,
  onToggle,
  placeholder,
  disabled = false,
}: {
  label: string;

  value: string;

  visible: boolean;

  onChange: (
    value: string,
  ) => void;

  onToggle: () => void;

  placeholder: string;

  disabled?: boolean;
}) {
  return (
    <label className="block">

      <span className="text-sm font-bold">
        {label}
      </span>

      <div className="mt-3 flex h-15 items-center rounded-2xl border border-[#e5dfe0] bg-[#fafafa] px-4 transition focus-within:border-[#b91c2b] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#b91c2b]/5">

        <LockKeyhole
          size={21}
          className="shrink-0 text-[#9a9ba2]"
        />

        <input
          type={
            visible
              ? "text"
              : "password"
          }
          value={
            value
          }
          disabled={
            disabled
          }
          onChange={(
            event,
          ) =>
            onChange(
              event.target
                .value,
            )
          }
          placeholder={
            placeholder
          }
          autoComplete="new-password"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={
            onToggle
          }
          aria-label={
            visible
              ? "ซ่อนรหัสผ่าน"
              : "แสดงรหัสผ่าน"
          }
          className="text-[#8b8c94] transition hover:text-[#b91c2b] disabled:cursor-not-allowed disabled:opacity-50"
        >

          {visible ? (
            <EyeOff
              size={21}
            />
          ) : (
            <Eye
              size={21}
            />
          )}

        </button>

      </div>

    </label>
  );
}

// หน้า: รีเซ็ตรหัสผ่าน ครอบด้วย Suspense พร้อมหน้าโหลด
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#fbf9f9]">

          <div className="text-center">

            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#f0dadd] border-t-[#b91c2b]" />

            <p className="mt-4 text-sm font-semibold text-[#777780]">
              กำลังโหลด...
            </p>

          </div>

        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}