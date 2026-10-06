/* =========================================================
   ระดับความเสี่ยงกลางของฝั่ง Staff
   สร้างจากค่า risk_level ที่มีจริงในตาราง assessment และ recommendation

   severity: 0 = ปกติ, 1 = ควรระวัง, 2 = สูง, 3 = วิกฤต
========================================================= */

export type Severity = 0 | 1 | 2 | 3;

// แบบประเมินที่ไม่แสดงในฝั่ง Staff
export const EXCLUDED_TYPES = ["Oral Health", "Diabetes Risk"];

export const TYPE_LABELS: Record<string, string> = {
  BMI: "ดัชนีมวลกาย",
  "Blood Pressure": "ความดันโลหิต",
  "Thai CVD": "โรคหัวใจและหลอดเลือด",
  "Diabetes TDS": "ความเสี่ยงเบาหวาน",
  Smoking: "การสูบบุหรี่",
  Alcohol: "การดื่มแอลกอฮอล์",
  "Physical Activity": "กิจกรรมทางกาย",
  Sleep: "การนอนหลับ",
  Diet: "พฤติกรรมการรับประทานอาหาร",
  Stress: "ความเครียด",
  "9Q": "ภาวะซึมเศร้า 9Q",
  "PHQ-2": "คัดกรองซึมเศร้า 2Q",
};

export const typeLabel = (name: string) => TYPE_LABELS[name] ?? name;

// ค่า risk_level → severity แยกตามแบบประเมิน (ตรงกับข้อมูลจริง)
const MAP: Record<string, Record<string, Severity>> = {
  "9Q": {
    "ไม่มีอาการซึมเศร้าหรือมีน้อยมาก": 0,
    "มีอาการซึมเศร้าระดับน้อย": 1,
    "มีอาการซึมเศร้าระดับปานกลาง": 2,
    "มีอาการซึมเศร้าระดับรุนแรง": 3,
  },
  "PHQ-2": {
    "ไม่เป็นโรคซึมเศร้า": 0,
    "มีความเสี่ยงหรือมีแนวโน้มเป็นโรคซึมเศร้า": 1,
  },
  Stress: { "เครียดน้อย": 0, "เครียดปานกลาง": 1, "เครียดมาก": 2, "เครียดมากที่สุด": 3 },
  "Blood Pressure": {
    "ความดันต่ำกว่าเกณฑ์": 1,
    "ความดันอยู่ในระดับปกติ": 0,
    "ความดันโลหิตเริ่มสูง": 1,
    "อาจเป็นโรคความดันโลหิตสูง": 1,
    "น่าจะเป็นโรคความดันโลหิตสูง": 2,
    "ความดันโลหิตสูงอันตราย": 3,
  },
  BMI: { "ผอม": 1, "ปกติ": 0, "น้ำหนักเกิน": 1, "อ้วน": 2, "อ้วนอันตราย": 3 },
  "Thai CVD": { "เสี่ยงน้อย": 0, "เสี่ยงปานกลาง": 1, "เสี่ยงสูง": 2 },
  // ในตาราง assessment เก็บเป็นภาษาอังกฤษ แต่ในตาราง recommendation เป็นภาษาไทย จึงรองรับทั้งคู่
  "Diabetes TDS": {
    low: 0, "เสี่ยงน้อย": 0,
    moderate: 1, "เสี่ยงปานกลาง": 1,
    high: 2, "เสี่ยงสูง": 2,
    very_high: 3, "เสี่ยงสูงมาก": 3,
  },
  Smoking: { "ติดนิโคตินระดับต่ำ": 1, "ติดนิโคตินระดับปานกลาง": 1, "ติดนิโคตินระดับสูง": 2 },
  Alcohol: {
    "ไม่เคยดื่ม": 0, "ไม่เคยดื่มตลอดชีวิต": 0,
    "หยุดดื่มแล้ว": 0, "เคยดื่มแต่หยุดดื่มมาแล้ว 1 ปีขึ้นไป": 0,
    "ดื่มในระดับเสี่ยงต่ำ": 1, "ดื่มในระดับเสี่ยงปานกลาง": 1,
    "ความเสี่ยงสูง": 2, "ดื่มในระดับเสี่ยงสูง": 2,
  },
  "Physical Activity": { "เพียงพอ": 0, "ไม่เพียงพอ": 1, "ไม่มีกิจกรรมทางกาย": 2 },
  Sleep: { "เพียงพอ": 0, "ไม่เพียงพอ": 1, "เสี่ยงสูง": 2 },
  Diet: { "ควรใส่ใจ": 1, "ควรปรับพฤติกรรมมาก": 2 },
};

