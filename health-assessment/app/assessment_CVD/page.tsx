"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Activity,
  ArrowRight,
  Heart,
  Lock,
  Stethoscope,
  UserRound,
} from "lucide-react";

import type { ReactNode } from "react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Sidebar from "@/app/components/Sidebar";

/* =========================================================
   TYPES
========================================================= */

type Choice = {
  choiceId: number;
  choiceText: string;
  score: number;
  displayOrder: number;
};

type Question = {
  questionId: number;
  questionText: string;

  questionType:
    | "number"
    | "choice"
    | "text";

  displayOrder: number;
  isRequired: boolean;

  choices: Choice[];
};

type Profile = {
  age: number | null;

  gender:
    | string
    | null;

  height_cm:
    | string
    | number
    | null;

  weight_kg:
    | string
    | number
    | null;

  waist_cm:
    | string
    | number
    | null;

  smoking:
    | boolean
    | null;

  has_diabetes:
    | boolean
    | null;

  family_diabetes?:
    | boolean
    | null;
};

type LoadResponse = {
  success: boolean;
  assessmentName?: string;

  questions?: Question[];

  profile?:
    | Profile
    | null;

  message?: string;
};

type SubmitResponse = {
  success: boolean;

  assessmentId?: number;

  riskPercent?: number;

  riskLevel?: string;

  recommendation?: string;

  message?: string;
};

/* =========================================================
   PAGE
========================================================= */

