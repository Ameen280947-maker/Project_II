// ตารางแปลงชื่อแบบประเมินภาษาอังกฤษในฐานข้อมูลเป็นชื่อไทย
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

// ตารางเดียวกันแต่ใช้ key ตัวพิมพ์เล็ก เพื่อค้นแบบไม่สนตัวพิมพ์
const BY_LOWER = new Map(Object.entries(THAI_NAMES).map(([k, v]) => [k.toLowerCase(), v]));

// แปลงชื่อแบบประเมินภาษาอังกฤษเป็นชื่อไทย (ไม่สนตัวพิมพ์) ถ้าไม่รู้จักคืนชื่อเดิม
export const assessmentThaiName = (name: string | null | undefined) => {
  const raw = String(name ?? "").trim();
  return BY_LOWER.get(raw.toLowerCase()) ?? raw;
};

// แปลงรหัสระดับความเสี่ยงภาษาอังกฤษเป็นไทย แยกตามแบบประเมิน
const RISK_TEXT: Record<string, Record<string, string>> = {
  "diabetes tds": { low: "เสี่ยงน้อย", moderate: "เสี่ยงปานกลาง", high: "เสี่ยงสูง", very_high: "เสี่ยงสูงมาก" },
};

// แปลงรหัสระดับความเสี่ยงเป็นภาษาไทยตามแบบประเมิน (เช่น Diabetes TDS) ถ้าไม่มีคืนค่าเดิม
export const riskLevelThai = (name: string | null | undefined, riskLevel: string | null | undefined) => {
  const risk = String(riskLevel ?? "").trim();
  return RISK_TEXT[String(name ?? "").trim().toLowerCase()]?.[risk] ?? risk;
};
