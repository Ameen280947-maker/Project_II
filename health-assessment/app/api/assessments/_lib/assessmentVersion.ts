import type { Pool, PoolClient } from "pg";

/* =========================================================
   ผูกผลประเมินกับเวอร์ชันของแบบประเมินที่ใช้อยู่ตอนทำ (assessment.version_id)

   เรียกหลัง COMMIT ผลประเมินแล้ว (นอก transaction)
   - query ที่ล้มใน transaction จะทำให้ทั้ง transaction ถูก abort
     จึงไม่เรียกระหว่าง BEGIN/COMMIT
   - ไม่ throw: ผูกเวอร์ชันไม่สำเร็จต้องไม่ทำให้การบันทึกผลล้มเหลว
========================================================= */

type Db = Pool | PoolClient;

// ตั้ง version_id ของผลประเมินเป็นเวอร์ชันที่เผยแพร่ล่าสุดของแบบประเมิน (ไม่ throw)
export async function markAssessmentSaved(
  db: Db,
  { typeId, assessmentId }: { userId?: number; typeId: number; assessmentId: number },
): Promise<void> {
  /* ===== ผูกผลประเมินกับเวอร์ชันที่เผยแพร่ล่าสุด (ไม่มี → NULL) ===== */
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
