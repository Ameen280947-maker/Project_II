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
  Lock,
  Ruler,
  Save,
  Scale,
  UsersRound,
  X,
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

  /*
    หน้านี้ไม่ได้แสดง แต่ต้องส่งค่าเดิมกลับตอนบันทึก
    เพราะ PUT /api/profile เขียนทับทุกช่อง
  */
  smoking: boolean;
  has_diabetes: boolean;
  family_diabetes: boolean | null;
};

/* ค่าที่แก้ไขได้ในโหมดแก้ไข (เก็บเป็น string ตามช่อง input) */
type ProfileDraft = {
  age: string;
  gender: string;
  height_cm: string;
  weight_kg: string;
  waist_cm: string;
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

  const [successMessage, setSuccessMessage] =
    useState("");

  /* =======================================================
     EDIT PROFILE
     ทำงานแบบเดียวกับหน้าแบบประเมินโรคหัวใจและหลอดเลือด
  ======================================================= */

  const [isEditingProfile, setIsEditingProfile] =
    useState(false);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [draft, setDraft] =
    useState<ProfileDraft>({
      age: "",
      gender: "",
      height_cm: "",
      weight_kg: "",
      waist_cm: "",
    });

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

          smoking:
            source.smoking === true,

          has_diabetes:
            source.has_diabetes === true,

          family_diabetes:
            typeof source.family_diabetes ===
            "boolean"
              ? source.family_diabetes
              : null,
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
           ประวัติเบาหวานในครอบครัว
           ใช้ค่าจากข้อมูลสุขภาพเป็นค่าเริ่มต้น
        ------------------------------------------------ */

        if (normalized.family_diabetes !== null) {
          setFamilyDiabetes(
            normalized.family_diabetes,
          );
        }

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
     START / CANCEL EDITING
  ========================================================= */

  const startEditingProfile = () => {
    if (!profile) {
      return;
    }

    setError("");
    setSuccessMessage("");

    setDraft({
      age: String(profile.age ?? ""),
      gender: profile.gender ?? "",
      height_cm: String(profile.height_cm ?? ""),
      weight_kg: String(profile.weight_kg ?? ""),
      waist_cm: String(profile.waist_cm ?? ""),
    });

    setIsEditingProfile(true);
  };

  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
    setError("");
    setSuccessMessage("");
  };

  /* =========================================================
     SAVE PROFILE
     PUT /api/profile (ช่วงค่าเดียวกับหน้า CVD และหน้าข้อมูลสุขภาพ)
  ========================================================= */

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      setError("");
      setSuccessMessage("");

      if (!userId || !profile) {
        throw new Error(
          "ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่",
        );
      }

      const age = Number(draft.age);
      const height = Number(draft.height_cm);
      const weight = Number(draft.weight_kg);
      const waist = Number(draft.waist_cm);

      if (
        !Number.isInteger(age) ||
        age < 18 ||
        age > 100
      ) {
        throw new Error(
          "อายุต้องอยู่ระหว่าง 18-100 ปี",
        );
      }

      if (
        draft.gender !== "male" &&
        draft.gender !== "female"
      ) {
        throw new Error("กรุณาเลือกเพศ");
      }

      if (
        !Number.isFinite(height) ||
        height < 120 ||
        height > 230
      ) {
        throw new Error(
          "ส่วนสูงต้องอยู่ระหว่าง 120-230 ซม.",
        );
      }

      if (
        !Number.isFinite(weight) ||
        weight < 30 ||
        weight > 250
      ) {
        throw new Error(
          "น้ำหนักต้องอยู่ระหว่าง 30-250 กก.",
        );
      }

      if (
        !Number.isFinite(waist) ||
        waist < 40 ||
        waist > 200
      ) {
        throw new Error(
          "รอบเอวต้องอยู่ระหว่าง 40-200 ซม.",
        );
      }

      const response = await fetch(
        "/api/profile",
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id: userId,

            age,

            gender: draft.gender,

            height_cm: height,

            weight_kg: weight,

            waist_cm: waist,

            smoking: profile.smoking,

            has_diabetes:
              profile.has_diabetes,

            family_diabetes:
              familyDiabetes ??
              profile.family_diabetes ??
              false,
          }),
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
            "ไม่สามารถบันทึกข้อมูลสุขภาพได้",
        );
      }

      setProfile({
        ...profile,
        age,
        gender: draft.gender,
        height_cm: height,
        weight_kg: weight,
        waist_cm: waist,
        family_diabetes:
          familyDiabetes ??
          profile.family_diabetes,
      });

      setIsEditingProfile(false);

      setSuccessMessage(
        "บันทึกข้อมูลสุขภาพเรียบร้อยแล้ว",
      );
    } catch (saveError) {
      console.error(
        "SAVE PROFILE ERROR:",
        saveError,
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "ไม่สามารถบันทึกข้อมูลสุขภาพได้",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  /* =========================================================
     BMI
     ระหว่างแก้ไขคำนวณจากค่าที่กำลังกรอก
  ========================================================= */

  const bmiHeight = isEditingProfile
    ? Number(draft.height_cm)
    : profile?.height_cm ?? 0;

  const bmiWeight = isEditingProfile
    ? Number(draft.weight_kg)
    : profile?.weight_kg ?? 0;

  const bmi =
    bmiHeight > 0 && bmiWeight > 0
      ? bmiWeight /
        Math.pow(bmiHeight / 100, 2)
      : null;

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    /* -----------------------------------------------
       ห้ามประเมินระหว่างแก้ไขข้อมูล
       เพราะ API คำนวณจากข้อมูลสุขภาพที่บันทึกแล้ว
    ------------------------------------------------ */

    if (isEditingProfile) {
      setError(
        "กรุณาบันทึกหรือยกเลิกการแก้ไขข้อมูลสุขภาพก่อนประเมิน",
      );
      return;
    }

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

    // API รับเฉพาะจำนวนเต็ม และตัวบนต้องมากกว่าตัวล่าง
    if (!Number.isInteger(systolic) || !Number.isInteger(diastolic)) {
      setError(
        "ค่าความดันต้องเป็นจำนวนเต็ม",
      );
      return;
    }

    if (systolic <= diastolic) {
      setError(
        "ค่า SBP ต้องมากกว่า DBP",
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

          {successMessage && (
            <div className="mt-6 rounded-2xl border border-[#cfe8c6] bg-[#eef8e9] px-5 py-4 text-sm font-semibold text-[#4f8a43]">
              {successMessage}
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

                  <div className="flex flex-wrap items-center justify-between gap-4">
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

                    {!isEditingProfile ? (
                      <button
                        type="button"
                        onClick={startEditingProfile}
                        className="rounded-full bg-[#fff0f2] px-5 py-2.5 text-sm font-bold text-[#b91c2b] transition hover:bg-[#ffe4e8]"
                      >
                        แก้ไขข้อมูล
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEditingProfile}
                          disabled={savingProfile}
                          className="flex items-center gap-2 rounded-full border border-[#ead9db] px-4 py-2.5 text-sm font-bold text-[#777780] transition hover:bg-[#faf8f8] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X size={16} />
                          ยกเลิก
                        </button>

                        <button
                          type="button"
                          onClick={saveProfile}
                          disabled={savingProfile}
                          className="flex items-center gap-2 rounded-full bg-[#b91c2b] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9f1624] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save size={16} />
                          {savingProfile
                            ? "กำลังบันทึก..."
                            : "บันทึก"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div
                    className={`mt-5 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs ${
                      isEditingProfile
                        ? "bg-[#fff7e8] text-[#856404]"
                        : "bg-[#faf8f8] text-[#85858d]"
                    }`}
                  >
                    <Lock
                      size={15}
                      className={
                        isEditingProfile
                          ? "shrink-0 text-[#c98b00]"
                          : "shrink-0 text-[#b91c2b]"
                      }
                    />

                    {isEditingProfile
                      ? "คุณกำลังแก้ไขข้อมูลสุขภาพ สามารถปรับข้อมูลที่ต้องการได้"
                      : "ข้อมูลส่วนนี้ดึงมาจากข้อมูลสุขภาพของคุณ กด “แก้ไขข้อมูล” หากต้องการปรับข้อมูล"}
                  </div>

                  <div className="mt-7 space-y-4">

                    {isEditingProfile ? (
                      <>
                        <EditRow
                          icon={<CalendarDays size={22} />}
                          label="อายุ"
                          unit="ปี"
                          value={draft.age}
                          min={18}
                          max={100}
                          onChange={(value) =>
                            setDraft((prev) => ({ ...prev, age: value }))
                          }
                        />

                        <div className="flex min-h-16 items-center rounded-2xl bg-[#faf8f8] px-4">
                          <span className="mr-4 shrink-0 text-[#ef4962]">
                            <UsersRound size={22} />
                          </span>

                          <span className="font-semibold">
                            เพศ
                          </span>

                          <div className="ml-auto grid grid-cols-2 overflow-hidden rounded-xl border border-[#e5e0e1]">
                            {[
                              { value: "female", label: "หญิง" },
                              { value: "male", label: "ชาย" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    gender: option.value,
                                  }))
                                }
                                className={`h-10 px-5 text-sm font-semibold transition ${
                                  draft.gender === option.value
                                    ? "bg-[#f8e8ea] text-[#b91c2b]"
                                    : "bg-white text-[#aaaab0] hover:bg-[#fceff1]"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <EditRow
                          icon={<Ruler size={22} />}
                          label="ส่วนสูง"
                          unit="ซม."
                          value={draft.height_cm}
                          min={120}
                          max={230}
                          onChange={(value) =>
                            setDraft((prev) => ({ ...prev, height_cm: value }))
                          }
                        />

                        <EditRow
                          icon={<Scale size={22} />}
                          label="น้ำหนัก"
                          unit="กก."
                          value={draft.weight_kg}
                          min={30}
                          max={250}
                          onChange={(value) =>
                            setDraft((prev) => ({ ...prev, weight_kg: value }))
                          }
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

                        <EditRow
                          icon={<Ruler size={22} />}
                          label="รอบเอว"
                          unit="ซม."
                          value={draft.waist_cm}
                          min={40}
                          max={200}
                          onChange={(value) =>
                            setDraft((prev) => ({ ...prev, waist_cm: value }))
                          }
                        />
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
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
                    isEditingProfile ||
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
   EDIT ROW
   แถวข้อมูลแบบกรอกได้ ใช้ในโหมดแก้ไขข้อมูลสุขภาพ
========================================================= */

function EditRow({
  icon,
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  unit: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-h-16 items-center rounded-2xl bg-[#faf8f8] px-4">
      <span className="mr-4 shrink-0 text-[#ef4962]">
        {icon}
      </span>

      <span className="font-semibold">
        {label}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-11 w-24 rounded-xl border border-[#e7e1e2] bg-white px-3 text-right font-bold text-[#b91c2b] outline-none transition focus:border-[#ef4962]"
        />

        <span className="w-8 text-sm font-semibold text-[#8b8d95]">
          {unit}
        </span>
      </div>
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