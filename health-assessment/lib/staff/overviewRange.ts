/* =========================================================
   ช่วงเวลาของหน้า "ภาพรวม" Staff (ใช้ร่วมกันระหว่าง overview และ overview/details)
   - from / to เป็นวันที่ตามเวลาไทย (รวมทั้งสองวัน)
========================================================= */

export const LEGACY_RANGES: Record<string, number> = { week: 7, month: 30, quarter: 90 };
const MAX_SPAN_DAYS = 731;

const TH_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export type Bucket = "hour" | "day" | "week" | "month";

// เวลาในฐานข้อมูล (timestamp ที่เก็บเป็น UTC) แปลงเป็นเวลาไทย
export const localOf = (col: string) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')`;
export const LOCAL_ASSESSED = localOf("a.assessed_at");
// ช่วงวันที่ $from ถึง $to (รวมทั้งสองวัน) ตามเวลาไทย
export const inRange = (localExpr: string, fromParam: string, toParam: string) =>
  `${localExpr} >= ${fromParam}::date AND ${localExpr} < ${toParam}::date + 1`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD
function todayInBangkok() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function toUtcDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // ตัดวันที่ไม่มีจริง เช่น 2026-02-31
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

function addDays(s: string, days: number) {
  const d = toUtcDate(s)!;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function spanDays(from: string, to: string) {
  return Math.round((toUtcDate(to)!.getTime() - toUtcDate(from)!.getTime()) / 86_400_000) + 1;
}

// ความละเอียดกราฟตามความยาวช่วง
export function bucketFor(days: number): Bucket {
  if (days <= 1) return "hour";
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

export const KEY_FORMAT: Record<Bucket, string> = {
  hour: "YYYY-MM-DD HH24",
  day: "YYYY-MM-DD",
  week: "YYYY-MM-DD",
  month: "YYYY-MM",
};

// แปลง key ของช่วงเวลา (มาจาก SQL) เป็นป้ายภาษาไทย
export function bucketLabel(key: string, bucket: Bucket, days: number, multiYear: boolean) {
  if (bucket === "hour") return `${key.slice(11, 13)}:00`;
  const [y, m, d] = key.split("-").map(Number);
  if (bucket === "month") return multiYear ? `${TH_MONTHS[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}` : TH_MONTHS[m - 1];
  if (bucket === "day" && days <= 7) return TH_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${d} ${TH_MONTHS[m - 1]}`;
}

/* ---------- อ่านช่วงเวลาจาก query ---------- */

export function parseRange(params: URLSearchParams): { from: string; to: string } | { error: string } {
  const today = todayInBangkok();
  const legacy = params.get("range");
  const fromParam = params.get("from");
  const toParam = params.get("to");

  if (!fromParam && !toParam) {
    const days = LEGACY_RANGES[legacy ?? ""] ?? 7;
    return { from: addDays(today, -(days - 1)), to: today };
  }

  if (!fromParam || !toParam || !DATE_RE.test(fromParam) || !DATE_RE.test(toParam) || !toUtcDate(fromParam) || !toUtcDate(toParam)) {
    return { error: "รูปแบบวันที่ไม่ถูกต้อง" };
  }
  if (fromParam > toParam) return { error: "วันเริ่มต้นต้องไม่อยู่หลังวันสิ้นสุด" };
  if (fromParam > today) return { error: "วันเริ่มต้นต้องไม่อยู่หลังวันนี้" };
  if (spanDays(fromParam, toParam) > MAX_SPAN_DAYS) return { error: "เลือกช่วงเวลาได้ไม่เกิน 2 ปี" };

  return { from: fromParam, to: toParam };
}
