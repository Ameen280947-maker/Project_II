import type { PoolClient } from "pg";
import pool from "@/lib/db";
import { EXCLUDED_TYPES, TYPE_LABELS, severityForRank, severityOf } from "@/lib/staff/riskLevels";

// ชื่อแบบประเมินหลักที่มีในระบบตั้งแต่แรก (ไม่ใช่ที่เจ้าหน้าที่สร้างเอง)
export const BUILT_IN = new Set([...Object.keys(TYPE_LABELS), ...EXCLUDED_TYPES]);

// โครง snapshot ของแบบประเมินหนึ่งเวอร์ชัน: ตัวเลือก คำถาม ระดับผล และข้อมูลทั่วไป
export type SnapChoice = { id?: number; text: string; score: number };
export type SnapQuestion = { id?: number; text: string; type: "choice" | "number"; choices: SnapChoice[] };
export type SnapLevel = {
  id?: number;
  riskLevel: string;
  min: number | null;
  max: number | null;
  severity: number;
  text: string;
  reassessDays: number | null;
  hotline: string;
  source: string;
};
export type Snapshot = {
  name: string;
  description: string;
  source: string;
  generic: boolean;
  questions: SnapQuestion[];
  levels: SnapLevel[];
};

// อะไรก็ได้ที่มีเมธอด query
type Db = Pick<PoolClient, "query">;

// ขีดจำกัดจำนวนคำถาม ตัวเลือก และระดับผล
export const LIMITS = { questions: 60, choices: 20, levels: 20, genericLevels: [2, 8] as const };

// อ่านเนื้อหาปัจจุบันของแบบประเมิน (คำถาม ตัวเลือก เกณฑ์ผล คำแนะนำ) จาก DB มาประกอบเป็น snapshot
export async function buildSnapshot(db: Db, typeId: number): Promise<Snapshot | null> {
  // ดึงข้อมูลแบบประเมิน คำถาม ตัวเลือก และคำแนะนำจาก DB พร้อมกัน
  const [t, q, c, r] = await Promise.all([
    db.query("SELECT assessment_name, description, source FROM assessment_types WHERE assessment_type_id = $1", [typeId]),
    db.query(
      `SELECT question_id, question_text, question_type FROM questions
        WHERE assessment_type_id = $1 AND is_active ORDER BY display_order, question_id`,
      [typeId]
    ),
    db.query(
      `SELECT c.choice_id, c.question_id, c.choice_text, c.score
         FROM question_choices c JOIN questions q USING (question_id)
        WHERE q.assessment_type_id = $1 AND q.is_active AND c.is_active
        ORDER BY c.display_order, c.score, c.choice_id`,
      [typeId]
    ),
    db.query(
      `SELECT rec_id, risk_level, min_score, max_score, recommendation_text, reassess_days, hotline, source
         FROM recommendation WHERE assessment_type_id = $1 ORDER BY min_score NULLS LAST, rec_id`,
      [typeId]
    ),
  ]);
  const type = t.rows[0];
  if (!type) return null;
  const name: string = type.assessment_name;
  const generic = r.rows.every((x) => x.min_score !== null && x.max_score !== null);

  // แปลงแถวคำแนะนำเป็นระดับผล (generic = ทุกระดับมีช่วงคะแนน)
  const levels: SnapLevel[] = r.rows.map((x, i) => ({
    id: x.rec_id,
    riskLevel: x.risk_level ?? "",
    min: x.min_score === null ? null : Number(x.min_score),
    max: x.max_score === null ? null : Number(x.max_score),
    severity: generic ? severityForRank(i, r.rows.length) : severityOf(name, x.risk_level),
    text: x.recommendation_text ?? "",
    reassessDays: x.reassess_days ?? null,
    hotline: x.hotline ?? "",
    source: x.source ?? "",
  }));
  if (!generic) levels.sort((a, b) => a.severity - b.severity);

  return {
    name,
    description: type.description ?? "",
    source: type.source ?? "",
    generic,
    questions: q.rows.map((x) => ({
      id: x.question_id,
      text: x.question_text ?? "",
      type: x.question_type === "number" ? "number" : "choice",
      choices: c.rows
        .filter((ch) => ch.question_id === x.question_id)
        .map((ch) => ({ id: ch.choice_id, text: ch.choice_text ?? "", score: Number(ch.score) })),
    })),
    levels,
  };
}

