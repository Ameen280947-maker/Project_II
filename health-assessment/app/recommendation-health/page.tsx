"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { riskLevelOf, type Level } from "@/lib/riskLevel";
import type { CalculatedNotification } from "@/lib/notificationRules";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Footprints,
  HeartPulse,
  MessageCircle,
  Moon,
  Phone,
  Printer,
  Ruler,
  Salad,
  Target,
  Wine,
  Zap,
  Cigarette,
  Droplet,
  Check,
  type LucideIcon,
} from "lucide-react";

/* =========================================================
   TYPES (ตรงกับ /api/dashboard และ /api/notifications)
========================================================= */

type Assessment = {
  assessment_id: number;
  assessment_type_id: number;
  assessment_name: string;
  total_score: number | string | null;
  risk_level: string;
  systolic?: number | string | null;
  diastolic?: number | string | null;
  assessed_at: string;
  recommendation_text?: string | null;
  self_harm_flag?: boolean; // 9Q: ตอบข้อคิดทำร้ายตนเอง > 0
};

type DashboardData = {
  success: boolean;
  latestByType: Assessment[];
  assessments: Assessment[];
};

type Category = "mind" | "body" | "behavior";

type TypeConfig = {
  match: string[]; // assessment_name ที่เป็นไปได้ (ตัวพิมพ์เล็ก)
  thaiName: string;
  icon: LucideIcon;
  category: Category;
  max?: number;
  unit?: string;
  detailHref?: string; // หน้าคำแนะนำฉบับเต็มของแต่ละแบบประเมินที่มีอยู่แล้ว
  levelFromScore?: (score: number) => Level;
  why: string;
  steps: string[];
  goal: string;
  seeDoctor?: string; // ใส่เฉพาะเมื่อเอกสารระบุ
  weeklyGoals: string[];
  source?: string; // แหล่งอ้างอิงของเนื้อหาคำแนะนำ
};

/* =========================================================
   THEME (สีเดียวกับระบบเดิม)
========================================================= */

const PRIMARY = "#b91c2b";

const LEVEL_STYLE: Record<Level, { label: string; pill: string; iconWrap: string; dot: string; n: number }> = {
  high: {
    label: "ควรพบผู้เชี่ยวชาญ",
    pill: "bg-red-50 text-red-700 border border-red-100",
    iconWrap: "bg-red-50 text-[#b91c2b]",
    dot: "bg-red-500",
    n: 3,
  },
  mid: {
    label: "ควรระวัง",
    pill: "bg-yellow-50 text-yellow-700 border border-yellow-100",
    iconWrap: "bg-yellow-50 text-yellow-700",
    dot: "bg-yellow-500",
    n: 2,
  },
  ok: {
    label: "ปกติ",
    pill: "bg-green-50 text-green-700 border border-green-100",
    iconWrap: "bg-green-50 text-green-700",
    dot: "bg-green-500",
    n: 1,
  },
  unknown: {
    label: "-",
    pill: "bg-gray-50 text-gray-600 border border-gray-100",
    iconWrap: "bg-gray-50 text-gray-500",
    dot: "bg-gray-400",
    n: 0,
  },
};

const CATEGORY_TABS: { key: "all" | Category; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "mind", label: "สุขภาพจิต" },
  { key: "body", label: "สุขภาพกาย" },
  { key: "behavior", label: "พฤติกรรม" },
];

/* =========================================================
   เนื้อหาคำแนะนำต่อแบบประเมิน
   อ้างอิงเอกสาร "แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยง
   โรคไม่ติดต่อ" กองโรคไม่ติดต่อ กรมควบคุมโรค (เลขตารางกำกับไว้แต่ละแบบ)
   seeDoctor ใส่เฉพาะเมื่อเอกสารระบุไว้
========================================================= */