export default function AssessmentPage() {
  const router =
    useRouter();

  /* =========================================================
     QUESTIONS
  ========================================================= */

  const [
    questions,
    setQuestions,
  ] =
    useState<Question[]>(
      [],
    );

  /* =========================================================
     PROFILE DATA

     ข้อมูลชุดนี้ดึงมาจาก health_profile
     และจะไม่อนุญาตให้แก้ในหน้านี้
  ========================================================= */

  const [
    age,
    setAge,
  ] = useState(18);

  const [
    gender,
    setGender,
  ] =
    useState<
      "female" | "male"
    >("female");

  const [
    smoking,
    setSmoking,
  ] = useState(false);

  const [
    diabetes,
    setDiabetes,
  ] = useState(false);

  const [
    waist,
    setWaist,
  ] = useState(60);

  const [
    height,
    setHeight,
  ] = useState(160);

  const [
    weight,
    setWeight,
  ] = useState(0);

  /* =========================================================
     ASSESSMENT DATA

     Systolic เป็นข้อมูลที่ผู้ใช้กรอกในแบบประเมิน
     จึงยังแก้ได้
  ========================================================= */

  const [
    systolic,
    setSystolic,
  ] = useState(120);

  /* =========================================================
     STATE
  ========================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    userId,
    setUserId,
  ] =
    useState<
      number | null
    >(null);

  /* =========================================================
     QUESTION BY ORDER
  ========================================================= */

  const questionByOrder =
    useMemo(() => {
      return new Map(
        questions.map(
          (question) => [
            question.displayOrder,
            question,
          ],
        ),
      );
    }, [questions]);

  /* =========================================================
     LOAD USER + PROFILE + QUESTIONS
  ========================================================= */

  useEffect(() => {
    const loadAssessment =
      async () => {
        try {
          setLoading(true);
          setError("");

          /* =========================
             USER ID
          ========================= */

          const storedUserId =
            localStorage.getItem(
              "userId",
            );

          if (
            !storedUserId
          ) {
            router.replace(
              "/login",
            );

            return;
          }

          const currentUserId =
            Number(
              storedUserId,
            );

          if (
            !Number.isInteger(
              currentUserId,
            ) ||
            currentUserId <= 0
          ) {
            localStorage.removeItem(
              "userId",
            );

            router.replace(
              "/login",
            );

            return;
          }

          setUserId(
            currentUserId,
          );

          /* =========================
             LOAD API
          ========================= */

          const response =
            await fetch(
              `/api/assessments/thai-cvd?userId=${currentUserId}`,
              {
                method:
                  "GET",

                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as LoadResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ??
                "ไม่สามารถโหลดแบบประเมินได้",
            );
          }

          /* =========================
             QUESTIONS
          ========================= */

          setQuestions(
            data.questions ??
              [],
          );

          /* =========================
             PROFILE
          ========================= */

          const profile =
            data.profile;

          if (!profile) {
            /*
              ไม่มีข้อมูลทั่วไป
              ต้องกลับไปกรอก Profile ก่อน
            */

            router.replace(
              "/profile",
            );

            return;
          }

          /* =========================
             AGE
          ========================= */

          if (
            profile.age !==
            null
          ) {
            setAge(
              Number(
                profile.age,
              ),
            );
          }

          /* =========================
             GENDER
          ========================= */

          if (
            profile.gender
          ) {
            const normalizedGender =
              String(
                profile.gender,
              )
                .trim()
                .toLowerCase();

            if (
              normalizedGender ===
                "male" ||
              normalizedGender ===
                "ชาย"
            ) {
              setGender(
                "male",
              );
            } else {
              setGender(
                "female",
              );
            }
          }

          /* =========================
             HEIGHT
          ========================= */

          if (
            profile.height_cm !==
            null
          ) {
            setHeight(
              Number(
                profile.height_cm,
              ),
            );
          }

          /* =========================
             WEIGHT
          ========================= */

          if (
            profile.weight_kg !==
            null
          ) {
            setWeight(
              Number(
                profile.weight_kg,
              ),
            );
          }

          /* =========================
             WAIST
          ========================= */

          if (
            profile.waist_cm !==
            null
          ) {
            setWaist(
              Number(
                profile.waist_cm,
              ),
            );
          }

          /* =========================
             SMOKING
          ========================= */

          setSmoking(
            profile.smoking ===
              true,
          );

          /* =========================
             DIABETES
          ========================= */

          setDiabetes(
            profile.has_diabetes ===
              true,
          );
        } catch (
          loadError
        ) {
          console.error(
            "LOAD THAI CVD ERROR:",
            loadError,
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "ไม่สามารถโหลดแบบประเมินได้",
          );
        } finally {
          setLoading(false);
        }
      };

    void loadAssessment();
  }, [router]);

  /* =========================================================
     GET CHOICE ID BY SCORE
  ========================================================= */

  const getChoiceIdByScore = (
    question:
      | Question
      | undefined,

    score: number,
  ) => {
    return (
      question?.choices.find(
        (choice) =>
          Number(
            choice.score,
          ) === score,
      )?.choiceId ?? null
    );
  };

  /* =========================================================
     SUBMIT CVD
  ========================================================= */

  const startAssessment =
    async () => {
      try {
        setSubmitting(
          true,
        );

        setError("");

        /* =========================
           USER
        ========================= */

        if (!userId) {
          throw new Error(
            "ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่",
          );
        }

        /* =========================
           QUESTIONS
        ========================= */

        const ageQuestion =
          questionByOrder.get(
            1,
          );

        const genderQuestion =
          questionByOrder.get(
            2,
          );

        const smokingQuestion =
          questionByOrder.get(
            3,
          );

        const diabetesQuestion =
          questionByOrder.get(
            4,
          );

        const systolicQuestion =
          questionByOrder.get(
            5,
          );

        const waistQuestion =
          questionByOrder.get(
            6,
          );

        const heightQuestion =
          questionByOrder.get(
            7,
          );

        if (
          !ageQuestion ||
          !genderQuestion ||
          !smokingQuestion ||
          !diabetesQuestion ||
          !systolicQuestion ||
          !waistQuestion ||
          !heightQuestion
        ) {
          throw new Error(
            "คำถาม Thai CVD ในฐานข้อมูลไม่ครบ 7 ข้อ",
          );
        }

        /* =========================
           CHOICE IDS
        ========================= */

        const genderChoiceId =
          getChoiceIdByScore(
            genderQuestion,

            gender ===
              "male"
              ? 1
              : 0,
          );

        const smokingChoiceId =
          getChoiceIdByScore(
            smokingQuestion,

            smoking
              ? 1
              : 0,
          );

        const diabetesChoiceId =
          getChoiceIdByScore(
            diabetesQuestion,

            diabetes
              ? 1
              : 0,
          );

        if (
          genderChoiceId ===
            null ||
          smokingChoiceId ===
            null ||
          diabetesChoiceId ===
            null
        ) {
          throw new Error(
            "ไม่พบตัวเลือกเพศ บุหรี่ หรือเบาหวานในฐานข้อมูล",
          );
        }

        /* =========================
           VALIDATION
        ========================= */

        if (
          !Number.isFinite(
            age,
          ) ||
          !Number.isFinite(
            systolic,
          ) ||
          !Number.isFinite(
            waist,
          ) ||
          !Number.isFinite(
            height,
          )
        ) {
          throw new Error(
            "ข้อมูลสำหรับประเมินไม่ถูกต้อง",
          );
        }

        if (
          systolic < 80 ||
          systolic > 220
        ) {
          throw new Error(
            "ค่าความดันตัวบนต้องอยู่ระหว่าง 80-220 mmHg",
          );
        }

        if (
          height <= 0
        ) {
          throw new Error(
            "ส่วนสูงต้องมากกว่า 0",
          );
        }

        /* =========================
           POST
        ========================= */

        const response =
          await fetch(
            "/api/assessments/thai-cvd",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  userId,

                  answers: [
                    {
                      questionId:
                        ageQuestion.questionId,

                      answerValue:
                        age,
                    },

                    {
                      questionId:
                        genderQuestion.questionId,

                      choiceId:
                        genderChoiceId,
                    },

                    {
                      questionId:
                        smokingQuestion.questionId,

                      choiceId:
                        smokingChoiceId,
                    },

                    {
                      questionId:
                        diabetesQuestion.questionId,

                      choiceId:
                        diabetesChoiceId,
                    },

                    {
                      questionId:
                        systolicQuestion.questionId,

                      answerValue:
                        systolic,
                    },

                    {
                      questionId:
                        waistQuestion.questionId,

                      answerValue:
                        waist,
                    },

                    {
                      questionId:
                        heightQuestion.questionId,

                      answerValue:
                        height,
                    },
                  ],
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

        if (
          !data.assessmentId
        ) {
          throw new Error(
            "ไม่พบ assessmentId หลังบันทึกผล",
          );
        }

        /* =========================
           RESULT PAGE
        ========================= */

        router.push(
          `/recommendation-health?assessmentId=${data.assessmentId}`,
        );
      } catch (
        submitError
      ) {
        console.error(
          "SUBMIT CVD ERROR:",
          submitError,
        );

        setError(
          submitError instanceof
            Error
            ? submitError.message
            : "ไม่สามารถบันทึกผลประเมินได้",
        );
      } finally {
        setSubmitting(
          false,
        );
      }
    };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">

      <div className="flex min-h-screen">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <Sidebar />

        {/* =================================================
            CONTENT
        ================================================= */}

        <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">

          {/* =================================================
              HEADER
          ================================================= */}

          <header>

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Health Assessment
            </p>

            <h1 className="mt-3 max-w-[900px] text-3xl font-bold leading-tight sm:text-4xl">

              ประเมินความเสี่ยง

              <span className="ml-2 text-[#b91c2b]">
                โรคหัวใจและหลอดเลือด
              </span>

              <span className="block">
                ในระยะ 10 ปีข้างหน้า
              </span>

            </h1>

            <p className="mt-3 text-base text-[#767780]">
              ข้อมูลส่วนบุคคลอ้างอิงจากข้อมูลสุขภาพที่คุณบันทึกไว้
            </p>

          </header>

          {/* =================================================
              LOADING
          ================================================= */}

          {loading && (
            <div className="mt-6 rounded-2xl bg-white p-4 text-sm text-[#767780] shadow-sm">
              กำลังโหลดข้อมูลสุขภาพจากฐานข้อมูล...
            </div>
          )}

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="mt-6 rounded-2xl bg-[#fff0f2] p-4 text-sm font-medium text-[#b91c2b]">
              {error}
            </div>
          )}

          <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">

            {/* =================================================
                LEFT
            ================================================= */}

            <div className="space-y-6">

              {/* =================================================
                  PERSONAL INFORMATION
              ================================================= */}

              <section className="rounded-[26px] border border-[#eee5e6] bg-white p-6 shadow-[0_15px_40px_rgba(35,25,30,0.045)]">

                {/* =========================
                    TITLE
                ========================= */}

                <div className="flex items-center justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <UserRound
                      className="text-[#b91c2b]"
                      size={25}
                    />

                    <h2 className="text-xl font-bold">
                      ข้อมูลส่วนบุคคล
                    </h2>

                  </div>

                  {/* =========================
                      EDIT PROFILE BUTTON

                      ปุ่มยังอยู่เหมือนเดิม
                      แต่พาไปหน้า Profile
                  ========================= */}

                  <Link
                    href="/profile"
                    className="rounded-full bg-[#fff0f2] px-5 py-2.5 text-sm font-bold text-[#b91c2b] transition hover:bg-[#ffe4e8]"
                  >
                    แก้ไขข้อมูล
                  </Link>

                </div>

                {/* =========================
                    LOCK NOTICE
                ========================= */}

                <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[#faf8f8] px-4 py-3 text-xs text-[#85858d]">

                  <Lock
                    size={15}
                    className="shrink-0 text-[#b91c2b]"
                  />

                  ข้อมูลส่วนนี้ดึงมาจากข้อมูลสุขภาพของคุณ หากต้องการแก้ไขให้กดปุ่ม “แก้ไขข้อมูล”

                </div>

                {/* =================================================
                    AGE + GENDER
                ================================================= */}

                <div className="mt-8 grid gap-8 md:grid-cols-2">

                  {/* =========================
                      AGE - READ ONLY
                  ========================= */}

                  <RangeField
                    label={
                      questionByOrder.get(
                        1,
                      )
                        ?.questionText ??
                      "อายุ (ปี)"
                    }
                    value={
                      age
                    }
                    unit="ปี"
                    min={18}
                    max={80}
                    readOnly
                  />

                  {/* =========================
                      GENDER - READ ONLY
                  ========================= */}

                  <div>

                    <p className="font-semibold">
                      {questionByOrder.get(
                        2,
                      )
                        ?.questionText ??
                        "เพศ"}
                    </p>

                    <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-2xl border border-[#e5e0e1]">

                      <button
                        type="button"
                        disabled
                        className={`h-14 cursor-not-allowed font-semibold ${
                          gender ===
                          "female"
                            ? "bg-[#f8e8ea] text-[#b91c2b]"
                            : "bg-[#fafafa] text-[#aaaab0]"
                        }`}
                      >
                        หญิง
                      </button>

                      <button
                        type="button"
                        disabled
                        className={`h-14 cursor-not-allowed font-semibold ${
                          gender ===
                          "male"
                            ? "bg-[#f8e8ea] text-[#b91c2b]"
                            : "bg-[#fafafa] text-[#aaaab0]"
                        }`}
                      >
                        ชาย
                      </button>

                    </div>

                  </div>

                </div>

                {/* =================================================
                    WEIGHT
                ================================================= */}

                <div className="mt-6 rounded-2xl bg-[#faf8f8] p-4">

                  <div className="flex items-center justify-between">

                    <span className="text-sm font-semibold text-[#777780]">
                      น้ำหนักจากข้อมูลทั่วไป
                    </span>

                    <strong className="text-lg">
                      {weight > 0
                        ? `${weight} kg`
                        : "-"}
                    </strong>

                  </div>

                </div>

                {/* =================================================
                    SMOKING + DIABETES
                ================================================= */}

                <div className="mt-8 grid gap-5 md:grid-cols-2">

                  {/* =========================
                      SMOKING - READ ONLY
                  ========================= */}

                  <ToggleCard
                    icon={
                      <Activity
                        size={25}
                      />
                    }
                    title={
                      questionByOrder.get(
                        3,
                      )
                        ?.questionText ??
                      "สูบบุหรี่หรือไม่"
                    }
                    description="ข้อมูลจากโปรไฟล์สุขภาพ"
                    checked={
                      smoking
                    }
                    readOnly
                  />

                  {/* =========================
                      DIABETES - READ ONLY
                  ========================= */}

                  <ToggleCard
                    icon={
                      <Stethoscope
                        size={25}
                      />
                    }
                    title={
                      questionByOrder.get(
                        4,
                      )
                        ?.questionText ??
                      "ป่วยเป็นเบาหวานหรือไม่"
                    }
                    description="ข้อมูลจากโปรไฟล์สุขภาพ"
                    checked={
                      diabetes
                    }
                    readOnly
                  />

                </div>

              </section>

              {/* =================================================
                  HEALTH INFORMATION
              ================================================= */}

              <section className="rounded-[26px] border border-[#eee5e6] bg-white p-6 shadow-[0_15px_40px_rgba(35,25,30,0.045)]">

                <h2 className="text-xl font-bold">
                  ข้อมูลสุขภาพ
                </h2>

                <div className="mt-8 grid gap-x-10 gap-y-10 md:grid-cols-2">

                  {/* =================================================
                      SBP

                      แก้ได้ เพราะเป็นข้อมูลของการประเมินครั้งนี้
                  ================================================= */}

                  <RangeField
                    label={
                      questionByOrder.get(
                        5,
                      )
                        ?.questionText ??
                      "ค่าความดันตัวบน (SBP)"
                    }
                    value={
                      systolic
                    }
                    unit="mmHg"
                    min={80}
                    max={220}
                    onChange={
                      setSystolic
                    }
                  />

                  {/* =================================================
                      WAIST

                      ดึง Profile → ห้ามแก้
                  ================================================= */}

                  <RangeField
                    label={
                      questionByOrder.get(
                        6,
                      )
                        ?.questionText ??
                      "เส้นรอบเอว"
                    }
                    value={
                      waist
                    }
                    unit="cm"
                    min={40}
                    max={200}
                    readOnly
                  />

                  {/* =================================================
                      HEIGHT

                      ดึง Profile → ห้ามแก้
                  ================================================= */}

                  <RangeField
                    label={
                      questionByOrder.get(
                        7,
                      )
                        ?.questionText ??
                      "ส่วนสูง"
                    }
                    value={
                      height
                    }
                    unit="cm"
                    min={120}
                    max={230}
                    readOnly
                  />

                </div>

              </section>

            </div>

            {/* =================================================
                RIGHT PANEL
            ================================================= */}

            <aside className="flex flex-col justify-end gap-5">

              <div className="rounded-[25px] border border-[#f0dfe1] bg-gradient-to-br from-white to-[#fff1f2] p-6">

                <Heart
                  className="text-[#b91c2b]"
                  size={29}
                />

                <h3 className="mt-4 font-bold">
                  เตรียมข้อมูลให้ครบถ้วน
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#85858d]">
                  ข้อมูลทั่วไปถูกดึงมาจากโปรไฟล์สุขภาพ
                  และเมื่อกดเริ่มประเมินระบบจะคำนวณและบันทึกผลภายใต้บัญชีผู้ใช้งานของคุณ
                </p>

                <div className="mt-5 rounded-2xl bg-white/80 p-4 text-sm">

                  <SummaryRow
                    label="อายุ"
                    value={`${age} ปี`}
                  />

                  <SummaryRow
                    label="เพศ"
                    value={
                      gender ===
                      "female"
                        ? "หญิง"
                        : "ชาย"
                    }
                  />

                  <SummaryRow
                    label="น้ำหนัก"
                    value={
                      weight > 0
                        ? `${weight} kg`
                        : "-"
                    }
                  />

                  <SummaryRow
                    label="ความดัน"
                    value={`${systolic} mmHg`}
                  />

                  <SummaryRow
                    label="รอบเอว"
                    value={`${waist} cm`}
                  />

                  <SummaryRow
                    label="ส่วนสูง"
                    value={`${height} cm`}
                  />

                  <SummaryRow
                    label="สูบบุหรี่"
                    value={
                      smoking
                        ? "ใช่"
                        : "ไม่"
                    }
                  />

                  <SummaryRow
                    label="เบาหวาน"
                    value={
                      diabetes
                        ? "ใช่"
                        : "ไม่"
                    }
                  />

                </div>

              </div>

              {/* =================================================
                  START
              ================================================= */}

              <button
                type="button"
                onClick={
                  startAssessment
                }
                disabled={
                  loading ||
                  submitting
                }
                className="flex h-[68px] w-full items-center justify-center gap-3 rounded-[22px] bg-gradient-to-r from-[#b91c2b] to-[#8a1420] text-lg font-bold text-white shadow-[0_16px_35px_rgba(138,20,32,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >

                {submitting
                  ? "กำลังประมวลผล..."
                  : "เริ่มประเมิน"}

                {!submitting && (
                  <ArrowRight
                    size={23}
                  />
                )}

              </button>

            </aside>

          </div>

        </section>

      </div>

    </main>
  );
}

