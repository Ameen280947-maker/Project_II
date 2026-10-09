"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardList, Phone, RotateCcw } from "lucide-react";
import Sidebar from "@/app/components/Sidebar";
import AnswerReview from "@/app/components/AnswerReview";
import AssessmentClosedNotice from "@/app/components/AssessmentClosedNotice";

/* =========================================================
   หน้ากลางสำหรับแบบประเมินที่เจ้าหน้าที่สร้างเพิ่ม
   /assessment/<typeId>                 → ทำแบบประเมิน
   /assessment/<typeId>?result=<id>     → ดูผล (ใช้จากหน้าประวัติด้วย)
========================================================= */

type Assessment = {
  id: number;
  name: string;
  description: string | null;
  questions: { id: number; text: string; choices: { id: number; text: string }[] }[];
};

type Result = {
  assessmentId: number;
  name: string;
  score: number;
  maxScore: number | null;
  riskLevel: string;
  severity: number;
  recommendation: string;
  reassessDays: number | null;
  hotline: string | null;
  source: string | null;
  assessedAt: string;
};

const NOT_FOUND_TEXT = "ไม่พบแบบประเมินนี้ หรือยังไม่เปิดให้ใช้งาน";

// session หมดอายุ → ล้างข้อมูลแล้วกลับไปหน้า login
const toLoginOn401 = (res: Response, router: ReturnType<typeof useRouter>) => {
  if (res.status !== 401) return false;
  localStorage.removeItem("userId");
  router.replace("/login");
  return true;
};

const SEV_STYLE = [
  { box: "bg-[#eef8e9] border-[#d6ecd0]", text: "text-[#3f7f45]" },
  { box: "bg-[#fff8e8] border-[#f6e2b4]", text: "text-[#a77723]" },
  { box: "bg-[#fff0f2] border-[#f7d4d9]", text: "text-[#b91c2b]" },
  { box: "bg-[#ffe6ea] border-[#f2b9c2]", text: "text-[#8a1420]" },
];