// สร้างเวอร์ชันตั้งต้น (version 1) ใน assessment_versions ให้แบบประเมินที่ยังไม่เคยเผยแพร่
export async function ensureBaselines(typeIds: number[]) {
  if (!typeIds.length) return;
  const { rows } = await pool.query(
    `SELECT t.assessment_type_id AS id FROM assessment_types t
      WHERE t.assessment_type_id = ANY($1)
        AND NOT EXISTS (SELECT 1 FROM assessment_versions v
                         WHERE v.assessment_type_id = t.assessment_type_id AND v.status = 'published')
        AND (EXISTS (SELECT 1 FROM questions q WHERE q.assessment_type_id = t.assessment_type_id AND q.is_active)
          OR EXISTS (SELECT 1 FROM recommendation r WHERE r.assessment_type_id = t.assessment_type_id))`,
    [typeIds]
  );
  for (const { id } of rows) {
    const snap = await buildSnapshot(pool, id);
    if (!snap) continue;
    await pool.query(
      `INSERT INTO assessment_versions (assessment_type_id, version_no, status, snapshot, published_by, published_at)
       SELECT $1, 1, 'published', $2::jsonb, NULL, NOW()
        WHERE NOT EXISTS (SELECT 1 FROM assessment_versions WHERE assessment_type_id = $1 AND status = 'published')
       ON CONFLICT DO NOTHING`,
      [id, JSON.stringify(snap)]
    );
  }
}

// แปลงค่าเป็นข้อความตัดช่องว่างและจำกัดความยาว
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
// แปลงค่าเป็นจำนวนเต็ม หรือ null ถ้าว่าง/ไม่ใช่ตัวเลข
const intOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
// คืน id ถ้าเป็นจำนวนเต็มบวก ไม่งั้น undefined (ถือเป็นรายการใหม่)
const idOf = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

// ทำความสะอาดและตรวจ snapshot ที่ส่งมาจาก client (จำนวน คะแนน รอบประเมินซ้ำ) คืน snapshot หรือข้อความ error
export function normalizeSnapshot(raw: unknown, base: { name: string; generic: boolean }): Snapshot | string {
  const s = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(s.questions) || !Array.isArray(s.levels)) return "ข้อมูลไม่ถูกต้อง";
  if (s.questions.length > LIMITS.questions) return "คำถามมากเกินไป";
  if (s.levels.length > LIMITS.levels) return "ระดับผลมากเกินไป";

  // ตรวจและทำความสะอาดคำถาม/ตัวเลือก
  const questions: SnapQuestion[] = [];
  for (const [i, item] of s.questions.entries()) {
    const q = (item ?? {}) as Record<string, unknown>;
    const type = q.type === "number" ? "number" : "choice";
    const rawChoices = Array.isArray(q.choices) ? q.choices : [];
    if (rawChoices.length > LIMITS.choices) return `ตัวเลือกในข้อ ${i + 1} มากเกินไป`;
    const choices: SnapChoice[] = [];
    for (const item2 of rawChoices) {
      const c = (item2 ?? {}) as Record<string, unknown>;
      const score = Number(c.score);
      if (!Number.isInteger(score) || score < -100 || score > 100) return `คะแนนในข้อ ${i + 1} ต้องเป็นจำนวนเต็ม −100 ถึง 100`;
      choices.push({ id: idOf(c.id), text: str(c.text, 255), score });
    }
    questions.push({ id: idOf(q.id), text: str(q.text, 1000), type, choices: type === "choice" ? choices : [] });
  }

  // ตรวจและทำความสะอาดระดับผล
  const levels: SnapLevel[] = [];
  for (const item of s.levels) {
    const l = (item ?? {}) as Record<string, unknown>;
    const days = intOrNull(l.reassessDays);
    if (days !== null && (days < 1 || days > 730)) return "รอบประเมินซ้ำต้องอยู่ระหว่าง 1–730 วัน";
    levels.push({
      id: idOf(l.id),
      riskLevel: str(l.riskLevel, 100),
      min: base.generic ? intOrNull(l.min) : null,
      max: base.generic ? intOrNull(l.max) : null,
      severity: 0,
      text: str(l.text, 1000),
      reassessDays: days,
      hotline: str(l.hotline, 100),
      source: str(l.source, 300),
    });
  }
  // คำนวณความรุนแรงของแต่ละระดับใหม่
  if (base.generic) {
    const order = [...levels].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
    order.forEach((l, i) => (l.severity = severityForRank(i, order.length)));
  } else {
    for (const l of levels) l.severity = severityOf(base.name, l.riskLevel);
  }

  return {
    name: base.name,
    description: str(s.description, 500),
    source: str(s.source, 500),
    generic: base.generic,
    questions,
    levels,
  };
}

