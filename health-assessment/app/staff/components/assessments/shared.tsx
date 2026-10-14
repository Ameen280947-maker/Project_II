"use client";

import type { ReactNode } from "react";
import type { SnapLevel, SnapQuestion, Snapshot } from "@/lib/staff/assessmentVersions";
import type { CategoryTheme } from "@/lib/assessmentCategories";

export type { SnapLevel, SnapQuestion, Snapshot };

// แถวแบบประเมินในรายการฝั่งเจ้าหน้าที่ (สถานะ จำนวนคำถาม ร่าง เวอร์ชัน)
export type TypeRow = {
  id: number;
  name: string;
  label: string;
  description: string | null;
  isActive: boolean;
  questions: number;
  missing: number;
  versionNo: number | null;
  hasDraft: boolean;
  categoryId: number | null;
  builtIn: boolean;
};

// ตัวเลือกหมวดหมู่สำหรับ dropdown พร้อมจำนวนแบบประเมินในหมวด
export type CategoryOption = {
  id: number;
  name: string;
  subtitle: string | null;
  theme: CategoryTheme;
  routePath: string | null;
  builtIn: boolean;
  types: number;
};

// รายละเอียดแบบประเมินที่เปิดแก้ไข: เนื้อหาร่าง/ที่ใช้อยู่ ข้อมูลเวอร์ชัน และผู้แก้ล่าสุดของแต่ละระดับ
export type Detail = {
  id: number;
  name: string;
  label: string;
  isActive: boolean;
  categoryId: number | null;
  generic: boolean;
  builtIn: boolean;
  resultCount: number;
  deletable: boolean;
  content: Snapshot;
  live: Snapshot;
  draft: { updatedAt: string; by: string | null } | null;
  published: { versionId: number; versionNo: number; at: string; by: string | null; used: number } | null;
  levelMeta: Record<string, { at: string | null; by: string | null }>;
};

// ชนิดข้อมูลฝั่งฟอร์มแก้ไข (เพิ่ม key ให้แต่ละคำถาม/ระดับ) และ state ทั้งหมดของฟอร์ม
export type EQuestion = SnapQuestion & { key: string };
export type ELevel = SnapLevel & { key: string };
export type EState = { description: string; source: string; questions: EQuestion[]; levels: ELevel[] };

// ตัวนับสำหรับสร้าง key ชั่วคราว
let keySeq = 0;
// สร้าง key ชั่วคราวที่ไม่ซ้ำสำหรับรายการในฟอร์มแก้ไข
export const newKey = () => `k${++keySeq}`;

// แปลง snapshot จาก API เป็น state ที่แก้ไขได้ (คัดลอกข้อมูลและใส่ key ให้ทุกรายการ)
export const toEditable = (s: Snapshot): EState => ({
  description: s.description ?? "",
  source: s.source ?? "",
  questions: s.questions.map((q) => ({ ...q, choices: q.choices.map((c) => ({ ...c })), key: newKey() })),
  levels: s.levels.map((l) => ({ ...l, key: newKey() })),
});

// แปลง state ในฟอร์มกลับเป็น snapshot สำหรับบันทึกร่าง/เผยแพร่ (ตัด key ออก)
export const toSnapshot = (e: EState, base: { name: string; generic: boolean }): Snapshot => ({
  name: base.name,
  generic: base.generic,
  description: e.description,
  source: e.source,
  questions: e.questions.map((q) => ({
    id: q.id,
    text: q.text,
    type: q.type,
    choices: q.type === "choice" ? q.choices.map((c) => ({ id: c.id, text: c.text, score: c.score })) : [],
  })),
  levels: e.levels.map((l) => ({
    id: l.id,
    riskLevel: l.riskLevel,
    min: l.min,
    max: l.max,
    severity: l.severity,
    text: l.text,
    reassessDays: l.reassessDays,
    hotline: l.hotline,
    source: l.source,
  })),
});

// ตรวจว่าระดับผลยังไม่มีข้อความคำแนะนำหรือไม่
export const isMissing = (l: { text: string }) => !l.text.trim();

// ความยาวคำแนะนำที่แนะนำ (ตัวอักษร) ให้อ่านง่ายบนมือถือ
export const MAX_HINT = 300;

// รายการสายด่วนที่เลือกแสดงคู่กับคำแนะนำได้
export const HOTLINES = [
  { value: "", label: "ไม่แสดงสายด่วน" },
  { value: "1323 สายด่วนสุขภาพจิต", label: "1323 สายด่วนสุขภาพจิต" },
  { value: "1600 สายด่วนเลิกบุหรี่", label: "1600 สายด่วนเลิกบุหรี่" },
  { value: "1413 สายด่วนเลิกเหล้า", label: "1413 สายด่วนเลิกเหล้า" },
  { value: "1669 การแพทย์ฉุกเฉิน", label: "1669 การแพทย์ฉุกเฉิน" },
  { value: "1422 กรมควบคุมโรค", label: "1422 กรมควบคุมโรค" },
];

// คลาสสีจุดและป้ายระดับผล ตามความรุนแรง 0–3
export const SEV_DOT = ["bg-risk-ok", "bg-risk-mid", "bg-[#f07a3a]", "bg-risk-crit"];
export const SEV_PILL_USER = [
  "bg-[#e8f7ed] text-[#21733f]",
  "bg-[#fff3dc] text-[#8a5a00]",
  "bg-[#ffe9dc] text-[#9a4210]",
  "bg-[#fde6e7] text-[#a61e28]",
];

// แสดงช่วงคะแนนของระดับผลเป็นข้อความ หรือบอกว่าคำนวณในระบบ
export const rangeText = (l: { min: number | null; max: number | null }) =>
  l.min !== null && l.max !== null ? `คะแนน ${l.min}–${l.max}` : "เกณฑ์คำนวณในระบบ";

// คำนวณคะแนนรวมต่ำสุด-สูงสุดที่เป็นไปได้จากคำถามแบบเลือกตอบทั้งหมด
export function possibleRange(questions: SnapQuestion[]) {
  const qs = questions.filter((q) => q.type === "choice" && q.choices.length);
  return {
    count: qs.length,
    min: qs.reduce((s, q) => s + Math.min(...q.choices.map((c) => c.score)), 0),
    max: qs.reduce((s, q) => s + Math.max(...q.choices.map((c) => c.score)), 0),
  };
}

// ปุ่มไอคอนสี่เหลี่ยมเล็ก มี tooltip/aria-label และโหมดสีแดงสำหรับการลบ
export function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border bg-white transition disabled:opacity-30 ${
        danger ? "border-[#f7c6c9] text-risk-crit hover:bg-[#fff5f5]" : "border-staff-line text-staff-muted hover:border-staff-300 hover:text-staff-ink"
      }`}
    >
      {children}
    </button>
  );
}
