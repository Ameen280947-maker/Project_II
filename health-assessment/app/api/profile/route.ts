import pool from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { logSystemError } from "@/lib/errorLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type ProfileBody = {
  user_id?: number;
  age?: number | null;

  gender?:
    | "male"
    | "female"
    | null;

  height_cm?: number | null;
  weight_kg?: number | null;
  waist_cm?: number | null;

  smoking?: boolean | null;

  has_diabetes?: boolean | null;

  family_diabetes?: boolean | null;
};

/* =========================================================
   GET PROFILE

   GET /api/profile?userId=1
========================================================= */

export async function GET(
  request: NextRequest,
) {
  try {
    // ใช้ผู้ใช้จาก session (userId ที่ส่งมาต้องตรงกับ session)
    const auth = requireUser(
      request,
      request.nextUrl.searchParams.get("userId"),
    );
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    /* =========================
       Validate userId
    ========================= */

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "userId ไม่ถูกต้อง",
        },
        {
          status: 400,
        },
      );
    }

    /* =========================
       ประวัติการแก้ไข
       GET /api/profile?history=1
       ทุกเวอร์ชันของข้อมูลสุขภาพ ใหม่สุดก่อน
    ========================= */

    if (request.nextUrl.searchParams.get("history") === "1") {
      const historyResult = await pool.query(
        `
        SELECT
          profile_id,
          age,
          gender,
          height_cm,
          weight_kg,
          waist_cm,
          smoking,
          has_diabetes,
          family_diabetes,
          created_at
        FROM health_profile
        WHERE user_id = $1
        ORDER BY profile_id DESC
        LIMIT 100
        `,
        [userId],
      );

      return NextResponse.json({
        success: true,
        history: historyResult.rows,
      });
    }

    /* =========================
       หา User ก่อน
    ========================= */

    const userResult =
      await pool.query(
        `
        SELECT
          user_id,
          username,
          email,
          created_at
        FROM users
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId],
      );

    if (
      (userResult.rowCount ??
        0) === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบผู้ใช้งานในระบบ",
        },
        {
          status: 404,
        },
      );
    }

    const user =
      userResult.rows[0];

    /* =========================
       หา Profile
    ========================= */

    const profileResult =
      await pool.query(
        `
        SELECT
          profile_id,
          user_id,
          age,
          gender,
          height_cm,
          weight_kg,
          waist_cm,
          smoking,
          has_diabetes,
          family_diabetes,
          created_at,
          updated_at
        FROM health_profile
        WHERE user_id = $1
        -- เก็บทุกเวอร์ชัน แถวล่าสุด (profile_id มากสุด) คือข้อมูลปัจจุบัน
        ORDER BY profile_id DESC
        LIMIT 1
        `,
        [userId],
      );

    /* =========================
       สมาชิกใหม่
       ยังไม่มี Profile
    ========================= */

    if (
      (profileResult.rowCount ??
        0) === 0
    ) {
      return NextResponse.json({
        success: true,

        profile: null,

        user: {
          user_id:
            user.user_id,

          username:
            user.username,

          email:
            user.email,

          created_at:
            user.created_at,
        },

        hasProfile: false,

        message:
          "ยังไม่มีข้อมูลสุขภาพ",
      });
    }

    /* =========================
       สมาชิกเก่า
    ========================= */

    return NextResponse.json({
      success: true,

      profile:
        profileResult.rows[0],

      user: {
        user_id:
          user.user_id,

        username:
          user.username,

        email:
          user.email,

        created_at:
          user.created_at,
      },

      hasProfile: true,
    });
  } catch (error) {
    void logSystemError("GET /api/profile", error);
    console.error(
      "GET PROFILE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "ไม่สามารถโหลดข้อมูลสุขภาพได้",
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
   PUT PROFILE
   ทุกครั้งที่บันทึกจะ INSERT เป็นเวอร์ชันใหม่ ไม่แก้แถวเดิม
   (แถวเก่าเก็บไว้เป็นประวัติ แถวล่าสุดคือข้อมูลปัจจุบัน)
   ถ้าค่าไม่ต่างจากเวอร์ชันล่าสุด จะไม่เพิ่มแถวซ้ำ
========================================================= */

export async function PUT(
  request: NextRequest,
) {
  const client =
    await pool.connect();

  let transactionStarted =
    false;

  try {
    const body =
      (await request.json()) as ProfileBody;

    /* =========================
       รับค่า
    ========================= */

    // ใช้ผู้ใช้จาก session (user_id ที่ส่งมาต้องตรงกับ session)
    const auth = requireUser(
      request,
      body.user_id,
    );
    if (!auth.ok) return auth.response;

    const userId = auth.userId;

    const age =
      body.age === null ||
      body.age === undefined
        ? null
        : Number(body.age);

    const gender =
      body.gender ?? null;

    const heightCm =
      body.height_cm === null ||
      body.height_cm ===
        undefined
        ? null
        : Number(
            body.height_cm,
          );

    const weightKg =
      body.weight_kg === null ||
      body.weight_kg ===
        undefined
        ? null
        : Number(
            body.weight_kg,
          );

    const waistCm =
      body.waist_cm === null ||
      body.waist_cm ===
        undefined
        ? null
        : Number(
            body.waist_cm,
          );

    const smoking =
      body.smoking;

    const hasDiabetes =
      body.has_diabetes;

    const familyDiabetes =
      body.family_diabetes;

    /* =====================================================
       USER ID
    ===================================================== */

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "user_id ไม่ถูกต้อง",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       ตรวจว่ากรอกครบหรือยัง

       สำคัญ:
       boolean false ถือว่า "กรอกแล้ว"
       ดังนั้นห้ามใช้ !smoking
    ===================================================== */

    if (
      age === null ||
      gender === null ||
      heightCm === null ||
      weightKg === null ||
      waistCm === null ||
      smoking === null ||
      smoking === undefined ||
      hasDiabetes === null ||
      hasDiabetes ===
        undefined ||
      familyDiabetes === null ||
      familyDiabetes ===
        undefined
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "กรุณากรอกข้อมูลให้ครบทุกช่อง",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       AGE
    ===================================================== */

    if (
      !Number.isInteger(age) ||
      age < 18 ||
      age > 100
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "อายุต้องอยู่ระหว่าง 18-100 ปี",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       GENDER
    ===================================================== */

    if (
      gender !== "male" &&
      gender !== "female"
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "กรุณาเลือกเพศ",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       HEIGHT
    ===================================================== */

    if (
      !Number.isFinite(
        heightCm,
      ) ||
      heightCm < 120 ||
      heightCm > 230
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "ส่วนสูงต้องอยู่ระหว่าง 120-230 ซม.",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       WEIGHT
    ===================================================== */

    if (
      !Number.isFinite(
        weightKg,
      ) ||
      weightKg < 30 ||
      weightKg > 250
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "น้ำหนักต้องอยู่ระหว่าง 30-250 กก.",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       WAIST
    ===================================================== */

    if (
      !Number.isFinite(
        waistCm,
      ) ||
      waistCm < 40 ||
      waistCm > 200
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "รอบเอวต้องอยู่ระหว่าง 40-200 ซม.",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       TRANSACTION
    ===================================================== */

    await client.query(
      "BEGIN",
    );

    transactionStarted =
      true;

    /* =========================
       เช็ก User
    ========================= */

    const userResult =
      await client.query(
        `
        SELECT user_id
        FROM users
        WHERE user_id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [userId],
      );

    if (
      (userResult.rowCount ??
        0) === 0
    ) {
      await client.query(
        "ROLLBACK",
      );

      transactionStarted =
        false;

      return NextResponse.json(
        {
          success: false,

          message:
            "ไม่พบผู้ใช้งานในระบบ",
        },
        {
          status: 404,
        },
      );
    }

    /* =========================
       หา Profile เวอร์ชันล่าสุด
       (ล็อกแถว users ไว้แล้วด้านบน กันบันทึกซ้อนกัน)
    ========================= */

    const existingProfile =
      await client.query(
        `
        SELECT
          profile_id,
          user_id,
          age,
          gender,
          height_cm,
          weight_kg,
          waist_cm,
          smoking,
          has_diabetes,
          family_diabetes,
          created_at,
          updated_at
        FROM health_profile
        WHERE user_id = $1
        ORDER BY profile_id DESC
        LIMIT 1
        `,
        [userId],
      );

    let result;

    const latest =
      existingProfile.rows[0];

    // เทียบค่าแบบตัวเลข (numeric จากฐานข้อมูลเป็น string)
    const sameNumber = (a: unknown, b: number | null) =>
      (a === null || a === undefined ? null : Number(a)) === b;

    const unchanged =
      latest &&
      sameNumber(latest.age, age) &&
      latest.gender === gender &&
      sameNumber(latest.height_cm, heightCm) &&
      sameNumber(latest.weight_kg, weightKg) &&
      sameNumber(latest.waist_cm, waistCm) &&
      latest.smoking === smoking &&
      latest.has_diabetes === hasDiabetes &&
      latest.family_diabetes === familyDiabetes;

    /* =====================================================
       ไม่มีอะไรเปลี่ยน -> ไม่เพิ่มเวอร์ชันใหม่
    ===================================================== */

    if (unchanged) {
      result = existingProfile;
    }

    /* =====================================================
       มีการเปลี่ยนแปลง / ยังไม่มีข้อมูล -> INSERT เวอร์ชันใหม่
    ===================================================== */

    else {
      result =
        await client.query(
          `
          INSERT INTO health_profile (
            user_id,
            age,
            gender,
            height_cm,
            weight_kg,
            waist_cm,
            smoking,
            has_diabetes,
            family_diabetes,
            created_at,
            updated_at
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          RETURNING
            profile_id,
            user_id,
            age,
            gender,
            height_cm,
            weight_kg,
            waist_cm,
            smoking,
            has_diabetes,
            family_diabetes,
            created_at,
            updated_at
          `,
          [
            userId,
            age,
            gender,
            heightCm,
            weightKg,
            waistCm,
            smoking,
            hasDiabetes,
            familyDiabetes,
          ],
        );
    }

    await client.query(
      "COMMIT",
    );

    transactionStarted =
      false;

    return NextResponse.json({
      success: true,

      message:
        "บันทึกข้อมูลสุขภาพสำเร็จ",

      profile:
        result.rows[0],

      hasProfile: true,
    });
  } catch (error) {
    if (
      transactionStarted
    ) {
      try {
        await client.query(
          "ROLLBACK",
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "PROFILE ROLLBACK ERROR:",
          rollbackError,
        );
      }
    }

    console.error(
      "PUT PROFILE ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถบันทึกข้อมูลสุขภาพได้",
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}