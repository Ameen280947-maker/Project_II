// ช่วงเวลาแบบเก่า (?range=week/month/quarter) เป็นจำนวนวัน และช่วงยาวสุดที่เลือกได้
export const LEGACY_RANGES: Record<string, number> = { week: 7, month: 30, quarter: 90 };
const MAX_SPAN_DAYS = 731;

// ชื่อวันและเดือนแบบย่อภาษาไทย สำหรับป้ายแกนกราฟ
const TH_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// หน่วยการจัดกลุ่มข้อมูลในกราฟ
export type Bucket = "hour" | "day" | "week" | "month";

// สร้างนิพจน์ SQL แปลงคอลัมน์เวลา UTC เป็นเวลาไทย (Asia/Bangkok)
export const localOf = (col: string) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')`;
// เวลาประเมิน (a.assessed_at) แบบเวลาไทย สำหรับใช้ใน SQL
export const LOCAL_ASSESSED = localOf("a.assessed_at");
// สร้างเงื่อนไข SQL กรองช่วงวันที่ from ถึง to (รวมวันสุดท้าย)
export const inRange = (localExpr: string, fromParam: string, toParam: string) =>
  `${localExpr} >= ${fromParam}::date AND ${localExpr} < ${toParam}::date + 1`;

// รูปแบบวันที่ YYYY-MM-DD
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// คืนวันที่วันนี้ตามเวลาไทยในรูปแบบ YYYY-MM-DD
function todayInBangkok() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

// แปลง YYYY-MM-DD เป็น Date (UTC) และคืน null ถ้าเป็นวันที่ที่ไม่มีจริง
function toUtcDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

// บวก/ลบจำนวนวันจากวันที่ YYYY-MM-DD
export function addDays(s: string, days: number) {
  const d = toUtcDate(s)!;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// นับจำนวนวันในช่วง from ถึง to (รวมทั้งสองวัน)
export function spanDays(from: string, to: string) {
  return Math.round((toUtcDate(to)!.getTime() - toUtcDate(from)!.getTime()) / 86_400_000) + 1;
}

// เลือกหน่วยการจัดกลุ่มกราฟ (ชั่วโมง/วัน/สัปดาห์/เดือน) ตามความยาวช่วงเวลา
export function bucketFor(days: number): Bucket {
  if (days <= 1) return "hour";
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

// รูปแบบ to_char ของ PostgreSQL สำหรับสร้าง key ของแต่ละช่วง
export const KEY_FORMAT: Record<Bucket, string> = {
  hour: "YYYY-MM-DD HH24",
  day: "YYYY-MM-DD",
  week: "YYYY-MM-DD",
  month: "YYYY-MM",
};

// แปลง key ของช่วงเวลาเป็นป้ายแกนกราฟภาษาไทย (เวลา ชื่อวัน วันที่ หรือเดือน)
export function bucketLabel(key: string, bucket: Bucket, days: number, multiYear: boolean) {
  if (bucket === "hour") return `${key.slice(11, 13)}:00`;
  const [y, m, d] = key.split("-").map(Number);
  if (bucket === "month") return multiYear ? `${TH_MONTHS[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}` : TH_MONTHS[m - 1];
  if (bucket === "day" && days <= 7) return TH_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${d} ${TH_MONTHS[m - 1]}`;
}

// อ่านและตรวจช่วงวันที่จาก query (from/to หรือ range แบบเก่า) ไม่เกิน 2 ปี คืน {from,to} หรือ {error}
export function parseRange(params: URLSearchParams): { from: string; to: string } | { error: string } {
  const today = todayInBangkok();
  const legacy = params.get("range");
  const fromParam = params.get("from");
  const toParam = params.get("to");

  // ไม่ระบุ from/to → ใช้ช่วงแบบเก่า (ค่าเริ่มต้น 7 วัน)
  if (!fromParam && !toParam) {
    const days = LEGACY_RANGES[legacy ?? ""] ?? 7;
    return { from: addDays(today, -(days - 1)), to: today };
  }

  // ตรวจรูปแบบวันที่ ลำดับ ไม่เกินวันนี้ และไม่เกิน 2 ปี
  if (!fromParam || !toParam || !DATE_RE.test(fromParam) || !DATE_RE.test(toParam) || !toUtcDate(fromParam) || !toUtcDate(toParam)) {
    return { error: "รูปแบบวันที่ไม่ถูกต้อง" };
  }
  if (fromParam > toParam) return { error: "วันเริ่มต้นต้องไม่อยู่หลังวันสิ้นสุด" };
  if (fromParam > today) return { error: "วันเริ่มต้นต้องไม่อยู่หลังวันนี้" };
  if (spanDays(fromParam, toParam) > MAX_SPAN_DAYS) return { error: "เลือกช่วงเวลาได้ไม่เกิน 2 ปี" };

  return { from: fromParam, to: toParam };
}