export default function CustomAssessmentPage() {
  return (
    <main className="min-h-screen bg-[#fbf9f9] text-[#2f3037]">
      <div className="flex min-h-screen">
        <Sidebar />
        <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-[900px]">
            <Suspense>
              <Content />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

function Content() {
  const params = useParams<{ id: string }>();
  const resultId = Number(useSearchParams().get("result")) || null;
  const typeId = Number(params.id);
  // id ที่ไม่ใช่ตัวเลข (เช่น /assessment/abc) → แสดงข้อความเดียวกับ id ที่ไม่มีในระบบ
  if (!Number.isInteger(typeId) || typeId <= 0) {
    return <Message text={NOT_FOUND_TEXT} />;
  }
  if (resultId) return <ResultView key={resultId} assessmentId={resultId} typeId={typeId} />;
  // ดูผลเก่าได้เสมอ แต่ถ้า staff ปิดแบบประเมินนี้อยู่ จะแจ้งเตือนทับหน้าทำแบบประเมิน
  return (
    <>
      <Form key={typeId} typeId={typeId} />
      <AssessmentClosedNotice typeId={typeId} />
    </>
  );
}

/* =========================================================
   ทำแบบประเมิน
========================================================= */

function Form({ typeId }: { typeId: number }) {
  const router = useRouter();
  const [data, setData] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/assessments/custom?type=${typeId}`, { cache: "no-store" })
      .then((r) => (toLoginOn401(r, router) ? null : r.json()))
      .then((d) => {
        if (!d) return;
        if (d.success && d.assessment) setData(d.assessment);
        else setLoadError(d.message || NOT_FOUND_TEXT);
      })
      .catch(() => setLoadError("โหลดแบบประเมินไม่สำเร็จ"));
  }, [typeId, router]);

  const answered = data ? data.questions.filter((q) => answers[q.id]).length : 0;

  const submit = async () => {
    if (!data) return;
    const userId = localStorage.getItem("userId");
    if (!userId) return router.push("/login");
    if (answered < data.questions.length) {
      setError(`กรุณาตอบให้ครบทุกข้อ (ตอบแล้ว ${answered}/${data.questions.length} ข้อ)`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/assessments/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(userId),
          typeId,
          answers: Object.entries(answers).map(([questionId, choiceId]) => ({ questionId: Number(questionId), choiceId })),
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message);
      router.push(`/assessment/${typeId}?result=${d.assessmentId}`);
    } catch (e) {
      setError((e as Error).message || "บันทึกผลไม่สำเร็จ");
      setSaving(false);
    }
  };

  if (loadError) return <Message text={loadError} />;
  if (!data) return <Spinner />;

  return (
    <>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">Assessment</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{data.name}</h1>
      {data.description && <p className="mt-3 leading-7 text-[#8b8f98]">{data.description}</p>}

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#f1e9ea]" aria-hidden>
        <div className="h-full rounded-full bg-[#ef4962] transition-all" style={{ width: `${(answered / data.questions.length) * 100}%` }} />
      </div>
      <p className="mt-2 text-sm text-[#858991]">
        ตอบแล้ว {answered} จาก {data.questions.length} ข้อ
      </p>

      <div className="mt-6 space-y-5">
        {data.questions.map((q, i) => (
          <fieldset key={q.id} className="rounded-[26px] border border-[#eee8e9] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)] sm:p-7">
            <legend className="sr-only">ข้อ {i + 1}</legend>
            <div className="flex gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff0f2] font-bold text-[#b91c2b]">{i + 1}</div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold leading-7 sm:text-lg">{q.text}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {q.choices.map((c) => {
                    const on = answers[q.id] === c.id;
                    return (
                      <label
                        key={c.id}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                          on ? "border-[#ef4962] bg-[#fff0f2]" : "border-[#eee5e6] hover:border-[#f3b6c0]"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q${q.id}`}
                          checked={on}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                          className="h-4 w-4 accent-[#b91c2b]"
                        />
                        <span className={`text-sm font-medium ${on ? "text-[#b91c2b]" : "text-[#4f535b]"}`}>{c.text}</span>
                        {on && <CheckCircle2 size={18} className="ml-auto text-[#b91c2b]" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600" role="alert">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href="/assessment-type"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#e8dddd] bg-white px-6 font-semibold text-[#777780] transition hover:bg-[#faf7f7]"
        >
          <ArrowLeft size={18} /> กลับไปเลือกแบบประเมิน
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-[#ef4962] to-[#b91c2b] px-8 font-bold text-white shadow-[0_12px_26px_rgba(185,28,43,0.22)] transition hover:brightness-105 disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก…" : "ส่งแบบประเมิน"}
        </button>
      </div>
    </>
  );
}

/* =========================================================
   ผลการประเมิน
========================================================= */

function ResultView({ assessmentId, typeId }: { assessmentId: number; typeId: number }) {
  const router = useRouter();
  const [r, setR] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = localStorage.getItem("userId") ?? "";
    fetch(`/api/assessments/custom?assessmentId=${assessmentId}&userId=${userId}`, { cache: "no-store" })
      .then((res) => (toLoginOn401(res, router) ? null : res.json()))
      .then((d) => {
        if (!d) return;
        if (d.success) setR(d.result);
        else setError(d.message || "ไม่พบผลการประเมิน");
      })
      .catch(() => setError("โหลดผลการประเมินไม่สำเร็จ"));
  }, [assessmentId, router]);

  if (error) return <Message text={error} />;
  if (!r) return <Spinner />;

  const style = SEV_STYLE[r.severity] ?? SEV_STYLE[0];
  return (
    <>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b91c2b]">Result</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">ผล{r.name}</h1>
      <p className="mt-2 text-sm text-[#858991]">
        ประเมินเมื่อ {new Date(r.assessedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
      </p>

      <div className={`mt-6 rounded-[26px] border p-6 sm:p-8 ${style.box}`}>
        <p className="text-sm font-semibold text-[#858991]">ผลการประเมินของคุณ</p>
        <p className={`mt-1 text-3xl font-black ${style.text}`}>{r.riskLevel}</p>
        <p className="mt-2 text-[#4f535b]">
          คะแนนรวม <b>{r.score}</b>
          {r.maxScore !== null ? ` จาก ${r.maxScore} คะแนน` : " คะแนน"}
        </p>
      </div>

      <div className="mt-5 rounded-[26px] border border-[#eee8e9] bg-white p-6 shadow-[0_12px_35px_rgba(35,25,30,0.04)] sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ClipboardList size={20} className="text-[#b91c2b]" /> คำแนะนำ
        </h2>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-[#4f535b]">{r.recommendation || "-"}</p>
        {r.hotline && (
          <p className="mt-4 flex items-center gap-2 font-semibold text-[#b91c2b]">
            <Phone size={17} /> ปรึกษาได้ที่ {r.hotline}
          </p>
        )}
        {r.reassessDays && <p className="mt-3 text-sm text-[#858991]">แนะนำให้ประเมินซ้ำในอีก {r.reassessDays} วัน</p>}
        {r.source && <p className="mt-3 text-xs text-[#9a9ba2]">อ้างอิง: {r.source}</p>}
      </div>

      <AnswerReview assessmentId={assessmentId} className="mt-5" />

      <p className="mt-4 text-xs leading-6 text-[#9a9ba2]">ผลนี้เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link
          href="/history"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#e8dddd] bg-white px-6 font-semibold text-[#777780] transition hover:bg-[#faf7f7]"
        >
          ดูประวัติการประเมิน
        </Link>
        <Link
          href={`/assessment/${typeId}`}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#b91c2b] px-8 font-bold text-white transition hover:bg-[#8a1420]"
        >
          <RotateCcw size={18} /> ทำแบบประเมินอีกครั้ง
        </Link>
      </div>
    </>
  );
}

function Spinner() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#f1e9ea] border-t-[#b91c2b]" role="status" aria-label="กำลังโหลด" />
    </div>
  );
}

function Message({ text }: { text: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div>
        <p className="text-lg font-semibold">{text}</p>
        <Link href="/assessment-type" className="mt-4 inline-block font-semibold text-[#b91c2b] hover:underline">
          กลับไปเลือกแบบประเมิน
        </Link>
      </div>
    </div>
  );
}
