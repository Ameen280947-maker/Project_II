import pool from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type SubmitBody = {
  userId?: number;
  user_id?: number;

  family_diabetes: boolean;

  sbp?: number;
  dbp?: number;
};

type QuestionRow = {
  question_id: number;
  question_text: string;
  display_order: number;
};

/* =========================================================
   HELPERS
========================================================= */

function getNumber(
  profile: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = profile[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      const numberValue = Number(value);

      if (Number.isFinite(numberValue)) {
        return numberValue;
      }
    }
  }

  return null;
}

function getString(
  profile: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = profile[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      return String(value);
    }
  }

  return null;
}

/* =========================================================
   AGE FROM BIRTH YEAR
========================================================= */

function calculateAgeFromBirthYear(
  birthYear: number,
): number | null {
  const currentYear =
    new Date().getFullYear();

  let year = birthYear;

  // พ.ศ. -> ค.ศ.
  if (year > 2400) {
    year -= 543;
  }

  const age =
    currentYear - year;

  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > 120
  ) {
    return null;
  }

  return age;
}

/* =========================================================
   EXTRACT PROFILE
========================================================= */

function extractHealthProfile(
  profile: Record<string, unknown>,
) {
  /* AGE */

  let age = getNumber(
    profile,
    [
      "age",
      "user_age",
    ],
  );

  if (age === null) {
    const birthYear =
      getNumber(
        profile,
        [
          "birth_year",
          "year_of_birth",
          "birthYear",
        ],
      );

    if (birthYear !== null) {
      age =
        calculateAgeFromBirthYear(
          birthYear,
        );
    }
  }

  /* GENDER */

  let gender =
    getString(
      profile,
      [
        "gender",
        "sex",
      ],
    );

  if (gender) {
    const normalized =
      gender.toLowerCase();

    if (
      normalized === "ชาย" ||
      normalized === "male" ||
      normalized === "m"
    ) {
      gender = "male";
    } else if (
      normalized === "หญิง" ||
      normalized === "female" ||
      normalized === "f"
    ) {
      gender = "female";
    }
  }

  /* HEIGHT */

  const heightCm =
    getNumber(
      profile,
      [
        "height_cm",
        "height",
        "heightCm",
      ],
    );

  /* WEIGHT */

  const weightKg =
    getNumber(
      profile,
      [
        "weight_kg",
        "weight",
        "weightKg",
      ],
    );

  /* WAIST */

  const waistCm =
    getNumber(
      profile,
      [
        "waist_cm",
        "waist",
        "waistCm",
        "waist_circumference",
      ],
    );

  /* BP */

  const systolic =
    getNumber(
      profile,
      [
        "systolic",
        "sbp",
        "systolic_bp",
        "systolic_blood_pressure",
      ],
    );

  const diastolic =
    getNumber(
      profile,
      [
        "diastolic",
        "dbp",
        "diastolic_bp",
        "diastolic_blood_pressure",
      ],
    );

  return {
    age,
    gender,
    heightCm,
    weightKg,
    waistCm,
    systolic,
    diastolic,
  };
}

/* =========================================================
   CALCULATE DIABETES RISK
========================================================= */

