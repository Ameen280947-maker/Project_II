"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type AssessmentResult = {
    assessmentId: number;
    weightKg: number | null;
    heightCm: number | null;
    bmi: number;
    riskLevel: string;
    recommendation: string;
    assessedAt: string;
    assessmentName: string;
};

type ResultResponse = {
    success: boolean;
    result?: AssessmentResult;
    message?: string;
};

/*
  สีป้ายตามระดับ BMI
  อ้างอิงตารางของสำนักโภชนาการ กรมอนามัย
*/

const LEVEL_COLORS: Record<
    string,
    { bg: string; text: string; ring: string }
> = {
    "ผอม": { bg: "#eef8ec", text: "#4f9857", ring: "#8bc86f" },
    "ปกติ": { bg: "#fdf8e2", text: "#a68b1f", ring: "#e8d84a" },
    "น้ำหนักเกิน": { bg: "#fff1e2", text: "#c2740f", ring: "#f5a445" },
    "อ้วน": { bg: "#fdeef1", text: "#b91c2b", ring: "#ef4962" },
    "อ้วนอันตราย": { bg: "#fbe4e6", text: "#7c0c21", ring: "#9c1029" },
};

export default function BmiResultPage() {
    return (
        <Suspense fallback={<LoadingState />}>
            <BmiResultContent />
        </Suspense>
    );
}

