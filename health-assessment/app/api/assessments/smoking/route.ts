import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

/* =========================================================
   DATABASE
========================================================= */

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database:
    process.env.DB_NAME || "health_assessment",
  waitForConnections: true,
  connectionLimit: 10,
});

/* =========================================================
   GET
   โหลดคำถามแบบประเมินการสูบบุหรี่
========================================================= */

export async function GET() {
  try {
    /*
     * ส่วนนี้ใช้สำหรับกรณีที่คุณมีตารางคำถาม
     *
     * ถ้าฐานข้อมูลของคุณใช้ชื่อ table/column
     * แตกต่างจากนี้ ให้เปลี่ยนเฉพาะ SQL ตรงนี้
     */

    const [rows] = await pool.query(
      `
      SELECT
        question_id,
        question_text,
        option_text,
        option_score
      FROM smoking_questions
      ORDER BY question_id ASC, option_score ASC
      `
    );

    const data =
      rows as Array<{
        question_id: number;
        question_text: string;
        option_text: string;
        option_score: number;
      }>;

    const questionMap =
      new Map<number, {
        id: number;
        question: string;
        options: string[];
      }>();

    for (const row of data) {
      if (!questionMap.has(row.question_id)) {
        questionMap.set(
          row.question_id,
          {
            id: row.question_id,
            question:
              row.question_text,
            options: [],
          }
        );
      }

      questionMap
        .get(row.question_id)!
        .options.push(
          row.option_text
        );
    }

    return NextResponse.json({
      success: true,
      questions:
        Array.from(
          questionMap.values()
        ),
    });
  } catch (error) {
    console.error(
      "GET SMOKING ASSESSMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "ไม่สามารถโหลดแบบประเมินการสูบบุหรี่ได้",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   บันทึกผลการประเมิน
========================================================= */

export async function POST(
  request: NextRequest
) {
  let connection:
    | mysql.PoolConnection
    | null = null;

  try {
    const body =
      await request.json();

    const userId =
      Number(body.userId);

    const answers =
      body.answers;

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบข้อมูลผู้ใช้งาน",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !answers ||
      typeof answers !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบคำตอบแบบประเมิน",
        },
        {
          status: 400,
        }
      );
    }

    connection =
      await pool.getConnection();

    await connection.beginTransaction();

    /*
     * ดึงคำตอบพร้อมคะแนน
     */

    const questionIds =
      Object.keys(answers)
        .map(Number)
        .filter(
          (id) =>
            Number.isInteger(id)
        );

    if (
      questionIds.length === 0
    ) {
      throw new Error(
        "ไม่พบคำตอบ"
      );
    }

    const placeholders =
      questionIds
        .map(() => "?")
        .join(",");

    const [rows] =
      await connection.query(
        `
        SELECT
          question_id,
          option_text,
          option_score
        FROM smoking_questions
        WHERE question_id IN (${placeholders})
        `,
        questionIds
      );

    const answerRows =
      rows as Array<{
        question_id: number;
        option_text: string;
        option_score: number;
      }>;

    let totalScore = 0;

    for (
      const questionId of questionIds
    ) {
      const selectedAnswer =
        String(
          answers[
            questionId
          ]
        );

      const matched =
        answerRows.find(
          (row) =>
            Number(
              row.question_id
            ) === questionId &&
            row.option_text ===
              selectedAnswer
        );

      if (matched) {
        totalScore += Number(
          matched.option_score
        );
      }
    }

    /*
     * ตัวอย่างการแปลผล
     * สามารถเปลี่ยนเกณฑ์ตามแบบประเมินจริงของคุณ
     */

    let riskLevel =
      "ความเสี่ยงต่ำ";

    if (totalScore >= 6) {
      riskLevel =
        "ความเสี่ยงสูง";
    } else if (
      totalScore >= 3
    ) {
      riskLevel =
        "ความเสี่ยงปานกลาง";
    }

    /*
     * บันทึก assessment
     *
     * ตรวจสอบให้ table assessments
     * มี column ตามนี้
     */

    const [
      assessmentResult,
    ] = await connection.query(
      `
      INSERT INTO assessments
      (
        user_id,
        assessment_type_id,
        total_score,
        risk_level,
        assessed_at
      )
      VALUES (?, ?, ?, ?, NOW())
      `,
      [
        userId,

        /*
         * เปลี่ยน 5 เป็น assessment_type_id
         * ของ Smoking ในฐานข้อมูลจริงของคุณ
         */
        5,

        totalScore,
        riskLevel,
      ]
    );

    const result =
      assessmentResult as mysql.ResultSetHeader;

    const assessmentId =
      result.insertId;

    /*
     * บันทึกคำตอบแต่ละข้อ
     */

    for (
      const questionId of questionIds
    ) {
      const selectedAnswer =
        String(
          answers[
            questionId
          ]
        );

      const matched =
        answerRows.find(
          (row) =>
            Number(
              row.question_id
            ) === questionId &&
            row.option_text ===
              selectedAnswer
        );

      await connection.query(
        `
        INSERT INTO assessment_answers
        (
          assessment_id,
          question_id,
          answer_text,
          score
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          assessmentId,
          questionId,
          selectedAnswer,
          matched
            ? Number(
                matched.option_score
              )
            : 0,
        ]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      assessment_id:
        assessmentId,
      total_score:
        totalScore,
      risk_level:
        riskLevel,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error(
      "POST SMOKING ASSESSMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "ไม่สามารถบันทึกผลการประเมินได้",
      },
      {
        status: 500,
      }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}