const TYPE_CONFIGS: TypeConfig[] = [
  // ไม่อยู่ในเอกสาร — เอกสารกำหนดให้ทำ 9Q ต่อจาก 2Q (ตารางที่ 30) ใช้แนวทางกรมสุขภาพจิต
  {
    match: ["9q", "แบบประเมินโรคซึมเศร้า 9q"],
    thaiName: "ภาวะซึมเศร้า (9Q)",
    source: "กรมสุขภาพจิต · แนวทางการดูแลเฝ้าระวังโรคซึมเศร้าระดับจังหวัด (2557)",
    icon: ClipboardList,
    category: "mind",
    max: 27,
    detailHref: "/recommendation_depression_9q",
    levelFromScore: (s) => (s >= 13 ? "high" : s >= 7 ? "mid" : "ok"),
    why: "แบบประเมินต่อจากการคัดกรอง 2Q ใช้ดูระดับอาการซึมเศร้า (กรมสุขภาพจิต)",
    steps: [
      "พบแพทย์หรือบุคลากรสาธารณสุขเพื่อประเมินและรับการดูแล",
      "เล่าความรู้สึกให้คนใกล้ชิดที่ไว้ใจฟัง",
      "ปรึกษาสายด่วนสุขภาพจิต 1323 ได้ตลอด 24 ชั่วโมง",
    ],
    goal: "ได้รับการประเมินจากแพทย์หรือบุคลากรสาธารณสุข",
    seeDoctor: "มีความคิดอยากทำร้ายตนเอง ให้โทร 1323 หรือ 1669 ทันที",
    weeklyGoals: ["นัดพบแพทย์หรือบุคลากรสาธารณสุข"],
  },
  // ตารางที่ 29–30
  {
    match: ["phq-2", "2q", "คัดกรองภาวะซึมเศร้า 2q"],
    thaiName: "คัดกรองภาวะซึมเศร้า (2Q)",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: MessageCircle,
    category: "mind",
    max: 2,
    detailHref: "/recommendation_depression_2q",
    levelFromScore: (s) => (s >= 1 ? "mid" : "ok"),
    why: "ผล 1–2 คะแนน หมายถึงเป็นผู้มีความเสี่ยงหรือมีแนวโน้มที่จะเป็นโรคซึมเศร้า",
    steps: [
      "ทำแบบประเมินโรคซึมเศร้า 9Q ต่อ",
      "สังเกตว่ายังรู้สึกหดหู่ เศร้า ท้อแท้ หรือเบื่อ ทำอะไรก็ไม่เพลิดเพลินหรือไม่",
    ],
    goal: "ทำแบบประเมินโรคซึมเศร้า 9Q ต่อ",
    weeklyGoals: ["ทำแบบประเมิน 9Q ต่อ"],
  },
  // ตารางที่ 27–28 (ST-5)
  {
    match: ["stress", "ความเครียด", "st-5"],
    thaiName: "ความเครียด",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: Zap,
    category: "mind",
    max: 15,
    detailHref: "/recommendation_stress",
    levelFromScore: (s) => (s >= 8 ? "high" : s >= 5 ? "mid" : "ok"),
    why: "ความเครียดที่มากและต่อเนื่องอาจนำไปสู่โรควิตกกังวล ภาวะซึมเศร้า และเสี่ยงต่อการฆ่าตัวตาย",
    steps: [
      "ฝึกการหายใจคลายเครียด",
      "พูดคุยกับคนใกล้ชิด สวดมนต์ไหว้พระ หรือช่วยเหลือผู้อื่นที่ประสบปัญหา",
      "สร้างความหวังว่าจะผ่านอุปสรรคไปได้ และมองเห็นด้านบวก",
      "มองข้ามความขัดแย้งเก่า ๆ ในอดีต",
    ],
    goal: "คะแนนกลับมาอยู่ในระดับเครียดน้อย (0–4 คะแนน)",
    seeDoctor:
      "8–9 คะแนน ควรพบแพทย์ภายใน 2 สัปดาห์ · 10–15 คะแนน ต้องได้รับการรักษาจากแพทย์ทันที และดูแลต่อเนื่อง 3–6 เดือน",
    weeklyGoals: ["ฝึกการหายใจคลายเครียดทุกวัน", "พูดคุยกับคนใกล้ชิดอย่างน้อย 1 ครั้ง"],
  },
  // ตารางที่ 21–22
  {
    match: ["sleep", "การนอนหลับ"],
    thaiName: "การนอนหลับ",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: Moon,
    category: "behavior",
    detailHref: "/recommendation_sleep",
    why: "การนอนไม่พอส่งผลให้เกิดภาวะอ้วน เบาหวาน ความดันโลหิตสูง โรคหัวใจ โรคหลอดเลือดในสมอง และโรคซึมเศร้า",
    steps: [
      "นอนหลับ 7–9 ชั่วโมงต่อวัน และกำหนดเวลานอนให้ชัดเจน",
      "งดดื่มแอลกอฮอล์ก่อนเข้านอน 4 ชั่วโมง และงดสูบบุหรี่ก่อนเข้านอน",
      "หลีกเลี่ยงเครื่องดื่มที่มีคาเฟอีน 6 ชั่วโมงก่อนนอน",
      "หลีกเลี่ยงอาหารมื้อหนักก่อนนอน 4 ชั่วโมง และไม่ออกกำลังกายก่อนนอน 2 ชั่วโมง",
    ],
    goal: "นอนหลับ 7–9 ชั่วโมง ได้ 6–7 วันต่อสัปดาห์",
    weeklyGoals: ["นอนหลับ 7–9 ชั่วโมง อย่างน้อย 6 คืน", "งดคาเฟอีน 6 ชั่วโมงก่อนนอน"],
  },
  // ตารางที่ 11–12
  {
    match: ["bmi", "ภาวะน้ำหนักเกิน", "ดัชนีมวลกาย"],
    thaiName: "ดัชนีมวลกาย",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: Ruler,
    category: "body",
    unit: "kg/m²",
    detailHref: "/recommendation_BMI",
    why: "ภาวะน้ำหนักเกินและอ้วนนำไปสู่โรคไม่ติดต่อเรื้อรัง เช่น โรคหัวใจและหลอดเลือด และโรคเบาหวาน",
    steps: [
      "ผอม (ต่ำกว่า 18.5) ควรเพิ่มน้ำหนัก",
      "น้ำหนักเกิน (23–24.99) ควรลดน้ำหนัก",
      "อ้วน (25–29.99) ต้องลดน้ำหนักอย่างเร่งด่วน",
      "อ้วนอันตราย (30 ขึ้นไป) ต้องลดน้ำหนักอย่างเร่งด่วน และไปพบแพทย์",
    ],
    goal: "ค่า BMI อยู่ในช่วง 18.5–22.99 (ปกติ)",
    seeDoctor: "ค่า BMI ตั้งแต่ 30 ขึ้นไป (อ้วนอันตราย)",
    weeklyGoals: ["ชั่งน้ำหนักและติดตามค่า BMI"],
  },
  // ตารางที่ 3–4
  {
    match: ["blood pressure", "ความดันโลหิต"],
    thaiName: "ความดันโลหิต",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: HeartPulse,
    category: "body",
    unit: "mmHg",
    detailHref: "/recommendation_DB",
    why: "หากควบคุมความดันโลหิตไม่ได้ตามเกณฑ์ จะเกิดภาวะแทรกซ้อน โดยเฉพาะโรคหัวใจและหลอดเลือด และโรคไต",
    steps: [
      "ลดอาหารรสหวาน มัน เค็ม และเพิ่มผัก ผลไม้ ธัญพืช",
      "เลิกสูบบุหรี่และงดเครื่องดื่มแอลกอฮอล์",
      "ออกกำลังกาย 30 นาที/ครั้ง 5 ครั้ง/สัปดาห์ หรือสะสม 150 นาที/สัปดาห์",
      "ควบคุมน้ำหนัก ทำจิตใจให้ผ่อนคลาย และนอนหลับพักผ่อนให้เพียงพอ",
    ],
    goal: "ความดันโลหิตอยู่ในระดับปกติ (90–129 / 60–84 mmHg)",
    seeDoctor:
      "นั่งพัก 5 นาทีแล้ววัดซ้ำ ถ้ายังสูง: 140–159/90–99 พบแพทย์ภายใน 3 เดือน · 160–179/100–109 ภายใน 1 เดือน · ตั้งแต่ 180/110 ต้องพบแพทย์ทันที",
    weeklyGoals: ["วัดความดันโลหิตและจดบันทึก", "ออกกำลังกายสะสม 150 นาที"],
  },
  // ตารางที่ 1–2
  {
    match: ["thai cvd", "cvd", "โรคหัวใจและหลอดเลือด"],
    thaiName: "ความเสี่ยงโรคหัวใจและหลอดเลือด",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: HeartPulse,
    category: "body",
    unit: "%",
    detailHref: "/recommendation-CVD",
    levelFromScore: (s) => (s >= 30 ? "high" : s >= 10 ? "mid" : "ok"),
    why: "บอกโอกาสเสี่ยงที่จะเป็นโรคหัวใจและสมองในอีก 10 ปีข้างหน้า",
    steps: [
      "ออกกำลังกายอย่างสม่ำเสมอ",
      "รับประทานผักผลไม้เป็นประจำ",
      "เลิกสูบบุหรี่ และควบคุมระดับน้ำตาลในเลือดให้อยู่ในเกณฑ์ปกติ",
      "ควบคุมน้ำหนักและความดันโลหิตให้อยู่ในเกณฑ์ปกติ",
    ],
    goal: "ความเสี่ยงต่ำกว่า 10% (เสี่ยงน้อย)",
    seeDoctor: "ความเสี่ยงตั้งแต่ 30% ขึ้นไป (เสี่ยงสูง) ควรเข้ารับคำปรึกษาจากแพทย์",
    weeklyGoals: ["ออกกำลังกายอย่างสม่ำเสมอ", "รับประทานผักผลไม้ทุกวัน"],
  },
  // ตารางที่ 5–7 (Thai Diabetes Score)
  {
    match: ["diabetes tds", "diabetes", "เบาหวาน", "ความเสี่ยงโรคเบาหวาน"],
    thaiName: "ความเสี่ยงโรคเบาหวาน",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: Droplet,
    category: "body",
    unit: "%",
    detailHref: "/recommendation_diabetes",
    why: "บอกร้อยละความเสี่ยงของการเกิดโรคเบาหวานใน 12 ปีข้างหน้า",
    steps: [
      "ออกกำลังกายสม่ำเสมอ (ระดับเสี่ยงสูงขึ้นไป ควบคุมอาหารร่วมด้วย)",
      "ควบคุมน้ำหนักให้อยู่ในเกณฑ์ที่เหมาะสม",
      "ตรวจวัดความดันโลหิต",
      "ระดับเสี่ยงสูงขึ้นไป ตรวจระดับน้ำตาลในเลือด",
    ],
    goal: "ความเสี่ยงอยู่ในระดับเสี่ยงน้อย",
    seeDoctor: "ระดับเสี่ยงสูงหรือสูงมาก ควรเข้ารับการตรวจระดับน้ำตาลในเลือดที่หน่วยบริการ",
    weeklyGoals: ["ออกกำลังกายสม่ำเสมอ", "ควบคุมอาหารและน้ำหนัก"],
  },
  // ตารางที่ 23–24
  {
    match: ["diet", "พฤติกรรมการรับประทานอาหาร", "อาหาร"],
    thaiName: "พฤติกรรมการรับประทานอาหาร",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: Salad,
    category: "behavior",
    detailHref: "/recommendation_diet",
    why: "กินผักน้อย และกินหวาน มัน เค็มมาก เสี่ยงต่อโรคอ้วน เบาหวาน ความดันโลหิตสูง และไขมันในเลือดสูง",
    steps: [
      "กินผักวันละ 5 ทัพพี ให้หลากหลายสี เน้นผักสด ผักต้ม",
      "หลีกเลี่ยงเครื่องดื่มรสหวาน ขนมหวาน และการเติมน้ำตาล น้ำผึ้ง",
      "หลีกเลี่ยงอาหารทอด อาหารใส่กะทิ และเนื้อสัตว์ติดมัน",
      "หลีกเลี่ยงอาหารแปรรูป อาหารกึ่งสำเร็จรูป ผงปรุงรส และชิมก่อนปรุงทุกครั้ง",
    ],
    goal: "กินผักวันละ 5 ทัพพีทุกวัน และลดหวาน มัน เค็ม",
    weeklyGoals: ["กินผักวันละ 5 ทัพพี อย่างน้อย 5 วัน", "ชิมก่อนปรุงทุกมื้อ"],
  },
  // ตารางที่ 17–20
  {
    match: ["physical activity", "กิจกรรมทางกาย"],
    thaiName: "กิจกรรมทางกาย",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: Footprints,
    category: "behavior",
    detailHref: "/recommendation_physical_activity",
    why: "กิจกรรมทางกายไม่เพียงพอ เสี่ยงต่อโรคเบาหวาน ความดันโลหิต โรคหลอดเลือดหัวใจตีบ และตายก่อนวัยอันควร",
    steps: [
      "มีกิจกรรมทางกายจนเหนื่อยกว่าปกติ สะสมอย่างน้อย 150 นาทีต่อสัปดาห์",
      "ถ้ายังไม่เคยออกกำลังกาย เริ่มเบา ๆ แล้วค่อยเพิ่มความหนัก",
      "ลุกขึ้นขยับร่างกายทุก 2 ชั่วโมงเมื่อต้องนั่งนาน",
      "เพิ่มการฝึกความแข็งแรงและยืดเหยียดกล้ามเนื้อ",
    ],
    goal: "มีกิจกรรมทางกายสะสม 150 นาทีต่อสัปดาห์",
    weeklyGoals: ["ออกกำลังกายสะสม 150 นาที", "ลุกขยับร่างกายทุก 2 ชั่วโมง"],
  },
  // ตารางที่ 15–16
  {
    match: ["alcohol", "การดื่มแอลกอฮอล์", "แอลกอฮอล์"],
    thaiName: "การดื่มแอลกอฮอล์",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: Wine,
    category: "behavior",
    detailHref: "/recommendation_alcohol",
    why: "การดื่มมากต่อเนื่องทำให้เกิดโรค เช่น ความดันโลหิตสูง อัมพาต ตับแข็ง และอุบัติเหตุ",
    steps: [
      "ลดปริมาณการดื่ม หรือเลิกดื่ม",
      "ตั้งเป้าหมายว่าจะเลิกดื่มเพื่อใคร",
      "ปรับเปลี่ยนสิ่งแวดล้อมรอบตัวและการเข้าสังคมที่ทำให้ดื่ม",
    ],
    goal: "ลดปริมาณการดื่ม หรือเลิกดื่ม",
    seeDoctor: "คะแนนตั้งแต่ 27 ขึ้นไป (เสี่ยงสูง) ควรพบเจ้าหน้าที่สาธารณสุขเพื่อเข้ารับการบำบัด",
    weeklyGoals: ["ลดปริมาณการดื่มลงจากสัปดาห์ก่อน"],
  },
  // ตารางที่ 13–14
  {
    match: ["smoking", "การสูบบุหรี่", "บุหรี่"],
    thaiName: "การสูบบุหรี่",
    source: "กรมควบคุมโรค · แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ",
    icon: Cigarette,
    category: "behavior",
    detailHref: "/recommendation_smoking",
    why: "การสูบบุหรี่เพิ่มโอกาสเกิดโรคหัวใจ ถุงลมโป่งพอง และมะเร็งปอด ทำให้อายุเฉลี่ยสั้นลง 12 ปี",
    steps: [
      "Delay — อย่าสูบบุหรี่ทันทีที่อยากสูบ",
      "Deep Breath — หายใจเข้าออกลึก ๆ 5–10 ครั้ง",
      "Drink Water — จิบน้ำบ่อย ๆ หรือดื่มน้ำผลไม้รสเปรี้ยว",
      "Do something else — หากิจกรรมอื่นแทนการสูบบุหรี่",
      "Destination — คิดถึงข้อดีของการเลิกบุหรี่สำเร็จ",
    ],
    goal: "กำหนดวันเลิกบุหรี่ และทดลองเลิกตามขั้นตอน 5D",
    seeDoctor: "5–8 คะแนน (เสี่ยงสูง) ควรได้รับความช่วยเหลือจากบุคลากรทางการแพทย์ หรือโทรสายด่วนเลิกบุหรี่ 1600",
    weeklyGoals: ["กำหนดวันเลิกบุหรี่", "ทำตามขั้นตอน 5D ทุกครั้งที่อยากสูบ"],
  },
];

