// ระดับความเสี่ยงแบบมาตรฐาน 3 ระดับ (+ ไม่ทราบ)
export type Level = "ok" | "mid" | "high" | "unknown";

// ตารางแปลงข้อความระดับผลของแต่ละแบบประเมิน → ok/mid/high
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

// เดาระดับความเสี่ยง (ok/mid/high) จากคำสำคัญในข้อความระดับผล เมื่อไม่มีในตารางแมป
const fromKeywords = (v: string): Level => {
  if (["ไม่มีความเสี่ยง", "ไม่พบ", "ไม่มีอาการ", "ไม่เป็นโรค"].some((k) => v.includes(k))) return "ok";
  if (v.includes("เริ่มสูง")) return "mid";
  if (["สูง", "อันตราย", "รุนแรง", "มาก", "อ้วน"].some((k) => v.includes(k))) return "high";
  if (["ไม่เพียงพอ", "ปานกลาง", "แนวโน้ม", "ท้วม", "เกิน", "ผอม", "ควร"].some((k) => v.includes(k))) return "mid";
  if (["ปกติ", "เพียงพอ", "น้อย", "ต่ำ", "ดี", "เหมาะสม"].some((k) => v.includes(k))) return "ok";
  if (v.includes("เสี่ยง")) return "mid";
  return "unknown";
};

// แปลงชื่อแบบประเมิน + ข้อความระดับผลเป็นระดับมาตรฐาน ok/mid/high/unknown
export const riskLevelOf = (
  assessmentName?: string | null,
  riskLevel?: string | null
): Level => {
  const risk = String(riskLevel ?? "").trim();
  if (!risk) return "unknown";
  const table = BY_TYPE[String(assessmentName ?? "").toLowerCase().trim()];
  return table?.[risk] ?? fromKeywords(risk.toLowerCase());
};

// สีระดับผลตามเอกสารกรมควบคุมโรค
export type DocColor = "green" | "yellow" | "orange" | "red" | "unknown";

// กรณีพิเศษที่สีตามเอกสารต่างจากการแปลงปกติ แยกตามแบบประเมิน
const DOC_COLOR: Record<string, Record<string, DocColor>> = {
  bmi: {
    "ผอม": "green",
    "ปกติ": "yellow",
    "น้ำหนักเกิน": "orange",
  },
  "blood pressure": {
    "อาจเป็นโรคความดันโลหิตสูง": "orange",
    "น่าจะเป็นโรคความดันโลหิตสูง": "orange",
  },
  "diabetes tds": {
    high: "orange",
    "เสี่ยงสูง": "orange",
  },
  alcohol: {
    "ความเสี่ยงปานกลาง": "orange",
  },
  diet: {
    "ควรปรับพฤติกรรม": "orange",
  },
  "phq-2": {
    "มีความเสี่ยงหรือมีแนวโน้มเป็นโรคซึมเศร้า": "red",
  },
  "9q": {
    "มีอาการซึมเศร้าระดับปานกลาง": "orange",
  },
};

// การแปลงระดับมาตรฐานเป็นสีเริ่มต้น
const LEVEL_TO_DOC: Record<Level, DocColor> = {
  ok: "green",
  mid: "yellow",
  high: "red",
  unknown: "unknown",
};

// หาสีปิงปองจราจรตามเอกสารกรมควบคุมโรค (เขียว/เหลือง/ส้ม/แดง) ของผลประเมิน
export const docColorOf = (
  assessmentName?: string | null,
  riskLevel?: string | null
): DocColor => {
  const risk = String(riskLevel ?? "").trim();
  const table = DOC_COLOR[String(assessmentName ?? "").toLowerCase().trim()];
  return table?.[risk] ?? LEVEL_TO_DOC[riskLevelOf(assessmentName, riskLevel)];
};
