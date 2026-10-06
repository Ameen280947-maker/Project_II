import pool from "@/lib/db";
import { setCustomSeverities, severityForRank, type Severity } from "@/lib/staff/riskLevels";

/* =========================================================
   แบบประเมินทั่วไป (เจ้าหน้าที่สร้างเพิ่มเอง)
   - แปลผลจาก "คะแนนรวม" ตามช่วง recommendation.min_score–max_score
   - แบบประเมินจะนับเป็นแบบทั่วไปเมื่อ "ทุกระดับ" มีช่วงคะแนนครบ
   - คะแนนมาก = ความเสี่ยงสูง (ระดับเรียงตาม min_score)
   แบบประเมินเดิม 12 แบบไม่มีช่วงคะแนน จึงไม่ถูกนับเป็นแบบทั่วไป
========================================================= */

export type GenericLevel = {
  recId: number;
  riskLevel: string;
  min: number;
  max: number;
  severity: Severity;
  text: string;
  reassessDays: number | null;
  hotline: string | null;
  source: string | null;
};

type Queryable = Pick<typeof pool, "query">;

// ระดับผลของแบบประเมินทั่วไป (null = ไม่ใช่แบบทั่วไป)
export async function getGenericLevels(typeId: number, db: Queryable = pool): Promise<GenericLevel[] | null> {
  const { rows } = await db.query(
    `SELECT rec_id, risk_level, min_score, max_score, recommendation_text, reassess_days, hotline, source
       FROM recommendation WHERE assessment_type_id = $1
      ORDER BY min_score NULLS FIRST, rec_id`,
    [typeId]
  );
  if (!rows.length || rows.some((r) => r.min_score === null || r.max_score === null)) return null;
  return rows.map((r, i) => ({
    recId: r.rec_id,
    riskLevel: r.risk_level,
    min: Number(r.min_score),
    max: Number(r.max_score),
    severity: severityForRank(i, rows.length),
    text: r.recommendation_text ?? "",
    reassessDays: r.reassess_days,
    hotline: r.hotline,
    source: r.source,
  }));
}

export const levelForScore = (levels: GenericLevel[], score: number) =>
  levels.find((l) => score >= l.min && score <= l.max) ?? null;

// รายการแบบประเมินทั่วไปที่เปิดใช้งาน (สำหรับเมนูผู้ใช้)
export async function listGenericTypes(onlyActive = true) {
  const { rows } = await pool.query(
    `SELECT t.assessment_type_id, t.assessment_name, t.description, t.is_active,
            (SELECT COUNT(*) FROM questions q WHERE q.assessment_type_id = t.assessment_type_id AND q.is_active)::int AS questions
       FROM assessment_types t
      WHERE EXISTS (SELECT 1 FROM recommendation r WHERE r.assessment_type_id = t.assessment_type_id)
        AND NOT EXISTS (
          SELECT 1 FROM recommendation r
           WHERE r.assessment_type_id = t.assessment_type_id AND (r.min_score IS NULL OR r.max_score IS NULL))
        AND ($1 = FALSE OR t.is_active)
      ORDER BY t.assessment_type_id`,
    [onlyActive]
  );
  return rows
    .filter((r) => r.questions > 0)
    .map((r) => ({ id: r.assessment_type_id as number, name: r.assessment_name as string, description: r.description as string | null, questions: r.questions as number }));
}

// ให้ severityOf รู้จักระดับของแบบประเมินทั่วไป (เรียกก่อนคำนวณในฝั่งเซิร์ฟเวอร์)
export async function loadCustomSeverities() {
  const { rows } = await pool.query(
    `SELECT t.assessment_name, r.risk_level, r.assessment_type_id,
            COUNT(*) OVER (PARTITION BY r.assessment_type_id) AS n,
            ROW_NUMBER() OVER (PARTITION BY r.assessment_type_id ORDER BY r.min_score, r.rec_id) - 1 AS i,
            BOOL_AND(r.min_score IS NOT NULL AND r.max_score IS NOT NULL) OVER (PARTITION BY r.assessment_type_id) AS ok
       FROM recommendation r JOIN assessment_types t USING (assessment_type_id)`
  );
  const map: Record<string, Record<string, Severity>> = {};
  for (const r of rows) {
    if (!r.ok) continue;
    (map[r.assessment_name] ??= {})[r.risk_level] = severityForRank(Number(r.i), Number(r.n));
  }
  setCustomSeverities(map);
}
