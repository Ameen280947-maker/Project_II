/* =========================================================
   จัดกลุ่มผลประเมินเป็น ok / mid / high สำหรับฝั่งผู้ใช้
   (Dashboard, คำแนะนำสุขภาพ, API dashboard)

   อิงสีในเอกสารอ้างอิงของกรมควบคุมโรค:
   เขียว = ok, เหลือง = mid, ส้ม/แดง = high

   ใช้ตารางแยกตามแบบประเมิน เพราะคำเดียวกันมีความหมายต่างกัน
   เช่น บุหรี่ "เสี่ยงต่ำ" = ไม่สูบ (เขียว)
   แต่แอลกอฮอล์ "ความเสี่ยงต่ำ" = ยังดื่มอยู่ (เหลือง)
========================================================= */

export type Level = "ok" | "mid" | "high" | "unknown";

const BY_TYPE: Record<string, Record<string, Level>> = {
  bmi: {
    "ผอม": "mid",
    "ปกติ": "ok",
    "น้ำหนักเกิน": "mid",
    "อ้วน": "high",
    "อ้วนอันตราย": "high",
  },
  "blood pressure": {
    "ความดันต่ำกว่าเกณฑ์": "ok",
    "ความดันอยู่ในระดับปกติ": "ok",
    "ความดันโลหิตเริ่มสูง": "mid",
    "อาจเป็นโรคความดันโลหิตสูง": "high",
    "น่าจะเป็นโรคความดันโลหิตสูง": "high",
    "ความดันโลหิตสูงอันตราย": "high",
  },
  "thai cvd": {
    "เสี่ยงน้อย": "ok",
    "เสี่ยงปานกลาง": "mid",
    "เสี่ยงสูง": "high",
  },
  // assessment เก็บคีย์อังกฤษ ส่วน recommendation เก็บภาษาไทย
  "diabetes tds": {
    low: "ok", "เสี่ยงน้อย": "ok",
    moderate: "mid", "เสี่ยงปานกลาง": "mid",
    high: "high", "เสี่ยงสูง": "high",
    very_high: "high", "เสี่ยงสูงมาก": "high",
  },
  smoking: {
    "เสี่ยงต่ำ": "ok",
    "เสี่ยงปานกลาง": "mid",
    "เสี่ยงสูง": "high",
    // ระดับเดิมก่อนปรับตามเอกสาร (ทุกระดับคือคนที่สูบอยู่)
    "ติดนิโคตินระดับต่ำ": "mid",
    "ติดนิโคตินระดับปานกลาง": "mid",
    "ติดนิโคตินระดับสูง": "high",
  },
  alcohol: {
    "ไม่เคยดื่ม": "ok",
    "หยุดดื่มแล้ว": "ok",
    "ความเสี่ยงต่ำ": "mid",
    "ความเสี่ยงปานกลาง": "high",
    "ความเสี่ยงสูง": "high",
  },
  "physical activity": {
    "เพียงพอ": "ok",
    "ไม่เพียงพอ": "mid",
    "ไม่มีกิจกรรมทางกาย": "high",
  },
  sleep: {
    "เพียงพอ": "ok",
    "ไม่เพียงพอ": "mid",
    "เสี่ยงสูง": "high",
  },
  diet: {
    "พฤติกรรมเหมาะสม": "ok",
    "ควรใส่ใจ": "mid",
    "ควรปรับพฤติกรรม": "high",
    "ควรปรับพฤติกรรมมาก": "high",
  },
  // ตรงกับเกณฑ์คะแนนในหน้า Dashboard (<7 ok, 7-12 mid, ≥13 high)
  "9q": {
    "ไม่มีอาการซึมเศร้าหรือมีน้อยมาก": "ok",
    "มีอาการซึมเศร้าระดับน้อย": "mid",
    "มีอาการซึมเศร้าระดับปานกลาง": "high",
    "มีอาการซึมเศร้าระดับรุนแรง": "high",
  },
  stress: {
    "เครียดน้อย": "ok",
    "เครียดปานกลาง": "mid",
    "เครียดมาก": "high",
    "เครียดมากที่สุด": "high",
  },
};

