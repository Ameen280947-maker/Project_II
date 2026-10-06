import pool from "@/lib/db";
import { FOLLOW_UP_AT, customTypeNames, followUpThreshold, severityOf } from "./riskLevels";
import { loadCustomSeverities } from "@/lib/customAssessments";
import { USER_ROLE_ID } from "./auth";

/* =========================================================
   สร้างเคสติดตามอัตโนมัติจากผลประเมินล่าสุดที่อยู่ในระดับสูง
   - ดูเฉพาะผลประเมินล่าสุดของแต่ละคน/แต่ละแบบ ภายใน 90 วัน
   - เฉพาะผู้ใช้ที่กดยินยอมให้เจ้าหน้าที่ติดตาม (user_settings.consent_staff)
   - ไม่สร้างซ้ำ ถ้าคนนั้นมีเคสของแบบประเมินเดียวกันที่ยังไม่ปิด
   เรียกตอนเปิดหน้าภาพรวมและหน้าติดตาม (ข้อมูลน้อย ทำได้เร็ว)
========================================================= */

export async function syncFollowUpCases() {
  await loadCustomSeverities();
  const types = [...Object.keys(FOLLOW_UP_AT), ...customTypeNames()];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (a.user_id, a.assessment_type_id)
            a.assessment_id, a.user_id, a.assessment_type_id, a.risk_level, t.assessment_name
       FROM assessment a
       JOIN assessment_types t USING (assessment_type_id)
       JOIN users u ON u.user_id = a.user_id
       JOIN user_settings s ON s.user_id::text = a.user_id::text
      WHERE u.role_id = $1
        AND s.consent_staff IS TRUE
        AND t.assessment_name = ANY($2)
        AND a.assessed_at >= NOW() - INTERVAL '90 days'
      ORDER BY a.user_id, a.assessment_type_id, a.assessed_at DESC`,
    [USER_ROLE_ID, types]
  );

  for (const r of rows) {
    const sev = severityOf(r.assessment_name, r.risk_level);
    const threshold = followUpThreshold(r.assessment_name);
    if (threshold === undefined || sev < threshold) continue;
    await pool.query(
      `INSERT INTO follow_up_cases (user_id, assessment_id, assessment_type_id, severity)
       SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (
          SELECT 1 FROM follow_up_cases
           WHERE user_id = $1 AND assessment_type_id = $3 AND status <> 'closed'
        )
       ON CONFLICT (assessment_id) DO NOTHING`,
      [r.user_id, r.assessment_id, r.assessment_type_id, sev]
    );
  }
}
