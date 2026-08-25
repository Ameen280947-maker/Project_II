"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

import {
  Activity,
  CalendarDays,
  ChevronDown,
  Heart,
  Lightbulb,
  Pencil,
  Ruler,
  Save,
  Scale,
  Settings,
  UserRound,
  UsersRound,
  VenusAndMars,
} from "lucide-react";

import type { ReactNode } from "react";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

/* =========================================================
   TYPES
========================================================= */

type Gender =
  | "male"
  | "female"
  | null;

type ProfileData = {
  profile_id: number;
  user_id: number;

  age:
    | number
    | null;

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

  family_diabetes:
    | boolean
    | null;

  created_at?: string;
  updated_at?: string;
};

type ProfileResponse = {
  success: boolean;
  message?: string;
  hasProfile?: boolean;

  user?: {
    user_id: number;
    username: string;
    email: string | null;
  };

  profile?:
    | ProfileData
    | null;
};

type SaveProfileResponse = {
  success: boolean;
  message?: string;
  hasProfile?: boolean;

  profile?:
    | ProfileData
    | null;
};

type ProfileSnapshot = {
  gender: Gender;

  age:
    | number
    | null;

  weight:
    | number
    | null;

  height:
    | number
    | null;

  waist:
    | number
    | null;

  smoking:
    | boolean
    | null;

  diabetes:
    | boolean
    | null;

  familyDiabetes:
    | boolean
    | null;
};

/* =========================================================
   PAGE
========================================================= */

