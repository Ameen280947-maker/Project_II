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
  HeartPulse,
  Ruler,
  Save,
  Scale,
  UsersRound,
  X,
} from "lucide-react";

import Sidebar from "@/app/components/Sidebar";
import AssessmentBackLink from "@/app/components/AssessmentBackLink";
import HealthConsentNotice from "@/app/components/HealthConsentNotice";
import { AssessmentSourceNote } from "@/app/components/AssessmentSources";

// ข้อมูลสุขภาพของผู้ใช้ที่ใช้ประเมิน (แปลงจาก response ของ /api/profile)
type HealthProfile = {
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  waist_cm: number | null;
  sbp: number | null;
  dbp: number | null;

  smoking: boolean;
  has_diabetes: boolean;
  family_diabetes: boolean | null;
};

// ค่าในฟอร์มแก้ไขโปรไฟล์ (เก็บเป็น string ระหว่างพิมพ์)
type ProfileDraft = {
  age: string;
  gender: string;
  height_cm: string;
  weight_kg: string;
  waist_cm: string;
};

// รูปแบบ response จาก POST /api/assessments/diabetes
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

// หน้า: ประเมินความเสี่ยงโรคเบาหวานจากโปรไฟล์ (อายุ เพศ BMI รอบเอว) และประวัติสุขภาพ
export default function AssessmentDiabetesPage() {
  const router = useRouter();

  // state ของหน้า: ผู้ใช้ โปรไฟล์ ค่าความดัน ประวัติครอบครัว สถานะต่าง ๆ และ draft ฟอร์มแก้ไข
  const [userId, setUserId] =
    useState<number | null>(null);

  const [profile, setProfile] =
    useState<HealthProfile | null>(null);

  const [sbp, setSbp] =
    useState("");

  const [dbp, setDbp] =
    useState("");

  const [familyDiabetes, setFamilyDiabetes] =
    useState<boolean | null>(null);

  const [loadingProfile, setLoadingProfile] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

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

  // โหลดโปรไฟล์สุขภาพตอนเปิดหน้า
  useEffect(() => {
    // ตรวจ userId ใน localStorage แล้วโหลดโปรไฟล์จาก GET /api/profile
    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        setError("");

        // ตรวจ userId ใน localStorage
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

        // ดึงโปรไฟล์จาก API
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

        // แปลงข้อมูลให้อยู่ในรูป HealthProfile (รองรับชื่อฟิลด์หลายแบบ)
        const source =
          data.profile ??
          data.healthProfile ??
          data.data ??
          data;

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

        // ข้อมูลหลักต้องครบ แล้วเติมค่าความดัน/ประวัติครอบครัวที่มีอยู่ลงฟอร์ม
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

        if (normalized.family_diabetes !== null) {
          setFamilyDiabetes(
            normalized.family_diabetes,
          );
        }

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

  // คัดลอกค่าโปรไฟล์ปัจจุบันลง draft แล้วเปิดโหมดแก้ไข
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

  // ปิดโหมดแก้ไขโปรไฟล์โดยไม่บันทึก
  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
    setError("");
    setSuccessMessage("");
  };

  // ตรวจค่าใน draft แล้วบันทึกโปรไฟล์ผ่าน PUT /api/profile
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

      // ตรวจช่วงค่าของอายุ เพศ ส่วนสูง น้ำหนัก และรอบเอว
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

      // บันทึกโปรไฟล์ที่ API
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

      // อัปเดตโปรไฟล์ในหน้าและปิดโหมดแก้ไข
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

  // คำนวณ BMI จากค่าที่กำลังแก้ไขหรือค่าในโปรไฟล์
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

  // ส่งข้อมูลประเมิน POST /api/assessments/diabetes เก็บผลใน localStorage แล้วไปหน้าผลลัพธ์
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    // ตรวจสถานะฟอร์ม ผู้ใช้ และโปรไฟล์
    if (isEditingProfile) {
      setError(
        "กรุณาบันทึกหรือยกเลิกการแก้ไขข้อมูลสุขภาพก่อนประเมิน",
      );
      return;
    }

    if (!userId) {
      setError(
        "ไม่พบข้อมูลผู้ใช้งาน",
      );
      return;
    }

    if (!profile) {
      setError(
        "ไม่พบข้อมูลสุขภาพ",
      );
      return;
    }

    // ตรวจค่าความดัน SBP/DBP และการเลือกประวัติครอบครัว
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

    if (
      familyDiabetes === null
    ) {
      setError(
        "กรุณาระบุว่ามีประวัติโรคเบาหวานในครอบครัวหรือไม่",
      );
      return;
    }

    try {
      setSubmitting(true);

      // ส่งข้อมูลไปประเมินและบันทึกที่ API
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

      // เก็บผลไว้ใน localStorage แล้วไปหน้าคำแนะนำ
      localStorage.setItem(
        "diabetesAssessment",
        JSON.stringify(
          data.assessment,
        ),
      );

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

  // หน้าระหว่างโหลดโปรไฟล์
  if (loadingProfile) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#cde0c0] border-t-[#3f7a2e]" />

              <p className="mt-5 font-semibold text-[#777982]">
                กำลังโหลดข้อมูลสุขภาพของคุณ...
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // โหลดโปรไฟล์ไม่สำเร็จ/ข้อมูลไม่ครบ → หน้า error
  if (error && !profile) {
    return (
      <main className="min-h-screen bg-[#fbf9f9]">
        <div className="flex min-h-screen">
          <Sidebar />

          <section className="flex flex-1 items-center justify-center px-5">
            <div className="w-full max-w-lg rounded-[28px] border border-[#eee5e6] bg-white p-8 text-center shadow-sm">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#ebf3e2] text-[#3f7a2e]">
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

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">

          {/* ส่วนหัวหน้า: ชื่อแบบประเมิน ความยินยอม และปุ่มย้อนกลับ */}
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#3f7a2e]">
              Diabetes Assessment
            </p>

            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl lg:text-[42px]">
              แบบประเมินความเสี่ยง
              <span className="text-[#5a9445]">
                โรคเบาหวาน
              </span>
            </h1>

            </div>

            <HealthConsentNotice />
            <AssessmentBackLink href="/assessment-menu" />
          </header>
          <AssessmentSourceNote typeId={4} className="mt-3" />

          {/* ข้อความ error / บันทึกสำเร็จ */}
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

          {/* ฟอร์มประเมิน: ข้อมูลสุขภาพ ความดัน และประวัติครอบครัว */}
          <form
            onSubmit={handleSubmit}
            className="mt-8"
          >
            <div>

              <div className="space-y-6">

                {/* การ์ดข้อมูลสุขภาพ: แสดงหรือแก้ไขอายุ เพศ ส่วนสูง น้ำหนัก BMI รอบเอว */}
                <section className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-8">

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ebf3e2] text-[#3f7a2e]">
                        <HeartPulse size={27} />
                      </div>

                      <div>
                        <h2 className="text-xl font-bold">
                          ข้อมูลสุขภาพ
                        </h2>
                      </div>
                    </div>

                    {!isEditingProfile ? (
                      <button
                        type="button"
                        onClick={startEditingProfile}
                        className="rounded-full bg-[#ebf3e2] px-5 py-2.5 text-sm font-bold text-[#3f7a2e] transition hover:bg-[#ebf3e2]"
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
                          className="flex items-center gap-2 rounded-full bg-[#3f7a2e] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#2f5f22] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save size={16} />
                          {savingProfile
                            ? "กำลังบันทึก..."
                            : "บันทึก"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-7 space-y-4">

                    {/* โหมดแก้ไข = ช่องกรอก, โหมดปกติ = แถวแสดงค่า */}
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
                          <span className="mr-4 shrink-0 text-[#5a9445]">
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
                                    ? "bg-[#ebf3e2] text-[#3f7a2e]"
                                    : "bg-white text-[#aaaab0] hover:bg-[#f5f9f0]"
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

                {/* การ์ดกรอกค่าความดันโลหิต SBP/DBP */}
                <section className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-8">

                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf5ff] text-[#6e9ed5]">
                      <Activity size={27} />
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        ความดันโลหิต
                      </h2>
                    </div>
                  </div>

                  <div className="mt-7 grid gap-5 sm:grid-cols-2">

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

                {/* การ์ดประวัติเบาหวานในครอบครัว (มี/ไม่มี) */}
                <section className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-8">

                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef8e9] text-[#6fa85e]">
                      <UsersRound size={27} />
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        ประวัติครอบครัว
                      </h2>
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

              {/* ปุ่มส่งประเมินความเสี่ยง */}
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    isEditingProfile ||
                    familyDiabetes === null
                  }
                  className="flex h-16 w-full items-center sm:w-[320px] justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#5a9445] to-[#3f7a2e] text-lg font-bold text-white shadow-[0_15px_32px_rgba(63,122,46,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "กำลังประเมิน..."
                    : "ประเมินความเสี่ยง"}

                  {!submitting && (
                    <ArrowRight size={21} />
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

// คอมโพเนนต์: แถวแสดงข้อมูลโปรไฟล์ (ไอคอน ป้ายชื่อ และค่า) แบบอ่านอย่างเดียว
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
      <span className="mr-4 shrink-0 text-[#5a9445]">
        {icon}
      </span>

      <span className="font-semibold">
        {label}
      </span>

      <span className="ml-auto font-bold text-[#3f7a2e]">
        {value}
      </span>
    </div>
  );
}

// คอมโพเนนต์: แถวช่องกรอกตัวเลขพร้อมหน่วยสำหรับแก้ไขข้อมูลโปรไฟล์
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
      <span className="mr-4 shrink-0 text-[#5a9445]">
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
          className="h-11 w-24 rounded-xl border border-[#e7e1e2] bg-white px-3 text-right font-bold text-[#3f7a2e] outline-none transition focus:border-[#5a9445]"
        />

        <span className="w-8 text-sm font-semibold text-[#8b8d95]">
          {unit}
        </span>
      </div>
    </div>
  );
}

// คอมโพเนนต์: ปุ่มตัวเลือก ใช่/ไม่ใช่ ที่เปลี่ยนสีเมื่อถูกเลือก
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
          ? "border-[#5a9445] bg-[#5a9445] text-white"
          : "border-[#eee5e6] bg-white text-[#777982] hover:bg-[#ebf3e2]"
      }`}
    >
      {children}
    </button>
  );
}