// ตรวจความพร้อมก่อนเผยแพร่: คำถาม/ตัวเลือกครบ ระดับผล 2–8 ระดับ ช่วงคะแนนต่อกันและชื่อไม่ซ้ำ
export function validateForPublish(snap: Snapshot): string | null {
  if (!snap.questions.length) return "ต้องมีคำถามอย่างน้อย 1 ข้อ";
  for (const [i, q] of snap.questions.entries()) {
    if (!q.text) return `กรุณากรอกข้อความคำถามข้อ ${i + 1}`;
    if (q.type === "choice") {
      if (q.choices.length < 2) return `คำถามข้อ ${i + 1} ต้องมีตัวเลือกอย่างน้อย 2 ตัว`;
      if (q.choices.some((c) => !c.text)) return `กรุณากรอกข้อความตัวเลือกในข้อ ${i + 1}`;
    }
  }
  if (!snap.generic || !snap.levels.length) return null;

  // ตรวจระดับผล: จำนวน ชื่อ ช่วงคะแนนต่อกัน และชื่อไม่ซ้ำ
  const [lo, hi] = LIMITS.genericLevels;
  if (snap.levels.length < lo || snap.levels.length > hi) return `ต้องมีระดับผล ${lo}–${hi} ระดับ`;
  for (const [i, l] of snap.levels.entries()) {
    if (!l.riskLevel) return `กรุณาตั้งชื่อระดับที่ ${i + 1}`;
    if (l.min === null || l.max === null || l.min > l.max) return `ช่วงคะแนนของ "${l.riskLevel}" ไม่ถูกต้อง`;
  }
  const sorted = [...snap.levels].sort((a, b) => a.min! - b.min!);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min !== sorted[i - 1].max! + 1) {
      return `ช่วงคะแนนต้องต่อกันพอดี: "${sorted[i - 1].riskLevel}" จบที่ ${sorted[i - 1].max} ระดับถัดไปต้องเริ่มที่ ${sorted[i - 1].max! + 1}`;
    }
  }
  if (new Set(snap.levels.map((l) => l.riskLevel)).size !== snap.levels.length) return "ชื่อระดับผลต้องไม่ซ้ำกัน";
  return null;
}