/* =========================================================
   SUMMARY ROW
========================================================= */

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="mt-2 flex items-center justify-between first:mt-0">

      <span className="text-[#777780]">
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}

/* =========================================================
   RANGE FIELD

   readOnly = true
   → แสดงค่าอย่างเดียว
   → Slider ขยับไม่ได้
========================================================= */

type RangeFieldProps = {
  label: string;

  value: number;

  unit: string;

  min: number;

  max: number;

  onChange?: (
    value: number,
  ) => void;

  readOnly?: boolean;
};

function RangeField({
  label,
  value,
  unit,
  min,
  max,
  onChange,
  readOnly = false,
}: RangeFieldProps) {
  const percentage =
    ((value - min) /
      (max - min)) *
    100;

  const safePercentage =
    Math.min(
      Math.max(
        percentage,
        0,
      ),
      100,
    );

  return (
    <div>

      <div className="flex items-end justify-between gap-4">

        <div>

          <p className="text-sm font-semibold">
            {label}
          </p>

          {readOnly && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[#9a9aa1]">

              <Lock
                size={11}
              />

              จากข้อมูลสุขภาพ

            </div>
          )}

        </div>

        <div className="flex items-baseline gap-2">

          <span className="text-3xl font-bold text-[#b91c2b]">
            {value}
          </span>

          <span className="text-xs text-[#777780]">
            {unit}
          </span>

        </div>

      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={
          value
        }
        disabled={
          readOnly
        }
        onChange={(
          event,
        ) => {
          if (
            readOnly ||
            !onChange
          ) {
            return;
          }

          onChange(
            Number(
              event.target.value,
            ),
          );
        }}
        className={`mt-5 h-2 w-full appearance-none rounded-full ${
          readOnly
            ? "cursor-not-allowed opacity-80"
            : "cursor-pointer"
        }`}
        style={{
          background: `linear-gradient(
            to right,
            #b91c2b 0%,
            #b91c2b ${safePercentage}%,
            #e7e3e4 ${safePercentage}%,
            #e7e3e4 100%
          )`,
        }}
      />

      <div className="mt-3 flex justify-between text-xs text-[#898991]">

        <span>
          {min}
        </span>

        <span>
          {max}
        </span>

      </div>

    </div>
  );
}

