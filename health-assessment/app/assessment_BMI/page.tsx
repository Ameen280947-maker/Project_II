"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Sidebar from "@/app/components/Sidebar";

interface NumberStepperProps {
    id: string;
    label: string;
    unit: string;
    value: number;
    step?: number;
    icon: React.ReactNode;
    onChange: (next: number) => void;
}

function NumberStepper({
    id,
    label,
    unit,
    value,
    step = 1,
    icon,
    onChange,
}: NumberStepperProps) {
    return (
        <div className="field">
            <label htmlFor={id}>
                <span className="fieldIcon">{icon}</span>
                {label}
            </label>
            <div className="stepper">
                <input
                    id={id}
                    type="number"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                <div className="unitControls">
                    <span className="unitLabel">{unit}</span>
                    <div className="arrows">
                        <button
                            type="button"
                            aria-label={`เพิ่ม${label}`}
                            onClick={() => onChange(value + step)}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 8l6 6H6z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            aria-label={`ลด${label}`}
                            onClick={() => onChange(Math.max(0, value - step))}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 16l-6-6h12z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

type SubmitResponse = {
    success: boolean;
    assessmentId?: number;
    weightKg?: number;
    heightCm?: number;
    bmi?: number;
    riskLevel?: string;
    recommendation?: string;
    message?: string;
};

const TIPS = [
    {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6c-1.6-1.6-4.2-1.6-5.8 0L12 7.5 9 4.6c-1.6-1.6-4.2-1.6-5.8 0-1.6 1.6-1.6 4.2 0 5.8L12 19l8.8-8.6c1.6-1.6 1.6-4.2 0-5.8z" />
                <path d="M4 12h3l2-3 2 5 2-4 1.5 2H20" />
            </svg>
        ),
        title: "ช่วยประเมินความเสี่ยง",
        description: "ต่อโรคไม่ติดต่อเรื้อรัง (NCDs)",
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21c-4-2.6-8-6-8-10.5A5.5 5.5 0 0 1 9.5 5c1.1 0 2.1.4 3 1.1V4" />
                <path d="M16 3c-1.7 0-3 1.3-3 3" />
                <path d="M12 21c4-2.6 8-6 8-10.5A5.5 5.5 0 0 0 14.5 5" />
            </svg>
        ),
        title: "วางแผนดูแลสุขภาพ",
        description: "ด้านอาหารและการออกกำลังกาย",
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 14s1.3 2 3.5 2 3.5-2 3.5-2" />
                <path d="M9 9h.01M15 9h.01" />
            </svg>
        ),
        title: "เพื่อคุณภาพชีวิตที่ดีขึ้น",
        description: "แข็งแรง มั่นใจ ในทุกวัน",
    },
];

