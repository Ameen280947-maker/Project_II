"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/app//components/Sidebar";

import {
  ArrowRight,
  HeartPulse,
} from "lucide-react";

import { useState } from "react";
import AssessmentBackLink from "@/app/components/AssessmentBackLink";
import HealthConsentNotice from "@/app/components/HealthConsentNotice";

type SubmitResponse = {
  success: boolean;
  assessmentId?: number;
  systolic?: number;
  diastolic?: number;
  riskLevel?: string;
  recommendation?: string;
  message?: string;
};

export default function BloodPressureAssessmentPage() {
  const router = useRouter();

  // เริ่มว่าง (แสดง placeholder) แทน 0 เพราะโปรไฟล์ไม่มีค่าความดัน
  const [systolic, setSystolic] =
    useState("");

  const [diastolic, setDiastolic] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =========================================================
     บันทึกลง Database
  ========================================================= */

  const handleAssessment =
    async () => {
      try {
        setSubmitting(true);
        setError("");

        const storedUserId =
          localStorage.getItem(
            "userId",
          );

        if (!storedUserId) {
          router.push("/login");
          return;
        }

        const userId =
          Number(storedUserId);

        if (
          !Number.isInteger(userId) ||
          userId <= 0
        ) {
          localStorage.removeItem(
            "userId",
          );

          router.push("/login");
          return;
        }

        if (
          !systolic.trim() ||
          !diastolic.trim()
        ) {
          throw new Error(
            "กรุณากรอกค่าความดันตัวบนและตัวล่าง",
          );
        }

        const systolicValue =
          Number(systolic);

        const diastolicValue =
          Number(diastolic);

        // ช่วงค่าเดียวกับ API (จำนวนเต็ม SBP 60-250, DBP 30-150 และตัวบนต้องมากกว่าตัวล่าง)
        if (
          !Number.isInteger(systolicValue) ||
          systolicValue < 60 ||
          systolicValue > 250
        ) {
          throw new Error(
            "ค่าความดันตัวบนต้องเป็นจำนวนเต็มระหว่าง 60–250 mmHg",
          );
        }

        if (
          !Number.isInteger(diastolicValue) ||
          diastolicValue < 30 ||
          diastolicValue > 150
        ) {
          throw new Error(
            "ค่าความดันตัวล่างต้องเป็นจำนวนเต็มระหว่าง 30–150 mmHg",
          );
        }

        if (systolicValue <= diastolicValue) {
          throw new Error(
            "ค่าความดันตัวบนต้องมากกว่าตัวล่าง",
          );
        }

        const response =
          await fetch(
            "/api/assessments/blood-pressure",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  userId,
                  systolic: systolicValue,
                  diastolic: diastolicValue,
                }),
            },
          );

        // session หมดอายุ → กลับไปหน้า login
        if (response.status === 401) {
          localStorage.removeItem("userId");
          router.push("/login");
          return;
        }

        const data =
          (await response.json()) as SubmitResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "ไม่สามารถบันทึกผลประเมินได้",
          );
        }

        /*
          จุดสำคัญ

          API ต้องส่ง assessmentId
          กลับมา
        */

        if (!data.assessmentId) {
          throw new Error(
            "ระบบบันทึกข้อมูลแล้ว แต่ไม่ได้รับ assessmentId",
          );
        }

        /*
          ส่ง assessmentId ไปหน้า Recommendation
        */

        router.push(
          `/recommendation_DB?assessmentId=${data.assessmentId}`,
        );
      } catch (submitError) {
        console.error(
          "Blood Pressure submit error:",
          submitError,
        );

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

            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#2f4fa0]">
              Blood Pressure Assessment
            </p>

            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-[42px]">
              แบบประเมิน
              <span className="text-[#4f6fc0]">
                ความดันโลหิต
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

                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8edf8] text-[#2f4fa0]">
                    <HeartPulse
                      size={27}
                    />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold">
                      ค่าความดันโลหิต
                    </h2>

                    <p className="text-sm text-[#92939b]">
                      หน่วยมิลลิเมตรปรอท
                    </p>
                  </div>

                </div>

                <div className="mt-8 grid gap-5 md:grid-cols-2">

                  <PressureInput
                    label="Systolic (ค่าตัวบน)"
                    value={systolic}
                    placeholder="เช่น 120"
                    onChange={
                      setSystolic
                    }
                  />

                  <PressureInput
                    label="Diastolic (ค่าตัวล่าง)"
                    value={diastolic}
                    placeholder="เช่น 80"
                    onChange={
                      setDiastolic
                    }
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
                disabled={
                  submitting
                }
                onClick={
                  handleAssessment
                }
                className="group relative flex h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#4f6fc0] to-[#263f82] text-lg font-bold text-white shadow-[0_18px_40px_rgba(47,79,160,0.3)] transition-all hover:shadow-[0_22px_48px_rgba(47,79,160,0.4)] active:scale-[0.99] disabled:opacity-60 disabled:shadow-none"
              >

                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                {submitting
                  ? "กำลังบันทึก..."
                  : "เริ่มประเมิน"}

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
   Pressure input
========================================================= */

function PressureInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label>

      <span className="text-sm font-semibold">
        {label}
      </span>

      <div className="mt-3 flex h-20 items-center rounded-2xl border border-[#e8dfe0] bg-[#faf8f8] px-5 focus-within:border-[#2f4fa0]">

        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-[#2f4fa0] outline-none placeholder:font-normal placeholder:text-[#c9c3c4]"
        />

        <span className="ml-3 text-xs font-semibold text-[#8b8c94]">
          MMHG
        </span>

      </div>

    </label>
  );
}