// สำรองกรณีเจอค่าที่ยังไม่อยู่ในตาราง MAP (เช็คคำเชิงลบก่อนเสมอ)
const fromText = (risk: string): Severity => {
  const v = risk.toLowerCase();
  if (v.includes("ไม่มีความเสี่ยง") || v.includes("ไม่มีอาการ")) return 0;
  if (v.includes("อันตราย") || v.includes("รุนแรง") || v.includes("สูงมาก") || v.includes("very_high")) return 3;
  if (v.includes("สูง") || v.includes("high")) return 2;
  if (v.includes("ไม่เพียงพอ") || v.includes("ปานกลาง") || v.includes("เสี่ยง") || v.includes("moderate")) return 1;
  return 0;
};

// ระดับของแบบประเมินที่เจ้าหน้าที่สร้างเพิ่ม (โหลดจากฐานข้อมูลด้วย loadCustomSeverities ฝั่งเซิร์ฟเวอร์)
const CUSTOM: Record<string, Record<string, Severity>> = {};

export function setCustomSeverities(map: Record<string, Record<string, Severity>>) {
  for (const k of Object.keys(CUSTOM)) delete CUSTOM[k];
  Object.assign(CUSTOM, map);
}

// ระดับที่ i จาก n ระดับ (เรียงคะแนนน้อย → มาก) → severity 0–3
export const severityForRank = (i: number, n: number): Severity => {
  if (n <= 1) return 0;
  if (n === 2) return i === 0 ? 0 : 2;
  if (n <= 4) return Math.min(3, i) as Severity;
  return Math.round((i * 3) / (n - 1)) as Severity;
};

export const severityOf = (assessmentName: string, riskLevel: string | null | undefined): Severity => {
  const risk = String(riskLevel ?? "").trim();
  if (!risk) return 0;
  const exact = MAP[assessmentName]?.[risk] ?? CUSTOM[assessmentName]?.[risk];
  return exact ?? fromText(risk);
};

// ระดับที่ต้องสร้างเคสติดตามอัตโนมัติ (เฉพาะแบบประเมินทางคลินิก)
export const FOLLOW_UP_AT: Record<string, Severity> = {
  "9Q": 2,
  Stress: 3,
  "Blood Pressure": 2,
  "Thai CVD": 2,
  "Diabetes TDS": 2,
  BMI: 3,
};

// เกณฑ์สร้างเคสของแบบประเมินที่เจ้าหน้าที่สร้างเพิ่ม: ระดับสูงสุดของแบบนั้น (ถ้าอยู่ในระดับ "สูง" ขึ้นไป)
export const customTypeNames = () => Object.keys(CUSTOM);

export function followUpThreshold(assessmentName: string): Severity | undefined {
  if (FOLLOW_UP_AT[assessmentName] !== undefined) return FOLLOW_UP_AT[assessmentName];
  const levels = CUSTOM[assessmentName];
  if (!levels) return undefined;
  const top = Math.max(...Object.values(levels)) as Severity;
  return top >= 2 ? top : undefined;
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  0: "ปกติ",
  1: "ควรระวัง",
  2: "สูง",
  3: "วิกฤต",
};
