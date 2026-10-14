import type { CardTone } from "@/app/components/AssessmentMenuCard";

// ชื่อธีมสีที่หมวดหมู่เลือกใช้ได้
export const CATEGORY_THEMES = ["red", "green", "blue", "amber", "violet", "teal", "pink"] as const;
export type CategoryTheme = (typeof CATEGORY_THEMES)[number];

// ตรวจว่าค่าที่รับมาเป็นชื่อธีมสีหมวดที่รองรับหรือไม่
export const isCategoryTheme = (v: unknown): v is CategoryTheme =>
  typeof v === "string" && (CATEGORY_THEMES as readonly string[]).includes(v);

// ความยาวสูงสุดของชื่อและคำอธิบายสั้นของหมวด
export const CATEGORY_NAME_MAX = 60;
export const CATEGORY_SUBTITLE_MAX = 80;

// ข้อมูลแต่ละธีม: ชื่อไทย สีตัวอย่าง และคลาส Tailwind ที่ใช้บนหน้าหมวด
export const THEME_INFO: Record<
  CategoryTheme,
  { label: string; swatch: string; eyebrow: string; accent: string; back: string }
> = {
  red: {
    label: "แดง",
    swatch: "#ef4962",
    eyebrow: "text-[#b91c2b]",
    accent: "text-[#ef4962]",
    back: "bg-[#fff0f2] text-[#ef4962] hover:bg-[#ffe4e8]",
  },
  green: {
    label: "เขียว",
    swatch: "#67a556",
    eyebrow: "text-[#57965c]",
    accent: "text-[#57965c]",
    back: "bg-[#eef8e9] text-[#57965c] hover:bg-[#e2f2dc]",
  },
  blue: {
    label: "ฟ้า",
    swatch: "#6594c8",
    eyebrow: "text-[#6092cb]",
    accent: "text-[#6092cb]",
    back: "bg-[#eef5ff] text-[#6092cb] hover:bg-[#e2edf9]",
  },
  amber: {
    label: "เหลืองอำพัน",
    swatch: "#d0961f",
    eyebrow: "text-[#a87414]",
    accent: "text-[#d0961f]",
    back: "bg-[#fdf3dc] text-[#a87414] hover:bg-[#f8e9cc]",
  },
  violet: {
    label: "ม่วง",
    swatch: "#8b6fd0",
    eyebrow: "text-[#6e52b5]",
    accent: "text-[#8b6fd0]",
    back: "bg-[#f3effc] text-[#6e52b5] hover:bg-[#e8e0f8]",
  },
  teal: {
    label: "เขียวอมฟ้า",
    swatch: "#3aa898",
    eyebrow: "text-[#2a8676]",
    accent: "text-[#3aa898]",
    back: "bg-[#eaf6f3] text-[#2a8676] hover:bg-[#d8efe9]",
  },
  pink: {
    label: "ชมพู",
    swatch: "#e0679a",
    eyebrow: "text-[#c24f80]",
    accent: "text-[#e0679a]",
    back: "bg-[#fdeef4] text-[#c24f80] hover:bg-[#fae0ea]",
  },
};

// แบบประเมินหนึ่งรายการภายในหมวด (สำหรับหน้าผู้ใช้)
export type CategoryAssessment = { id: number; name: string; description: string | null; questions: number };

// หมวดหมู่พร้อมลิงก์และรายการแบบประเมินในหมวด
export type AssessmentCategory = {
  id: number;
  name: string;
  subtitle: string | null;
  theme: CategoryTheme;
  routePath: string | null;
  builtIn: boolean;
  href: string;
  assessments: CategoryAssessment[];
};

// คืนลิงก์ของหมวด: ใช้ routePath ถ้ามี ไม่งั้นใช้ /assessment-category/{id}
export const categoryHref = (c: { id: number; routePath: string | null }) => c.routePath ?? `/assessment-category/${c.id}`;

// ลำดับโทนสีการ์ดที่ใช้วนให้แบบประเมิน
const CARD_TONES: CardTone[] = ["rose", "green", "blue", "mint", "amber", "teal", "violet", "pink"];
// เลือกโทนสีการ์ดแบบประเมินจาก id (วนตามรายการสี)
export const cardToneFor = (id: number): CardTone => CARD_TONES[Math.abs(id) % CARD_TONES.length];

// หาธีมสีแรกที่ยังไม่มีหมวดใช้ (ถ้าใช้หมดแล้วคืน violet)
export const firstUnusedTheme = (used: string[]): CategoryTheme =>
  CATEGORY_THEMES.find((t) => !used.includes(t)) ?? "violet";
