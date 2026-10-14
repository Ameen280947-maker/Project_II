import pool from "@/lib/db";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { logSystemError } from "@/lib/errorLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// แปลงค่าคำตอบภาษาอังกฤษเป็นข้อความไทยสำหรับแสดงผล
const VALUE_LABELS: Record<string, string> = {
  male: "ชาย",
  female: "หญิง",
};

// แถวคำตอบจาก SQL พร้อมคะแนนเต็มของข้อ
type AnswerRow = {
  question_id: number;
  question_text: string;
  question_type: string | null;
  answer_value: string | null;
  choice_text: string | null;
  score: string | number | null;
  max_score: string | number | null;
};

// API: ดึงคำถามและคำตอบที่ผู้ใช้ตอบไว้ในผลประเมิน assessmentId
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const auth = requireUser(request, url.searchParams.get("userId"));
    if (!auth.ok) return auth.response;

    const assessmentId = Number(url.searchParams.get("assessmentId"));

    if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
      return NextResponse.json(
        { success: false, message: "assessmentId ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    // ตรวจว่าผลประเมินนี้เป็นของผู้ใช้จริง
    const owner = await pool.query(
      `SELECT 1 FROM assessment WHERE assessment_id = $1 AND user_id = $2`,
      [assessmentId, auth.userId],
    );

    if ((owner.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { success: false, message: "ไม่พบผลการประเมิน" },
        { status: 404 },
      );
    }

    // ดึงคำถาม คำตอบ และคะแนน แล้วแปลงเป็นรูปแบบแสดงผล
    const result = await pool.query<AnswerRow>(
      `
      SELECT
        q.question_id,
        q.question_text,
        q.question_type,
        aa.answer_value,
        c.choice_text,
        aa.score,
        -- คะแนนเต็มของข้อ = คะแนนสูงสุดในตัวเลือกของข้อนั้น (ข้อที่กรอกตัวเลขจะเป็น null)
        (SELECT MAX(c2.score) FROM question_choices c2 WHERE c2.question_id = q.question_id) AS max_score
      FROM assessment_answers aa
      JOIN questions q
        ON q.question_id = aa.question_id
      LEFT JOIN question_choices c
        ON c.choice_id = aa.choice_id
      WHERE aa.assessment_id = $1
      ORDER BY q.display_order, aa.answer_id
      `,
      [assessmentId],
    );

    const answers = result.rows.map((row) => {
      const raw = row.answer_value?.trim() ?? "";

      return {
        questionId: row.question_id,
        question: row.question_text,
        answer: row.choice_text || VALUE_LABELS[raw.toLowerCase()] || raw || "-",
        score: row.score === null ? null : Number(row.score),
        maxScore: row.max_score === null ? null : Number(row.max_score),
      };
    });

    return NextResponse.json({ success: true, answers });
  } catch (error) {
    void logSystemError("GET /api/history/answers", error);
    console.error("GET ASSESSMENT ANSWERS ERROR:", error);

    return NextResponse.json(
      { success: false, message: "ไม่สามารถโหลดคำตอบได้" },
      { status: 500 },
    );
  }
}