export default function ProfilePage() {
  const router =
    useRouter();

  /* =========================================================
     USER
  ========================================================= */

  const [
    username,
    setUsername,
  ] = useState("");

  /* =========================================================
     PROFILE DATA
  ========================================================= */

  const [
    gender,
    setGender,
  ] = useState<Gender>(
    null,
  );

  const [
    age,
    setAge,
  ] = useState<
    number | null
  >(null);

  const [
    weight,
    setWeight,
  ] = useState<
    number | null
  >(null);

  const [
    height,
    setHeight,
  ] = useState<
    number | null
  >(null);

  const [
    waist,
    setWaist,
  ] = useState<
    number | null
  >(null);

  const [
    smoking,
    setSmoking,
  ] = useState<
    boolean | null
  >(null);

  const [
    diabetes,
    setDiabetes,
  ] = useState<
    boolean | null
  >(null);

  const [
    familyDiabetes,
    setFamilyDiabetes,
  ] = useState<
    boolean | null
  >(null);

  /* =========================================================
     STATE
  ========================================================= */

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    hasProfile,
    setHasProfile,
  ] = useState(false);

  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    originalData,
    setOriginalData,
  ] =
    useState<ProfileSnapshot | null>(
      null,
    );

  /* =========================================================
     CHECK COMPLETE
  ========================================================= */

  const isComplete =
    useMemo(() => {
      return (
        gender !== null &&
        age !== null &&
        weight !== null &&
        height !== null &&
        waist !== null &&
        smoking !== null &&
        diabetes !== null &&
        familyDiabetes !==
          null
      );
    }, [
      gender,
      age,
      weight,
      height,
      waist,
      smoking,
      diabetes,
      familyDiabetes,
    ]);

  /* =========================================================
     CHECK VALID
  ========================================================= */

  const isValid =
    useMemo(() => {
      if (!isComplete) {
        return false;
      }

      if (
        age === null ||
        weight === null ||
        height === null ||
        waist === null
      ) {
        return false;
      }

      if (
        !Number.isInteger(
          age,
        ) ||
        age < 18 ||
        age > 100
      ) {
        return false;
      }

      if (
        !Number.isFinite(
          weight,
        ) ||
        weight < 30 ||
        weight > 250
      ) {
        return false;
      }

      if (
        !Number.isFinite(
          height,
        ) ||
        height < 120 ||
        height > 230
      ) {
        return false;
      }

      if (
        !Number.isFinite(
          waist,
        ) ||
        waist < 40 ||
        waist > 200
      ) {
        return false;
      }

      return true;
    }, [
      isComplete,
      age,
      weight,
      height,
      waist,
    ]);

  /* =========================================================
     LOAD PROFILE
  ========================================================= */

  useEffect(() => {
    const loadProfile =
      async () => {
        try {
          setLoading(true);
          setError("");

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

          const userId =
            Number(
              storedUserId,
            );

          if (
            !Number.isInteger(
              userId,
            ) ||
            userId <= 0
          ) {
            localStorage.removeItem(
              "userId",
            );

            localStorage.removeItem(
              "username",
            );

            localStorage.removeItem(
              "email",
            );

            localStorage.removeItem(
              "roleId",
            );

            localStorage.removeItem(
              "role",
            );

            localStorage.removeItem(
              "user",
            );

            localStorage.removeItem(
              "hasProfile",
            );

            router.replace(
              "/login",
            );

            return;
          }

          /* =========================
             GET PROFILE
          ========================= */

          const response =
            await fetch(
              `/api/profile?userId=${userId}`,
              {
                method:
                  "GET",

                cache:
                  "no-store",
              },
            );

          const data =
            (await response.json()) as ProfileResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ??
                "ไม่สามารถโหลดข้อมูลสุขภาพได้",
            );
          }

          /* =========================
             USERNAME
          ========================= */

          const loadedUsername =
            data.user
              ?.username ??
            localStorage.getItem(
              "username",
            ) ??
            "";

          setUsername(
            loadedUsername,
          );

          /* =================================================
             USER ใหม่

             ยังไม่มี health_profile
          ================================================= */

          if (
            !data.profile
          ) {
            setHasProfile(
              false,
            );

            /*
              ผู้ใช้ใหม่:
              เปิดให้กรอกข้อมูลได้ทันที
            */

            setIsEditing(
              true,
            );

            setGender(null);
            setAge(null);
            setWeight(null);
            setHeight(null);
            setWaist(null);
            setSmoking(null);
            setDiabetes(null);

            setFamilyDiabetes(
              null,
            );

            setOriginalData(
              null,
            );

            return;
          }

          /* =================================================
             USER เก่า

             มี health_profile แล้ว
          ================================================= */

          setHasProfile(
            true,
          );

          /*
            ผู้ใช้เก่า:
            ล็อกข้อมูลก่อน
            ต้องกด "แก้ไขข้อมูล"
          */

          setIsEditing(
            false,
          );

          const profile =
            data.profile;

          /* =========================
             GENDER
          ========================= */

          let loadedGender: Gender =
            null;

          if (
            profile.gender ===
              "male" ||
            profile.gender ===
              "female"
          ) {
            loadedGender =
              profile.gender;
          }

          /* =========================
             AGE
          ========================= */

          const loadedAge =
            profile.age !==
            null
              ? Number(
                  profile.age,
                )
              : null;

          /* =========================
             WEIGHT
          ========================= */

          const loadedWeight =
            profile.weight_kg !==
            null
              ? Number(
                  profile.weight_kg,
                )
              : null;

          /* =========================
             HEIGHT
          ========================= */

          const loadedHeight =
            profile.height_cm !==
            null
              ? Number(
                  profile.height_cm,
                )
              : null;

          /* =========================
             WAIST
          ========================= */

          const loadedWaist =
            profile.waist_cm !==
            null
              ? Number(
                  profile.waist_cm,
                )
              : null;

          /* =========================
             BOOLEAN VALUES
          ========================= */

          const loadedSmoking =
            profile.smoking;

          const loadedDiabetes =
            profile.has_diabetes;

          const loadedFamily =
            profile.family_diabetes;

          /* =========================
             SET FORM
          ========================= */

          setGender(
            loadedGender,
          );

          setAge(
            loadedAge,
          );

          setWeight(
            loadedWeight,
          );

          setHeight(
            loadedHeight,
          );

          setWaist(
            loadedWaist,
          );

          setSmoking(
            loadedSmoking,
          );

          setDiabetes(
            loadedDiabetes,
          );

          setFamilyDiabetes(
            loadedFamily,
          );

          /* =========================
             SAVE ORIGINAL
          ========================= */

          setOriginalData({
            gender:
              loadedGender,

            age:
              loadedAge,

            weight:
              loadedWeight,

            height:
              loadedHeight,

            waist:
              loadedWaist,

            smoking:
              loadedSmoking,

            diabetes:
              loadedDiabetes,

            familyDiabetes:
              loadedFamily,
          });
        } catch (
          loadError
        ) {
          console.error(
            "LOAD PROFILE ERROR:",
            loadError,
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "ไม่สามารถโหลดข้อมูลสุขภาพได้",
          );
        } finally {
          setLoading(false);
        }
      };

    void loadProfile();
  }, [router]);

  /* =========================================================
     START EDITING
  ========================================================= */

  const startEditing =
    () => {
      setError("");

      /*
        เก็บข้อมูลก่อนแก้ไข
        เผื่อกด Cancel
      */

      setOriginalData({
        gender,
        age,
        weight,
        height,
        waist,
        smoking,
        diabetes,
        familyDiabetes,
      });

      setIsEditing(
        true,
      );
    };

  /* =========================================================
     CANCEL EDITING
  ========================================================= */

  const cancelEditing =
    () => {
      if (
        !originalData
      ) {
        return;
      }

      setGender(
        originalData.gender,
      );

      setAge(
        originalData.age,
      );

      setWeight(
        originalData.weight,
      );

      setHeight(
        originalData.height,
      );

      setWaist(
        originalData.waist,
      );

      setSmoking(
        originalData.smoking,
      );

      setDiabetes(
        originalData.diabetes,
      );

      setFamilyDiabetes(
        originalData.familyDiabetes,
      );

      setError("");

      setIsEditing(
        false,
      );
    };

  /* =========================================================
     SAVE PROFILE
  ========================================================= */

  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      try {
        setError("");

        /* =========================
           ต้องอยู่ใน Edit Mode
        ========================= */

        if (
          !isEditing
        ) {
          return;
        }

        /* =========================
           CHECK COMPLETE
        ========================= */

        if (
          !isComplete
        ) {
          setError(
            "กรุณากรอกข้อมูลให้ครบทุกช่อง",
          );

          return;
        }

        /* =========================
           NULL GUARD
        ========================= */

        if (
          age === null ||
          gender === null ||
          weight === null ||
          height === null ||
          waist === null ||
          smoking === null ||
          diabetes === null ||
          familyDiabetes ===
            null
        ) {
          setError(
            "กรุณากรอกข้อมูลให้ครบทุกช่อง",
          );

          return;
        }

        /* =========================
           AGE
        ========================= */

        if (
          !Number.isInteger(
            age,
          ) ||
          age < 18 ||
          age > 100
        ) {
          setError(
            "อายุต้องอยู่ระหว่าง 18-100 ปี",
          );

          return;
        }

        /* =========================
           WEIGHT
        ========================= */

        if (
          !Number.isFinite(
            weight,
          ) ||
          weight < 30 ||
          weight > 250
        ) {
          setError(
            "น้ำหนักต้องอยู่ระหว่าง 30-250 กก.",
          );

          return;
        }

        /* =========================
           HEIGHT
        ========================= */

        if (
          !Number.isFinite(
            height,
          ) ||
          height < 120 ||
          height > 230
        ) {
          setError(
            "ส่วนสูงต้องอยู่ระหว่าง 120-230 ซม.",
          );

          return;
        }

        /* =========================
           WAIST
        ========================= */

        if (
          !Number.isFinite(
            waist,
          ) ||
          waist < 40 ||
          waist > 200
        ) {
          setError(
            "รอบเอวต้องอยู่ระหว่าง 40-200 ซม.",
          );

          return;
        }

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

        const userId =
          Number(
            storedUserId,
          );

        if (
          !Number.isInteger(
            userId,
          ) ||
          userId <= 0
        ) {
          throw new Error(
            "ข้อมูลผู้ใช้งานไม่ถูกต้อง",
          );
        }

        setSaving(
          true,
        );

        /* =========================
           REQUEST BODY
        ========================= */

        const requestBody = {
          user_id:
            userId,

          age,

          gender,

          height_cm:
            height,

          weight_kg:
            weight,

          waist_cm:
            waist,

          smoking,

          has_diabetes:
            diabetes,

          family_diabetes:
            familyDiabetes,
        };

        console.log(
          "PROFILE REQUEST:",
          requestBody,
        );

        /* =========================
           PUT PROFILE
        ========================= */

        const response =
          await fetch(
            "/api/profile",
            {
              method:
                "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  requestBody,
                ),
            },
          );

        const data =
          (await response.json()) as SaveProfileResponse;

        console.log(
          "PROFILE RESPONSE:",
          data,
        );

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ??
              "ไม่สามารถบันทึกข้อมูลสุขภาพได้",
          );
        }

        /* =========================
           SUCCESS
        ========================= */

        localStorage.setItem(
          "hasProfile",
          "true",
        );

        setHasProfile(
          true,
        );

        setIsEditing(
          false,
        );

        setOriginalData({
          gender,
          age,
          weight,
          height,
          waist,
          smoking,
          diabetes,
          familyDiabetes,
        });

        alert(
          "บันทึกข้อมูลสุขภาพเรียบร้อย",
        );

        /*
          สำคัญ

          ผู้ใช้ใหม่:
          Profile → บันทึก → Assessment Type

          ผู้ใช้เก่าแก้ไข Profile:
          บันทึก → Assessment Type เช่นกัน
        */

        router.push(
          "/assessment-type",
        );
      } catch (
        saveError
      ) {
        console.error(
          "SAVE PROFILE ERROR:",
          saveError,
        );

        const message =
          saveError instanceof
            Error
            ? saveError.message
            : "เกิดข้อผิดพลาดในการบันทึกข้อมูล";

        setError(
          message,
        );
      } finally {
        setSaving(
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
        ================================================== */}

        <Sidebar />

        {/* =================================================
            MAIN CONTENT
        ================================================== */}

        <section className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-12">

          {/* =================================================
              HEADER
          ================================================== */}

          <header>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">
              Health Profile
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              health-

              <span className="text-[#ef4962]">
                profile
              </span>
            </h1>

            <p className="mt-3 text-lg text-[#85858d]">
              ข้อมูลสุขภาพของคุณ
            </p>
          </header>

          {/* =================================================
              REQUIRED MESSAGE
          ================================================== */}

          {!loading &&
            isEditing && (
              <p className="mt-5 text-sm text-[#777780]">
                <span className="font-black text-[#dc2626]">
                  *
                </span>{" "}
                กรุณากรอกข้อมูลที่จำเป็นให้ครบทุกช่อง
              </p>
            )}

          {/* =================================================
              LOCK STATUS
          ================================================== */}

          {!loading &&
            hasProfile &&
            !isEditing && (
              <div className="mt-5 flex w-fit items-center gap-2 rounded-full bg-[#f5f3f3] px-4 py-2 text-sm text-[#777780]">

                <Settings
                  size={16}
                />

                ข้อมูลถูกล็อก กรุณากดแก้ไขข้อมูลหากต้องการเปลี่ยนแปลง

              </div>
            )}

          {/* =================================================
              LOADING
          ================================================== */}

          {loading && (
            <div className="mt-6 rounded-2xl border border-[#eee5e6] bg-white p-4 text-sm text-[#777780] shadow-sm">
              กำลังโหลดข้อมูลสุขภาพ...
            </div>
          )}

          {/* =================================================
              ERROR
          ================================================== */}

          {error && (
            <div className="mt-6 rounded-2xl border border-[#f3cdd1] bg-[#fff0f2] p-4 text-sm font-semibold text-[#b91c2b]">
              {error}
            </div>
          )}

          {/* =================================================
              FORM
          ================================================== */}

          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">

              {/* =================================================
                  LEFT
              ================================================== */}

              <div className="space-y-6">

                {/* Section title */}

                <div className="flex items-start gap-4">

                  <span className="mt-3 h-2.5 w-2.5 rounded-full bg-[#ef4962]" />

                  <div>
                    <h2 className="text-3xl font-bold">
                      ข้อมูลทั่วไป
                    </h2>

                    <p className="mt-2 text-lg text-[#74757d]">
                      เพื่อใช้ในการประเมิน
                    </p>
                  </div>

                </div>

                {/* =================================================
                    BASIC INFORMATION
                ================================================== */}

                <section className="rounded-[28px] border border-[#eee5e6] bg-white p-6 shadow-[0_16px_45px_rgba(35,25,30,0.05)] sm:p-8">

                  <div className="flex items-center justify-between gap-4">

                    <div className="flex items-center gap-3">

                      <UserRound
                        size={26}
                        className="text-[#ef4962]"
                      />

                      <h3 className="text-xl font-bold text-[#ef4962]">
                        Basic Information
                      </h3>

                    </div>

                    {hasProfile &&
                      isEditing && (
                        <span className="rounded-full bg-[#fff0f2] px-3 py-1.5 text-xs font-bold text-[#b91c2b]">
                          กำลังแก้ไข
                        </span>
                      )}

                  </div>

                  <div className="mt-7 space-y-4">

                    {/* =========================
                        GENDER
                    ========================= */}

                    <SelectField
                      icon={
                        <VenusAndMars
                          size={23}
                        />
                      }
                      label={
                        <RequiredLabel>
                          เพศ
                        </RequiredLabel>
                      }
                      value={
                        gender ??
                        ""
                      }
                      disabled={
                        !isEditing
                      }
                      onChange={(
                        value,
                      ) => {
                        if (
                          value ===
                            "male" ||
                          value ===
                            "female"
                        ) {
                          setGender(
                            value,
                          );
                        } else {
                          setGender(
                            null,
                          );
                        }
                      }}
                      options={[
                        {
                          value:
                            "",
                          label:
                            "กรุณาเลือก",
                        },
                        {
                          value:
                            "male",
                          label:
                            "ชาย",
                        },
                        {
                          value:
                            "female",
                          label:
                            "หญิง",
                        },
                      ]}
                    />

                    {/* =========================
                        AGE
                    ========================= */}

                    <NumberField
                      icon={
                        <CalendarDays
                          size={22}
                        />
                      }
                      label={
                        <RequiredLabel>
                          อายุ
                        </RequiredLabel>
                      }
                      value={
                        age
                      }
                      placeholder="กรอกอายุ"
                      min={18}
                      max={100}
                      disabled={
                        !isEditing
                      }
                      onChange={
                        setAge
                      }
                    />

                    {/* =========================
                        WEIGHT
                    ========================= */}

                    <NumberField
                      icon={
                        <Scale
                          size={22}
                        />
                      }
                      label={
                        <RequiredLabel>
                          น้ำหนัก (กก.)
                        </RequiredLabel>
                      }
                      value={
                        weight
                      }
                      placeholder="กรอกน้ำหนัก"
                      min={30}
                      max={250}
                      disabled={
                        !isEditing
                      }
                      onChange={
                        setWeight
                      }
                    />

                    {/* =========================
                        HEIGHT
                    ========================= */}

                    <NumberField
                      icon={
                        <Ruler
                          size={22}
                        />
                      }
                      label={
                        <RequiredLabel>
                          ส่วนสูง (ซม.)
                        </RequiredLabel>
                      }
                      value={
                        height
                      }
                      placeholder="กรอกส่วนสูง"
                      min={120}
                      max={230}
                      disabled={
                        !isEditing
                      }
                      onChange={
                        setHeight
                      }
                    />

                    {/* =========================
                        WAIST
                    ========================= */}

                    <NumberField
                      icon={
                        <Activity
                          size={22}
                        />
                      }
                      label={
                        <RequiredLabel>
                          รอบเอว (ซม.)
                        </RequiredLabel>
                      }
                      value={
                        waist
                      }
                      placeholder="กรอกรอบเอว"
                      min={40}
                      max={200}
                      disabled={
                        !isEditing
                      }
                      onChange={
                        setWaist
                      }
                    />

                    {/* =========================
                        SMOKING
                    ========================= */}

                    <YesNoField
                      icon={
                        <Activity
                          size={22}
                        />
                      }
                      label={
                        <RequiredLabel>
                          สูบบุหรี่หรือไม่?
                        </RequiredLabel>
                      }
                      value={
                        smoking
                      }
                      disabled={
                        !isEditing
                      }
                      onChange={
                        setSmoking
                      }
                    />

                    {/* =========================
                        DIABETES
                    ========================= */}

                    <YesNoField
                      icon={
                        <UsersRound
                          size={22}
                        />
                      }
                      label={
                        <RequiredLabel>
                          เป็นโรคเบาหวานหรือไม่?
                        </RequiredLabel>
                      }
                      value={
                        diabetes
                      }
                      disabled={
                        !isEditing
                      }
                      onChange={
                        setDiabetes
                      }
                    />

                    {/* =========================
                        FAMILY DIABETES
                    ========================= */}

                    <YesNoField
                      icon={
                        <UsersRound
                          size={22}
                        />
                      }
                      label={
                        <RequiredLabel>
                          ครอบครัวมีประวัติเบาหวานหรือไม่?
                        </RequiredLabel>
                      }
                      value={
                        familyDiabetes
                      }
                      disabled={
                        !isEditing
                      }
                      onChange={
                        setFamilyDiabetes
                      }
                    />

                  </div>

                </section>

                {/* =================================================
                    TIP
                ================================================== */}

                <section className="flex flex-col gap-5 rounded-[26px] border border-[#eee5e6] bg-white p-6 shadow-[0_14px_35px_rgba(35,25,30,0.04)] sm:flex-row sm:items-center">

                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#fff0f2] text-[#ef4962]">

                    <Lightbulb
                      size={28}
                    />

                  </div>

                  <div>
                    <h3 className="font-bold">
                      เคล็ดลับ
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-[#898a92]">
                      กรุณากรอกข้อมูลตามความเป็นจริง
                      เพื่อให้ระบบสามารถประเมินความเสี่ยงสุขภาพได้แม่นยำมากขึ้น
                    </p>
                  </div>

                </section>

              </div>

              {/* =================================================
                  RIGHT PANEL
              ================================================== */}

              <aside className="space-y-5">

                {/* =========================
                    PROFILE CARD
                ========================= */}

                <section className="rounded-[30px] border border-[#eee5e6] bg-white p-7 text-center shadow-[0_16px_45px_rgba(35,25,30,0.05)]">

                  <div className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-[#fff0f2] text-[#ef4962] shadow-[0_16px_40px_rgba(239,73,98,0.12)]">

                    <UserRound
                      size={66}
                      strokeWidth={
                        1.5
                      }
                    />

                  </div>

                  {/* USERNAME */}

                  <h3 className="mt-5 break-all text-xl font-black text-[#b91c2b]">
                    {username ||
                      "ผู้ใช้งาน"}
                  </h3>

                  {/* GENDER + AGE */}

                  <p className="mt-2 text-sm leading-6 text-[#92939b]">

                    {gender ===
                    "male"
                      ? "ชาย"
                      : gender ===
                          "female"
                        ? "หญิง"
                        : "ยังไม่ระบุเพศ"}

                    {" • "}

                    {age !== null
                      ? `${age} ปี`
                      : "ยังไม่ระบุอายุ"}

                  </p>

                  <div className="mt-7 rounded-[24px] bg-gradient-to-br from-[#fff6f7] to-[#fdebed] p-6">

                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-[#ef4962] shadow-sm">

                      <Heart
                        size={31}
                      />

                    </div>

                    <p className="mt-4 leading-7 text-[#686970]">

                      ดูแลสุขภาพวันนี้

                      <span className="block">
                        เพื่ออนาคตที่ดีกว่า
                      </span>

                    </p>

                  </div>

                </section>

                {/* =================================================
                    EXISTING PROFILE + LOCKED
                ================================================== */}

                {hasProfile &&
                !isEditing ? (
                  <button
                    type="button"
                    onClick={
                      startEditing
                    }
                    className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-[#b91c2b] bg-white text-lg font-bold text-[#b91c2b] shadow-[0_10px_25px_rgba(185,28,43,0.06)] transition hover:-translate-y-0.5 hover:bg-[#fff0f2]"
                  >

                    <Pencil
                      size={21}
                    />

                    แก้ไขข้อมูล

                  </button>
                ) : (
                  /* =================================================
                     NEW USER / EDITING
                  ================================================= */

                  <div className="space-y-3">

                    {/* SAVE */}

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        saving ||
                        !isComplete ||
                        !isValid
                      }
                      className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#ef3e59] to-[#b91c2b] text-lg font-bold text-white shadow-[0_15px_32px_rgba(185,28,43,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                    >

                      <Save
                        size={21}
                      />

                      {saving
                        ? "กำลังบันทึก..."
                        : hasProfile
                          ? "บันทึกการแก้ไข"
                          : "บันทึกข้อมูล"}

                    </button>

                    {/* CANCEL */}

                    {hasProfile && (
                      <button
                        type="button"
                        onClick={
                          cancelEditing
                        }
                        disabled={
                          saving
                        }
                        className="flex h-14 w-full items-center justify-center rounded-2xl border border-[#e8e2e3] bg-white font-semibold text-[#777880] transition hover:bg-[#faf7f7] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ยกเลิกการแก้ไข
                      </button>
                    )}

                    {/* REQUIRED */}

                    {!isComplete &&
                      !loading && (
                        <p className="text-center text-xs text-[#777780]">

                          <span className="font-black text-[#dc2626]">
                            *
                          </span>{" "}

                          กรุณากรอกข้อมูลให้ครบก่อนบันทึก

                        </p>
                      )}

                    {/* INVALID */}

                    {isComplete &&
                      !isValid &&
                      !loading && (
                        <p className="text-center text-xs font-semibold text-[#dc2626]">
                          กรุณาตรวจสอบค่าข้อมูลให้ถูกต้อง
                        </p>
                      )}

                  </div>
                )}

              </aside>

            </div>
          </form>

        </section>

      </div>
    </main>
  );
}

/* =========================================================
   REQUIRED LABEL
========================================================= */

function RequiredLabel({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}

      <span className="ml-1 font-black text-[#dc2626]">
        *
      </span>
    </>
  );
}

/* =========================================================
   SELECT FIELD
========================================================= */

function SelectField({
  icon,
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  icon: ReactNode;

  label: ReactNode;

  value: string;

  onChange: (
    value: string,
  ) => void;

  options: {
    value: string;
    label: string;
  }[];

  disabled?: boolean;
}) {
  return (
    <label
      className={`flex min-h-14 items-center rounded-2xl px-4 transition ${
        disabled
          ? "bg-[#f4f3f3]"
          : "bg-[#faf8f8] focus-within:ring-2 focus-within:ring-[#b91c2b]/10"
      }`}
    >

      <span className="mr-4 shrink-0 text-[#ef4962]">
        {icon}
      </span>

      <span className="font-semibold">
        {label}
      </span>

      <div className="relative ml-auto">

        <select
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
          className={`appearance-none bg-transparent py-2 pl-5 pr-8 text-right font-semibold outline-none ${
            disabled
              ? "cursor-not-allowed text-[#777780]"
              : "cursor-pointer"
          }`}
        >

          {options.map(
            (
              option,
            ) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}

        </select>

        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2"
        />

      </div>

    </label>
  );
}

/* =========================================================
   NUMBER FIELD
========================================================= */

function NumberField({
  icon,
  label,
  value,
  placeholder,
  min,
  max,
  onChange,
  disabled = false,
}: {
  icon: ReactNode;

  label: ReactNode;

  value:
    | number
    | null;

  placeholder: string;

  min: number;

  max: number;

  onChange: (
    value:
      | number
      | null,
  ) => void;

  disabled?: boolean;
}) {
  return (
    <label
      className={`flex min-h-14 items-center rounded-2xl px-4 transition ${
        disabled
          ? "bg-[#f4f3f3]"
          : "bg-[#faf8f8] focus-within:ring-2 focus-within:ring-[#b91c2b]/10"
      }`}
    >

      <span className="mr-4 shrink-0 text-[#ef4962]">
        {icon}
      </span>

      <span className="font-semibold">
        {label}
      </span>

      <input
        type="number"
        min={min}
        max={max}
        value={
          value ?? ""
        }
        placeholder={
          placeholder
        }
        disabled={
          disabled
        }
        onChange={(
          event,
        ) => {
          const inputValue =
            event.target
              .value;

          if (
            inputValue ===
            ""
          ) {
            onChange(
              null,
            );

            return;
          }

          onChange(
            Number(
              inputValue,
            ),
          );
        }}
        className={`ml-auto w-36 bg-transparent text-right font-semibold outline-none placeholder:font-normal placeholder:text-[#b6b6bc] ${
          disabled
            ? "cursor-not-allowed text-[#777780]"
            : "text-[#2f3037]"
        }`}
      />

    </label>
  );
}

/* =========================================================
   YES / NO FIELD
========================================================= */

function YesNoField({
  icon,
  label,
  value,
  onChange,
  disabled = false,
}: {
  icon: ReactNode;

  label: ReactNode;

  value:
    | boolean
    | null;

  onChange: (
    value: boolean,
  ) => void;

  disabled?: boolean;
}) {
  return (
    <div
      className={`flex min-h-16 items-center gap-4 rounded-2xl px-4 transition ${
        disabled
          ? "bg-[#f4f3f3]"
          : "bg-[#faf8f8]"
      }`}
    >

      <span className="shrink-0 text-[#ef4962]">
        {icon}
      </span>

      <span className="min-w-0 flex-1 font-semibold">
        {label}
      </span>

      <div className="flex shrink-0 overflow-hidden rounded-xl border border-[#e7dfe0]">

        {/* YES */}

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            onChange(
              true,
            )
          }
          className={`min-w-[58px] px-4 py-2 text-sm font-bold transition ${
            value === true
              ? "bg-[#ef4962] text-white"
              : "bg-white text-[#777780]"
          } ${
            disabled
              ? "cursor-not-allowed opacity-70"
              : "hover:bg-[#fff0f2]"
          }`}
        >
          Yes
        </button>

        {/* NO */}

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            onChange(
              false,
            )
          }
          className={`min-w-[58px] border-l border-[#e7dfe0] px-4 py-2 text-sm font-bold transition ${
            value === false
              ? "bg-[#ef4962] text-white"
              : "bg-white text-[#777780]"
          } ${
            disabled
              ? "cursor-not-allowed opacity-70"
              : "hover:bg-[#fff0f2]"
          }`}
        >
          No
        </button>

      </div>
    </div>
  );
}