// เขียน snapshot ลงตารางจริง (assessment_types, questions, question_choices, recommendation) ภายใน transaction
export async function applySnapshot(client: PoolClient, typeId: number, snap: Snapshot, staffId: number): Promise<string | null> {
  // อัปเดตคำอธิบายและแหล่งอ้างอิงของแบบประเมิน
  await client.query(
    "UPDATE assessment_types SET description = $2, source = $3, updated_at = NOW() WHERE assessment_type_id = $1",
    [typeId, snap.description || null, snap.source || null]
  );

  // คำถาม/ตัวเลือก: อัปเดตของเดิม เพิ่มของใหม่ และปิดใช้งานที่ถูกลบ
  const qRows = await client.query("SELECT question_id, is_active FROM questions WHERE assessment_type_id = $1", [typeId]);
  const ownQ = new Set(qRows.rows.map((r) => r.question_id as number));
  const cRows = await client.query(
    `SELECT c.choice_id, c.question_id FROM question_choices c JOIN questions q USING (question_id)
      WHERE q.assessment_type_id = $1`,
    [typeId]
  );
  const choiceOwner = new Map(cRows.rows.map((r) => [r.choice_id as number, r.question_id as number]));
  const keepQ = new Set<number>();

  for (const [i, q] of snap.questions.entries()) {
    let qid = q.id && ownQ.has(q.id) && !keepQ.has(q.id) ? q.id : undefined;
    if (qid) {
      await client.query(
        `UPDATE questions SET question_text = $2, question_type = $3, display_order = $4, is_active = TRUE,
                updated_by = $5, updated_at = NOW()
          WHERE question_id = $1
            AND (question_text IS DISTINCT FROM $2 OR question_type IS DISTINCT FROM $3
                 OR display_order IS DISTINCT FROM $4 OR NOT is_active)`,
        [qid, q.text, q.type, i + 1, staffId]
      );
    } else {
      const r = await client.query(
        `INSERT INTO questions (assessment_type_id, question_text, question_type, display_order, is_required, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, TRUE, TRUE, $5, $5) RETURNING question_id`,
        [typeId, q.text, q.type, i + 1, staffId]
      );
      qid = r.rows[0].question_id as number;
    }
    keepQ.add(qid);

    if (q.type !== "choice") continue;
    const keepC: number[] = [];
    for (const [j, c] of q.choices.entries()) {
      let cid = c.id && choiceOwner.get(c.id) === qid && !keepC.includes(c.id) ? c.id : undefined;
      if (cid) {
        await client.query(
          `UPDATE question_choices SET choice_text = $2, score = $3, display_order = $4, is_active = TRUE, updated_at = NOW()
            WHERE choice_id = $1
              AND (choice_text IS DISTINCT FROM $2 OR score IS DISTINCT FROM $3 OR display_order IS DISTINCT FROM $4 OR NOT is_active)`,
          [cid, c.text, c.score, j + 1]
        );
      } else {
        const r = await client.query(
          `INSERT INTO question_choices (question_id, choice_text, score, display_order, is_active)
           VALUES ($1, $2, $3, $4, TRUE) RETURNING choice_id`,
          [qid, c.text, c.score, j + 1]
        );
        cid = r.rows[0].choice_id as number;
      }
      keepC.push(cid!);
    }
    await client.query(
      "UPDATE question_choices SET is_active = FALSE, updated_at = NOW() WHERE question_id = $1 AND is_active AND NOT (choice_id = ANY($2))",
      [qid, keepC]
    );
  }
  const removedQ = qRows.rows.filter((r) => r.is_active && !keepQ.has(r.question_id)).map((r) => r.question_id as number);
  if (removedQ.length) {
    await client.query("UPDATE questions SET is_active = FALSE, updated_by = $2, updated_at = NOW() WHERE question_id = ANY($1)", [
      removedQ,
      staffId,
    ]);
  }

  // คำแนะนำ: ตรวจว่าชนิดเกณฑ์ไม่เปลี่ยน แล้วอัปเดต (แบบสูตรเฉพาะแก้ได้แค่ข้อความ)
  const recRows = await client.query("SELECT rec_id, min_score, max_score FROM recommendation WHERE assessment_type_id = $1", [typeId]);
  const ownRec = new Set(recRows.rows.map((r) => r.rec_id as number));
  const liveGeneric = recRows.rows.every((r) => r.min_score !== null && r.max_score !== null);
  if (snap.generic !== liveGeneric) return "เกณฑ์แปลผลของแบบประเมินนี้เปลี่ยนไปแล้ว กรุณาทิ้งฉบับร่างแล้วแก้ไขใหม่";

  if (!liveGeneric) {
    for (const l of snap.levels) {
      if (!l.id || !ownRec.has(l.id)) continue;
      await client.query(
        `UPDATE recommendation SET recommendation_text = $2, reassess_days = $3, hotline = $4, source = $5,
                updated_by = $6, updated_at = NOW()
          WHERE rec_id = $1 AND (recommendation_text IS DISTINCT FROM $2 OR reassess_days IS DISTINCT FROM $3
                OR hotline IS DISTINCT FROM $4 OR source IS DISTINCT FROM $5)`,
        [l.id, l.text || null, l.reassessDays, l.hotline || null, l.source || null, staffId]
      );
    }
    return null;
  }

  // แบบทั่วไป: ลบระดับที่ถูกเอาออก (ถ้าไม่มีผลประเมินอ้างอิง) แล้วอัปเดต/เพิ่มระดับ
  const wanted = new Set(snap.levels.map((l) => l.id).filter((id): id is number => !!id && ownRec.has(id)));
  const removed = [...ownRec].filter((id) => !wanted.has(id));
  if (removed.length) {
    const used = await client.query("SELECT 1 FROM assessment WHERE recommendation_id = ANY($1) LIMIT 1", [removed]);
    if (used.rowCount) return "ลบระดับผลที่มีผลประเมินของผู้ใช้อ้างอิงอยู่ไม่ได้ (แก้ชื่อหรือช่วงคะแนนแทนได้)";
    await client.query("DELETE FROM recommendation WHERE rec_id = ANY($1)", [removed]);
  }

  const keepRec: number[] = [];
  for (const l of snap.levels) {
    let id = l.id && wanted.has(l.id) && !keepRec.includes(l.id) ? l.id : undefined;
    const vals = [l.riskLevel, l.min, l.max, l.text || null, l.reassessDays, l.hotline || null, l.source || null, staffId];
    if (id) {
      await client.query(
        `UPDATE recommendation SET risk_level = $2, min_score = $3, max_score = $4, recommendation_text = $5,
                reassess_days = $6, hotline = $7, source = $8, updated_by = $9, updated_at = NOW()
          WHERE rec_id = $1
            AND (risk_level IS DISTINCT FROM $2 OR min_score IS DISTINCT FROM $3::numeric OR max_score IS DISTINCT FROM $4::numeric
                 OR recommendation_text IS DISTINCT FROM $5 OR reassess_days IS DISTINCT FROM $6
                 OR hotline IS DISTINCT FROM $7 OR source IS DISTINCT FROM $8)`,
        [id, ...vals]
      );
    } else {
      const r = await client.query(
        `INSERT INTO recommendation (assessment_type_id, risk_level, min_score, max_score, recommendation_text,
                                     reassess_days, hotline, source, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING rec_id`,
        [typeId, ...vals]
      );
      id = r.rows[0].rec_id as number;
    }
    keepRec.push(id!);
  }
  return null;
}
