"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

import {
  CalendarDays,
  Cigarette,
  Droplet,
  Lightbulb,
  Lock,
  PencilLine,
  Ruler,
  Save,
  UserRound,
  UsersRound,
  Torus,
  Weight,
  X,
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
    notice,
    setNotice,
  ] = useState("");

  // เวลาของข้อมูลเวอร์ชันล่าสุด (แสดง "อัปเดตล่าสุด")
  const [
    updatedAt,
    setUpdatedAt,
  ] = useState<string | null>(null);

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

          setUpdatedAt(
            profile.updated_at ??
              profile.created_at ??
              null,
          );

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
      setNotice("");

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

        const wasExisting =
          hasProfile;

        setUpdatedAt(
          new Date().toISOString(),
        );

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

        /*
          ผู้ใช้เก่าแก้ไขผ่านหน้าต่าง: อยู่หน้าเดิม เห็นประวัติที่เพิ่งบันทึก
        */

        if (
          wasExisting
        ) {
          setNotice(
            "บันทึกข้อมูลสุขภาพเรียบร้อย",
          );

          return;
        }

        alert(
          "บันทึกข้อมูลสุขภาพเรียบร้อย",
        );

        /*
          สำคัญ

          ผู้ใช้ใหม่:
          Profile → บันทึก → Assessment Type

          ผู้ใช้เก่าแก้ไข Profile:
          อยู่หน้าเดิม (จัดการด้านบน)
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
     FIELDS
     ใช้ทั้งในหน้า (ผู้ใช้ใหม่กรอกครั้งแรก / ผู้ใช้เก่าดูแบบล็อก)
     และในหน้าต่างแก้ไข (ผู้ใช้เก่า)
  ========================================================= */

  const renderFields = (disabled: boolean) => (
    <div className="space-y-7">
      {/* ข้อมูลร่างกาย */}
      <section>
        <h3 className="text-base font-bold text-[#16181d]">
          ข้อมูลร่างกาย
        </h3>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GenderTile
            value={gender}
            disabled={disabled}
            onChange={setGender}
          />
          <EditTile
            icon={<CalendarDays size={18} />}
            label="อายุ"
            unit="ปี"
            value={age}
            min={18}
            max={100}
            disabled={disabled}
            onChange={setAge}
          />
          <EditTile
            icon={<Weight size={18} />}
            label="น้ำหนัก"
            unit="กก."
            value={weight}
            min={30}
            max={250}
            disabled={disabled}
            onChange={setWeight}
          />
          <EditTile
            icon={<Ruler size={18} />}
            label="ส่วนสูง"
            unit="ซม."
            value={height}
            min={120}
            max={230}
            disabled={disabled}
            onChange={setHeight}
          />
          <EditTile
            icon={<Torus size={18} />}
            label="รอบเอว"
            unit="ซม."
            value={waist}
            min={40}
            max={200}
            disabled={disabled}
            onChange={setWaist}
          />
        </div>
      </section>

      {/* ประวัติสุขภาพ */}
      <section>
        <h3 className="text-base font-bold text-[#16181d]">
          ประวัติสุขภาพ
        </h3>

        <div className="mt-2 divide-y divide-[#f0eaeb] border-t border-[#f0eaeb]">
          <ChoiceRow
            icon={<Cigarette size={20} />}
            label="สูบบุหรี่"
            value={smoking}
            yes="สูบ"
            no="ไม่สูบ"
            disabled={disabled}
            onChange={setSmoking}
          />
          <ChoiceRow
            icon={<Droplet size={20} />}
            label="เป็นโรคเบาหวาน"
            value={diabetes}
            yes="เป็น"
            no="ไม่เป็น"
            disabled={disabled}
            onChange={setDiabetes}
          />
          <ChoiceRow
            icon={<UsersRound size={20} />}
            label="ครอบครัวมีประวัติเบาหวาน"
            value={familyDiabetes}
            yes="มี"
            no="ไม่มี"
            disabled={disabled}
            onChange={setFamilyDiabetes}
          />
        </div>
      </section>
    </div>
  );

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

          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#b91c2b]">
                Health Profile
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-[#16181d] sm:text-5xl">
                ข้อมูลสุขภาพ
                <span className="text-[#b91c2b]">ของคุณ</span>
              </h1>

              <p className="mt-3 text-[#6b6d75]">
                ใช้คำนวณผลในแบบประเมินโดยอัตโนมัติ
                {hasProfile &&
                  updatedAt &&
                  ` · อัปเดตล่าสุด ${new Date(updatedAt).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}`}
              </p>
            </div>

            {/* ปุ่มหลัก: ผู้ใช้เก่า = แก้ไข (เปิดหน้าต่าง) / ผู้ใช้ใหม่ = บันทึกครั้งแรก */}
            {!loading &&
              (hasProfile ? (
                <button
                  type="button"
                  onClick={
                    startEditing
                  }
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 self-start rounded-2xl border border-[#e7e1e2] bg-white px-5 text-sm font-bold text-[#16181d] transition hover:-translate-y-0.5 hover:bg-[#faf7f7] sm:self-auto"
                >
                  <PencilLine
                    size={18}
                  />
                  แก้ไขข้อมูล
                </button>
              ) : (
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <button
                    type="submit"
                    form="profile-form"
                    disabled={
                      saving ||
                      !isComplete ||
                      !isValid
                    }
                    className="flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#ef3e59] to-[#b91c2b] px-6 font-bold text-white shadow-[0_12px_26px_rgba(185,28,43,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  >
                    <Save
                      size={19}
                    />
                    {saving
                      ? "กำลังบันทึก..."
                      : "บันทึกข้อมูล"}
                  </button>

                  {!isComplete && (
                    <p className="text-xs text-[#777780]">
                      <span className="font-black text-[#dc2626]">*</span>{" "}
                      กรุณากรอกข้อมูลให้ครบก่อนบันทึก
                    </p>
                  )}

                  {isComplete &&
                    !isValid && (
                      <p className="text-xs font-semibold text-[#dc2626]">
                        กรุณาตรวจสอบค่าข้อมูลให้ถูกต้อง
                      </p>
                    )}
                </div>
              ))}
          </header>

          {/* =================================================
              LOADING / NOTICE / ERROR
          ================================================== */}

          {loading && (
            <div className="mt-8 rounded-2xl border border-[#eee5e6] bg-white p-4 text-sm text-[#777780]">
              กำลังโหลดข้อมูลสุขภาพ...
            </div>
          )}

          {notice && (
            <div className="mt-6 rounded-2xl border border-[#cfe8d5] bg-[#eef8f0] p-4 text-sm font-semibold text-[#2f7a45]">
              {notice}
            </div>
          )}

          {error && !(hasProfile && isEditing) && (
            <div className="mt-6 rounded-2xl border border-[#f3cdd1] bg-[#fff0f2] p-4 text-sm font-semibold text-[#b91c2b]">
              {error}
            </div>
          )}

          {/* =================================================
              ผู้ใช้เก่า: แสดงข้อมูล (แก้ผ่านหน้าต่าง)
          ================================================== */}

          {!loading &&
            hasProfile && (
              <>
                <section className="mt-8 rounded-[28px] border border-[#ece6e3] bg-white p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-[#16181d]">
                      ข้อมูลร่างกาย
                    </h2>
                    <span className="inline-flex items-center gap-1.5 text-sm text-[#85858d]">
                      <Lock size={15} />
                      กดแก้ไขข้อมูลเพื่อเปลี่ยน
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    <StatTile
                      icon={<UserRound size={18} />}
                      label="เพศ"
                      value={gender === "male" ? "ชาย" : gender === "female" ? "หญิง" : "-"}
                    />
                    <StatTile
                      icon={<CalendarDays size={18} />}
                      label="อายุ"
                      value={age ?? "-"}
                      unit="ปี"
                    />
                    <StatTile
                      icon={<Weight size={18} />}
                      label="น้ำหนัก"
                      value={weight ?? "-"}
                      unit="กก."
                    />
                    <StatTile
                      icon={<Ruler size={18} />}
                      label="ส่วนสูง"
                      value={height ?? "-"}
                      unit="ซม."
                    />
                    <StatTile
                      icon={<Torus size={18} />}
                      label="รอบเอว"
                      value={waist ?? "-"}
                      unit="ซม."
                    />
                  </div>
                </section>

                <section className="mt-6 rounded-[28px] border border-[#ece6e3] bg-white p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-[#16181d]">
                    ประวัติสุขภาพ
                  </h2>

                  <div className="mt-4 divide-y divide-[#f0eaeb] border-t border-[#f0eaeb]">
                    <HistoryRow
                      icon={<Cigarette size={20} />}
                      label="สูบบุหรี่"
                      value={smoking}
                      yes="สูบ"
                      no="ไม่สูบ"
                    />
                    <HistoryRow
                      icon={<Droplet size={20} />}
                      label="เป็นโรคเบาหวาน"
                      value={diabetes}
                      yes="เป็น"
                      no="ไม่เป็น"
                    />
                    <HistoryRow
                      icon={<UsersRound size={20} />}
                      label="ครอบครัวมีประวัติเบาหวาน"
                      value={familyDiabetes}
                      yes="มี"
                      no="ไม่มี"
                    />
                  </div>
                </section>
              </>
            )}

          {/* =================================================
              ผู้ใช้ใหม่: กรอกข้อมูลครั้งแรก
          ================================================== */}

          {!loading &&
            !hasProfile && (
              <form
                id="profile-form"
                onSubmit={
                  handleSubmit
                }
                className="mt-8 rounded-[28px] border border-[#ece6e3] bg-white p-6 sm:p-8"
              >
                <h2 className="text-xl font-bold text-[#16181d]">
                  กรอกข้อมูลสุขภาพ
                </h2>
                <p className="mt-1 text-sm text-[#777780]">
                  <span className="font-black text-[#dc2626]">*</span>{" "}
                  กรุณากรอกข้อมูลที่จำเป็นให้ครบทุกช่อง
                </p>

                <div className="mt-6">
                  {renderFields(
                    false,
                  )}
                </div>
              </form>
            )}

          {/* =================================================
              TIP
          ================================================== */}

          {!loading && (
            <p className="mt-6 flex items-center gap-3 px-1 text-sm text-[#6b6d75]">
              <Lightbulb
                size={20}
                className="shrink-0 text-[#b91c2b]"
              />
              กรอกข้อมูลตามความเป็นจริง เพื่อให้ระบบประเมินความเสี่ยงสุขภาพได้แม่นยำขึ้น
            </p>
          )}

          {/* =================================================
              EDIT MODAL (ผู้ใช้เก่า)
          ================================================== */}

          {hasProfile &&
            isEditing && (
              <div
                className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6"
                onClick={() =>
                  !saving &&
                  cancelEditing()
                }
              >
                <form
                  onSubmit={
                    handleSubmit
                  }
                  onClick={(e) =>
                    e.stopPropagation()
                  }
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="edit-profile-title"
                  className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-[28px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.2)] sm:rounded-[28px]"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-[#f0eaeb] px-6 py-5">
                    <div>
                      <h2
                        id="edit-profile-title"
                        className="text-xl font-bold"
                      >
                        แก้ไขข้อมูลสุขภาพ
                      </h2>
                      <p className="mt-1 text-sm text-[#85858d]">
                        ข้อมูลเดิมจะถูกเก็บไว้ ไม่ถูกเขียนทับ
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={
                        cancelEditing
                      }
                      disabled={
                        saving
                      }
                      aria-label="ปิด"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#85858d] transition hover:bg-[#f5f3f3] disabled:opacity-50"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                    {renderFields(
                      false,
                    )}
                  </div>

                  <div className="space-y-3 border-t border-[#f0eaeb] px-6 py-4">
                    {error && (
                      <p className="rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b91c2b]">
                        {error}
                      </p>
                    )}

                    {!isComplete && (
                      <p className="text-xs text-[#777780]">
                        <span className="font-black text-[#dc2626]">*</span>{" "}
                        กรุณากรอกข้อมูลให้ครบก่อนบันทึก
                      </p>
                    )}

                    {isComplete &&
                      !isValid && (
                        <p className="text-xs font-semibold text-[#dc2626]">
                          กรุณาตรวจสอบค่าข้อมูลให้ถูกต้อง
                        </p>
                      )}

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={
                          cancelEditing
                        }
                        disabled={
                          saving
                        }
                        className="flex h-12 items-center justify-center rounded-2xl border border-[#e8e2e3] bg-white px-6 font-semibold text-[#777880] transition hover:bg-[#faf7f7] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={
                          saving ||
                          !isComplete ||
                          !isValid
                        }
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ef3e59] to-[#b91c2b] px-6 font-bold text-white shadow-[0_12px_26px_rgba(185,28,43,0.24)] transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Save size={18} />
                        {saving
                          ? "กำลังบันทึก..."
                          : "บันทึกการแก้ไข"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

        </section>

      </div>
    </main>
  );
}

