import pool from "@/lib/db";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import {
  badRequest,
  readJsonObject,
  toIntInRange,
  userExists,
} from "../_lib/validate";
import { logSystemError } from "@/lib/errorLogger";
import { rejectIfAssessmentClosed } from "../_lib/assessmentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

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

/*
  ตาราง recommendation เก็บระดับเป็นภาษาไทยตามเอกสารอ้างอิง (ตารางที่ 7)
  ส่วน risk_level ใน assessment ยังเก็บเป็นคีย์อังกฤษเพราะหน้าเว็บใช้อยู่
*/
const RECOMMENDATION_LEVEL: Record<string, string> = {
  low: "เสี่ยงน้อย",
  moderate: "เสี่ยงปานกลาง",
  high: "เสี่ยงสูง",
  very_high: "เสี่ยงสูงมาก",
};

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: Request,
) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;

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

        -- คำแนะนำฉบับที่ใช้อยู่ตอนทำแบบประเมิน (staff แก้ภายหลังไม่กระทบผลเก่า)
        LEFT JOIN LATERAL recommendation_at(a.recommendation_id, a.assessed_at) r
          ON TRUE

        WHERE a.assessment_id = $1

          AND t.assessment_name =
              'Diabetes TDS'

          AND a.user_id = $2

        LIMIT 1
        `,
        [assessmentId, auth.userId],
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
       ANSWERS
       POST บันทึกค่าที่ใช้คำนวณไว้ใน assessment_answers
       ตาม display_order:
       1 อายุ, 2 เพศ (male/female), 3 ส่วนสูง, 4 น้ำหนัก,
       5 รอบเอว, 6 SBP, 7 DBP, 8 ประวัติครอบครัว (มี/ไม่มี)
       ผลเก่าต้องแสดงค่าตอนประเมิน ไม่ใช่ค่าใน health_profile ปัจจุบัน
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

    const answerText = (displayOrder: number) => {
      const value = answersResult.rows.find(
        (answer) =>
          answer.display_order === displayOrder,
      )?.answer_value;

      return value === null ||
        value === undefined ||
        value.trim() === ""
        ? null
        : value.trim();
    };

    const answerNumber = (displayOrder: number) => {
      const value = Number(answerText(displayOrder) ?? NaN);
      return Number.isFinite(value) ? value : null;
    };

    /* =====================================================
       PROFILE (สำรอง ใช้เฉพาะค่าที่ไม่มีในคำตอบ)
    ===================================================== */

    let profileCache:
      | ReturnType<typeof extractHealthProfile>
      | null = null;

    const getProfile = async () => {
      if (!profileCache) {
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

        profileCache = extractHealthProfile(
          profileResult.rows[0]?.profile ?? {},
        );
      }

      return profileCache;
    };

    const savedGender = answerText(2);

    const age =
      answerNumber(1) ?? (await getProfile()).age;
    const gender =
      savedGender === "male" || savedGender === "female"
        ? savedGender
        : (await getProfile()).gender;
    const heightCm =
      answerNumber(3) ?? (await getProfile()).heightCm;
    const weightKg =
      answerNumber(4) ?? (await getProfile()).weightKg;
    const waistCm =
      answerNumber(5) ?? (await getProfile()).waistCm;
    const finalSbp =
      answerNumber(6) ?? (await getProfile()).systolic;
    const finalDbp =
      answerNumber(7) ?? (await getProfile()).diastolic;

    /* FAMILY */

    const familyDiabetes =
      answerText(8) === "มี";

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

        age,

        gender,

        height_cm:
          heightCm,

        weight_kg:
          weightKg,

        bmi:
          heightCm && weightKg
            ? Number(
                (
                  weightKg /
                  Math.pow(
                    heightCm / 100,
                    2,
                  )
                ).toFixed(2),
              )
            : null,

        waist_cm:
          waistCm,

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
    void logSystemError("GET /api/assessments/diabetes", error);
    console.error(
      "GET DIABETES ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        message: "ไม่สามารถโหลดผลประเมินได้",
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
  const body =
    await readJsonObject(request);

  if (!body) {
    return badRequest(
      "รูปแบบข้อมูลไม่ถูกต้อง",
    );
  }

  /* =====================================================
     USER
     ผู้ใช้มาจาก session เท่านั้น (userId ที่ส่งมาต้องตรงกับ session)
  ===================================================== */

  const auth = requireUser(
    request,
    body.userId ?? body.user_id,
  );

  if (!auth.ok) return auth.response;

  // staff ปิดแบบประเมินนี้อยู่ ไม่รับผลใหม่
  const closed = await rejectIfAssessmentClosed(4);
  if (closed) return closed;

  const userId = auth.userId;

  /* =====================================================
     FAMILY
  ===================================================== */

  if (
    typeof body.family_diabetes !==
    "boolean"
  ) {
    return badRequest(
      "กรุณาระบุประวัติเบาหวานในครอบครัว",
    );
  }

  const familyDiabetes =
    body.family_diabetes;

  /* =====================================================
     BP
     รับจากหน้า assessment (จำนวนเต็ม mmHg)
     SBP 60-250, DBP 30-150 และตัวบนต้องสูงกว่าตัวล่าง
  ===================================================== */

  const submittedSbp =
    toIntInRange(body.sbp, 60, 250);

  const submittedDbp =
    toIntInRange(body.dbp, 30, 150);

  if (submittedSbp === null) {
    return badRequest(
      "ค่าความดันตัวบน (SBP) ต้องเป็นจำนวนเต็ม 60-250 mmHg",
    );
  }

  if (submittedDbp === null) {
    return badRequest(
      "ค่าความดันตัวล่าง (DBP) ต้องเป็นจำนวนเต็ม 30-150 mmHg",
    );
  }

  if (submittedSbp <= submittedDbp) {
    return badRequest(
      "ค่าความดันตัวบนต้องมากกว่าค่าความดันตัวล่าง",
    );
  }

  const client =
    await pool.connect();

  try {
    if (
      !(await userExists(
        client,
        userId,
      ))
    ) {
      return badRequest(
        "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่",
      );
    }

    /* =====================================================
       PROFILE
       ข้อมูลไม่ครบ = ผู้ใช้ต้องไปกรอกก่อน (400 ไม่ใช่ 500)
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
      return badRequest(
        "ไม่พบข้อมูลสุขภาพของผู้ใช้ กรุณากรอกข้อมูลสุขภาพก่อน",
      );
    }

    const profileData =
      extractHealthProfile(
        profileResult.rows[0]
          .profile,
      );

    const { age, gender, heightCm, weightKg, waistCm } =
      profileData;

    if (age === null || age <= 0) {
      return badRequest(
        "ไม่พบอายุในข้อมูลสุขภาพ",
      );
    }

    if (
      gender !== "male" &&
      gender !== "female"
    ) {
      return badRequest(
        "ไม่พบเพศในข้อมูลสุขภาพ",
      );
    }

    if (
      heightCm === null ||
      heightCm <= 0
    ) {
      return badRequest(
        "ไม่พบส่วนสูงในข้อมูลสุขภาพ",
      );
    }

    if (
      weightKg === null ||
      weightKg <= 0
    ) {
      return badRequest(
        "ไม่พบน้ำหนักในข้อมูลสุขภาพ",
      );
    }

    if (
      waistCm === null ||
      waistCm <= 0
    ) {
      return badRequest(
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
        age,
        gender,
        heightCm,
        weightKg,
        waistCm,
        systolic,
        diastolic,
        familyDiabetes,
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
          RECOMMENDATION_LEVEL[result.riskLevel] ??
            result.riskLevel,
        ],
      );

    const recommendation =
      recommendationResult.rows[0] ??
      null;

    /* =====================================================
       INSERT ASSESSMENT
    ===================================================== */

    await client.query("BEGIN");

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
        age,
      ),
    );

    await insertAnswer(
      2,
      gender,
    );

    await insertAnswer(
      3,
      String(
        heightCm,
      ),
    );

    await insertAnswer(
      4,
      String(
        weightKg,
      ),
    );

    await insertAnswer(
      5,
      String(
        waistCm,
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
      familyDiabetes
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
            age,

          gender:
            gender,

          height_cm:
            heightCm,

          weight_kg:
            weightKg,

          waist_cm:
            waistCm,

          sbp:
            systolic,

          dbp:
            diastolic,

          bmi:
            result.bmi,

          family_diabetes:
            familyDiabetes,

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
    void logSystemError("POST /api/assessments/diabetes", error);
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

        message: "ไม่สามารถบันทึกผลประเมินได้",
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}