// เป้าหมายพื้นฐานเพื่อป้องกัน NCDs (แสดงเสมอ) — ตารางที่ 4, 18 และ 23
const BASE_GOALS = ["ออกกำลังกายสะสมอย่างน้อย 150 นาที", "กินผักวันละ 5 ทัพพี"];

const FALLBACK_CONFIG: TypeConfig = {
  match: [],
  thaiName: "",
  icon: Activity,
  category: "body",
  why: "ติดตามผลอย่างต่อเนื่องเพื่อดูการเปลี่ยนแปลง",
  steps: ["ดูรายละเอียดผลการประเมินและคำแนะนำ", "ทำแบบประเมินซ้ำตามรอบ"],
  goal: "ทำแบบประเมินซ้ำตามรอบที่กำหนด",
  seeDoctor: "มีอาการผิดปกติหรือมีข้อสงสัยเกี่ยวกับสุขภาพ",
  weeklyGoals: [],
};

const HOTLINES = [
  { number: "1669", label: "การแพทย์ฉุกเฉิน", style: "bg-red-50 text-[#b91c2b] hover:bg-red-100" },
  { number: "1323", label: "สุขภาพจิต", style: "bg-gray-50 text-gray-900 hover:bg-gray-100" },
  { number: "1600", label: "เลิกบุหรี่", style: "bg-gray-50 text-gray-900 hover:bg-gray-100" },
  { number: "1413", label: "เลิกเหล้า", style: "bg-gray-50 text-gray-900 hover:bg-gray-100" },
];

