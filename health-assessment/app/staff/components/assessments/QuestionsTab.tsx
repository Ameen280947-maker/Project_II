"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { inputCls } from "../ui";
import { IconBtn, newKey, type EQuestion } from "./shared";

/* =========================================================
   แท็บ "คำถามและคะแนน"
========================================================= */

type Choice = EQuestion["choices"][number];

// แท็บคำถาม: แสดงรายการคำถาม เพิ่ม ลบ เลื่อนลำดับ และแก้ไขแต่ละข้อ
export default function QuestionsTab({ questions, onChange }: { questions: EQuestion[]; onChange: (qs: EQuestion[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null);

  // แก้ไขข้อมูลคำถามตาม key
  const update = (key: string, patch: Partial<EQuestion>) => onChange(questions.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  // สลับลำดับคำถามขึ้น/ลง
  const move = (i: number, d: -1 | 1) => {
    const next = [...questions];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  // ลบคำถาม (ถามยืนยันก่อน)
  const remove = (key: string) => {
    if (!confirm("ลบคำถามข้อนี้? (ผลประเมินเดิมของผู้ใช้จะไม่หาย)")) return;
    onChange(questions.filter((q) => q.key !== key));
  };
  // เพิ่มคำถามใหม่ (ใช้ตัวเลือกของคำถามแบบตัวเลือกข้อแรกเป็นแม่แบบ) แล้วเปิดแก้ไข
  const add = () => {
    const tpl = questions.find((q) => q.type === "choice")?.choices.map((c) => ({ text: c.text, score: c.score }));
    const q: EQuestion = {
      key: newKey(),
      text: "",
      type: "choice",
      choices: tpl ?? [
        { text: "ไม่ใช่", score: 0 },
        { text: "ใช่", score: 1 },
      ],
    };
    onChange([...questions, q]);
    setEditing(q.key);
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      {questions.length === 0 && <p className="text-sm text-staff-muted">ยังไม่มีคำถาม เริ่มจากกด “เพิ่มคำถาม”</p>}
      {questions.map((q, i) => (
        <QuestionCard
          key={q.key}
          index={i}
          q={q}
          total={questions.length}
          editing={editing === q.key}
          onEdit={() => setEditing(editing === q.key ? null : q.key)}
          onChange={(p) => update(q.key, p)}
          onMove={(d) => move(i, d)}
          onRemove={() => remove(q.key)}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-staff-200 text-sm font-semibold text-staff-600 transition hover:border-staff-400 hover:bg-staff-50"
      >
        <Plus size={18} /> เพิ่มคำถาม
      </button>
    </div>
  );
}

// การ์ดคำถามหนึ่งข้อ: แสดง/แก้ไขข้อความ ตัวเลือก และคะแนน พร้อมปุ่มเลื่อน/ลบ
function QuestionCard({
  q,
  index,
  total,
  editing,
  onEdit,
  onChange,
  onMove,
  onRemove,
}: {
  q: EQuestion;
  index: number;
  total: number;
  editing: boolean;
  onEdit: () => void;
  onChange: (p: Partial<EQuestion>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  // แก้ไขตัวเลือกลำดับที่ j ของคำถามนี้
  const setChoice = (j: number, patch: Partial<Choice>) => onChange({ choices: q.choices.map((c, k) => (k === j ? { ...c, ...patch } : c)) });

  return (
    <div className={`rounded-2xl border p-4 transition ${editing ? "border-staff-300 bg-staff-soft" : "border-staff-line"}`}>
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-staff-100 text-sm font-bold text-staff-700">{index + 1}</span>
        <div className="min-w-0 flex-1 basis-[calc(100%-44px)] sm:basis-auto">
          {editing ? (
            <textarea
              value={q.text}
              onChange={(e) => onChange({ text: e.target.value })}
              rows={2}
              autoFocus
              maxLength={1000}
              placeholder="ข้อความคำถาม"
              aria-label={`ข้อความคำถามข้อ ${index + 1}`}
              className={inputCls}
            />
          ) : (
            <p className="break-words font-semibold">{q.text || <span className="text-risk-high">ยังไม่ได้กรอกข้อความคำถาม</span>}</p>
          )}
          <p className="mt-0.5 text-xs text-staff-muted">{q.type === "number" ? "กรอกเป็นตัวเลข" : `ตัวเลือก ${q.choices.length} ระดับ`}</p>
        </div>
        <div className="ml-11 flex shrink-0 gap-1 sm:ml-0">
          <IconBtn label="เลื่อนขึ้น" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp size={16} />
          </IconBtn>
          <IconBtn label="เลื่อนลง" disabled={index === total - 1} onClick={() => onMove(1)}>
            <ArrowDown size={16} />
          </IconBtn>
          <IconBtn label={editing ? "เสร็จสิ้น" : "แก้ไข"} onClick={onEdit}>
            {editing ? <Check size={16} /> : <Pencil size={16} />}
          </IconBtn>
          <IconBtn label="ลบคำถาม" danger onClick={onRemove}>
            <Trash2 size={16} />
          </IconBtn>
        </div>
      </div>

      {q.type === "choice" && !editing && (
        <div className="mt-3 flex flex-wrap gap-2 sm:pl-11">
          {q.choices.map((c, j) => (
            <span key={j} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-staff-bg px-3 py-1.5 text-sm">
              <span className="min-w-0 break-words">{c.text || "…"}</span>
              <span className="rounded-md bg-white px-1.5 text-xs font-bold text-staff-700">{c.score}</span>
            </span>
          ))}
        </div>
      )}

      {q.type === "choice" && editing && (
        <div className="mt-3 flex flex-col gap-2 sm:pl-11">
          {q.choices.map((c, j) => (
            <div key={j} className="flex items-center gap-2">
              <input
                value={c.text}
                onChange={(e) => setChoice(j, { text: e.target.value })}
                maxLength={255}
                aria-label={`ตัวเลือกที่ ${j + 1}`}
                placeholder="ข้อความตัวเลือก"
                className={`${inputCls} min-w-0 bg-white`}
              />
              <input
                type="number"
                value={c.score}
                onChange={(e) => setChoice(j, { score: Math.trunc(Number(e.target.value)) || 0 })}
                aria-label={`คะแนนตัวเลือกที่ ${j + 1}`}
                className={`${inputCls} w-20 shrink-0 bg-white text-center`}
              />
              <IconBtn
                label="ลบตัวเลือก"
                danger
                disabled={q.choices.length <= 2}
                onClick={() => onChange({ choices: q.choices.filter((_, k) => k !== j) })}
              >
                <X size={16} />
              </IconBtn>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ choices: [...q.choices, { text: "", score: q.choices.length }] })}
            disabled={q.choices.length >= 20}
            className="self-start text-sm font-semibold text-staff-600 hover:underline disabled:opacity-40"
          >
            + เพิ่มตัวเลือก
          </button>
        </div>
      )}
    </div>
  );
}