export default function WeightAssessmentPage() {
    const router = useRouter();

    const [weight, setWeight] = useState<number>(65);
    const [height, setHeight] = useState<number>(170);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    /* =========================================================
       บันทึกลง Database
    ========================================================= */

    const handleStartAssessment = async () => {
        try {
            setSubmitting(true);
            setError("");

            const storedUserId = localStorage.getItem("userId");

            if (!storedUserId) {
                router.push("/login");
                return;
            }

            const userId = Number(storedUserId);

            if (!Number.isInteger(userId) || userId <= 0) {
                localStorage.removeItem("userId");
                router.push("/login");
                return;
            }

            if (weight < 10 || weight > 400) {
                throw new Error("ค่าน้ำหนักไม่ถูกต้อง");
            }

            if (height < 50 || height > 250) {
                throw new Error("ค่าส่วนสูงไม่ถูกต้อง");
            }

            const response = await fetch("/api/assessments/bmi", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId,
                    weightKg: weight,
                    heightCm: height,
                }),
            });

            const data = (await response.json()) as SubmitResponse;

            if (!response.ok || !data.success) {
                throw new Error(data.message ?? "ไม่สามารถบันทึกผลประเมินได้");
            }

            if (!data.assessmentId) {
                throw new Error("ระบบบันทึกข้อมูลแล้ว แต่ไม่ได้รับ assessmentId");
            }

            router.push(`/recommendation_BMI?assessmentId=${data.assessmentId}`);
        } catch (submitError) {
            console.error("BMI submit error:", submitError);

            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "เกิดข้อผิดพลาดในการประเมิน",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page">
            <Sidebar />

            <main className="main">
                <div className="blobTopLeft" />
                <div className="blobBottomLeft" />

                <div className="layout">
                    {/* ===================== ซ้าย: ฟอร์ม ===================== */}
                    <div className="formColumn">
                        <div className="eyebrow">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.8 4.6c-1.6-1.6-4.2-1.6-5.8 0L12 7.5 9 4.6c-1.6-1.6-4.2-1.6-5.8 0-1.6 1.6-1.6 4.2 0 5.8L12 19l8.8-8.6c1.6-1.6 1.6-4.2 0-5.8z" />
                            </svg>
                            แบบประเมินสุขภาพเบื้องต้น
                        </div>

                        <h1 className="heading">
                            Assessment-
                            <span className="highlight">
                                ภาวะน้ำหนักเกิน
                                <svg
                                    className="underline"
                                    viewBox="0 0 320 18"
                                    preserveAspectRatio="none"
                                    fill="none"
                                >
                                    <path
                                        d="M2 12c40-10 240-10 316 2"
                                        stroke="#f3b4c2"
                                        strokeWidth="5"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                        </h1>

                        <p className="lede">
                            กรอกน้ำหนักและส่วนสูงของคุณ เพื่อประเมินค่าดัชนีมวลกาย (BMI)
                            และระดับความเสี่ยงภาวะน้ำหนักเกินเบื้องต้น
                        </p>

                        <div className="card">
                            <div className="cardHead">
                                <div className="cardIcon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="4" y="7" width="16" height="13" rx="3" />
                                        <path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="cardTitle">น้ำหนักและส่วนสูง</div>
                                    <div className="cardSub">ใช้คำนวณดัชนีมวลกาย (BMI)</div>
                                </div>
                            </div>

                            <div className="fieldGrid">
                                <NumberStepper
                                    id="weight"
                                    label="น้ำหนัก (กิโลกรัม)"
                                    unit="KG"
                                    value={weight}
                                    onChange={setWeight}
                                    icon={
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="4" y="7" width="16" height="13" rx="3" />
                                            <path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7" />
                                        </svg>
                                    }
                                />
                                <NumberStepper
                                    id="height"
                                    label="ส่วนสูง (เซนติเมตร)"
                                    unit="CM"
                                    value={height}
                                    onChange={setHeight}
                                    icon={
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="5" r="2" />
                                            <path d="M12 7v6M9 10h6M9 13l-2 8M15 13l2 8" />
                                        </svg>
                                    }
                                />
                            </div>

                            {error && <div className="errorBox">{error}</div>}

                            <button
                                className="cta"
                                type="button"
                                disabled={submitting}
                                onClick={handleStartAssessment}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.8 4.6c-1.6-1.6-4.2-1.6-5.8 0L12 7.5 9 4.6c-1.6-1.6-4.2-1.6-5.8 0-1.6 1.6-1.6 4.2 0 5.8L12 19l8.8-8.6c1.6-1.6 1.6-4.2 0-5.8z" />
                                </svg>
                                {submitting ? "กำลังบันทึก..." : "เริ่มประเมิน"}
                                {!submitting && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14M13 6l6 6-6 6" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* ===================== ขวา: ภาพประกอบ + Tips ===================== */}
                    <div className="sideColumn">
                        <div className="illustrationWrap">
                            <div className="illustrationCircle">
                                <svg viewBox="0 0 24 24" fill="currentColor" className="heartGlyph">
                                    <path d="M12 21s-7.2-4.6-9.8-9C.6 8.7 1.7 5 5.3 4.1 7.7 3.5 9.9 4.6 12 6.9c2.1-2.3 4.3-3.4 6.7-2.8 3.6.9 4.7 4.6 3.1 7.9C19.2 16.4 12 21 12 21z" />
                                </svg>
                            </div>
                            {/*
                หมายเหตุ: ตรงนี้คือจุดใส่ภาพประกอบตัวละคร
                วางไฟล์ภาพไว้ที่ /public/images/bmi-illustration.png
                แล้วแทนที่ illustrationCircle ด้วย
                <img src="/images/bmi-illustration.png" alt="" className="illustrationImg" />
              */}
                        </div>

                        <div className="tipsCard">
                            <div className="tipsHead">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.3V16h6v-.9c0-.5.2-1 .6-1.3A6 6 0 0 0 12 3z" />
                                </svg>
                                <h3>ทำไมต้องรู้ค่า BMI ?</h3>
                            </div>

                            <div className="tipsList">
                                {TIPS.map((tip) => (
                                    <div className="tipItem" key={tip.title}>
                                        <div className="tipIcon">{tip.icon}</div>
                                        <div>
                                            <div className="tipTitle">{tip.title}</div>
                                            <div className="tipDesc">{tip.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <style jsx>{`
        .page {
          --maroon: #9c1029;
          --maroon-dark: #7c0c21;
          --maroon-soft: #fdeef1;
          --pink-blob: #fbdce3;
          --pink-blob-soft: #fce7ec;
          --ink: #1f2430;
          --muted: #7a828e;
          --border: #f1dfe3;
          --bg: linear-gradient(160deg, #fff6f8 0%, #fdeef1 45%, #fbe4ea 100%);
          --card: #ffffff;

          display: flex;
          min-height: 100vh;
          background: var(--bg);
          color: var(--ink);
          font-family: "Sarabun", "Prompt", sans-serif;
        }

        .main {
          position: relative;
          flex: 1;
          padding: 52px 64px;
          overflow: hidden;
        }

        .blobTopLeft,
        .blobBottomLeft {
          position: absolute;
          border-radius: 50%;
          background: var(--pink-blob);
          filter: blur(2px);
          opacity: 0.55;
          pointer-events: none;
          z-index: 0;
        }

        .blobTopLeft {
          width: 260px;
          height: 260px;
          top: -80px;
          left: -100px;
        }

        .blobBottomLeft {
          width: 340px;
          height: 340px;
          bottom: -140px;
          left: -140px;
          background: var(--pink-blob-soft);
        }

        .layout {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr;
          gap: 48px;
          max-width: 1280px;
        }

        @media (min-width: 1100px) {
          .layout {
            grid-template-columns: minmax(0, 620px) 1fr;
            align-items: start;
          }
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 999px;
          background: #ffffff;
          color: var(--maroon);
          font-weight: 700;
          font-size: 13px;
          box-shadow: 0 6px 16px rgba(156, 16, 41, 0.08);
        }

        .eyebrow :global(svg) {
          width: 15px;
          height: 15px;
        }

        .heading {
          margin-top: 18px;
          font-family: "Prompt", sans-serif;
          font-size: 42px;
          font-weight: 800;
          color: var(--ink);
          line-height: 1.2;
        }

        .highlight {
          position: relative;
          display: inline-block;
          color: var(--maroon);
        }

        .underline {
          position: absolute;
          left: 0;
          bottom: -10px;
          width: 100%;
          height: 12px;
        }

        .lede {
          margin-top: 22px;
          max-width: 520px;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.8;
        }

        .card {
          margin-top: 32px;
          background: var(--card);
          border-radius: 26px;
          box-shadow: 0 20px 48px rgba(156, 16, 41, 0.08);
          padding: 34px;
        }

        .cardHead {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          border-radius: 18px;
          background: var(--maroon-soft);
          margin-bottom: 26px;
        }

        .cardIcon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: var(--maroon);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .cardIcon :global(svg) {
          width: 22px;
          height: 22px;
        }

        .cardTitle {
          font-family: "Prompt", sans-serif;
          font-weight: 700;
          font-size: 18px;
        }

        .cardSub {
          font-size: 13px;
          color: var(--muted);
          margin-top: 2px;
        }

        .fieldGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        .field :global(label) {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14.5px;
          margin-bottom: 12px;
          color: var(--ink);
        }

        .fieldIcon {
          display: inline-flex;
          color: var(--maroon);
        }

        .fieldIcon :global(svg) {
          width: 16px;
          height: 16px;
        }

        .stepper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid var(--border);
          background: #fdfafb;
          border-radius: 16px;
          padding: 16px 18px;
        }

        .stepper :global(input) {
          border: none;
          background: transparent;
          outline: none;
          font-family: "Prompt", sans-serif;
          font-weight: 700;
          font-size: 26px;
          color: var(--ink);
          width: 100%;
        }

        .stepper :global(input)::-webkit-outer-spin-button,
        .stepper :global(input)::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .unitControls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .unitLabel {
          font-size: 13px;
          color: var(--muted);
          font-weight: 600;
          white-space: nowrap;
        }

        .arrows {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .arrows :global(button) {
          width: 20px;
          height: 16px;
          border: none;
          background: transparent;
          color: #c9c2c4;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .arrows :global(button):hover {
          color: var(--maroon);
        }

        .arrows :global(svg) {
          width: 12px;
          height: 12px;
        }

        .errorBox {
          margin-bottom: 20px;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid #f2d3d7;
          background: var(--maroon-soft);
          color: var(--maroon);
          font-size: 14px;
          font-weight: 500;
        }

        .cta {
          width: 100%;
          border: none;
          background: linear-gradient(135deg, var(--maroon), var(--maroon-dark));
          color: #fff;
          font-family: "Prompt", sans-serif;
          font-weight: 600;
          font-size: 17px;
          padding: 19px 24px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          box-shadow: 0 14px 30px rgba(156, 16, 41, 0.3);
        }

        .cta:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }

        .cta:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 36px rgba(156, 16, 41, 0.36);
        }

        .cta:active:not(:disabled) {
          transform: translateY(0);
        }

        .cta :global(svg) {
          width: 19px;
          height: 19px;
        }

        /* ===================== ขวา: illustration + tips ===================== */

        .sideColumn {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
        }

        .illustrationWrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 360px;
          aspect-ratio: 1 / 1;
        }

        .illustrationCircle {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #ffd7de 0%, #f7a9bb 55%, #ef7f99 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 30px 60px rgba(156, 16, 41, 0.18);
        }

        .heartGlyph {
          width: 40%;
          height: 40%;
          color: #ffffff;
          opacity: 0.9;
        }

        .tipsCard {
          width: 100%;
          max-width: 360px;
          background: #ffffff;
          border-radius: 24px;
          padding: 26px;
          box-shadow: 0 20px 44px rgba(156, 16, 41, 0.08);
        }

        .tipsHead {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .tipsHead :global(svg) {
          width: 20px;
          height: 20px;
          color: var(--maroon);
        }

        .tipsHead h3 {
          font-family: "Prompt", sans-serif;
          font-weight: 700;
          font-size: 17px;
        }

        .tipsList {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .tipItem {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f4eaec;
        }

        .tipItem:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .tipIcon {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: var(--maroon-soft);
          color: var(--maroon);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tipIcon :global(svg) {
          width: 18px;
          height: 18px;
        }

        .tipTitle {
          font-weight: 700;
          font-size: 14.5px;
          color: var(--ink);
        }

        .tipDesc {
          margin-top: 3px;
          font-size: 13px;
          color: var(--muted);
        }

        @media (max-width: 1099px) {
          .sideColumn {
            margin-top: 12px;
          }
        }

        @media (max-width: 900px) {
          .main {
            padding: 32px 22px;
          }
          .fieldGrid {
            grid-template-columns: 1fr;
          }
          .heading {
            font-size: 32px;
          }
        }
      `}</style>
        </div>
    );
}