/* =========================================================
   TOGGLE CARD

   readOnly = true
   → ดูสถานะได้
   → กดเปลี่ยนไม่ได้
========================================================= */

type ToggleCardProps = {
  icon: ReactNode;

  title: string;

  description: string;

  checked: boolean;

  onChange?: () => void;

  readOnly?: boolean;
};

function ToggleCard({
  icon,
  title,
  description,
  checked,
  onChange,
  readOnly = false,
}: ToggleCardProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-[22px] border p-5 transition ${
        checked
          ? "border-[#e6bfc4] bg-[#fff0f2]"
          : "border-[#eee8e9] bg-[#faf8f8]"
      }`}
    >

      <div className="flex min-w-0 items-center gap-4">

        <span className="shrink-0 text-[#b91c2b]">
          {icon}
        </span>

        <div>

          <p className="text-sm font-bold">
            {title}
          </p>

          <p className="mt-1 text-xs text-[#92929a]">
            {description}
          </p>

        </div>

      </div>

      <Toggle
        checked={
          checked
        }
        onChange={
          onChange
        }
        disabled={
          readOnly
        }
      />

    </div>
  );
}

/* =========================================================
   TOGGLE
========================================================= */

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;

  onChange?: () => void;

  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={() => {
        if (
          disabled ||
          !onChange
        ) {
          return;
        }

        onChange();
      }}
      aria-pressed={
        checked
      }
      className={`relative h-8 w-14 shrink-0 rounded-full transition ${
        checked
          ? "bg-[#b91c2b]"
          : "bg-[#dfe0e3]"
      } ${
        disabled
          ? "cursor-not-allowed opacity-80"
          : "cursor-pointer"
      }`}
    >

      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
          checked
            ? "left-7"
            : "left-1"
        }`}
      />

    </button>
  );
}