function BmiResultContent() {
    const searchParams = useSearchParams();
    const assessmentId = searchParams.get("assessmentId");

    const [result, setResult] = useState<AssessmentResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadResult = async () => {
            if (!assessmentId) {
                setError("ไม่พบ assessmentId");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `/api/assessments/bmi?assessmentId=${assessmentId}`,
                    { method: "GET", cache: "no-store" },
                );

                const data = (await response.json()) as ResultResponse;

                if (!response.ok || !data.success || !data.result) {
                    throw new Error(data.message ?? "ไม่สามารถโหลดผลประเมินได้");
                }

                setResult(data.result);
            } catch (loadError) {
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "ไม่สามารถโหลดผลประเมินได้",
                );
            } finally {
                setLoading(false);
            }
        };

        void loadResult();
    }, [assessmentId]);

    if (loading) {
        return <LoadingState />;
    }

    if (error || !result) {
        return (
            <main className="errorPage">
                <div className="errorCard">
                    <div className="errorIcon">!</div>
                    <h1>ไม่สามารถแสดงผลได้</h1>
                    <p>{error || "ไม่พบผลการประเมิน"}</p>
                    <Link href="/assessment_BMI" className="backButton">
                        กลับไปทำแบบประเมิน
                    </Link>
                </div>

                <style jsx>{`
          .errorPage {
            display: grid;
            place-items: center;
            min-height: 100vh;
            background: #f7f6f4;
            padding: 24px;
          }
          .errorCard {
            width: 100%;
            max-width: 420px;
            background: #fff;
            border-radius: 28px;
            padding: 36px;
            text-align: center;
            box-shadow: 0 16px 40px rgba(30, 20, 20, 0.08);
          }
          .errorIcon {
            width: 48px;
            height: 48px;
            margin: 0 auto;
            border-radius: 50%;
            background: #fdeef1;
            color: #9c1029;
            font-weight: 800;
            font-size: 22px;
            display: grid;
            place-items: center;
          }
          h1 {
            margin-top: 18px;
            font-size: 22px;
            font-family: "Prompt", sans-serif;
          }
          p {
            margin-top: 10px;
            color: #7a828e;
          }
          .backButton {
            margin-top: 26px;
            display: flex;
            height: 52px;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 14px;
            background: #9c1029;
            color: #fff;
            font-weight: 700;
            text-decoration: none;
          }
        `}</style>
            </main>
        );
    }

    const colors = LEVEL_COLORS[result.riskLevel] ?? LEVEL_COLORS["ปกติ"];

    return (
        <main className="page">
            <div className="wrap">
                <header className="header">
                    <div>
                        <p className="eyebrow">Health Recommendation</p>
                        <h1 className="title">คำแนะนำ</h1>
                        <div className="rule" />
                        <p className="lede">คำแนะนำจากผลประเมินภาวะน้ำหนักเกิน</p>
                        <h2 className="heading">
                            ค่าดัชนีมวลกาย <span>(BMI)</span> ของคุณ
                        </h2>
                    </div>

                    <div className="scoreWrap">
                        <div
                            className="scoreCircle"
                            style={{ borderColor: colors.ring, background: colors.bg }}
                        >
                            <span className="scoreValue" style={{ color: colors.text }}>
                                {result.bmi.toFixed(1)}
                            </span>
                            <span className="scoreUnit" style={{ color: colors.text }}>
                                BMI
                            </span>
                        </div>

                        <span
                            className="levelPill"
                            style={{ background: colors.bg, color: colors.text }}
                        >
                            {result.riskLevel}
                        </span>
                    </div>
                </header>

                <section className="infoCard">
                    <div className="infoIcon">i</div>
                    <div>
                        <h3>ผลและคำแนะนำจากฐานข้อมูล</h3>
                        <p>
                            ผลประเมินของคุณอยู่ในระดับ{" "}
                            <strong style={{ color: colors.text }}>
                                {result.riskLevel}
                            </strong>{" "}
                            โดยมีค่าดัชนีมวลกาย (BMI) ประมาณ{" "}
                            <strong style={{ color: colors.text }}>
                                {result.bmi.toFixed(1)}
                            </strong>
                            {result.weightKg && result.heightCm && (
                                <>
                                    {" "}
                                    (จากน้ำหนัก {result.weightKg} กก. ส่วนสูง {result.heightCm}{" "}
                                    ซม.)
                                </>
                            )}
                        </p>
                        <p className="recommendationText">{result.recommendation}</p>
                    </div>
                </section>

                <section className="adviceSection">
                    <h3>แนวทางดูแลสุขภาพ</h3>

                    <div className="adviceGrid">
                        <AdviceCard
                            title="โภชนาการ"
                            description="รับประทานผัก ผลไม้ และธัญพืช ลดอาหารหวาน มัน เค็ม และอาหารแปรรูป"
                        />
                        <AdviceCard
                            title="การออกกำลังกาย"
                            description="ออกกำลังกายระดับปานกลางอย่างน้อย 150 นาทีต่อสัปดาห์"
                        />
                        <AdviceCard
                            title="ติดตามสุขภาพ"
                            description="ชั่งน้ำหนักสม่ำเสมอ ควบคุมอาหาร และตรวจสุขภาพเป็นประจำ"
                        />
                    </div>
                </section>

                <div className="actions">
                    <Link href="/assessment_BMI" className="secondaryButton">
                        กลับไปแก้แบบประเมิน
                    </Link>
                    <Link href="/assessment-menu" className="primaryButton">
                        เลือกแบบประเมินอื่น
                    </Link>
                </div>
            </div>

            <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f7f6f4;
          color: #1f2430;
          font-family: "Sarabun", "Prompt", sans-serif;
          padding: 48px 24px;
        }

        .wrap {
          max-width: 1100px;
          margin: 0 auto;
        }

        .header {
          display: grid;
          gap: 32px;
          grid-template-columns: 1fr;
          align-items: start;
        }

        @media (min-width: 960px) {
          .header {
            grid-template-columns: 1fr 220px;
          }
        }

        .eyebrow {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #9c1029;
        }

        .title {
          margin-top: 10px;
          font-family: "Prompt", sans-serif;
          font-size: 40px;
          font-weight: 800;
        }

        .rule {
          margin-top: 14px;
          width: 40px;
          height: 4px;
          border-radius: 999px;
          background: #ef4962;
        }

        .lede {
          margin-top: 14px;
          color: #85858d;
        }

        .heading {
          margin-top: 22px;
          font-family: "Prompt", sans-serif;
          font-size: 30px;
          font-weight: 700;
          line-height: 1.3;
        }

        .heading :global(span) {
          color: #ef4962;
        }

        .scoreWrap {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .scoreCircle {
          width: 176px;
          height: 176px;
          border-radius: 50%;
          border-width: 8px;
          border-style: solid;
          display: grid;
          place-items: center;
        }

        .scoreValue {
          display: block;
          font-family: "Prompt", sans-serif;
          font-size: 44px;
          font-weight: 800;
          text-align: center;
        }

        .scoreUnit {
          display: block;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
        }

        .levelPill {
          margin-top: 16px;
          padding: 8px 20px;
          border-radius: 999px;
          font-weight: 600;
        }

        .infoCard {
          margin-top: 32px;
          display: flex;
          gap: 16px;
          border-radius: 28px;
          border: 1px solid #f1e2e4;
          background: linear-gradient(135deg, #fff8f9, #fff0f2);
          padding: 32px;
        }

        .infoIcon {
          flex-shrink: 0;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #fff;
          color: #ef4962;
          font-weight: 800;
          font-size: 22px;
          display: grid;
          place-items: center;
        }

        .infoCard h3 {
          font-family: "Prompt", sans-serif;
          font-size: 22px;
          font-weight: 700;
        }

        .infoCard p {
          margin-top: 14px;
          line-height: 1.9;
          color: #666872;
        }

        .recommendationText {
          white-space: pre-line;
        }

        .adviceSection {
          margin-top: 32px;
        }

        .adviceSection h3 {
          font-family: "Prompt", sans-serif;
          font-size: 22px;
          font-weight: 700;
        }

        .adviceGrid {
          margin-top: 20px;
          display: grid;
          gap: 18px;
          grid-template-columns: 1fr;
        }

        @media (min-width: 768px) {
          .adviceGrid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .actions {
          margin-top: 32px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        @media (min-width: 640px) {
          .actions {
            flex-direction: row;
            justify-content: flex-end;
          }
        }

        .secondaryButton,
        .primaryButton {
          display: flex;
          height: 52px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 24px;
          border-radius: 999px;
          font-weight: 600;
          text-decoration: none;
        }

        .secondaryButton {
          border: 1px solid #ead9db;
          background: #fff;
          color: #8a1420;
        }

        .primaryButton {
          background: #fff0f2;
          color: #ef4962;
        }
      `}</style>
        </main>
    );
}

function AdviceCard({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <article className="card">
            <h4>{title}</h4>
            <p>{description}</p>

            <style jsx>{`
        .card {
          border-radius: 25px;
          border: 1px solid #eee8e9;
          background: #fff;
          padding: 24px;
          box-shadow: 0 14px 35px rgba(35, 25, 30, 0.04);
        }

        h4 {
          font-family: "Prompt", sans-serif;
          font-size: 19px;
          font-weight: 700;
        }

        p {
          margin-top: 10px;
          font-size: 14px;
          line-height: 1.7;
          color: #767880;
        }
      `}</style>
        </article>
    );
}

function LoadingState() {
    return (
        <main className="loadingPage">
            <div className="loadingBox">
                <div className="spinner" />
                <p>กำลังโหลดผลการประเมิน...</p>
            </div>

            <style jsx>{`
        .loadingPage {
          display: grid;
          place-items: center;
          min-height: 100vh;
          background: #f7f6f4;
        }
        .loadingBox {
          text-align: center;
        }
        .spinner {
          margin: 0 auto;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 4px solid #f1dadd;
          border-top-color: #9c1029;
          animation: spin 0.8s linear infinite;
        }
        p {
          margin-top: 18px;
          font-weight: 600;
          color: #7a828e;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
        </main>
    );
}