/* =========================================================
   STAT TILE (ข้อมูลร่างกาย)
========================================================= */

function StatTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
}) {
  return (
    <div className="rounded-[22px] bg-[#faf6f4] p-5">
      <div className="flex items-center gap-2 text-sm text-[#6b6d75]">
        <span className="text-[#b91c2b]">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-3xl font-bold text-[#16181d]">
        {value}
        {unit && value !== "-" && <span className="ml-1.5 text-base font-medium text-[#6b6d75]">{unit}</span>}
      </p>
    </div>
  );
}

/* =========================================================
   HISTORY ROW (ประวัติสุขภาพ)
========================================================= */

function HistoryRow({
  icon,
  label,
  value,
  yes,
  no,
}: {
  icon: ReactNode;
  label: string;
  value: boolean | null;
  yes: string;
  no: string;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#fde8ea] text-[#b91c2b]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 font-semibold text-[#16181d]">{label}</span>
      <span
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${
          value ? "bg-[#fde8ea] text-[#b91c2b]" : "bg-[#f1f1f3] text-[#4f535b]"
        }`}
      >
        {value === null ? "-" : value ? yes : no}
      </span>
    </div>
  );
}

/* =========================================================
   EDIT TILE (กรอกตัวเลข ในหน้าต่างแก้ไข / ฟอร์มครั้งแรก)
========================================================= */

function EditTile({
  icon,
  label,
  unit,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  unit: string;
  value: number | null;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  const outOfRange = value !== null && (!Number.isFinite(value) || value < min || value > max);

  return (
    <label
      className={`block rounded-[20px] bg-[#faf6f4] p-4 ring-1 transition focus-within:bg-white ${
        outOfRange ? "ring-[#f3b6c0]" : "ring-transparent focus-within:ring-[#ead7d9]"
      }`}
    >
      <span className="flex items-center gap-2 text-sm text-[#6b6d75]">
        <span className="text-[#b91c2b]">{icon}</span>
        {label}
        <span className="text-[#dc2626]">*</span>
      </span>

      <span className="mt-2 flex items-baseline gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          value={value ?? ""}
          placeholder="-"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full min-w-0 bg-transparent text-3xl font-bold text-[#16181d] outline-none placeholder:text-[#c9c6c4] disabled:cursor-not-allowed"
        />
        <span className="shrink-0 text-base font-medium text-[#6b6d75]">{unit}</span>
      </span>

      <span className={`mt-1 block text-xs ${outOfRange ? "font-semibold text-[#dc2626]" : "text-[#a0a1a8]"}`}>
        ช่วงที่กรอกได้ {min}–{max} {unit}
      </span>
    </label>
  );
}

/* =========================================================
   GENDER TILE
========================================================= */

function GenderTile({
  value,
  disabled,
  onChange,
}: {
  value: Gender;
  disabled: boolean;
  onChange: (value: Gender) => void;
}) {
  return (
    <div className="rounded-[20px] bg-[#faf6f4] p-4">
      <span className="flex items-center gap-2 text-sm text-[#6b6d75]">
        <span className="text-[#b91c2b]">
          <UserRound size={18} />
        </span>
        เพศ
        <span className="text-[#dc2626]">*</span>
      </span>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["male", "female"] as const).map((g) => (
          <button
            key={g}
            type="button"
            disabled={disabled}
            aria-pressed={value === g}
            onClick={() => onChange(g)}
            className={`h-11 rounded-xl text-base font-bold transition disabled:cursor-not-allowed ${
              value === g
                ? "bg-white text-[#b91c2b] shadow-[0_4px_12px_rgba(22,24,29,0.08)] ring-1 ring-[#f0c9cf]"
                : "text-[#6b6d75] hover:bg-white/60"
            }`}
          >
            {g === "male" ? "ชาย" : "หญิง"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   CHOICE ROW (ใช่ / ไม่ใช่ ในหน้าต่างแก้ไข / ฟอร์มครั้งแรก)
========================================================= */

function ChoiceRow({
  icon,
  label,
  value,
  yes,
  no,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: boolean | null;
  yes: string;
  no: string;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#fde8ea] text-[#b91c2b]">
        {icon}
      </span>
      <span className="min-w-0 flex-1 font-semibold text-[#16181d]">
        {label}
        <span className="ml-1 text-[#dc2626]">*</span>
      </span>

      <div role="group" aria-label={label} className="flex shrink-0 gap-1 rounded-full bg-[#f5f3f3] p-1">
        {[
          { v: false, text: no },
          { v: true, text: yes },
        ].map((opt) => (
          <button
            key={opt.text}
            type="button"
            disabled={disabled}
            aria-pressed={value === opt.v}
            onClick={() => onChange(opt.v)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
              value === opt.v
                ? opt.v
                  ? "bg-[#fde8ea] text-[#b91c2b] ring-1 ring-[#f0c9cf]"
                  : "bg-white text-[#16181d] shadow-[0_2px_8px_rgba(22,24,29,0.08)]"
                : "text-[#85858d] hover:text-[#4f535b]"
            }`}
          >
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
}
