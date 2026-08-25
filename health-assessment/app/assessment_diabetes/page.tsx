"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  HeartPulse,
  Ruler,
  Scale,
  UsersRound,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";

/* =========================================================
   TYPES
========================================================= */

type HealthProfile = {
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  waist_cm: number | null;
  sbp: number | null;
  dbp: number | null;
};

type AssessmentResponse = {
  success: boolean;
  message?: string;

  assessment?: {
    assessment_id: number;
    user_id: number;

    age: number;
    gender: string;

    height_cm: number;
    weight_kg: number;
    waist_cm: number;

    sbp: number;
    dbp: number;

    bmi: number;

    family_diabetes: boolean;

    risk_percent: number;
    risk_level: string;
  };
};

/* =========================================================
   PAGE
========================================================= */

export default function AssessmentDiabetesPage() {
  const router = useRouter();

  /* =======================================================
     USER
  ======================================================= */

  const [userId, setUserId] =
    useState<number | null>(null);

  /* =======================================================
     PROFILE
  ======================================================= */

  const [profile, setProfile] =
    useState<HealthProfile | null>(null);

  /* =======================================================
     ADDITIONAL DATA
  ======================================================= */

  const [sbp, setSbp] =
    useState("");

  const [dbp, setDbp] =
    useState("");

  const [familyDiabetes, setFamilyDiabetes] =
    useState<boolean | null>(null);

  /* =======================================================
     STATE
  ======================================================= */

  const [loadingProfile, setLoadingProfile] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =========================================================
     LOAD PROFILE
  ========================================================= */

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        setError("");

        /* -----------------------------------------------
           USER ID
        ------------------------------------------------ */

        const storedUserId =
          localStorage.getItem("userId");

        if (!storedUserId) {
          router.push("/login");
          return;
        }

        const id = Number(storedUserId);

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          throw new Error(
            "ไม่พบข้อมูลผู้ใช้งาน",
          );
        }

        setUserId(id);

        /* -----------------------------------------------
           LOAD PROFILE
        ------------------------------------------------ */

        const response = await fetch(
          `/api/profile?userId=${id}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "ไม่สามารถโหลดข้อมูลสุขภาพได้",
          );
        }

        /* -----------------------------------------------
           SOURCE
        ------------------------------------------------ */

        const source =
          data.profile ??
          data.healthProfile ??
          data.data ??
          data;

        /* -----------------------------------------------
           NORMALIZE
        ------------------------------------------------ */

        const normalized: HealthProfile = {
          age:
            Number(
              source.age ??
                source.user_age ??
                0,
            ) || null,

          gender:
            source.gender ??
            source.sex ??
            null,

          height_cm:
            Number(
              source.height_cm ??
                source.height ??
                0,
            ) || null,

          weight_kg:
            Number(
              source.weight_kg ??
                source.weight ??
                0,
            ) || null,

          waist_cm:
            Number(
              source.waist_cm ??
                source.waist ??
                source.waist_circumference ??
                0,
            ) || null,

          sbp:
            Number(
              source.sbp ??
                source.systolic ??
                source.systolic_bp ??
                source.systolic_blood_pressure ??
                0,
            ) || null,

          dbp:
            Number(
              source.dbp ??
                source.diastolic ??
                source.diastolic_bp ??
                source.diastolic_blood_pressure ??
                0,
            ) || null,
        };

        /* -----------------------------------------------
           REQUIRED PROFILE DATA
           
           ไม่บังคับ SBP/DBP
           เพราะถ้าไม่มีให้กรอกในหน้านี้
        ------------------------------------------------ */

        if (
          normalized.age === null ||
          normalized.gender === null ||
          normalized.height_cm === null ||
          normalized.weight_kg === null ||
          normalized.waist_cm === null
        ) {
          throw new Error(
            "ข้อมูลสุขภาพยังไม่ครบ กรุณากรอก อายุ เพศ ส่วนสูง น้ำหนัก และรอบเอว ในหน้าข้อมูลสุขภาพก่อน",
          );
        }

        setProfile(normalized);

        /* -----------------------------------------------
           ถ้ามี BP อยู่แล้ว
           ให้ใส่ลงช่องอัตโนมัติ
        ------------------------------------------------ */

        if (normalized.sbp !== null) {
          setSbp(String(normalized.sbp));
        }

        if (normalized.dbp !== null) {
          setDbp(String(normalized.dbp));
        }
      } catch (loadError) {
        console.error(
          "LOAD HEALTH PROFILE ERROR:",
          loadError,
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "ไม่สามารถโหลดข้อมูลสุขภาพได้",
        );
      } finally {
        setLoadingProfile(false);
      }
    };

    void loadProfile();
  }, [router]);

  /* =========================================================
     BMI
  ========================================================= */

  const bmi =
    profile &&
    profile.height_cm &&
    profile.weight_kg
      ? profile.weight_kg /
        Math.pow(
          profile.height_cm / 100,
          2,
        )
      : null;

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");

    /* -----------------------------------------------
       USER
    ------------------------------------------------ */

    if (!userId) {
      setError(
        "ไม่พบข้อมูลผู้ใช้งาน",
      );
      return;
    }

    /* -----------------------------------------------
       PROFILE
    ------------------------------------------------ */

    if (!profile) {
      setError(
        "ไม่พบข้อมูลสุขภาพ",
      );
      return;
    }

    /* -----------------------------------------------
       BLOOD PRESSURE
    ------------------------------------------------ */

    const systolic = Number(sbp);
    const diastolic = Number(dbp);

    if (
      !sbp ||
      !Number.isFinite(systolic) ||
      systolic <= 0
    ) {
      setError(
        "กรุณากรอกค่าความดันตัวบน (SBP)",
      );
      return;
    }

    if (
      !dbp ||
      !Number.isFinite(diastolic) ||
      diastolic <= 0
    ) {
      setError(
        "กรุณากรอกค่าความดันตัวล่าง (DBP)",
      );
      return;
    }

    if (systolic < 60 || systolic > 250) {
      setError(
        "ค่า SBP ควรอยู่ระหว่าง 60–250 mmHg",
      );
      return;
    }

    if (diastolic < 30 || diastolic > 150) {
      setError(
        "ค่า DBP ควรอยู่ระหว่าง 30–150 mmHg",
      );
      return;
    }

    /* -----------------------------------------------
       FAMILY HISTORY
    ------------------------------------------------ */

    if (
      familyDiabetes === null
    ) {
      setError(
        "กรุณาระบุว่ามีประวัติโรคเบาหวานในครอบครัวหรือไม่",
      );
      return;
    }

    /* -----------------------------------------------
       SUBMIT
    ------------------------------------------------ */

    try {
      setSubmitting(true);

      const response = await fetch(
        "/api/assessments/diabetes",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id: userId,

            family_diabetes:
              familyDiabetes,

            sbp: systolic,

            dbp: diastolic,
          }),
        },
      );

      const data =
        (await response.json()) as AssessmentResponse;

      if (
        !response.ok ||
        !data.success ||
        !data.assessment
      ) {
        throw new Error(
          data.message ??
            "ไม่สามารถบันทึกผลการประเมินได้",
        );
      }

      /* -----------------------------------------------
         SAVE RESULT
      ------------------------------------------------ */

      localStorage.setItem(
        "diabetesAssessment",
        JSON.stringify(
          data.assessment,
        ),
      );

      /* -----------------------------------------------
         RESULT PAGE
      ------------------------------------------------ */

      router.push(
        `/recommendation_diabetes?assessmentId=${data.assessment.assessment_id}`,
      );
    } catch (submitError) {
      console.error(
        "DIABETES ASSESSMENT ERROR:",
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

  /* =========================================================
     LOADING
  ========================================================= */

  if (loadingProfile) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f3cdd1] border-t-[#b91c2b]" />

              <p className="mt-5 font-semibold text-[#777982]">
                กำลังโหลดข้อมูลสุขภาพของคุณ...
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  /* =========================================================
     ERROR PROFILE
  ========================================================= */

  if (error && !profile) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex flex-1 items-center justify-center px-5">
            <div className="w-full max-w-lg rounded-[28px] border border-[#eee5e6] bg-white p-8 text-center shadow-sm">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff0f2] text-[#b91c2b]">
                <HeartPulse size={40} />
              </div>

              <h1 className="mt-5 text-xl font-bold">
                ไม่พบข้อมูลสุขภาพ
              </h1>

              <p className="mt-3 text-sm leading-7 text-[#858791]">
                {error}
              </p>

              <Link
                href="/profile"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#b91c2b] px-6 py-3 font-bold text-white"
              >
                ไปกรอกข้อมูลสุขภาพ
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

          {/* =================================================
              HEADER
          ================================================= */}

          <header>
            <Link
              href="/assessment-type"
              className="inline-flex items-center gap-2 rounded-full bg-[#fff0f2] px-4 py-2 text-sm font-semibold text-[#b91c2b]"
            >
              <ChevronLeft size={18} />
              ย้อนกลับ
            </Link>

            <p className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Diabetes Assessment
            </p>

            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-[42px]">
              แบบประเมินความเสี่ยง
              <span className="text-[#ef4962]">
                โรคเบาหวาน
              </span>
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-[#777982]">
              ระบบจะดึงข้อมูลสุขภาพที่มีอยู่แล้วมาใช้
              และให้กรอกเฉพาะข้อมูลที่จำเป็นเพิ่มเติม
            </p>
          </header>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="mt-6 rounded-2xl border border-[#f3cdd1] bg-[#fff0f2] px-5 py-4 text-sm font-semibold text-[#b91c2b]">
              {error}
            </div>
          )}

          {/* =================================================
              FORM
          ================================================= */}

          <form
            onSubmit={handleSubmit}
            className="mt-8"
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">

              {/* =================================================
                  LEFT
              ================================================= */}

              <div className="space-y-6">

                {/* =================================================
                    HEALTH PROFILE
                ================================================= */}

                <section className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-8">

                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
                      <HeartPulse size={27} />
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        ข้อมูลสุขภาพ
                      </h2>

                      <p className="text-sm text-[#8b8d95]">
                        ข้อมูลที่มีอยู่แล้วจะถูกดึงมาให้อัตโนมัติ
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 space-y-4">

                    <InfoRow
                      icon={<CalendarDays size={22} />}
                      label="อายุ"
                      value={
                        profile?.age
                          ? `${profile.age} ปี`
                          : "--"
                      }
                    />

                    <InfoRow
                      icon={<UsersRound size={22} />}
                      label="เพศ"
                      value={
                        profile?.gender === "male"
                          ? "ชาย"
                          : "หญิง"
                      }
                    />

                    <InfoRow
                      icon={<Ruler size={22} />}
                      label="ส่วนสูง"
                      value={`${profile?.height_cm ?? "--"} ซม.`}
                    />

                    <InfoRow
                      icon={<Scale size={22} />}
                      label="น้ำหนัก"
                      value={`${profile?.weight_kg ?? "--"} กก.`}
                    />

                    <InfoRow
                      icon={<Activity size={22} />}
                      label="BMI"
                      value={
                        bmi !== null
                          ? bmi.toFixed(2)
                          : "--"
                      }
                    />

                    <InfoRow
                      icon={<Ruler size={22} />}
                      label="รอบเอว"
                      value={`${profile?.waist_cm ?? "--"} ซม.`}
                    />
                  </div>
                </section>

                {/* =================================================
                    BLOOD PRESSURE
                ================================================= */}

                <section className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-8">

                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf5ff] text-[#6e9ed5]">
                      <Activity size={27} />
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        ความดันโลหิต
                      </h2>

                      <p className="text-sm text-[#8b8d95]">
                        ถ้ามีข้อมูลอยู่แล้ว ระบบจะกรอกให้อัตโนมัติ
                      </p>
                    </div>
                  </div>

                  <div className="mt-7 grid gap-5 sm:grid-cols-2">

                    {/* SBP */}

                    <div>
                      <label className="mb-2 block text-sm font-bold">
                        ความดันตัวบน (SBP)
                      </label>

                      <div className="relative">
                        <input
                          type="number"
                          value={sbp}
                          onChange={(e) =>
                            setSbp(e.target.value)
                          }
                          placeholder="เช่น 120"
                          min="60"
                          max="250"
                          className="h-14 w-full rounded-2xl border border-[#e7e1e2] bg-[#faf8f8] px-4 pr-20 font-semibold outline-none transition focus:border-[#6e9ed5] focus:bg-white"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#8b8d95]">
                          mmHg
                        </span>
                      </div>
                    </div>

                    {/* DBP */}

                    <div>
                      <label className="mb-2 block text-sm font-bold">
                        ความดันตัวล่าง (DBP)
                      </label>

                      <div className="relative">
                        <input
                          type="number"
                          value={dbp}
                          onChange={(e) =>
                            setDbp(e.target.value)
                          }
                          placeholder="เช่น 80"
                          min="30"
                          max="150"
                          className="h-14 w-full rounded-2xl border border-[#e7e1e2] bg-[#faf8f8] px-4 pr-20 font-semibold outline-none transition focus:border-[#6e9ed5] focus:bg-white"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#8b8d95]">
                          mmHg
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-[#f5f9ff] px-4 py-3 text-sm leading-6 text-[#65758b]">
                    หากยังไม่มีข้อมูลความดันโลหิต
                    สามารถกรอกค่าที่วัดล่าสุดได้
                  </div>
                </section>

                {/* =================================================
                    FAMILY HISTORY
                ================================================= */}

                <section className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-8">

                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef8e9] text-[#6fa85e]">
                      <UsersRound size={27} />
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        ประวัติครอบครัว
                      </h2>

                      <p className="text-sm text-[#8b8d95]">
                        ข้อมูลที่ใช้เพิ่มเติมในการคำนวณ
                      </p>
                    </div>
                  </div>

                  <div className="mt-7">
                    <p className="mb-3 font-semibold">
                      มีประวัติโรคเบาหวานในญาติสายตรงหรือไม่?
                    </p>

                    <div className="grid grid-cols-2 gap-3">

                      <YesNoButton
                        active={
                          familyDiabetes === true
                        }
                        onClick={() =>
                          setFamilyDiabetes(true)
                        }
                      >
                        มี
                      </YesNoButton>

                      <YesNoButton
                        active={
                          familyDiabetes === false
                        }
                        onClick={() =>
                          setFamilyDiabetes(false)
                        }
                      >
                        ไม่มี
                      </YesNoButton>

                    </div>
                  </div>
                </section>
              </div>

              {/* =================================================
                  RIGHT
              ================================================= */}

              <aside className="space-y-5">

                <section className="rounded-[30px] border border-[#eee5e6] bg-white p-7 shadow-[0_16px_45px_rgba(35,25,30,0.05)]">

                  <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-[#fff0f2] text-[#ef4962]">
                    <HeartPulse size={48} />
                  </div>

                  <h3 className="mt-5 text-center text-xl font-black text-[#b91c2b]">
                    Thai Diabetes Score
                  </h3>

                  <p className="mt-3 text-center text-sm leading-7 text-[#858791]">
                    ประเมินโอกาสเสี่ยงการเกิดโรคเบาหวาน
                    ใน 12 ปีข้างหน้า
                  </p>

                  <div className="mt-6 rounded-2xl bg-[#fff7f8] p-4 text-sm leading-7 text-[#686970]">
                    ข้อมูลสุขภาพเดิมจะถูกนำมาใช้
                    และคุณกรอกเฉพาะข้อมูลเพิ่มเติมที่จำเป็น
                  </div>
                </section>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    familyDiabetes === null
                  }
                  className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#ef3e59] to-[#b91c2b] text-lg font-bold text-white shadow-[0_15px_32px_rgba(185,28,43,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "กำลังประเมิน..."
                    : "ประเมินความเสี่ยง"}

                  {!submitting && (
                    <ArrowRight size={21} />
                  )}
                </button>
              </aside>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   INFO ROW
========================================================= */

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-16 items-center rounded-2xl bg-[#faf8f8] px-4">
      <span className="mr-4 shrink-0 text-[#ef4962]">
        {icon}
      </span>

      <span className="font-semibold">
        {label}
      </span>

      <span className="ml-auto font-bold text-[#b91c2b]">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   YES / NO BUTTON
========================================================= */

function YesNoButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 rounded-2xl border-2 font-bold transition ${
        active
          ? "border-[#ef4962] bg-[#ef4962] text-white"
          : "border-[#eee5e6] bg-white text-[#777982] hover:bg-[#fff0f2]"
      }`}
    >
      {children}
    </button>
  );
}