// หน่วยการจัดกลุ่มข้อมูลในกราฟ
export type Bucket = "hour" | "day" | "week" | "month";

// โครงข้อมูลที่ /api/staff/overview ส่งกลับ: KPI กราฟ ผลประเมิน บัญชี รายงาน งานค้าง และกิจกรรมล่าสุด
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
  chart: { label: string; value: number; prev: number | null }[];
  outcome: {
    total: number;
    users: number;
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
