"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Stethoscope, X } from "lucide-react";
import type { CardTone } from "@/app/components/AssessmentMenuCard";
import ResultActions from "@/app/components/ResultActions";
import { riskLevelOf } from "@/lib/riskLevel";

/* =========================================================
   ปุ่มท้ายหน้าผล + popup "แนะนำให้ประเมินเพิ่มเติม"
   - ผลอยู่ในระดับเสี่ยงสูง แล้วกด "เลือกแบบประเมินอื่น" → เปิด popup
   - แต่ละแบบประเมินล็อกแบบประเมินถัดไปไว้ 1 แบบ (NEXT_ASSESSMENT)
   - เหตุผลอ้างอิงเอกสาร "แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพ
     และพฤติกรรมเสี่ยงโรคไม่ติดต่อ" กองโรคไม่ติดต่อ กรมควบคุมโรค
========================================================= */

// fromMid = แนะนำตั้งแต่ระดับเฝ้าระวัง (ไม่ต้องรอระดับสูง)
type NextAssessment = { finding: string; reason: string; label: string; href: string; fromMid?: boolean };

// key = assessment_name ตัวพิมพ์เล็ก
const NEXT_ASSESSMENT: Record<string, NextAssessment> = {
  // บทที่ 1.1: คุมความดันไม่ได้ → ภาวะแทรกซ้อน โดยเฉพาะโรคหัวใจและหลอดเลือด
  "blood pressure": {
    finding: "ความดันโลหิตของคุณสูงกว่าปกติ",
    reason: "ซึ่งเพิ่มความเสี่ยงต่อโรคหัวใจและหลอดเลือด",
    label: "ประเมินโรคหัวใจและหลอดเลือด",
    href: "/assessment_CVD",
    fromMid: true,
  },
  // ตารางที่ 2: แนะนำรักษา/ควบคุมระดับน้ำตาลในเลือดให้อยู่ในเกณฑ์ปกติ
  "thai cvd": {
    finding: "คุณมีความเสี่ยงสูงต่อการเกิดโรคหัวใจและสมองในอีก 10 ปี",
    reason: "และควรควบคุมระดับน้ำตาลในเลือดให้อยู่ในเกณฑ์ปกติ",
    label: "ประเมินความเสี่ยงโรคเบาหวาน",
    href: "/assessment_diabetes",
  },
  // ตารางที่ 7: ระดับเสี่ยงสูง/สูงมาก ควรตรวจวัดความดันโลหิต
  "diabetes tds": {
    finding: "คุณมีความเสี่ยงสูงต่อการเกิดโรคเบาหวานใน 12 ปีข้างหน้า",
    reason: "และควรตรวจวัดความดันโลหิตร่วมด้วย",
    label: "ประเมินความดันโลหิต",
    href: "/assessment_DB",
  },
  // บทที่ 1.1: ภาวะน้ำหนักเกินและอ้วน นำไปสู่โรคเบาหวาน
  bmi: {
    finding: "น้ำหนักของคุณเกินเกณฑ์",
    reason: "ซึ่งนำไปสู่โรคไม่ติดต่อเรื้อรัง เช่น โรคเบาหวาน",
    label: "ประเมินความเสี่ยงโรคเบาหวาน",
    href: "/assessment_diabetes",
  },
  // ตารางที่ 14: เสี่ยงต่อโรคหัวใจ ถุงลมโป่งพอง มะเร็งปอด
  smoking: {
    finding: "คุณมีความเสี่ยงสูงจากการสูบบุหรี่",
    reason: "ซึ่งเสี่ยงต่อโรคหัวใจ ถุงลมโป่งพอง และมะเร็งปอด",
    label: "ประเมินโรคหัวใจและหลอดเลือด",
    href: "/assessment_CVD",
  },
  // ตารางที่ 16: ทำให้เกิดโรค เช่น ความดันโลหิตสูง อัมพาต ตับแข็ง
  alcohol: {
    finding: "คุณดื่มเครื่องดื่มแอลกอฮอล์ในระดับเสี่ยง",
    reason: "ซึ่งทำให้เกิดโรค เช่น ความดันโลหิตสูง อัมพาต ตับแข็ง",
    label: "ประเมินความดันโลหิต",
    href: "/assessment_DB",
  },
  // ตารางที่ 24: เสี่ยงต่อโรคอ้วน เบาหวาน ความดันโลหิตสูง ไขมันในเลือดสูง
  diet: {
    finding: "พฤติกรรมการรับประทานอาหารของคุณควรปรับ",
    reason: "ซึ่งเสี่ยงต่อโรคอ้วน เบาหวาน ความดันโลหิตสูง",
    label: "ประเมินภาวะน้ำหนักเกิน",
    href: "/assessment_BMI",
  },
  // ตารางที่ 18: เสี่ยงสูงมากต่อโรคเบาหวาน ความดันโลหิต โรคหลอดเลือดหัวใจตีบ
  "physical activity": {
    finding: "คุณไม่มีกิจกรรมทางกาย",
    reason: "ซึ่งเสี่ยงสูงมากต่อโรคเบาหวาน ความดันโลหิต และโรคหลอดเลือดหัวใจตีบ",
    label: "ประเมินความเสี่ยงโรคเบาหวาน",
    href: "/assessment_diabetes",
  },
  // ตารางที่ 22: นอนไม่พอ ส่งผลให้เกิดโรคความดันโลหิตสูง โรคหัวใจ ฯลฯ
  sleep: {
    finding: "คุณนอนหลับไม่เพียงพอ",
    reason: "ซึ่งส่งผลให้เกิดโรคเบาหวาน โรคความดันโลหิตสูง และโรคหัวใจ",
    label: "ประเมินความดันโลหิต",
    href: "/assessment_DB",
  },
  // ตารางที่ 28: ความเครียดมากต่อเนื่อง อาจนำไปสู่ภาวะซึมเศร้า
  stress: {
    finding: "คุณมีความเครียดในระดับสูง",
    reason: "ซึ่งอาจนำไปสู่โรควิตกกังวลและภาวะซึมเศร้า",
    label: "คัดกรองภาวะซึมเศร้า (2Q)",
    href: "/assessment_depression_2q",
  },
  // ตารางที่ 30: 2Q 1-2 คะแนน ให้ประเมินต่อด้วย 9Q
  "phq-2": {
    finding: "คุณมีความเสี่ยงหรือมีแนวโน้มที่จะเป็นโรคซึมเศร้า",
    reason: "ควรประเมินต่อด้วยแบบประเมินโรคซึมเศร้า 9Q",
    label: "ประเมินโรคซึมเศร้า (9Q)",
    href: "/assessment_depression_9q",
    fromMid: true,
  },
};
NEXT_ASSESSMENT["กิจกรรมทางกาย"] = NEXT_ASSESSMENT["physical activity"];

