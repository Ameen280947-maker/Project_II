/* โครงข้อมูลจาก GET /api/staff/overview (หน้า "ภาพรวมระบบ") */

export type Bucket = "hour" | "day" | "week" | "month";

export type Overview = {
  staffName: string;
  from: string;
  to: string;
  bucket: Bucket;
  minGroup: number;
  kpi: {
    totalUsers: number;
    newUsers: number;
    assessments: number;
    prevAssessments: number;
    activeUsers: number;
    activeTypes: number;
    totalTypes: number;
  };
  // prev = ช่องเดียวกันของช่วงก่อนหน้า (null ถ้าช่วงก่อนมีจำนวนช่องน้อยกว่า)
  chart: { label: string; value: number; prev: number | null }[];
  outcome: {
    total: number;
    users: number;
    // null = ผู้ยินยอมน้อยกว่า minGroup คน (ไม่แสดงสัดส่วน)
    counts: { ok: number; mid: number; high: number } | null;
  };
  accounts: { newUsers: number; active30: number; inactive30: number; suspended: number };
  topAssessments: { id: number; label: string; count: number }[];
  reports: {
    topIssue: { label: string; pct: number } | null;
    onTime: number | null;
    onTimeChange: number | null;
    monthly: { label: string; value: number; current: boolean }[];
  };
  tasks: {
    missing: { typeId: number; assessment: string; level: string }[];
    drafts: { typeId: number; assessment: string; updatedAt: string; updatedBy: string | null }[];
    suspended: number;
  };
  activity: { kind: "staff" | "signup"; text: string; at: string }[];
};
