/* =========================================================
   สถานะเคสติดตาม (follow_up_cases.status)
   ใช้ร่วมกันทั้ง API และหน้าเว็บ
========================================================= */

// ต้องตรงกับ CHECK constraint follow_up_cases_status_check ในฐานข้อมูล
export const CASE_STATUSES = ["waiting", "progress", "referred", "closed"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  waiting: "รอติดตาม",
  progress: "กำลังติดตาม",
  // ระบบไม่ได้เชื่อมกับแพทย์/โรงพยาบาล: เจ้าหน้าที่แนะนำให้ผู้ใช้ไปพบแพทย์เอง (ค่า referred คงไว้ตาม constraint ในฐานข้อมูล)
  referred: "แนะนำให้พบแพทย์แล้ว",
  closed: "ปิดเคส",
};

export const isCaseStatus = (v: unknown): v is CaseStatus =>
  typeof v === "string" && (CASE_STATUSES as readonly string[]).includes(v);
