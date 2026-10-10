import { NextResponse } from "next/server";
import type { Pool, PoolClient } from "pg";

/* =========================================================
   ตัวช่วยตรวจข้อมูลที่ใช้ร่วมกันใน /api/assessments/*

   - ไฟล์นี้ไม่ import pool เพื่อให้ทดสอบฟังก์ชันคำนวณแบบ offline ได้
   - คะแนนคิดจาก question_choices ในฐานข้อมูลเสมอ
     ไม่เชื่อคะแนนที่หน้าเว็บส่งมา
========================================================= */

type Db = Pool | PoolClient;

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

/* ---------- อ่าน body ---------- */

// JSON เสีย หรือไม่ใช่ object → null (ให้ route ตอบ 400 แทน 500)
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

/* ---------- ตรวจตัวเลข ---------- */

// รับเฉพาะตัวเลขหรือข้อความตัวเลข (ไม่รับ true/false/""/null ที่ Number() แปลงเป็น 0/1)
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// จำนวนเต็มในช่วง [min, max] ไม่งั้น null (ทศนิยมไม่ผ่าน)
export function toIntInRange(value: unknown, min: number, max: number): number | null {
  const n = toNumber(value);
  return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// ตัวเลข (มีทศนิยมได้) ในช่วง [min, max] ไม่งั้น null
export function toNumberInRange(value: unknown, min: number, max: number): number | null {
  const n = toNumber(value);
  return n !== null && n >= min && n <= max ? n : null;
}

// id ในฐานข้อมูล (จำนวนเต็มบวก)
export function toId(value: unknown): number | null {
  return toIntInRange(value, 1, Number.MAX_SAFE_INTEGER);
}

/* ---------- ผู้ใช้ ---------- */

export async function userExists(db: Db, userId: number) {
  const result = await db.query("SELECT 1 FROM users WHERE user_id = $1 LIMIT 1", [userId]);
  return (result.rowCount ?? 0) > 0;
}

/* =========================================================
   คำตอบแบบเลือกตอบ
========================================================= */

export type ChoiceRow = {
  choice_id: number;
  question_id: number;
  choice_text: string;
  score: number;
  display_order: number; // ลำดับของ "คำถาม"
};

// ตัวเลือกที่ใช้งานอยู่ของคำถามที่ใช้งานอยู่ในแบบประเมินนี้
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

export type SubmittedChoice = {
  questionId: unknown;
  choiceId?: unknown;
  choiceText?: unknown;
};

export type ResolvedAnswers =
  | { ok: true; picked: ChoiceRow[]; total: number }
  | { ok: false; message: string };

/*
  จับคู่คำตอบกับตัวเลือกจริงในฐานข้อมูล แล้วรวมคะแนนจากฐานข้อมูล
  - ถ้าส่ง choiceId มา ใช้ choiceId (ไม่งั้นใช้ choiceText ที่ตรงกันทุกตัวอักษร)
  - ปฏิเสธ: คำถามของแบบประเมินอื่น, ตอบข้อเดียวกันซ้ำ, ตัวเลือกที่ไม่มีจริง
  - ต้องตอบครบทุกคำถามที่ใช้งานอยู่ ยกเว้นข้อใน skippedIds (ข้อที่ถูกข้ามตามเงื่อนไข)
  picked เรียงตามลำดับคำถาม
*/
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
