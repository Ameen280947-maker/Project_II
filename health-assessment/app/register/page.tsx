"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { FormEvent, ReactNode, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);

    const username = String(
      formData.get("username") || ""
    ).trim();

    const email = String(
      formData.get("email") || ""
    ).trim();

    const password = String(
      formData.get("password") || ""
    );

    const confirmPassword = String(
      formData.get("confirmPassword") || ""
    );

    // ตรวจสอบข้อมูล
    if (!username || !email || !password || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    if (!email.includes("@")) {
      setError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }

    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    // ตรงนี้ค่อยส่งไป API
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message || "สมัครสมาชิกไม่สำเร็จ"
        );
        return;
      }

      alert("สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ");
      router.push("/login");
    } catch (error) {
      console.error(error);
      setError("ไม่สามารถเชื่อมต่อกับระบบได้");
    }
  };

  return (
    <main className="min-h-screen bg-[#fbf7f7] p-3 sm:p-5">
      <section className="mx-auto grid min-h-[calc(100vh-24px)] max-w-[1450px] overflow-hidden rounded-[30px] border border-[#efe5e6] bg-white shadow-[0_25px_70px_rgba(35,25,30,0.08)] lg:grid-cols-[42%_58%]">
        {/* ฝั่งซ้าย */}
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#fff5f6] via-[#f3dadd] to-[#b91c2b] p-14 lg:flex lg:flex-col">
        
          <div className="relative z-10 mt-20 max-w-[420px]">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-[#b91c2b] shadow-lg">
              <HeartPulse size={35} />
            </div>

            <h1 className="mt-8 text-5xl font-bold leading-tight text-[#292a31]">
              เริ่มต้นดูแล
              <span className="block text-[#b91c2b]">สุขภาพของคุณ</span>
            </h1>

            <p className="mt-7 text-lg leading-9 text-[#686970]">
              สร้างบัญชีเพื่อประเมินความเสี่ยงสุขภาพ
              บันทึกผล และติดตามการเปลี่ยนแปลงของคุณ
            </p>
          </div>

          <div className="relative z-10 mt-auto flex items-center gap-3 text-white">
            <ShieldCheck size={24} />
            <p className="text-sm">จัดเก็บข้อมูลอย่างปลอดภัย</p>
          </div>

          <div className="absolute -bottom-40 -right-28 h-[430px] w-[430px] rounded-full bg-white/15" />
        </aside>

        {/* ฟอร์ม */}
        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-16">
          <div className="w-full max-w-[510px]">
            <Link
              href="/welcome"
              className="mb-8 flex w-fit items-center gap-2 text-sm font-semibold text-[#8a1420] lg:hidden"
            >
              <ArrowLeft size={18} />
              กลับหน้าหลัก
            </Link>

            <header className="text-center">
              <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#f8e8ea] text-[#b91c2b] shadow-[0_15px_40px_rgba(138,20,32,0.1)]">
                <UserPlus size={43} strokeWidth={1.7} />
              </div>

              <h2 className="mt-7 text-3xl font-bold sm:text-4xl">
                สร้างบัญชีผู้ใช้
              </h2>

              <div className="mx-auto mt-4 h-1 w-10 rounded-full bg-[#b91c2b]" />

              <p className="mt-4 text-[#909199]">
                กรอกข้อมูลเพื่อสมัครสมาชิก
              </p>
            </header>

            <form className="mt-9 space-y-4" onSubmit={handleSubmit}>
              <InputField
                name="username"
                type="text"
                placeholder="ชื่อผู้ใช้"
                autoComplete="username"
                icon={<UserRound size={22} />}
              />

              <InputField
                name="email"
                type="email"
                placeholder="อีเมล"
                autoComplete="email"
                icon={<Mail size={22} />}
              />

              <PasswordField
                name="password"
                placeholder="รหัสผ่านอย่างน้อย 8 ตัวอักษร"
                visible={showPassword}
                onToggle={() =>
                  setShowPassword((value) => !value)
                }
              />

              <PasswordField
                name="confirmPassword"
                placeholder="ยืนยันรหัสผ่าน"
                visible={showConfirmPassword}
                onToggle={() =>
                  setShowConfirmPassword((value) => !value)
                }
              />

              {error && (
                <p className="rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-medium text-[#b91c2b]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="flex h-[66px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#b91c2b] to-[#8a1420] text-lg font-bold text-white shadow-[0_14px_30px_rgba(138,20,32,0.28)] transition hover:-translate-y-0.5"
              >
                สมัครสมาชิก
                <ArrowRight size={22} />
              </button>
            </form>

            <p className="mt-7 text-center text-[#909199]">
              มีบัญชีอยู่แล้ว?
              <Link
                href="/login"
                className="ml-2 font-bold text-[#b91c2b] hover:underline"
              >
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}

type InputFieldProps = {
  name: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
  icon: ReactNode;
};

function InputField({
  name,
  type,
  placeholder,
  autoComplete,
  icon,
}: InputFieldProps) {
  return (
    <label className="flex h-[66px] items-center rounded-2xl border border-[#e5e0e1] bg-white px-5 focus-within:border-[#b91c2b]/60 focus-within:ring-4 focus-within:ring-[#b91c2b]/10">
      <span className="mr-4 text-[#8b8c94]">{icon}</span>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-full w-full bg-transparent outline-none placeholder:text-[#a6a7ad]"
      />
    </label>
  );
}

type PasswordFieldProps = {
  name: string;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
};

function PasswordField({
  name,
  placeholder,
  visible,
  onToggle,
}: PasswordFieldProps) {
  return (
    <label className="flex h-[66px] items-center rounded-2xl border border-[#e5e0e1] bg-white px-5 focus-within:border-[#b91c2b]/60 focus-within:ring-4 focus-within:ring-[#b91c2b]/10">
      <LockKeyhole
        size={22}
        className="mr-4 shrink-0 text-[#8b8c94]"
      />

      <input
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete="new-password"
        className="h-full w-full bg-transparent outline-none placeholder:text-[#a6a7ad]"
      />

      <button
        type="button"
        onClick={onToggle}
        className="ml-3 grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#8b8c94] hover:bg-[#f8e8ea] hover:text-[#b91c2b]"
        aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
      >
        {visible ? <EyeOff size={21} /> : <Eye size={21} />}
      </button>
    </label>
  );
}