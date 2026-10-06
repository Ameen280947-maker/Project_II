/* =========================================================
   สถานะเคสติดตาม (follow_up_cases.status)
   ใช้ร่วมกันทั้ง API และหน้าเว็บ
========================================================= */

export const CASE_STATUSES = ["waiting", "in_progress", "referred", "closed"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  waiting: "รอติดตาม",
  in_progress: "กำลังติดตาม",
  referred: "ส่งต่อแพทย์แล้ว",
  closed: "ปิดเคส",
};

export const isCaseStatus = (v: unknown): v is CaseStatus =>
  typeof v === "string" && (CASE_STATUSES as readonly string[]).includes(v);
