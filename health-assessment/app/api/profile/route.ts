import pool from "@/lib/db";
import {
  NextRequest,
  NextResponse,
} from "next/server";

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
    const userId = Number(
      request.nextUrl.searchParams.get(
        "userId",
      ),
    );

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
       หา User ก่อน
    ========================= */

    const userResult =
      await pool.query(
        `
        SELECT
          user_id,
          username,
          email
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
        ORDER BY
          updated_at DESC NULLS LAST,
          created_at DESC NULLS LAST,
          profile_id DESC
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
      },

      hasProfile: true,
    });
  } catch (error) {
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

   สมาชิกใหม่ -> INSERT
   สมาชิกเก่า -> UPDATE
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

    const userId = Number(
      body.user_id,
    );

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
       หา Profile เดิม
    ========================= */

    const existingProfile =
      await client.query<{
        profile_id: number;
      }>(
        `
        SELECT profile_id
        FROM health_profile
        WHERE user_id = $1
        ORDER BY
          updated_at DESC NULLS LAST,
          created_at DESC NULLS LAST,
          profile_id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [userId],
      );

    let result;

    /* =====================================================
       มีแล้ว -> UPDATE
    ===================================================== */

    if (
      (existingProfile.rowCount ??
        0) > 0
    ) {
      const profileId =
        existingProfile.rows[0]
          .profile_id;

      result =
        await client.query(
          `
          UPDATE health_profile

          SET
            age = $1,
            gender = $2,
            height_cm = $3,
            weight_kg = $4,
            waist_cm = $5,
            smoking = $6,
            has_diabetes = $7,
            family_diabetes = $8,
            updated_at = CURRENT_TIMESTAMP

          WHERE profile_id = $9

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
            age,
            gender,
            heightCm,
            weightKg,
            waistCm,
            smoking,
            hasDiabetes,
            familyDiabetes,
            profileId,
          ],
        );
    }

    /* =====================================================
       ไม่มี -> INSERT
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