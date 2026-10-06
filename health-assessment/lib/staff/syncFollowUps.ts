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

// ผลล่าสุด (ใน 90 วัน) ที่ถึงเกณฑ์ต้องติดตาม แยกตามว่าผู้ใช้ยินยอมหรือไม่
async function highRiskLatest(consented: boolean) {
  await loadCustomSeverities();
  const types = [...Object.keys(FOLLOW_UP_AT), ...customTypeNames()];
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (a.user_id, a.assessment_type_id)
            a.assessment_id, a.user_id, a.assessment_type_id, a.risk_level, t.assessment_name
       FROM assessment a
       JOIN assessment_types t USING (assessment_type_id)
       JOIN users u ON u.user_id = a.user_id
       LEFT JOIN user_settings s ON s.user_id::text = a.user_id::text
      WHERE u.role_id = $1
        AND COALESCE(s.consent_staff, FALSE) = $3
        AND t.assessment_name = ANY($2)
        AND a.assessed_at >= NOW() - INTERVAL '90 days'
      ORDER BY a.user_id, a.assessment_type_id, a.assessed_at DESC`,
    [USER_ROLE_ID, types, consented]
  );
  return rows
    .map((r) => ({ ...r, sev: severityOf(r.assessment_name, r.risk_level) }))
    .filter((r) => {
      const threshold = followUpThreshold(r.assessment_name);
      return threshold !== undefined && r.sev >= threshold;
    });
}

// กันหลายคำขอ (เช่น Sidebar + หน้าภาพรวม) สร้างเคสพร้อมกันจนซ้ำ
let running: Promise<void> | null = null;

export function syncFollowUpCases() {
  running ??= (async () => {
    try {
      for (const r of await highRiskLatest(true)) {
        await pool.query(
          `INSERT INTO follow_up_cases (user_id, assessment_id, assessment_type_id, severity)
           SELECT $1, $2, $3, $4
            WHERE NOT EXISTS (
              SELECT 1 FROM follow_up_cases
               WHERE user_id = $1 AND assessment_type_id = $3 AND status <> 'closed'
            )
           ON CONFLICT (assessment_id) DO NOTHING`,
          [r.user_id, r.assessment_id, r.assessment_type_id, r.sev]
        );
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

// จำนวนผู้ใช้ที่ผลถึงเกณฑ์ติดตาม แต่ยังไม่ยินยอม (ตัวเลขรวมเท่านั้น ไม่ระบุตัวตน)
export async function countHighRiskWithoutConsent() {
  return new Set((await highRiskLatest(false)).map((r) => r.user_id)).size;
}
