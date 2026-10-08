"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { severityForRank } from "@/lib/staff/riskLevels";
import { staffFetch } from "@/lib/staff/client";
import { Card, Empty, ErrorBox, PageHeader, RiskPill, Switch, btnGhost, btnPrimary, inputCls, thDate } from "../components/ui";

/* =========================================================
   TYPES (ตรงกับ /api/staff/assessments)
========================================================= */

type TypeRow = { id: number; name: string; label: string; description: string; isActive: boolean; questions: number };
type Choice = { id?: number; text: string; score: number };
type Question = { id?: number; key: string; text: string; type: "choice" | "number"; choices: Choice[] };
type Detail = {
  id: number;
  label: string;
  description: string;
  isActive: boolean;
  lastEdit: { by: string | null; at: string } | null;
  questions: Omit<Question, "key">[];
  generic: boolean;
  resultCount: number;
  deletable: boolean;
  levels: {
    id: number;
    riskLevel: string;
    severity: number;
    reassessDays: number | null;
    min: number | null;
    max: number | null;
    text: string;
  }[];
};

type Tab = "questions" | "levels" | "preview";

const TABS: { key: Tab; label: string }[] = [
  { key: "questions", label: "คำถามและตัวเลือก" },
  { key: "levels", label: "เกณฑ์แปลผล" },
  { key: "preview", label: "ตัวอย่างหน้าผู้ใช้" },
];

const DRAFT_KEY = (id: number) => `staffAssessmentDraft:${id}`;
let keySeq = 0;
const newKey = () => `k${++keySeq}`;
const withKeys = (qs: Omit<Question, "key">[]): Question[] => qs.map((q) => ({ ...q, key: newKey() }));
const withoutKeys = (qs: Question[]) => qs.map((q) => ({ id: q.id, text: q.text, type: q.type, choices: q.choices }));

