import type { Pool, PoolClient } from "pg";

// ตัวเชื่อมต่อ DB: pool หรือ client ใน transaction
type Db = Pool | PoolClient;

// ผูกผลประเมินที่บันทึกแล้วกับเวอร์ชันแบบประเมินที่ published ล่าสุด
export async function markAssessmentSaved(
  db: Db,
  { typeId, assessmentId }: { userId?: number; typeId: number; assessmentId: number },
): Promise<void> {
  try {
    await db.query(
      `
      UPDATE assessment
      SET version_id = (
        SELECT v.version_id
        FROM assessment_versions v
        WHERE v.assessment_type_id = $2
          AND v.status = 'published'
        ORDER BY v.version_no DESC
        LIMIT 1
      )
      WHERE assessment_id = $1
      `,
      [assessmentId, typeId],
    );
  } catch (error) {
    console.error("SET ASSESSMENT VERSION ERROR:", error);
  }
}
