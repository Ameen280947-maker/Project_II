"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/app//components/Sidebar";

import {
  ArrowRight,
  HeartPulse,
} from "lucide-react";

import { useState } from "react";

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

  const [systolic, setSystolic] =
    useState(0);

  const [diastolic, setDiastolic] =
    useState(0);

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
          systolic < 50 ||
          systolic > 300
        ) {
          throw new Error(
            "ค่าความดันตัวบนไม่ถูกต้อง",
          );
        }

        if (
          diastolic < 30 ||
          diastolic > 200
        ) {
          throw new Error(
            "ค่าความดันตัวล่างไม่ถูกต้อง",
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
                  systolic,
                  diastolic,
                }),
            },
          );

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

        <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12">

          <header>

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              แบบประเมินสุขภาพเบื้องต้น
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Assessment-
              <span className="text-[#b91c2b]">
                ความดันโลหิต
              </span>
            </h1>

            <p className="mt-4 text-[#85858d]">
              กรอกค่าความดันตัวบนและตัวล่าง
              เพื่อประเมินระดับความดันโลหิตเบื้องต้น
            </p>

          </header>

          <div className="mt-10">

            <div className="mx-auto max-w-2xl space-y-7">

              {/* Input card */}

              <section className="rounded-[28px] border border-[#eee5e6] bg-white p-8 shadow-[0_16px_45px_rgba(35,25,30,0.05)]">

                <div className="flex items-center gap-4">

                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
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
                    onChange={
                      setSystolic
                    }
                  />

                  <PressureInput
                    label="Diastolic (ค่าตัวล่าง)"
                    value={diastolic}
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
                className="group relative flex h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#c5162d] to-[#9d1426] text-lg font-bold text-white shadow-[0_18px_40px_rgba(185,28,43,0.3)] transition-all hover:shadow-[0_22px_48px_rgba(185,28,43,0.4)] active:scale-[0.99] disabled:opacity-60 disabled:shadow-none"
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
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number,
  ) => void;
}) {
  return (
    <label>

      <span className="text-sm font-semibold">
        {label}
      </span>

      <div className="mt-3 flex h-20 items-center rounded-2xl border border-[#e8dfe0] bg-[#faf8f8] px-5 focus-within:border-[#b91c2b]">

        <input
          type="number"
          value={value}
          onChange={(event) =>
            onChange(
              Number(
                event.target.value,
              ),
            )
          }
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-[#b91c2b] outline-none"
        />

        <span className="ml-3 text-xs font-semibold text-[#8b8c94]">
          MMHG
        </span>

      </div>

    </label>
  );
}