const RED_FLAGS = [
  "เจ็บแน่นหน้าอก หายใจไม่อิ่ม เหงื่อแตก",
  "หน้าเบี้ยว แขนขาอ่อนแรง พูดไม่ชัดทันที",
  "ความดันตั้งแต่ 180/110 mmHg ร่วมกับปวดศีรษะรุนแรง",
  "มีความคิดอยากทำร้ายตัวเอง",
];

/* =========================================================
   HELPERS
========================================================= */

const getConfig = (name?: string | null): TypeConfig => {
  const key = String(name || "").toLowerCase().trim();
  return TYPE_CONFIGS.find((c) => c.match.includes(key)) ?? FALLBACK_CONFIG;
};

const isBloodPressure = (a: Assessment) =>
  String(a.assessment_name || "").toLowerCase().trim() === "blood pressure";

const scoreOf = (a?: Assessment | null): number => {
  if (!a) return NaN;
  const raw = isBloodPressure(a) ? a.systolic : a.total_score;
  return raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
};

const formatScore = (n: number) => {
  if (!Number.isFinite(n)) return "-";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const displayScore = (a: Assessment) => {
  if (isBloodPressure(a)) {
    return a.systolic != null && a.diastolic != null ? `${a.systolic}/${a.diastolic}` : "-";
  }
  return formatScore(scoreOf(a));
};

const getLevel = (a: Assessment): Level => {
  // 9Q ที่ตอบข้อคิดทำร้ายตนเอง = เสี่ยงสูงเสมอ ไม่ว่าคะแนนรวมเท่าไร
  if (a.self_harm_flag) return "high";
  const cfg = getConfig(a.assessment_name);
  const s = scoreOf(a);
  if (cfg.levelFromScore && Number.isFinite(s)) return cfg.levelFromScore(s);
  return riskLevelOf(a.assessment_name, a.risk_level);
};

const formatDate = (date?: string | null) =>
  date ? new Date(date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";

// ใช้วันจันทร์ของสัปดาห์เป็น key สำหรับเก็บเป้าหมายรายสัปดาห์
const weekKey = () => {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
};

const resultHref = (a: Assessment) => {
  const cfg = getConfig(a.assessment_name);
  return cfg.detailHref
    ? `${cfg.detailHref}?assessmentId=${a.assessment_id}`
    : `/history?assessmentId=${a.assessment_id}`;
};

/* =========================================================
   PAGE
========================================================= */

export default function RecommendationHealthPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [notifs, setNotifs] = useState<CalculatedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [showFlags, setShowFlags] = useState(false);
  const [doneGoals, setDoneGoals] = useState<Record<string, boolean>>({});

  /* ---------- load ---------- */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const uid = localStorage.getItem("userId");
        if (!uid) throw new Error("ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่");
        setUserId(uid);

        // เป้าหมายรายสัปดาห์เก็บไว้ในเครื่อง แยกตามผู้ใช้และสัปดาห์
        try {
          const saved = localStorage.getItem(`weeklyGoals:${uid}:${weekKey()}`);
          if (saved) setDoneGoals(JSON.parse(saved));
        } catch {
          /* ignore */
        }

        const [dashRes, notifRes] = await Promise.all([
          fetch(`/api/dashboard?userId=${encodeURIComponent(uid)}`, { cache: "no-store" }),
          fetch(`/api/notifications?userId=${encodeURIComponent(uid)}`, { cache: "no-store" }),
        ]);
        // session หมดอายุ → กลับไปหน้า login
        if (dashRes.status === 401) {
          localStorage.removeItem("userId");
          router.replace("/login");
          return;
        }
        const dash = await dashRes.json();
        const notif = await notifRes.json().catch(() => ({}));

        if (!dashRes.ok) throw new Error(dash.message || "ไม่สามารถโหลดคำแนะนำได้");
        setData(dash);
        if (notif?.success) setNotifs(notif.notifications || []);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลได้");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  /* ---------- derive ---------- */
  const latest = data?.latestByType ?? [];
  const history = data?.assessments ?? [];

  const plans = useMemo(
    () =>
      latest
        .filter((a) => {
          const l = getLevel(a);
          return l === "high" || l === "mid";
        })
        .sort(
          (a, b) =>
            // ข้อคิดทำร้ายตนเองขึ้นก่อนเสมอ
            Number(!!b.self_harm_flag) - Number(!!a.self_harm_flag) ||
            LEVEL_STYLE[getLevel(b)].n - LEVEL_STYLE[getLevel(a)].n ||
            new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime()
        ),
    [latest]
  );

  const goods = useMemo(() => latest.filter((a) => getLevel(a) === "ok"), [latest]);

  const previousOf = (a: Assessment) =>
    history
      .filter(
        (x) =>
          x.assessment_type_id === a.assessment_type_id &&
          new Date(x.assessed_at).getTime() < new Date(a.assessed_at).getTime()
      )
      .sort((x, y) => new Date(y.assessed_at).getTime() - new Date(x.assessed_at).getTime())[0];

  const notifOf = (a: Assessment) => notifs.find((n) => n.assessmentTypeId === a.assessment_type_id);

  const weeklyGoals = useMemo(() => {
    const fromPlans = plans.flatMap((a) =>
      getConfig(a.assessment_name).weeklyGoals.map((g) => ({ label: g, from: `จากแผน: ${getConfig(a.assessment_name).thaiName || a.assessment_name}` }))
    );
    const all = [...fromPlans, ...BASE_GOALS.map((g) => ({ label: g, from: "หลักป้องกัน NCDs" }))];
    // ตัดเป้าหมายที่ซ้ำกัน
    return all.filter((g, i) => all.findIndex((x) => x.label === g.label) === i).slice(0, 7);
  }, [plans]);

  const doneCount = weeklyGoals.filter((g) => doneGoals[g.label]).length;
  const progress = weeklyGoals.length ? Math.round((doneCount / weeklyGoals.length) * 100) : 0;

  const toggleGoal = (label: string) => {
    const next = { ...doneGoals, [label]: !doneGoals[label] };
    setDoneGoals(next);
    if (userId) {
      try {
        localStorage.setItem(`weeklyGoals:${userId}:${weekKey()}`, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  };

  const inFilter = (a: Assessment) => filter === "all" || getConfig(a.assessment_name).category === filter;
  const shownPlans = plans.filter(inFilter);

  // เปิดการ์ดแรกไว้ตอนโหลดเสร็จ
  useEffect(() => {
    if (openId === null && plans.length > 0) setOpenId(plans[0].assessment_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  /* ---------- render ---------- */
  return (
    <div className="flex min-h-screen bg-[#faf9f7]">
      <Sidebar />

      <main className="flex-1 min-w-0 px-6 py-8 lg:px-10">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="py-32 text-center" role="status">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-[#b91c2b] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">กำลังโหลดคำแนะนำ...</p>
            </div>
          ) : error ? (
            <div className="max-w-xl mx-auto mt-16 bg-white border border-red-100 rounded-3xl p-8 text-center">
              <AlertTriangle size={44} className="text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-gray-800 mb-2">ไม่สามารถโหลดข้อมูลได้</h1>
              <p className="text-gray-500">{error}</p>
            </div>
          ) : (
            <>
              {/* =================================================
                  HEADER
              ================================================= */}
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                  <p className="text-sm font-bold tracking-[0.25em] text-[#b91c2b] uppercase">Health Recommendations</p>
                  <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mt-3">
                    คำแนะนำ<span className="text-[#b91c2b]">สุขภาพ</span>
                  </h1>
                </div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition self-start sm:self-auto print:hidden"
                >
                  <Printer size={18} />
                  พิมพ์ / บันทึกเป็น PDF
                </button>
              </div>

              {/* =================================================
                  SUMMARY
              ================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <SummaryCard
                  icon={AlertTriangle}
                  iconWrap="bg-red-50 text-[#b91c2b]"
                  label="เรื่องที่ควรดูแลก่อน"
                  value={plans.length}
                  unit="เรื่อง"
                />
                <SummaryCard
                  icon={CheckCircle2}
                  iconWrap="bg-green-50 text-green-700"
                  label="ผลอยู่ในเกณฑ์ดี"
                  value={goods.length}
                  unit="ด้าน"
                />
                <div className="bg-white border border-gray-100 rounded-3xl p-6 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Target size={26} />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-500 text-sm">เป้าหมายสัปดาห์นี้</p>
                    <p className="text-3xl font-bold text-gray-800">
                      {doneCount} <span className="text-base font-medium text-gray-400">/ {weeklyGoals.length} สำเร็จ</span>
                    </p>
                    <div className="h-1.5 rounded-full bg-gray-100 mt-2">
                      <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* =================================================
                  URGENT HELP
              ================================================= */}
              <section className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 mb-8">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
                  <h2 className="flex items-center gap-2 font-bold text-gray-800">
                    <Phone size={18} className="text-[#b91c2b]" />
                    สายด่วนช่วยเหลือ (โทรฟรี 24 ชม.)
                  </h2>
                  <button
                    onClick={() => setShowFlags((v) => !v)}
                    aria-expanded={showFlags}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#b91c2b] hover:underline"
                  >
                    สัญญาณอันตราย
                    <ChevronDown size={16} className={`transition-transform ${showFlags ? "rotate-180" : ""}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {HOTLINES.map((h) => (
                    <a
                      key={h.number}
                      href={`tel:${h.number}`}
                      className={`flex items-baseline gap-2 px-4 py-3 rounded-2xl transition ${h.style}`}
                    >
                      <span className="text-xl font-bold">{h.number}</span>
                      <span className="text-sm opacity-80">{h.label}</span>
                    </a>
                  ))}
                </div>

                {showFlags && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="font-semibold text-gray-800 mb-3">ควรไปโรงพยาบาลหรือโทร 1669 ทันที หากมีอาการเหล่านี้</p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {RED_FLAGS.map((f) => (
                        <li key={f} className="flex gap-2 text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#b91c2b] mt-2 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* =================================================
                  PLAN + WEEKLY GOALS
              ================================================= */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
                {/* ---------- Plan ---------- */}
                <section className="xl:col-span-2 flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#b91c2b] uppercase tracking-wider">Your Plan</p>
                      <h2 className="text-2xl font-bold text-gray-800 mt-1">แผนดูแลตามลำดับความสำคัญ</h2>
                    </div>
                    <div role="tablist" aria-label="หมวดคำแนะนำ" className="flex flex-wrap gap-2">
                      {CATEGORY_TABS.map((t) => (
                        <button
                          key={t.key}
                          role="tab"
                          aria-selected={filter === t.key}
                          onClick={() => setFilter(t.key)}
                          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                            filter === t.key ? "bg-[#b91c2b] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {latest.length === 0 ? (
                    <EmptyBox
                      text="ยังไม่มีผลการประเมิน ทำแบบประเมินก่อนเพื่อรับคำแนะนำที่เหมาะกับคุณ"
                      action={{ href: "/assessment-type", label: "ทำแบบประเมิน" }}
                    />
                  ) : shownPlans.length === 0 ? (
                    <EmptyBox text="ไม่มีเรื่องที่ต้องดูแลเร่งด่วนในหมวดนี้" />
                  ) : (
                    shownPlans.map((a, i) => (
                      <PlanCard
                        key={a.assessment_id}
                        rank={i + 1}
                        assessment={a}
                        previous={previousOf(a)}
                        notification={notifOf(a)}
                        open={openId === a.assessment_id}
                        onToggle={() => setOpenId(openId === a.assessment_id ? null : a.assessment_id)}
                      />
                    ))
                  )}
                </section>

                {/* ---------- Weekly goals ---------- */}
                <aside className="flex flex-col gap-6">
                  <div className="bg-white border border-gray-100 rounded-3xl p-6">
                    <p className="text-sm font-semibold text-[#b91c2b] uppercase tracking-wider">This Week</p>
                    <h2 className="text-xl font-bold text-gray-800 mt-1">เป้าหมายสัปดาห์นี้</h2>

                    <div className="flex items-center gap-3 mt-4 mb-2">
                      <div className="flex-1 h-2.5 rounded-full bg-gray-100">
                        <div className="h-2.5 rounded-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{progress}%</span>
                    </div>

                    <div className="flex flex-col">
                      {weeklyGoals.map((g) => {
                        const on = !!doneGoals[g.label];
                        return (
                          <button
                            key={g.label}
                            role="checkbox"
                            aria-checked={on}
                            onClick={() => toggleGoal(g.label)}
                            className="flex items-start gap-3 text-left px-2 py-2.5 rounded-xl hover:bg-gray-50 transition"
                          >
                            <span
                              className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                                on ? "bg-green-500 border-green-500" : "bg-white border-gray-300"
                              }`}
                            >
                              {on && <Check size={13} strokeWidth={3} className="text-white" />}
                            </span>
                            <span>
                              <span className={`block text-sm font-medium ${on ? "line-through text-gray-400" : "text-gray-800"}`}>
                                {g.label}
                              </span>
                              <span className="block text-xs text-gray-400">{g.from}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </aside>
              </div>

            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function SummaryCard({
  icon: Icon,
  iconWrap,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  iconWrap: string;
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${iconWrap}`}>
        <Icon size={26} />
      </div>
      <div>
        <p className="text-gray-500 text-sm">{label}</p>
        <p className="text-3xl font-bold text-gray-800">
          {value} <span className="text-base font-medium text-gray-400">{unit}</span>
        </p>
      </div>
    </div>
  );
}

function EmptyBox({ text, action }: { text: string; action?: { href: string; label: string } }) {
  return (
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center">
      <p className="text-gray-500">{text}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex mt-4 px-5 py-2.5 rounded-xl bg-[#b91c2b] text-white font-semibold hover:bg-[#991b1b] transition"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

function PlanCard({
  rank,
  assessment: a,
  previous,
  notification,
  open,
  onToggle,
}: {
  rank: number;
  assessment: Assessment;
  previous?: Assessment;
  notification?: CalculatedNotification;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const cfg = getConfig(a.assessment_name);
  const level = getLevel(a);
  const s = LEVEL_STYLE[level];
  const Icon = cfg.icon;

  const score = scoreOf(a);
  const prevScore = scoreOf(previous);
  const delta = Number.isFinite(score) && Number.isFinite(prevScore) ? Math.round((score - prevScore) * 100) / 100 : null;

  const isDue = notification?.status === "overdue" || notification?.status === "due_today";
  const reassessText = notification
    ? `${notification.statusText}${notification.dueDate ? ` · ${formatDate(notification.dueDate)}` : ""}`
    : "ตามรอบในหน้าการแจ้งเตือน";
  const reassessHref = notification?.actionUrl || "/assessment-type";

  return (
    <article className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
      <button onClick={onToggle} aria-expanded={open} className="w-full text-left p-5 sm:p-6 flex items-center gap-4 hover:bg-gray-50/60 transition">
        <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center shrink-0">
          {rank}
        </span>
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${s.iconWrap}`}>
          <Icon size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-gray-800">{cfg.thaiName || a.assessment_name}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.pill}`}>{s.label}</span>
          </span>
          <span className="block text-sm text-gray-500 mt-1">
            ผล {displayScore(a)}
            {cfg.max ? `/${cfg.max}` : cfg.unit ? ` ${cfg.unit}` : ""} · {a.risk_level} · ประเมินเมื่อ {formatDate(a.assessed_at)}
          </span>
          {((delta !== null && delta !== 0) || isDue) && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold">
              {delta !== null && delta !== 0 && (
                <span className={delta > 0 ? "text-[#b91c2b]" : "text-green-700"}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} จากครั้งก่อน
                </span>
              )}
              {isDue && <span className="text-yellow-700">● ถึงรอบประเมินซ้ำ</span>}
            </span>
          )}
        </span>
        <ChevronDown size={20} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* 9Q ตอบข้อคิดทำร้ายตนเอง → แสดงช่องทางช่วยเหลือเสมอ แม้ยังไม่เปิดการ์ด */}
      {a.self_harm_flag && (
        <div className="mx-5 sm:mx-6 mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <AlertTriangle size={20} className="text-[#b91c2b] shrink-0" />
          <p className="flex-1 min-w-[220px] text-sm text-[#991b1b]">
            <span className="font-bold">ผลประเมินพบความคิดทำร้ายตนเอง · </span>
            โปรดขอความช่วยเหลือทันที และไปพบแพทย์ที่สถานพยาบาลใกล้บ้านเพื่อประเมินความเสี่ยงการฆ่าตัวตาย (8Q)
          </p>
          <a
            href="tel:1323"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#b91c2b] text-white text-sm font-semibold hover:bg-[#991b1b] transition"
          >
            <Phone size={16} />
            โทร 1323 สายด่วนสุขภาพจิต (24 ชม.)
          </a>
        </div>
      )}

      {open && (
        <div className="mx-5 sm:mx-6 pt-5 pb-6 border-t border-gray-100 flex flex-col gap-6">
          <p className="text-sm text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-800">ทำไมเรื่องนี้สำคัญ · </span>
            {cfg.why}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <p className="font-bold text-gray-800 mb-3">สิ่งที่ทำได้เลย</p>
              <ol className="space-y-2.5">
                {cfg.steps.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm text-gray-600">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              {/* คำแนะนำจากฐานข้อมูล (ถ้ามี) */}
              {a.recommendation_text?.trim() && (
                <div className="mt-5 rounded-2xl bg-[#faf9f7] p-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">คำแนะนำสำหรับผลของคุณ</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{a.recommendation_text}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <InfoBox tone="blue" title="เป้าหมาย" text={cfg.goal} />
              {cfg.seeDoctor && <InfoBox tone="red" title="ควรพบผู้เชี่ยวชาญเมื่อ" text={cfg.seeDoctor} />}
              <InfoBox tone="gray" title="ประเมินซ้ำ" text={reassessText} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={reassessHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#b91c2b] text-white font-semibold hover:bg-[#991b1b] transition"
            >
              ทำแบบประเมินซ้ำ
              <ArrowRight size={16} />
            </Link>
            <button
              onClick={() => router.push(resultHref(a))}
              className="inline-flex items-center px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              ดูผลการประเมินครั้งล่าสุด
            </button>
          </div>

          {cfg.source && (
            <p className="-mt-2 text-right text-[11px] leading-snug text-gray-400">อ้างอิง: {cfg.source}</p>
          )}
        </div>
      )}
    </article>
  );
}

function InfoBox({ tone, title, text }: { tone: "blue" | "red" | "gray"; title: string; text: string }) {
  const styles = {
    blue: "border-blue-400 text-blue-700",
    red: "border-[#b91c2b] text-[#b91c2b]",
    gray: "border-gray-300 text-gray-600",
  }[tone];
  return (
    <div className={`border-l-[3px] pl-4 py-0.5 ${styles}`}>
      <p className="text-xs font-bold tracking-wide">{title}</p>
      <p className="text-sm text-gray-700 mt-0.5">{text}</p>
    </div>
  );
}