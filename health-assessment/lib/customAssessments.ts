import pool from "@/lib/db";
import { setCustomSeverities, severityForRank, type Severity } from "@/lib/staff/riskLevels";

// ระดับผลของแบบประเมินแบบทั่วไป: ช่วงคะแนน ความรุนแรง คำแนะนำ รอบประเมินซ้ำ สายด่วน
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

// อะไรก็ได้ที่มีเมธอด query (pool หรือ client ใน transaction)
type Queryable = Pick<typeof pool, "query">;

// ดึงเกณฑ์ช่วงคะแนนและคำแนะนำของแบบประเมินจากตาราง recommendation (null ถ้าเกณฑ์ไม่ครบ)
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

// หาระดับผลที่ช่วงคะแนนครอบคลุมคะแนนที่ได้ (null ถ้าไม่อยู่ในช่วงใด)
export const levelForScore = (levels: GenericLevel[], score: number) =>
  levels.find((l) => score >= l.min && score <= l.max) ?? null;

// ดึงแบบประเมินแบบทั่วไป (เกณฑ์คะแนนครบและมีคำถาม) พร้อมจำนวนคำถามและหมวด
export async function listGenericTypes(onlyActive = true) {
  const { rows } = await pool.query(
    `SELECT t.assessment_type_id, t.assessment_name, t.description, t.is_active, t.category_id,
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
    .map((r) => ({
      id: r.assessment_type_id as number,
      name: r.assessment_name as string,
      description: r.description as string | null,
      questions: r.questions as number,
      categoryId: r.category_id as number | null,
    }));
}

// โหลดระดับความรุนแรงของแบบประเมินที่สร้างเอง (คิดจากลำดับช่วงคะแนน) เข้า cache ของ riskLevels
export async function loadCustomSeverities() {
  const { rows } = await pool.query(
    `SELECT t.assessment_name, r.risk_level, r.assessment_type_id,
            COUNT(*) OVER (PARTITION BY r.assessment_type_id) AS n,
            ROW_NUMBER() OVER (PARTITION BY r.assessment_type_id ORDER BY r.min_score, r.rec_id) - 1 AS i,
            BOOL_AND(r.min_score IS NOT NULL AND r.max_score IS NOT NULL) OVER (PARTITION BY r.assessment_type_id) AS ok
       FROM recommendation r JOIN assessment_types t USING (assessment_type_id)`
  );
  // สร้างแผนที่ ชื่อแบบประเมิน → ระดับผล → ความรุนแรง แล้วเก็บเข้า cache
  const map: Record<string, Record<string, Severity>> = {};
  for (const r of rows) {
    if (!r.ok) continue;
    (map[r.assessment_name] ??= {})[r.risk_level] = severityForRank(Number(r.i), Number(r.n));
  }
  setCustomSeverities(map);
}