function calculateDiabetesRisk(
  age: number,
  gender: "male" | "female",
  heightCm: number,
  weightKg: number,
  waistCm: number,
  systolic: number,
  diastolic: number,
  familyDiabetes: boolean,
) {
  /* BMI */

  const heightMeter =
    heightCm / 100;

  const bmi =
    weightKg /
    (heightMeter *
      heightMeter);

  /* AGE */

  let ageProbability: number;

  if (age < 45) {
    ageProbability =
      -0.0702134;
  } else if (age <= 59) {
    ageProbability =
      0.2718858;
  } else {
    ageProbability =
      0.6043599;
  }

  /* GENDER */

  const genderScore =
    gender === "male"
      ? 2
      : 0;

  const genderProbability =
    0.4422573;

  /* BMI */

  let bmiScore: number;
  let bmiProbability: number;

  if (bmi < 23) {
    bmiScore = 0;
    bmiProbability = 0;
  } else if (bmi < 27.5) {
    bmiScore = 1;
    bmiProbability =
      0.6958621;
  } else {
    bmiScore = 1;
    bmiProbability =
      1.235097;
  }

  /* WAIST */

  const waistHigh =
    gender === "male"
      ? waistCm >= 90
      : waistCm >= 80;

  const waistScore =
    waistHigh ? 1 : 0;

  const waistProbability =
    waistHigh
      ? 0.5567118
      : 0;

  /* BLOOD PRESSURE */

  const bpHigh =
    systolic >= 140 ||
    diastolic >= 90;

  const bpScore =
    bpHigh ? 1 : 0;

  const bpProbability =
    bpHigh
      ? 0.6409517
      : 0;

  /* FAMILY */

  const familyScore =
    familyDiabetes ? 1 : 0;

  const familyProbability =
    1.081356;

  /* C1-C6 */

  const c1 =
    ageProbability;

  const c2 =
    genderScore *
    genderProbability;

  const c3 =
    bmiScore *
    bmiProbability;

  const c4 =
    waistScore *
    waistProbability;

  const c5 =
    bpScore *
    bpProbability;

  const c6 =
    familyScore *
    familyProbability;

  /* SUM */

  const sum =
    c1 +
    c2 +
    c3 +
    c4 +
    c5 +
    c6;

  /* LOGISTIC */

  const x =
    sum - 3.580397;

  const expValue =
    Math.exp(x);

  const risk =
    expValue /
    (1 + expValue);

  let riskPercent =
    risk * 100;

  riskPercent =
    Math.max(
      0,
      Math.min(
        100,
        riskPercent,
      ),
    );

  /* RISK LEVEL */

  let riskLevel: string;

  if (riskPercent < 5) {
    riskLevel = "low";
  } else if (riskPercent < 10) {
    riskLevel = "moderate";
  } else if (riskPercent < 20) {
    riskLevel = "high";
  } else {
    riskLevel = "very_high";
  }

  return {
    bmi: Number(
      bmi.toFixed(2),
    ),

    riskPercent: Number(
      riskPercent.toFixed(2),
    ),

    riskLevel,
  };
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: Request,
) {
  try {
    const url =
      new URL(request.url);

    const assessmentId =
      Number(
        url.searchParams.get(
          "assessmentId",
        ),
      );

    if (
      !Number.isInteger(
        assessmentId,
      ) ||
      assessmentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "assessmentId ไม่ถูกต้อง",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       ASSESSMENT
    ===================================================== */

    const assessmentResult =
      await pool.query<{
        assessment_id: number;
        user_id: number;
        assessment_type_id: number;
        assessment_name: string;

        total_score:
          | number
          | string
          | null;

        risk_level:
          | string
          | null;

        recommendation_id:
          | number
          | null;

        recommendation_text:
          | string
          | null;

        assessed_at: string;
      }>(
        `
        SELECT
          a.assessment_id,
          a.user_id,
          a.assessment_type_id,
          t.assessment_name,
          a.total_score,
          a.risk_level,
          a.recommendation_id,
          r.recommendation_text,
          a.assessed_at

        FROM assessment a

        INNER JOIN assessment_types t
          ON t.assessment_type_id =
             a.assessment_type_id

        LEFT JOIN recommendation r
          ON r.rec_id =
             a.recommendation_id

        WHERE a.assessment_id = $1

          AND t.assessment_name =
              'Diabetes TDS'

        LIMIT 1
        `,
        [assessmentId],
      );

    if (
      (assessmentResult.rowCount ??
        0) === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบผลการประเมินเบาหวาน",
        },
        {
          status: 404,
        },
      );
    }

    const assessment =
      assessmentResult.rows[0];

    /* =====================================================
       PROFILE
    ===================================================== */

    const profileResult =
      await pool.query<{
        profile: Record<
          string,
          unknown
        >;
      }>(
        `
        SELECT
          to_jsonb(hp) AS profile

        FROM health_profile hp

        WHERE hp.user_id = $1

        LIMIT 1
        `,
        [assessment.user_id],
      );

    const profile =
      profileResult.rows[0]
        ?.profile ?? {};

    const profileData =
      extractHealthProfile(
        profile,
      );

    /* =====================================================
       ANSWERS
    ===================================================== */

    const answersResult =
      await pool.query<{
        question_id: number;
        display_order: number;
        question_text: string;

        answer_value:
          | string
          | null;

        score:
          | number
          | null;
      }>(
        `
        SELECT
          q.question_id,
          q.display_order,
          q.question_text,
          aa.answer_value,
          aa.score

        FROM assessment_answers aa

        INNER JOIN questions q
          ON q.question_id =
             aa.question_id

        WHERE aa.assessment_id = $1

        ORDER BY
          q.display_order
        `,
        [assessmentId],
      );

    /* FAMILY */

    const familyAnswer =
      answersResult.rows.find(
        (answer) =>
          answer.display_order === 8,
      );

    const familyDiabetes =
      familyAnswer?.answer_value ===
      "มี";

    /* BP จาก assessment_answers
       ถ้า profile ไม่มี */
    const sbpAnswer =
      answersResult.rows.find(
        (answer) =>
          answer.display_order === 6,
      );

    const dbpAnswer =
      answersResult.rows.find(
        (answer) =>
          answer.display_order === 7,
      );

    const finalSbp =
      profileData.systolic ??
      (sbpAnswer?.answer_value
        ? Number(
            sbpAnswer.answer_value,
          )
        : null);

    const finalDbp =
      profileData.diastolic ??
      (dbpAnswer?.answer_value
        ? Number(
            dbpAnswer.answer_value,
          )
        : null);

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      assessment: {
        assessment_id:
          assessment.assessment_id,

        user_id:
          assessment.user_id,

        age:
          profileData.age,

        gender:
          profileData.gender,

        height_cm:
          profileData.heightCm,

        weight_kg:
          profileData.weightKg,

        bmi:
          profileData.heightCm &&
          profileData.weightKg
            ? Number(
                (
                  profileData.weightKg /
                  Math.pow(
                    profileData.heightCm /
                      100,
                    2,
                  )
                ).toFixed(2),
              )
            : null,

        waist_cm:
          profileData.waistCm,

        sbp:
          finalSbp,

        dbp:
          finalDbp,

        family_diabetes:
          familyDiabetes,

        risk_percent:
          Number(
            assessment.total_score ??
              0,
          ),

        risk_level:
          assessment.risk_level,

        created_at:
          assessment.assessed_at,
      },

      recommendation:
        assessment.recommendation_id
          ? {
              recommendation_id:
                assessment.recommendation_id,

              risk_level:
                assessment.risk_level,

              title:
                "คำแนะนำสำหรับคุณ",

              recommendation:
                assessment.recommendation_text ??
                "",
            }
          : null,

      answers:
        answersResult.rows,
    });
  } catch (error) {
    console.error(
      "GET DIABETES ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถโหลดผลประเมินได้",
      },
      {
        status: 500,
      },
    );
  }
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request,
) {
  const client =
    await pool.connect();

  try {
    const body =
      (await request.json()) as SubmitBody;

    /* =====================================================
       USER
    ===================================================== */

    const userId =
      Number(
        body.userId ??
          body.user_id,
      );

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

    /* =====================================================
       FAMILY
    ===================================================== */

    if (
      typeof body.family_diabetes !==
      "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณาระบุประวัติเบาหวานในครอบครัว",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       BP
       
       สำคัญ:
       รับจากหน้า assessment
       ไม่บังคับว่าต้องอยู่ใน health_profile
    ===================================================== */

    const submittedSbp =
      Number(body.sbp);

    const submittedDbp =
      Number(body.dbp);

    if (
      !Number.isFinite(
        submittedSbp,
      ) ||
      submittedSbp <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณากรอกค่าความดันตัวบน (SBP)",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isFinite(
        submittedDbp,
      ) ||
      submittedDbp <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณากรอกค่าความดันตัวล่าง (DBP)",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       BEGIN
    ===================================================== */

    await client.query("BEGIN");

    /* =====================================================
       USER
    ===================================================== */

    const userResult =
      await client.query(
        `
        SELECT
          user_id

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
      throw new Error(
        `ไม่พบผู้ใช้ user_id ${userId}`,
      );
    }

    /* =====================================================
       PROFILE
    ===================================================== */

    const profileResult =
      await client.query<{
        profile: Record<
          string,
          unknown
        >;
      }>(
        `
        SELECT
          to_jsonb(hp) AS profile

        FROM health_profile hp

        WHERE hp.user_id = $1

        LIMIT 1
        `,
        [userId],
      );

    if (
      (profileResult.rowCount ??
        0) === 0
    ) {
      throw new Error(
        "ไม่พบข้อมูลสุขภาพของผู้ใช้ กรุณากรอกข้อมูลสุขภาพก่อน",
      );
    }

    const profile =
      profileResult.rows[0]
        .profile;

    const profileData =
      extractHealthProfile(
        profile,
      );

    /* =====================================================
       VALIDATE REQUIRED PROFILE
       
       ไม่ตรวจ SBP/DBP จาก profile
    ===================================================== */

    if (
      profileData.age === null
    ) {
      throw new Error(
        "ไม่พบอายุในข้อมูลสุขภาพ",
      );
    }

    if (
      profileData.gender !==
        "male" &&
      profileData.gender !==
        "female"
    ) {
      throw new Error(
        "ไม่พบเพศในข้อมูลสุขภาพ",
      );
    }

    if (
      profileData.heightCm ===
        null ||
      profileData.heightCm <= 0
    ) {
      throw new Error(
        "ไม่พบส่วนสูงในข้อมูลสุขภาพ",
      );
    }

    if (
      profileData.weightKg ===
        null ||
      profileData.weightKg <= 0
    ) {
      throw new Error(
        "ไม่พบน้ำหนักในข้อมูลสุขภาพ",
      );
    }

    if (
      profileData.waistCm ===
        null ||
      profileData.waistCm <= 0
    ) {
      throw new Error(
        "ไม่พบรอบเอวในข้อมูลสุขภาพ",
      );
    }

    /* =====================================================
       USE BP FROM PAGE
    ===================================================== */

    const systolic =
      submittedSbp;

    const diastolic =
      submittedDbp;

    /* =====================================================
       ASSESSMENT TYPE
    ===================================================== */

    const typeResult =
      await client.query<{
        assessment_type_id: number;
      }>(
        `
        SELECT
          assessment_type_id

        FROM assessment_types

        WHERE assessment_name =
              'Diabetes TDS'

          AND is_active = TRUE

        LIMIT 1
        `,
      );

    if (
      (typeResult.rowCount ??
        0) === 0
    ) {
      throw new Error(
        "ไม่พบ Assessment Type: Diabetes TDS",
      );
    }

    const assessmentTypeId =
      typeResult.rows[0]
        .assessment_type_id;

    /* =====================================================
       QUESTIONS
    ===================================================== */

    const questionResult =
      await client.query<QuestionRow>(
        `
        SELECT
          question_id,
          question_text,
          display_order

        FROM questions

        WHERE assessment_type_id =
              $1

          AND is_active = TRUE

        ORDER BY
          display_order
        `,
        [assessmentTypeId],
      );

    if (
      questionResult.rows.length <
      8
    ) {
      throw new Error(
        "คำถาม Diabetes TDS ในฐานข้อมูลไม่ครบ 8 ข้อ",
      );
    }

    /* =====================================================
       CALCULATE
    ===================================================== */

    const result =
      calculateDiabetesRisk(
        profileData.age,
        profileData.gender,
        profileData.heightCm,
        profileData.weightKg,
        profileData.waistCm,
        systolic,
        diastolic,
        body.family_diabetes,
      );

    /* =====================================================
       RECOMMENDATION
    ===================================================== */

    const recommendationResult =
      await client.query<{
        rec_id: number;

        recommendation_text:
          | string
          | null;
      }>(
        `
        SELECT
          rec_id,
          recommendation_text

        FROM recommendation

        WHERE assessment_type_id =
              $1

          AND risk_level = $2

        LIMIT 1
        `,
        [
          assessmentTypeId,
          result.riskLevel,
        ],
      );

    const recommendation =
      recommendationResult.rows[0] ??
      null;

    /* =====================================================
       INSERT ASSESSMENT
    ===================================================== */

    const assessmentResult =
      await client.query<{
        assessment_id: number;
      }>(
        `
        INSERT INTO assessment (
          user_id,
          assessment_type_id,
          recommendation_id,
          total_score,
          risk_level
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )

        RETURNING
          assessment_id
        `,
        [
          userId,

          assessmentTypeId,

          recommendation?.rec_id ??
            null,

          result.riskPercent,

          result.riskLevel,
        ],
      );

    const assessmentId =
      assessmentResult.rows[0]
        .assessment_id;

    /* =====================================================
       INSERT ANSWER
    ===================================================== */

    async function insertAnswer(
      displayOrder: number,
      value: string,
      score = 0,
    ) {
      const question =
        questionResult.rows.find(
          (q) =>
            q.display_order ===
            displayOrder,
        );

      if (!question) {
        throw new Error(
          `ไม่พบคำถามลำดับ ${displayOrder}`,
        );
      }

      await client.query(
        `
        INSERT INTO assessment_answers (
          assessment_id,
          question_id,
          choice_id,
          answer_value,
          score
        )

        VALUES (
          $1,
          $2,
          NULL,
          $3,
          $4
        )
        `,
        [
          assessmentId,
          question.question_id,
          value,
          score,
        ],
      );
    }

    /* =====================================================
       SAVE 8 ANSWERS
    ===================================================== */

    await insertAnswer(
      1,
      String(
        profileData.age,
      ),
    );

    await insertAnswer(
      2,
      profileData.gender,
    );

    await insertAnswer(
      3,
      String(
        profileData.heightCm,
      ),
    );

    await insertAnswer(
      4,
      String(
        profileData.weightKg,
      ),
    );

    await insertAnswer(
      5,
      String(
        profileData.waistCm,
      ),
    );

    await insertAnswer(
      6,
      String(systolic),
    );

    await insertAnswer(
      7,
      String(diastolic),
    );

    await insertAnswer(
      8,
      body.family_diabetes
        ? "มี"
        : "ไม่มี",
    );

    /* =====================================================
       COMMIT
    ===================================================== */

    await client.query("COMMIT");

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        message:
          "บันทึกผลการประเมินเบาหวานเรียบร้อย",

        assessment: {
          assessment_id:
            assessmentId,

          user_id:
            userId,

          age:
            profileData.age,

          gender:
            profileData.gender,

          height_cm:
            profileData.heightCm,

          weight_kg:
            profileData.weightKg,

          waist_cm:
            profileData.waistCm,

          sbp:
            systolic,

          dbp:
            diastolic,

          bmi:
            result.bmi,

          family_diabetes:
            body.family_diabetes,

          risk_percent:
            result.riskPercent,

          risk_level:
            result.riskLevel,
        },

        recommendation:
          recommendation?.recommendation_text ??
          "ยังไม่มีคำแนะนำสำหรับระดับความเสี่ยงนี้",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK",
      );
    } catch {}

    console.error(
      "POST DIABETES ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถบันทึกผลประเมินได้",
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}