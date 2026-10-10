"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Weight } from "lucide-react";
import Sidebar from "@/app/components/Sidebar";
import AssessmentBackLink from "@/app/components/AssessmentBackLink";
import HealthConsentNotice from "@/app/components/HealthConsentNotice";

/* =========================================================
   แบบประเมินภาวะน้ำหนักเกิน (BMI)
   หน้าตาเดียวกับแบบประเมินความดันโลหิต
========================================================= */

type SubmitResponse = {
  success: boolean;
  assessmentId?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  riskLevel?: string;
  recommendation?: string;
  message?: string;
};

export default function WeightAssessmentPage() {
  const router = useRouter();

  // เก็บเป็นข้อความ เพื่อให้ลบช่องจนว่างได้ แล้วเติมจากข้อมูลสุขภาพในโปรไฟล์ (ถ้ามี)
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /* =========================================================
     โหลดน้ำหนัก/ส่วนสูงจากโปรไฟล์
  ========================================================= */

  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) return;

    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/profile?userId=${id}`, {
          method: "GET",
          cache: "no-store",
        });

        // session หมดอายุ → กลับไปหน้า login
        if (response.status === 401) {
          localStorage.removeItem("userId");
          router.replace("/login");
          return;
        }

        const data = await response.json();
        if (!response.ok || !data.success) return;

        const source = data.profile ?? data.healthProfile ?? data.data ?? data;
        const w = Number(source.weight_kg ?? source.weight ?? 0);
        const h = Number(source.height_cm ?? source.height ?? 0);

        // ไม่ทับค่าที่ผู้ใช้พิมพ์ไปแล้ว
        if (w > 0) setWeight((prev) => prev || String(w));
        if (h > 0) setHeight((prev) => prev || String(h));
      } catch (loadError) {
        // โหลดไม่ได้ก็ให้กรอกเองได้ตามปกติ
        console.error("BMI profile load error:", loadError);
      }
    };

    void loadProfile();
  }, [router]);

  /* =========================================================
     บันทึกผลประเมิน
  ========================================================= */

  const handleStartAssessment = async () => {
    try {
      setSubmitting(true);
      setError("");

      const storedUserId = localStorage.getItem("userId");

      if (!storedUserId) {
        router.push("/login");
        return;
      }

      const userId = Number(storedUserId);

      if (!Number.isInteger(userId) || userId <= 0) {
        localStorage.removeItem("userId");
        router.push("/login");
        return;
      }

      if (!weight.trim() || !height.trim()) {
        throw new Error("กรุณากรอกน้ำหนักและส่วนสูง");
      }

      const weightKg = Number(weight);
      const heightCm = Number(height);

      if (!Number.isFinite(weightKg) || weightKg < 10 || weightKg > 400) {
        throw new Error("ค่าน้ำหนักไม่ถูกต้อง");
      }

      if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250) {
        throw new Error("ค่าส่วนสูงไม่ถูกต้อง");
      }

      const response = await fetch("/api/assessments/bmi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          weightKg,
          heightCm,
        }),
      });

      // session หมดอายุ → กลับไปหน้า login
      if (response.status === 401) {
        localStorage.removeItem("userId");
        router.push("/login");
        return;
      }

      const data = (await response.json()) as SubmitResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "ไม่สามารถบันทึกผลประเมินได้");
      }

      if (!data.assessmentId) {
        throw new Error("ระบบบันทึกข้อมูลแล้ว แต่ไม่ได้รับ assessmentId");
      }

      router.push(`/recommendation_BMI?assessmentId=${data.assessmentId}`);
    } catch (submitError) {
      console.error("BMI submit error:", submitError);

      setError(
        submitError instanceof Error
          ? submitError.message
          : "เกิดข้อผิดพลาดในการประเมิน",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">

        <Sidebar />

        {/* Content */}

        <section className="flex min-h-screen min-w-0 flex-1 flex-col px-5 py-7 sm:px-8 lg:px-12">

          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">

              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#2c6b45]">
                Overweight Assessment
              </p>

              <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-[42px]">
                แบบประเมินความเสี่ยง
                <span className="text-[#4a8a62]">
                  ภาวะน้ำหนักเกิน
                </span>
              </h1>

            </div>

            {/* ถอนความยินยอมเก็บข้อมูลสุขภาพ → แจ้งก่อนเริ่มทำ */}
            <HealthConsentNotice />
            <AssessmentBackLink href="/assessment-menu" />
          </header>

          {/* จัดฟอร์มให้อยู่กลางพื้นที่ที่เหลือ (ขยับขึ้นเล็กน้อยให้ดูสมดุล) */}
          <div className="flex flex-1 items-center py-10 lg:pb-24">

            <div className="mx-auto w-full max-w-2xl space-y-7">

              {/* Input card */}

              <section className="rounded-[28px] border border-[#eee5e6] bg-white p-8 shadow-[0_16px_45px_rgba(35,25,30,0.05)]">

                <div className="flex items-center gap-4">

                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e5f0e8] text-[#2c6b45]">
                    <Weight size={26} />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold">
                      น้ำหนักและส่วนสูง
                    </h2>

                    <p className="text-sm text-[#92939b]">
                      ใช้คำนวณดัชนีมวลกาย (BMI)
                    </p>
                  </div>

                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2">

                  <MeasureInput
                    label="น้ำหนัก (กิโลกรัม)"
                    unit="KG"
                    value={weight}
                    placeholder="เช่น 65"
                    onChange={setWeight}
                  />

                  <MeasureInput
                    label="ส่วนสูง (เซนติเมตร)"
                    unit="CM"
                    value={height}
                    placeholder="เช่น 170"
                    onChange={setHeight}
                  />

                </div>

              </section>

              {error && (
                <div className="rounded-2xl border border-[#f2d3d7] bg-[#fff0f2] p-4 text-sm font-medium text-[#b91c2b]">
                  {error}
                </div>
              )}

              {/* Submit */}

              <button
                type="button"
                disabled={submitting}
                onClick={handleStartAssessment}
                className="group relative flex h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#4a8a62] to-[#235638] text-lg font-bold text-white shadow-[0_18px_40px_rgba(44,107,69,0.3)] transition-all hover:shadow-[0_22px_48px_rgba(44,107,69,0.4)] active:scale-[0.99] disabled:opacity-60 disabled:shadow-none"
              >

                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                {submitting ? "กำลังบันทึก..." : "เริ่มประเมิน"}

                {!submitting && (
                  <ArrowRight
                    size={22}
                    className="transition-transform group-hover:translate-x-1"
                  />
                )}

              </button>

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}

/* =========================================================
   Measure input (รูปแบบเดียวกับช่องกรอกความดันโลหิต)
========================================================= */

function MeasureInput({
  label,
  unit,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>

      <span className="text-sm font-semibold">
        {label}
      </span>

      <div className="mt-3 flex h-20 items-center rounded-2xl border border-[#e8dfe0] bg-[#faf8f8] px-5 focus-within:border-[#2c6b45]">

        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-[#2c6b45] outline-none placeholder:font-normal placeholder:text-[#c9c3c4]"
        />

        <span className="ml-3 text-xs font-semibold text-[#8b8c94]">
          {unit}
        </span>

      </div>

    </label>
  );
}
