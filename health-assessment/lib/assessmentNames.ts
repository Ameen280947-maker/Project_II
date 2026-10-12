/* =========================================================
   ชื่อแบบประเมินภาษาไทยสำหรับหน้าฝั่งผู้ใช้
   - assessment_types.assessment_name ในฐานข้อมูลเป็นภาษาอังกฤษ (ใช้เป็น key ในโค้ด)
   - ชื่อไทยตรงกับชื่อในหน้าเมนูแบบประเมิน (assessment-menu*)
   - แบบประเมินที่ staff สร้างเพิ่ม ชื่อเป็นภาษาไทยอยู่แล้ว → แสดงตามเดิม
========================================================= */

const THAI_NAMES: Record<string, string> = {
  "Thai CVD": "ความเสี่ยงโรคหัวใจและหลอดเลือด",
  "Diabetes TDS": "ความเสี่ยงโรคเบาหวาน",
  "Diabetes Risk": "ปัจจัยเสี่ยงโรคเบาหวาน",
  "Blood Pressure": "ความดันโลหิต",
  BMI: "ภาวะน้ำหนักเกิน (BMI)",
  Smoking: "การสูบบุหรี่",
  Alcohol: "การดื่มแอลกอฮอล์",
  "Physical Activity": "การออกกำลังกาย",
  Sleep: "การนอนหลับ",
  Diet: "การรับประทานอาหาร",
  "Oral Health": "สุขภาพช่องปาก",
  Stress: "ความเครียดสะสม",
  "PHQ-2": "ภาวะซึมเศร้า (2Q)",
  "9Q": "ภาวะซึมเศร้า (9Q)",
};

// เทียบแบบไม่สนตัวพิมพ์ เพราะบางหน้าส่งชื่อมาเป็นตัวพิมพ์เล็ก
const BY_LOWER = new Map(Object.entries(THAI_NAMES).map(([k, v]) => [k.toLowerCase(), v]));

// แปลงชื่อแบบประเมิน (อังกฤษ) เป็นชื่อไทย ถ้าไม่รู้จักคืนชื่อเดิม
export const assessmentThaiName = (name: string | null | undefined) => {
  const raw = String(name ?? "").trim();
  return BY_LOWER.get(raw.toLowerCase()) ?? raw;
};

// ระดับผลที่เก็บเป็นภาษาอังกฤษ → ข้อความไทย (แบบอื่นเก็บเป็นภาษาไทยอยู่แล้ว)
const RISK_TEXT: Record<string, Record<string, string>> = {
  "diabetes tds": { low: "เสี่ยงน้อย", moderate: "เสี่ยงปานกลาง", high: "เสี่ยงสูง", very_high: "เสี่ยงสูงมาก" },
};

// แปลงระดับผลที่เก็บเป็นภาษาอังกฤษเป็นข้อความไทยตามแบบประเมิน ถ้าไม่มีในตารางคืนค่าเดิม
export const riskLevelThai = (name: string | null | undefined, riskLevel: string | null | undefined) => {
  const risk = String(riskLevel ?? "").trim();
  return RISK_TEXT[String(name ?? "").trim().toLowerCase()]?.[risk] ?? risk;
};