// ผลที่ต้องแนะนำต่อ: ระดับสูง (หรือตั้งแต่ระดับเฝ้าระวังสำหรับแบบที่กำหนด fromMid)
const needsFollowUp = (key: string, riskLevel: string, next: NextAssessment) => {
  const level = riskLevelOf(key, riskLevel);
  return level === "high" || (!!next.fromMid && level === "mid");
};

export default function FollowUpActions({
  assessmentKey,
  riskLevel,
  tone,
  editHref,
  menuHref = "/assessment-menu",
}: {
  assessmentKey?: string;
  riskLevel: string;
  tone: CardTone;
  editHref: string;
  menuHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const key = String(assessmentKey ?? "").toLowerCase().trim();
  const next = NEXT_ASSESSMENT[key];
  const suggest = !!next && needsFollowUp(key, riskLevel, next);

  return (
    <>
      <ResultActions
        tone={tone}
        editHref={editHref}
        menuHref={menuHref}
        onMenuClick={suggest ? () => setOpen(true) : undefined}
      />

      {open && next && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-up-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] rounded-[30px] bg-white p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,0.18)]"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิด"
              className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-[#f7f4f4] text-[#777780]"
            >
              <X size={20} />
            </button>

            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#e8edf8] text-[#2f4fa0]">
              <Stethoscope size={38} />
            </div>

            <h2 id="follow-up-title" className="mt-6 text-2xl font-bold">
              แนะนำให้ประเมินเพิ่มเติม
            </h2>

            <p className="mt-3 leading-7 text-[#74757d]">
              ผลการประเมินพบว่า {next.finding} {next.reason}
            </p>

            <div className="mt-7 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => router.push(next.href)}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f6fc0] to-[#22397a] font-bold text-white"
              >
                {next.label}
                <ArrowRight size={20} />
              </button>

              <Link
                href={menuHref}
                className="flex h-14 items-center justify-center rounded-2xl border border-[#c8d3ec] font-semibold text-[#777780]"
              >
                ไว้ภายหลัง
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