// สำรองสำหรับค่าที่ไม่อยู่ในตาราง (เช่น แบบประเมินที่เจ้าหน้าที่สร้างเอง)
// เช็คคำเชิงลบก่อนเสมอ ("ไม่เพียงพอ" มีคำว่า "เพียงพอ" อยู่ข้างใน)
const fromKeywords = (v: string): Level => {
  if (["ไม่มีความเสี่ยง", "ไม่พบ", "ไม่มีอาการ", "ไม่เป็นโรค"].some((k) => v.includes(k))) return "ok";
  if (v.includes("เริ่มสูง")) return "mid";
  if (["สูง", "อันตราย", "รุนแรง", "มาก", "อ้วน"].some((k) => v.includes(k))) return "high";
  if (["ไม่เพียงพอ", "ปานกลาง", "แนวโน้ม", "ท้วม", "เกิน", "ผอม", "ควร"].some((k) => v.includes(k))) return "mid";
  if (["ปกติ", "เพียงพอ", "น้อย", "ต่ำ", "ดี", "เหมาะสม"].some((k) => v.includes(k))) return "ok";
  if (v.includes("เสี่ยง")) return "mid";
  return "unknown";
};

export const riskLevelOf = (
  assessmentName?: string | null,
  riskLevel?: string | null
): Level => {
  const risk = String(riskLevel ?? "").trim();
  if (!risk) return "unknown";
  const table = BY_TYPE[String(assessmentName ?? "").toLowerCase().trim()];
  return table?.[risk] ?? fromKeywords(risk.toLowerCase());
};

/* =========================================================
   สีตามเอกสารอ้างอิงกรมควบคุมโรค (4 สี: เขียว เหลือง ส้ม แดง)
   ใช้ในหน้าประวัติการประเมิน
   ค่าที่ไม่อยู่ใน DOC_COLOR ใช้ระดับจาก riskLevelOf
   (ok = เขียว, mid = เหลือง, high = แดง)
========================================================= */

export type DocColor = "green" | "yellow" | "orange" | "red" | "unknown";

const DOC_COLOR: Record<string, Record<string, DocColor>> = {
  // ตารางที่ 12: เอกสารให้ ผอม = เขียว, ปกติ = เหลือง
  bmi: {
    "ผอม": "green",
    "ปกติ": "yellow",
    "น้ำหนักเกิน": "orange",
  },
  // ตารางที่ 4
  "blood pressure": {
    "อาจเป็นโรคความดันโลหิตสูง": "orange",
    "น่าจะเป็นโรคความดันโลหิตสูง": "orange",
  },
  // ตารางที่ 7
  "diabetes tds": {
    high: "orange",
    "เสี่ยงสูง": "orange",
  },
  // ตารางที่ 16
  alcohol: {
    "ความเสี่ยงปานกลาง": "orange",
  },
  // ตารางที่ 24 (4 ระดับ)
  diet: {
    "ควรปรับพฤติกรรม": "orange",
  },
  // ตารางที่ 30: 1-2 คะแนน = แดง
  "phq-2": {
    "มีความเสี่ยงหรือมีแนวโน้มเป็นโรคซึมเศร้า": "red",
  },
  // ไม่อยู่ในเอกสาร ใช้สีตามเกณฑ์ 9Q ของกรมสุขภาพจิต
  "9q": {
    "มีอาการซึมเศร้าระดับปานกลาง": "orange",
  },
};

const LEVEL_TO_DOC: Record<Level, DocColor> = {
  ok: "green",
  mid: "yellow",
  high: "red",
  unknown: "unknown",
};

export const docColorOf = (
  assessmentName?: string | null,
  riskLevel?: string | null
): DocColor => {
  const risk = String(riskLevel ?? "").trim();
  const table = DOC_COLOR[String(assessmentName ?? "").toLowerCase().trim()];
  return table?.[risk] ?? LEVEL_TO_DOC[riskLevelOf(assessmentName, riskLevel)];
};
