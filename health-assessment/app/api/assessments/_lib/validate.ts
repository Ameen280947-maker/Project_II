import { NextResponse } from "next/server";
import type { Pool, PoolClient } from "pg";

// ตัวเชื่อมต่อ DB: pool หรือ client ใน transaction
type Db = Pool | PoolClient;

// สร้าง response JSON แจ้งข้อผิดพลาด (ค่าเริ่มต้น 400) พร้อมข้อความ
export function badRequest(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

// อ่าน body ของ request เป็น JSON object คืน null ถ้า parse ไม่ได้หรือไม่ใช่ object
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// แปลงค่า number/string เป็นตัวเลขที่ finite คืน null ถ้าแปลงไม่ได้
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// แปลงเป็นจำนวนเต็มที่อยู่ในช่วง min–max ไม่งั้นคืน null
export function toIntInRange(value: unknown, min: number, max: number): number | null {
  const n = toNumber(value);
  return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// แปลงเป็นตัวเลข (ทศนิยมได้) ที่อยู่ในช่วง min–max ไม่งั้นคืน null
export function toNumberInRange(value: unknown, min: number, max: number): number | null {
  const n = toNumber(value);
  return n !== null && n >= min && n <= max ? n : null;
}

// แปลงเป็น ID จำนวนเต็มบวก ไม่งั้นคืน null
export function toId(value: unknown): number | null {
  return toIntInRange(value, 1, Number.MAX_SAFE_INTEGER);
}

// ตรวจว่ามีผู้ใช้ user_id นี้ในตาราง users หรือไม่
export async function userExists(db: Db, userId: number) {
  const result = await db.query("SELECT 1 FROM users WHERE user_id = $1 LIMIT 1", [userId]);
  return (result.rowCount ?? 0) > 0;
}

// ตัวเลือกคำตอบหนึ่งแถวจาก DB พร้อมคะแนนและลำดับข้อ
export type ChoiceRow = {
  choice_id: number;
  question_id: number;
  choice_text: string;
  score: number;
  display_order: number;
};

// ดึงตัวเลือกคำตอบที่ใช้งานอยู่ทั้งหมดของแบบประเมิน (question_choices + questions)
export async function loadActiveChoices(db: Db, assessmentTypeId: number): Promise<ChoiceRow[]> {
  const { rows } = await db.query(
    `
    SELECT
      qc.choice_id,
      qc.question_id,
      qc.choice_text,
      qc.score,
      q.display_order
    FROM question_choices qc
    INNER JOIN questions q
      ON q.question_id = qc.question_id
    WHERE q.assessment_type_id = $1
      AND q.is_active = TRUE
      AND qc.is_active = TRUE
    `,
    [assessmentTypeId],
  );

  return rows.map((row) => ({
    choice_id: Number(row.choice_id),
    question_id: Number(row.question_id),
    choice_text: String(row.choice_text ?? ""),
    score: Number(row.score ?? 0),
    display_order: Number(row.display_order),
  }));
}

// คำตอบที่ผู้ใช้ส่งมา (อ้างด้วย choiceId หรือ choiceText)
export type SubmittedChoice = {
  questionId: unknown;
  choiceId?: unknown;
  choiceText?: unknown;
};

// ผลการตรวจคำตอบ: สำเร็จ (ตัวเลือกที่เลือก + คะแนนรวม) หรือข้อความ error
export type ResolvedAnswers =
  | { ok: true; picked: ChoiceRow[]; total: number }
  | { ok: false; message: string };

// ตรวจคำตอบที่ส่งมาให้ตรงกับตัวเลือกในฐานข้อมูล ครบทุกข้อและไม่ซ้ำ แล้วรวมคะแนน
export function resolveChoiceAnswers(
  choices: ChoiceRow[],
  submitted: SubmittedChoice[],
  skippedIds: ReadonlySet<number> = new Set(),
): ResolvedAnswers {
  const requiredIds = new Set(
    choices.map((c) => c.question_id).filter((id) => !skippedIds.has(id)),
  );

  if (requiredIds.size === 0) {
    return { ok: false, message: "ไม่พบคำถามของแบบประเมินนี้" };
  }

  // ตรวจคำตอบทีละข้อ: questionId ถูกต้อง ไม่ซ้ำ และตัวเลือกมีอยู่จริง
  const picked = new Map<number, ChoiceRow>();

  for (const item of submitted) {
    if (!item || typeof item !== "object") {
      return { ok: false, message: "ข้อมูลคำตอบไม่ถูกต้อง" };
    }

    const questionId = toId(item.questionId);

    if (questionId === null) {
      return { ok: false, message: "ข้อมูลคำตอบไม่ถูกต้อง" };
    }

    if (!requiredIds.has(questionId)) {
      return { ok: false, message: `คำถามรหัส ${questionId} ไม่อยู่ในแบบประเมินนี้` };
    }

    if (picked.has(questionId)) {
      return { ok: false, message: "มีคำตอบซ้ำสำหรับคำถามข้อเดียวกัน" };
    }

    let choice: ChoiceRow | undefined;

    if (item.choiceId !== undefined && item.choiceId !== null) {
      const choiceId = toId(item.choiceId);
      choice =
        choiceId === null
          ? undefined
          : choices.find((c) => c.question_id === questionId && c.choice_id === choiceId);
    } else if (typeof item.choiceText === "string") {
      const text = item.choiceText.trim();
      choice = choices.find((c) => c.question_id === questionId && c.choice_text.trim() === text);
    }

    if (!choice) {
      return { ok: false, message: "ตัวเลือกคำตอบไม่ถูกต้อง" };
    }

    picked.set(questionId, choice);
  }

  // ต้องตอบครบทุกข้อ แล้วเรียงตามลำดับข้อและรวมคะแนน
  if (picked.size !== requiredIds.size) {
    return { ok: false, message: "กรุณาตอบคำถามให้ครบทุกข้อ" };
  }

  const ordered = [...picked.values()].sort(
    (a, b) => a.display_order - b.display_order || a.question_id - b.question_id,
  );

  return {
    ok: true,
    picked: ordered,
    total: ordered.reduce((sum, c) => sum + c.score, 0),
  };
}