// ฉบับร่างเก็บในเบราว์เซอร์ของเจ้าหน้าที่คนนั้น (ยังไม่ส่งถึงผู้ใช้จนกด "เผยแพร่")
function readDraft(id: number): Question[] | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(id));
    return raw ? withKeys(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function writeDraft(id: number, qs: Question[] | null) {
  try {
    if (qs) localStorage.setItem(DRAFT_KEY(id), JSON.stringify(withoutKeys(qs)));
    else localStorage.removeItem(DRAFT_KEY(id));
  } catch {}
}

/* =========================================================
   PAGE
========================================================= */

export default function StaffAssessmentsPage() {
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTypes = useCallback(() => {
    staffFetch<{ types: TypeRow[] }>("/api/staff/assessments")
      .then((d) => {
        setTypes(d.types);
        setSelected((s) => s ?? d.types.find((t) => t.name === "9Q")?.id ?? d.types[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const toggle = async (t: TypeRow) => {
    setTypes((all) => all.map((x) => (x.id === t.id ? { ...x, isActive: !x.isActive } : x)));
    try {
      await staffFetch("/api/staff/assessments", { method: "PATCH", body: JSON.stringify({ typeId: t.id, isActive: !t.isActive }) });
    } catch (e) {
      setError((e as Error).message);
      loadTypes();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Assessments"
        title="จัดการ"
        highlight="แบบประเมิน"
        desc="แก้ไขคำถาม ตัวเลือก คะแนน และเกณฑ์แปลผลของแต่ละแบบประเมิน"
        actions={
          <button type="button" onClick={() => setCreating(true)} className={btnPrimary}>
            <Plus size={18} /> เพิ่มแบบประเมินใหม่
          </button>
        }
      />
      <ErrorBox message={error} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="!p-3 lg:w-[320px] lg:shrink-0">
          <p className="px-3 pb-2 pt-1 text-sm font-semibold text-staff-muted">แบบประเมินทั้งหมด ({types.length})</p>
          <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto lg:max-h-none">
            {types.map((t) => (
              <li key={t.id} className={`flex items-center gap-2 rounded-2xl pr-2 transition ${t.id === selected ? "bg-staff-50 ring-2 ring-staff-300" : "hover:bg-staff-soft"}`}>
                <button type="button" onClick={() => setSelected(t.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left" aria-current={t.id === selected ? "true" : undefined}>
                  <span className="block truncate text-sm font-semibold">{t.label}</span>
                  <span className="block text-xs text-staff-muted">
                    {t.questions} ข้อ · {t.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </button>
                <Switch checked={t.isActive} onChange={() => toggle(t)} label={`เปิดใช้งาน ${t.label}`} />
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0 flex-1">
          {selected && (
            <Editor
              key={selected}
              typeId={selected}
              onPublished={loadTypes}
              onDeleted={() => {
                writeDraft(selected, null);
                setSelected(null);
                loadTypes();
              }}
            />
          )}
        </div>
      </div>

      {creating && (
        <CreateDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelected(id);
            loadTypes();
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   EDITOR
========================================================= */

function Editor({ typeId, onPublished, onDeleted }: { typeId: number; onPublished: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [dirty, setDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("questions");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    staffFetch<{ assessment: Detail }>(`/api/staff/assessments?type=${typeId}`)
      .then((d) => {
        setDetail(d.assessment);
        const draft = readDraft(typeId);
        setHasDraft(Boolean(draft));
        setQuestions(draft ?? withKeys(d.assessment.questions));
        setDirty(false);
      })
      .catch((e) => setError(e.message));
  }, [typeId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  };

  const update = (key: string, patch: Partial<Question>) => {
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setQuestions((qs) => {
      const next = [...qs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
    setDirty(true);
  };
  const remove = (key: string) => {
    if (!confirm("ลบคำถามข้อนี้? (ผลประเมินเดิมของผู้ใช้จะไม่หาย)")) return;
    setQuestions((qs) => qs.filter((q) => q.key !== key));
    setDirty(true);
  };
  const add = () => {
    const tpl = questions.find((q) => q.type === "choice")?.choices.map((c) => ({ text: c.text, score: c.score }));
    const q: Question = {
      key: newKey(),
      text: "",
      type: "choice",
      choices: tpl ?? [
        { text: "ไม่ใช่", score: 0 },
        { text: "ใช่", score: 1 },
      ],
    };
    setQuestions((qs) => [...qs, q]);
    setEditing(q.key);
    setDirty(true);
  };

  const saveDraft = () => {
    writeDraft(typeId, questions);
    setHasDraft(true);
    setDirty(false);
    flash("บันทึกฉบับร่างในเครื่องนี้แล้ว");
  };
  const discardDraft = () => {
    writeDraft(typeId, null);
    load();
  };

  const publish = async () => {
    if (!confirm("เผยแพร่ชุดคำถามนี้ให้ผู้ใช้? มีผลกับการประเมินครั้งใหม่ทันที")) return;
    setBusy(true);
    setError("");
    try {
      await staffFetch("/api/staff/assessments", {
        method: "PUT",
        body: JSON.stringify({ typeId, questions: withoutKeys(questions) }),
      });
      writeDraft(typeId, null);
      setEditing(null);
      load();
      onPublished();
      flash("เผยแพร่แล้ว");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return error ? <ErrorBox message={error} /> : <Card><Empty>กำลังโหลด…</Empty></Card>;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold">{detail.label}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${detail.isActive ? "bg-staff-100 text-staff-800" : "bg-gray-100 text-gray-600"}`}>
              {detail.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </span>
            {(dirty || hasDraft) && <span className="rounded-full bg-[#fff3dc] px-2.5 py-0.5 text-xs font-semibold text-[#8a5a00]">มีการแก้ไขที่ยังไม่เผยแพร่</span>}
          </div>
          <p className="mt-1 text-sm text-staff-muted">
            {detail.lastEdit ? `แก้ไขล่าสุดโดย ${detail.lastEdit.by ?? "-"} · ${thDate(detail.lastEdit.at)}` : detail.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasDraft && (
            <button type="button" onClick={discardDraft} className={`${btnGhost} h-10`}>
              ทิ้งฉบับร่าง
            </button>
          )}
          {detail.deletable && (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#f7c6c9] bg-white px-4 text-sm font-semibold text-risk-crit transition hover:bg-[#fff5f5]"
            >
              <Trash2 size={16} /> ลบแบบประเมิน
            </button>
          )}
          <button type="button" onClick={saveDraft} disabled={!dirty} className={`${btnGhost} h-10`}>
            บันทึกฉบับร่าง
          </button>
          <button type="button" onClick={publish} disabled={busy} className={`${btnPrimary} h-10`}>
            {busy ? "กำลังเผยแพร่…" : "เผยแพร่"}
          </button>
        </div>
      </div>

      {detail.generic && !detail.deletable && detail.resultCount > 0 && (
        <p className="mt-3 text-sm text-staff-muted">
          มีผลการประเมินของผู้ใช้แล้ว {detail.resultCount.toLocaleString("th-TH")} รายการ จึงลบแบบประเมินนี้ไม่ได้ หากไม่ต้องการใช้แล้ว ให้ปิดใช้งานแทน
        </p>
      )}

      {deleting && <DeleteDialog typeId={detail.id} name={detail.label} onClose={() => setDeleting(false)} onDeleted={onDeleted} />}

      <div className="mt-4 flex gap-2 rounded-2xl border border-[#f6dca8] bg-[#fff8e8] p-4 text-sm text-[#8a5a00]">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        การแก้ไขมีผลกับการประเมินครั้งใหม่เท่านั้น ผลที่ผู้ใช้ทำไปแล้วจะคงเดิม · เกณฑ์ตัดคะแนนคำนวณในระบบ หากเพิ่ม/ลบข้อหรือเปลี่ยนคะแนน ควรตรวจสอบกับแหล่งอ้างอิงก่อนเผยแพร่
      </div>

      {msg && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-staff-700" role="status">
          <Check size={16} /> {msg}
        </p>
      )}
      <div className="mt-3">
        <ErrorBox message={error} />
      </div>

      <div role="tablist" aria-label="ส่วนของแบบประเมิน" className="mt-4 flex gap-1 overflow-x-auto border-b border-staff-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === t.key ? "border-staff-500 text-staff-700" : "border-transparent text-staff-muted hover:text-staff-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div className="mt-4 flex flex-col gap-3">
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
      )}

      {tab === "levels" &&
        (detail.generic ? (
          <LevelsEditor
            typeId={detail.id}
            questions={questions}
            initial={detail.levels}
            onSaved={() => {
              load();
              onPublished();
            }}
          />
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm text-staff-muted">ระดับผลที่ระบบใช้แปลคะแนน เรียงจากปกติไปเสี่ยงสูง · แบบประเมินนี้คำนวณด้วยสูตรเฉพาะในระบบ จึงแก้ช่วงคะแนนจากหน้านี้ไม่ได้</p>
            {detail.levels.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-staff-line px-4 py-3">
                <RiskPill severity={l.severity}>{l.riskLevel}</RiskPill>
                <span className="ml-auto text-sm text-staff-muted">
                  {l.reassessDays ? `ประเมินซ้ำทุก ${l.reassessDays} วัน` : "ใช้รอบประเมินซ้ำตามค่าเริ่มต้นของระบบ"}
                </span>
              </div>
            ))}
            <Link href={`/staff/recommendations?type=${detail.id}`} className="mt-2 self-start text-sm font-semibold text-staff-600 hover:underline">
              แก้ไขข้อความคำแนะนำและรอบประเมินซ้ำ →
            </Link>
          </div>
        ))}

      {tab === "preview" && <Preview label={detail.label} questions={questions} />}
    </Card>
  );
}

/* =========================================================
   QUESTION CARD
========================================================= */

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
  q: Question;
  index: number;
  total: number;
  editing: boolean;
  onEdit: () => void;
  onChange: (p: Partial<Question>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const setChoice = (j: number, patch: Partial<Choice>) =>
    onChange({ choices: q.choices.map((c, k) => (k === j ? { ...c, ...patch } : c)) });

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
              placeholder="ข้อความคำถาม"
              aria-label={`ข้อความคำถามข้อ ${index + 1}`}
              className={inputCls}
            />
          ) : (
            <p className="font-semibold">{q.text || <span className="text-risk-high">ยังไม่ได้กรอกข้อความคำถาม</span>}</p>
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
            <span key={j} className="inline-flex items-center gap-2 rounded-xl bg-staff-bg px-3 py-1.5 text-sm">
              {c.text}
              <span className="rounded-md bg-white px-1.5 text-xs font-bold text-staff-700">{c.score}</span>
            </span>
          ))}
        </div>
      )}

      {q.type === "choice" && editing && (
        <div className="mt-3 flex flex-col gap-2 sm:pl-11">
          {q.choices.map((c, j) => (
            <div key={j} className="flex items-center gap-2">
              <input value={c.text} onChange={(e) => setChoice(j, { text: e.target.value })} aria-label={`ตัวเลือกที่ ${j + 1}`} placeholder="ข้อความตัวเลือก" className={`${inputCls} bg-white`} />
              <input
                type="number"
                value={c.score}
                onChange={(e) => setChoice(j, { score: Math.trunc(Number(e.target.value)) || 0 })}
                aria-label={`คะแนนตัวเลือกที่ ${j + 1}`}
                className={`${inputCls} w-20 shrink-0 bg-white text-center`}
              />
              <IconBtn label="ลบตัวเลือก" danger disabled={q.choices.length <= 2} onClick={() => onChange({ choices: q.choices.filter((_, k) => k !== j) })}>
                <X size={16} />
              </IconBtn>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ choices: [...q.choices, { text: "", score: q.choices.length }] })}
            className="self-start text-sm font-semibold text-staff-600 hover:underline"
          >
            + เพิ่มตัวเลือก
          </button>
        </div>
      )}
    </div>
  );
}

function IconBtn({
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
      className={`grid h-9 w-9 place-items-center rounded-xl border bg-white transition disabled:opacity-30 ${
        danger ? "border-[#f7c6c9] text-risk-crit hover:bg-[#fff5f5]" : "border-staff-line text-staff-muted hover:border-staff-300 hover:text-staff-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* =========================================================
   ตัวอย่างหน้าผู้ใช้ (โทนแดงแบบหน้าผู้ใช้จริง)
========================================================= */

function Preview({ label, questions }: { label: string; questions: Question[] }) {
  // key คำถาม → ลำดับตัวเลือกที่เลือก
  const [picked, setPicked] = useState<Record<string, number>>({});
  const total = questions.reduce((s, q) => s + (picked[q.key] !== undefined ? q.choices[picked[q.key]]?.score ?? 0 : 0), 0);
  return (
    <div className="mt-4 rounded-3xl bg-[#fbf7f7] p-4 sm:p-6">
      <p className="text-sm font-semibold text-[#b91c2b]">แบบประเมิน</p>
      <h3 className="text-xl font-bold text-[#2f3037]">{label}</h3>
      <div className="mt-4 flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={q.key} className="rounded-2xl border border-[#eee5e6] bg-white p-4">
            <p className="font-semibold text-[#2f3037]">
              {i + 1}. {q.text || "…"}
            </p>
            {q.type === "number" ? (
              <input type="number" disabled placeholder="กรอกตัวเลข" className="mt-3 w-40 rounded-xl border border-[#eee5e6] px-3 py-2 text-sm" />
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.choices.map((c, j) => {
                  const on = picked[q.key] === j;
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setPicked((a) => ({ ...a, [q.key]: j }))}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                        on ? "border-[#b91c2b] bg-[#fff0f2] font-semibold text-[#b91c2b]" : "border-[#eee5e6] text-[#2f3037]"
                      }`}
                    >
                      {c.text || "…"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-[#777780]">
        คะแนนรวมจากตัวอย่าง: <b className="text-[#2f3037]">{total}</b>
      </p>
    </div>
  );
}

/* =========================================================
   สร้างแบบประเมินใหม่
========================================================= */

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const d = await staffFetch<{ id: number }>("/api/staff/assessments", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      onCreated(d.id);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-staff-ink/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="create-title" className="text-lg font-bold">
          เพิ่มแบบประเมินใหม่
        </h2>
        <p className="mt-1 text-sm text-staff-muted">
          สำหรับแบบประเมินที่ตอบแบบเลือกตัวเลือก รวมคะแนน แล้วแปลผลตามช่วงคะแนน · แบบประเมินจะเริ่มแบบปิดไว้จนกว่าจะเพิ่มคำถาม ตั้งเกณฑ์แปลผล และกดเปิดใช้งาน
        </p>
        <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
          ชื่อแบบประเมิน
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus placeholder="เช่น แบบประเมินภาวะหมดไฟในการทำงาน" className={inputCls} />
        </label>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
          คำอธิบาย (แสดงให้ผู้ใช้เห็น)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={inputCls} placeholder="แบบประเมินนี้ใช้ทำอะไร ใช้เวลาประมาณกี่นาที" />
        </label>
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            ยกเลิก
          </button>
          <button type="button" onClick={submit} disabled={saving || !name.trim()} className={btnPrimary}>
            {saving ? "กำลังสร้าง…" : "สร้างแบบประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   เกณฑ์แปลผลตามช่วงคะแนน (เฉพาะแบบประเมินทั่วไป)
========================================================= */

type LevelDraft = { key: string; id?: number; riskLevel: string; min: string; max: string; text: string };

function LevelsEditor({
  typeId,
  questions,
  initial,
  onSaved,
}: {
  typeId: number;
  questions: Question[];
  initial: Detail["levels"];
  onSaved: () => void;
}) {
  const [levels, setLevels] = useState<LevelDraft[]>(() =>
    initial.length
      ? initial.map((l) => ({ key: newKey(), id: l.id, riskLevel: l.riskLevel, min: String(l.min ?? ""), max: String(l.max ?? ""), text: l.text }))
      : [
          { key: newKey(), riskLevel: "ปกติ", min: "", max: "", text: "" },
          { key: newKey(), riskLevel: "ควรระวัง", min: "", max: "", text: "" },
          { key: newKey(), riskLevel: "เสี่ยงสูง", min: "", max: "", text: "" },
        ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // ช่วงคะแนนที่เป็นไปได้จากคำถามปัจจุบัน (รวมคะแนนต่ำสุด/สูงสุดของแต่ละข้อ)
  const choiceQs = questions.filter((q) => q.type === "choice" && q.choices.length);
  const possibleMin = choiceQs.reduce((s, q) => s + Math.min(...q.choices.map((c) => c.score)), 0);
  const possibleMax = choiceQs.reduce((s, q) => s + Math.max(...q.choices.map((c) => c.score)), 0);

  const parsed = levels.map((l) => ({ ...l, lo: Number(l.min), hi: Number(l.max) }));
  const complete = parsed.every((l) => l.min !== "" && l.max !== "" && Number.isInteger(l.lo) && Number.isInteger(l.hi) && l.lo <= l.hi);
  const sorted = [...parsed].sort((a, b) => a.lo - b.lo);
  const gapAt = complete ? sorted.findIndex((l, i) => i > 0 && l.lo !== sorted[i - 1].hi + 1) : -1;
  const covers = complete && sorted.length > 0 && sorted[0].lo <= possibleMin && sorted[sorted.length - 1].hi >= possibleMax;

  const set = (key: string, patch: Partial<LevelDraft>) => setLevels((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // แบ่งช่วงคะแนนให้อัตโนมัติเท่า ๆ กัน
  const autoSplit = () => {
    const n = levels.length;
    const span = possibleMax - possibleMin + 1;
    setLevels((ls) =>
      ls.map((l, i) => {
        const lo = possibleMin + Math.floor((span * i) / n);
        const hi = possibleMin + Math.floor((span * (i + 1)) / n) - 1;
        return { ...l, min: String(lo), max: String(i === n - 1 ? possibleMax : hi) };
      })
    );
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await staffFetch("/api/staff/assessments", {
        method: "PUT",
        body: JSON.stringify({
          typeId,
          levels: levels.map((l) => ({ id: l.id, riskLevel: l.riskLevel, min: Number(l.min), max: Number(l.max), text: l.text })),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-staff-soft px-4 py-3 text-sm">
        <span>
          คะแนนรวมที่เป็นไปได้จากคำถามที่เผยแพร่: <b>{possibleMin}–{possibleMax}</b> คะแนน · เรียงระดับจากคะแนนน้อย (ปกติ) ไปมาก (เสี่ยงสูง)
        </span>
        <button type="button" onClick={autoSplit} disabled={!choiceQs.length} className="font-semibold text-staff-600 hover:underline disabled:opacity-40">
          แบ่งช่วงอัตโนมัติ
        </button>
      </div>

      {levels.map((l, i) => (
        <div key={l.key} className="rounded-2xl border border-staff-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <RiskPill severity={severityForRank(i, levels.length)}>ระดับ {i + 1}</RiskPill>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-semibold text-staff-muted">
              ชื่อระดับผล
              <input value={l.riskLevel} onChange={(e) => set(l.key, { riskLevel: e.target.value })} maxLength={100} className={inputCls} />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs font-semibold text-staff-muted">
              ตั้งแต่
              <input type="number" value={l.min} onChange={(e) => set(l.key, { min: e.target.value })} className={`${inputCls} text-center`} />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs font-semibold text-staff-muted">
              ถึง
              <input type="number" value={l.max} onChange={(e) => set(l.key, { max: e.target.value })} className={`${inputCls} text-center`} />
            </label>
            <IconBtn label="ลบระดับ" danger disabled={levels.length <= 2} onClick={() => setLevels((ls) => ls.filter((x) => x.key !== l.key))}>
              <Trash2 size={16} />
            </IconBtn>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-staff-muted">
            คำแนะนำที่ผู้ใช้ได้รับ
            <textarea value={l.text} onChange={(e) => set(l.key, { text: e.target.value })} rows={2} maxLength={1000} className={inputCls} />
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setLevels((ls) => [...ls, { key: newKey(), riskLevel: "", min: "", max: "", text: "" }])}
        disabled={levels.length >= 8}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-staff-200 text-sm font-semibold text-staff-600 transition hover:border-staff-400 hover:bg-staff-50 disabled:opacity-40"
      >
        <Plus size={18} /> เพิ่มระดับ
      </button>

      {complete && gapAt > 0 && (
        <p className="text-sm font-semibold text-risk-crit">
          ช่วงคะแนนไม่ต่อกัน: หลัง &quot;{sorted[gapAt - 1].riskLevel}&quot; (ถึง {sorted[gapAt - 1].hi}) ระดับถัดไปควรเริ่มที่ {sorted[gapAt - 1].hi + 1}
        </p>
      )}
      {complete && gapAt <= 0 && !covers && choiceQs.length > 0 && (
        <p className="text-sm font-semibold text-[#8a5a00]">
          เกณฑ์ยังไม่ครอบคลุมคะแนน {possibleMin}–{possibleMax} ทั้งหมด ผู้ใช้ที่ได้คะแนนนอกช่วงจะส่งแบบประเมินไม่ได้
        </p>
      )}
      <ErrorBox message={error} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-staff-muted">ระดับสูงสุดที่อยู่ในระดับ &quot;สูง&quot; ขึ้นไป จะสร้างเคสในหน้าติดตามอัตโนมัติ (เฉพาะผู้ใช้ที่ยินยอม)</p>
        <button type="button" onClick={save} disabled={saving || !complete || gapAt > 0} className={btnPrimary}>
          {saved ? <><Check size={16} /> บันทึกแล้ว</> : saving ? "กำลังบันทึก…" : "บันทึกเกณฑ์แปลผล"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   ยืนยันการลบแบบประเมิน (พิมพ์ชื่อให้ตรงก่อนลบ)
========================================================= */

function DeleteDialog({ typeId, name, onClose, onDeleted }: { typeId: number; name: string; onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await staffFetch("/api/staff/assessments", { method: "DELETE", body: JSON.stringify({ typeId, confirmName: typed }) });
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-staff-ink/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="delete-title" className="text-lg font-bold">
          ลบแบบประเมิน &quot;{name}&quot;?
        </h2>
        <p className="mt-1 text-sm text-staff-muted">
          คำถาม ตัวเลือก และเกณฑ์แปลผลของแบบประเมินนี้จะถูกลบทั้งหมด และกู้คืนไม่ได้ (ยังไม่มีผู้ใช้ทำแบบประเมินนี้)
        </p>
        <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
          พิมพ์ชื่อแบบประเมินเพื่อยืนยัน
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoFocus className={inputCls} />
        </label>
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || typed.trim() !== name}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-risk-high px-5 text-sm font-semibold text-white transition hover:bg-risk-crit disabled:opacity-50"
          >
            <Trash2 size={16} /> {busy ? "กำลังลบ…" : "ลบแบบประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}
