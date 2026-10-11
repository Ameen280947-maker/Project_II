"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, FolderCog, Plus, Trash2 } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import { Card, Empty, ErrorBox, PageHeader, Switch, btnGhost, btnPrimary, inputCls, thDate } from "../components/ui";
import { CreateDialog, DeleteDialog } from "../components/assessments/Dialogs";
import LevelsTab from "../components/assessments/LevelsTab";
import PreviewTab from "../components/assessments/PreviewTab";
import HistoryTab from "../components/assessments/HistoryTab";
import CategoriesDialog from "../components/assessments/CategoriesDialog";
import QuestionsTab from "../components/assessments/QuestionsTab";
import { isMissing, toEditable, toSnapshot, type CategoryOption, type Detail, type EState, type TypeRow } from "../components/assessments/shared";

/* =========================================================
   จัดการแบบประเมิน
   - แก้ไขทุกอย่างลง "ฉบับร่าง" (assessment_versions status = draft) ก่อน
   - "เผยแพร่" = เขียนลงตารางที่ใช้งานอยู่ + บันทึกเป็นเวอร์ชันใหม่ (v1, v2, …)
   - เปิด/ปิดใช้งานมีผลทันที ไม่ผ่านฉบับร่าง
   - ?type=<id> เลือกแบบประเมินไว้ล่วงหน้า (ลิงก์จากหน้าภาพรวม)
   - หมวดหมู่ (หน้าที่ผู้ใช้พบแบบประเมิน) เลือกตอนสร้าง และย้ายได้ทันทีในหน้าแก้ไข ไม่ผ่านฉบับร่าง
========================================================= */

type Tab = "questions" | "levels" | "preview" | "history";

export default function StaffAssessmentsPage() {
  return (
    <Suspense>
      <Assessments />
    </Suspense>
  );
}

function Assessments() {
  const params = useSearchParams();
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selected, setSelected] = useState<number | null>(Number(params.get("type")) || null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  // มีการแก้ไขที่ยังไม่บันทึกในตัวแก้ไขหรือไม่ (ใช้เตือนก่อนเปลี่ยนแบบประเมิน)
  const dirtyRef = useRef(false);

  const loadTypes = useCallback(() => {
    staffFetch<{ types: TypeRow[]; categories: CategoryOption[] }>("/api/staff/assessments")
      .then((d) => {
        setTypes(d.types);
        setCategories(d.categories);
        setSelected((s) => (s && d.types.some((t) => t.id === s) ? s : d.types.find((t) => t.name === "9Q")?.id ?? d.types[0]?.id ?? null));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const select = (id: number) => {
    if (id === selected) return;
    if (dirtyRef.current && !confirm("มีการแก้ไขที่ยังไม่บันทึกเป็นฉบับร่าง ต้องการออกจากหน้านี้หรือไม่?")) return;
    dirtyRef.current = false;
    setSelected(id);
    window.history.replaceState(null, "", `?type=${id}`);
  };

  const toggle = async (t: TypeRow) => {
    setTypes((all) => all.map((x) => (x.id === t.id ? { ...x, isActive: !x.isActive } : x)));
    try {
      await staffFetch("/api/staff/assessments", { method: "PATCH", body: JSON.stringify({ typeId: t.id, isActive: !t.isActive }) });
    } catch (e) {
      setError((e as Error).message);
      loadTypes();
    }
  };

  const current = types.find((t) => t.id === selected);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Assessments"
        title="จัดการ"
        highlight="แบบประเมิน"
        actions={
          <>
            <button type="button" onClick={() => setManagingCategories(true)} className={btnGhost}>
              <FolderCog size={18} /> จัดการหมวดหมู่
            </button>
            <button type="button" onClick={() => setCreating(true)} className={btnPrimary}>
              <Plus size={18} /> สร้างแบบประเมินใหม่
            </button>
          </>
        }
      />
      <ErrorBox message={error} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="!p-3 lg:w-[300px] lg:shrink-0">
          <p className="px-3 pb-2 pt-1 text-sm font-semibold text-staff-muted">แบบประเมินทั้งหมด ({types.length})</p>
          <ul className="flex max-h-[340px] flex-col gap-1.5 overflow-y-auto lg:max-h-none">
            {types.map((t) => {
              const on = t.id === selected;
              return (
                <li
                  key={t.id}
                  className={`flex items-center gap-2 rounded-2xl border pr-2 transition ${
                    on ? "border-staff-900 bg-white" : "border-transparent hover:bg-staff-soft"
                  }`}
                >
                  <button type="button" onClick={() => select(t.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left" aria-current={on ? "true" : undefined}>
                    <span className="block truncate text-sm font-semibold">{t.label}</span>
                    <span className="block truncate text-xs text-staff-muted">
                      {t.questions} คำถาม · {categories.find((c) => c.id === t.categoryId)?.name ?? "ยังไม่มีหมวดหมู่"}
                    </span>
                    {t.missing > 0 && <span className="block text-xs font-semibold text-risk-crit">ขาดคำแนะนำ {t.missing} ระดับ</span>}
                    {!t.isActive && <span className="block text-xs font-semibold text-staff-muted">ปิดใช้งาน</span>}
                  </button>
                  <Switch checked={t.isActive} onChange={() => toggle(t)} label={`เปิดใช้งาน ${t.label}`} />
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="min-w-0 flex-1">
          {selected && (
            <Editor
              key={selected}
              typeId={selected}
              isActive={current?.isActive}
              categoryId={current?.categoryId}
              categories={categories}
              dirtyRef={dirtyRef}
              onChanged={loadTypes}
              onDeleted={() => {
                dirtyRef.current = false;
                setSelected(null);
                window.history.replaceState(null, "", "?");
                loadTypes();
              }}
            />
          )}
        </div>
      </div>

      {managingCategories && (
        <CategoriesDialog
          categories={categories}
          onClose={() => setManagingCategories(false)}
          onChanged={loadTypes}
        />
      )}

      {creating && (
        <CreateDialog
          categories={categories}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            loadTypes();
            select(id);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   EDITOR
========================================================= */

function Editor({
  typeId,
  isActive: listActive,
  categoryId: listCategoryId,
  categories,
  dirtyRef,
  onChanged,
  onDeleted,
}: {
  typeId: number;
  isActive?: boolean;
  categoryId?: number | null;
  categories: CategoryOption[];
  dirtyRef: { current: boolean };
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [edit, setEdit] = useState<EState | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const [tab, setTab] = useState<Tab>("questions");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "discard" | "publish" | "category">("");

  const setDirty = useCallback(
    (v: boolean) => {
      dirtyRef.current = v;
      setDirtyState(v);
    },
    [dirtyRef]
  );

  const load = useCallback(() => {
    return staffFetch<{ assessment: Detail }>(`/api/staff/assessments?type=${typeId}`)
      .then((d) => {
        setDetail(d.assessment);
        setEdit(toEditable(d.assessment.content));
        setDirty(false);
      })
      .catch((e) => setError(e.message));
  }, [typeId, setDirty]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const change = (patch: Partial<EState>) => {
    setEdit((e) => (e ? { ...e, ...patch } : e));
    setDirty(true);
  };

  if (!detail || !edit) return error ? <ErrorBox message={error} /> : <Card><Empty>กำลังโหลด…</Empty></Card>;

  const snapshot = () => toSnapshot(edit, { name: detail.name, generic: detail.generic });
  const hasDraft = Boolean(detail.draft);
  const missing = edit.levels.filter(isMissing).length;
  const active = listActive ?? detail.isActive;
  const categoryId = listCategoryId !== undefined ? listCategoryId : detail.categoryId;

  const run = async (kind: typeof busy, fn: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const saveDraft = () =>
    run("save", async () => {
      await staffFetch("/api/staff/assessments", { method: "PUT", body: JSON.stringify({ typeId, snapshot: snapshot() }) });
      await load();
      onChanged();
      flash("บันทึกฉบับร่างแล้ว ยังไม่มีผลกับผู้ใช้จนกว่าจะเผยแพร่");
    });

  const discardDraft = () => {
    if (!confirm(hasDraft ? "ทิ้งฉบับร่างนี้? การแก้ไขที่ยังไม่เผยแพร่ทั้งหมดจะหายไป" : "ยกเลิกการแก้ไขที่ยังไม่บันทึก?")) return;
    run("discard", async () => {
      if (hasDraft) await staffFetch("/api/staff/assessments", { method: "POST", body: JSON.stringify({ action: "discard", typeId }) });
      await load();
      onChanged();
      flash(hasDraft ? "ทิ้งฉบับร่างแล้ว" : "ยกเลิกการแก้ไขแล้ว");
    });
  };

  const publish = () => {
    const warn = missing ? `\n\nมี ${missing} ระดับที่ยังไม่มีข้อความคำแนะนำ ผู้ใช้ที่ได้ผลระดับนั้นจะไม่เห็นคำแนะนำ` : "";
    if (!confirm(`เผยแพร่การแก้ไข? มีผลกับการประเมินครั้งใหม่ทันที ผลเดิมของผู้ใช้ยังผูกกับเนื้อหาเดิม${warn}`)) return;
    run("publish", async () => {
      await staffFetch("/api/staff/assessments", {
        method: "POST",
        body: JSON.stringify({ action: "publish", typeId, snapshot: snapshot() }),
      });
      await load();
      onChanged();
      flash("เผยแพร่แล้ว · บันทึกในประวัติการแก้ไข");
    });
  };

  // ย้ายหมวดหมู่: มีผลกับหน้าผู้ใช้ทันที (ไม่ผ่านฉบับร่าง)
  const moveCategory = (id: number) =>
    run("category", async () => {
      await staffFetch("/api/staff/assessments", { method: "PATCH", body: JSON.stringify({ typeId, categoryId: id }) });
      onChanged();
      flash(`ย้ายไปหมวด "${categories.find((c) => c.id === id)?.name ?? ""}" แล้ว · มีผลกับหน้าผู้ใช้ทันที`);
    });

  const tabs: { key: Tab; label: string; dot?: boolean }[] = [
    { key: "questions", label: "คำถามและคะแนน" },
    { key: "levels", label: "เกณฑ์ผลและคำแนะนำ", dot: missing > 0 },
    { key: "preview", label: "ตัวอย่าง" },
    { key: "history", label: "ประวัติการแก้ไข" },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-2xl font-bold">{detail.label}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? "bg-staff-900 text-white" : "bg-staff-100 text-staff-muted"}`}>
              {active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </span>
            {hasDraft ? (
              <span className="rounded-full bg-[#fff3dc] px-2.5 py-0.5 text-xs font-semibold text-[#8a5a00]">มีฉบับร่างที่ยังไม่เผยแพร่</span>
            ) : (
              dirty && <span className="rounded-full bg-[#fff3dc] px-2.5 py-0.5 text-xs font-semibold text-[#8a5a00]">มีการแก้ไขที่ยังไม่บันทึก</span>
            )}
          </div>
          {detail.draft && (
            <p className="text-xs text-[#8a5a00]">
              ฉบับร่างบันทึกล่าสุดโดย {detail.draft.by ?? "-"} · {thDate(detail.draft.updatedAt, true)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.deletable && (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#f7c6c9] bg-white px-4 text-sm font-semibold text-risk-crit transition hover:bg-[#fff5f5]"
            >
              <Trash2 size={16} /> ลบแบบประเมิน
            </button>
          )}
          <button type="button" onClick={discardDraft} disabled={!!busy || (!hasDraft && !dirty)} className={`${btnGhost} h-10`}>
            {busy === "discard" ? "กำลังทิ้ง…" : "ทิ้งฉบับร่าง"}
          </button>
          <button type="button" onClick={saveDraft} disabled={!!busy || !dirty} className={`${btnGhost} h-10`}>
            {busy === "save" ? "กำลังบันทึก…" : "บันทึกฉบับร่าง"}
          </button>
          <button type="button" onClick={publish} disabled={!!busy || (!hasDraft && !dirty)} className={`${btnPrimary} h-10`}>
            {busy === "publish" ? "กำลังเผยแพร่…" : "เผยแพร่"}
          </button>
        </div>
      </div>

      {deleting && (
        <DeleteDialog
          typeId={detail.id}
          name={detail.name}
          resultCount={detail.resultCount}
          onClose={() => setDeleting(false)}
          onDeleted={onDeleted}
        />
      )}

      {/* ===== หมวดหมู่ (มีผลทันที) ===== */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="font-semibold">หมวดหมู่</span>
        {detail.builtIn ? (
          <span className="text-staff-muted">
            {categories.find((c) => c.id === categoryId)?.name ?? "-"} · แบบประเมินหลักของระบบ ย้ายหมวดไม่ได้
          </span>
        ) : (
          <>
            <select
              value={categoryId ?? ""}
              onChange={(e) => e.target.value && moveCategory(Number(e.target.value))}
              disabled={!!busy}
              aria-label="หมวดหมู่ของแบบประเมิน"
              className={`${inputCls} !w-auto min-w-[220px] !py-2`}
            >
              {categoryId === null && (
                <option value="" disabled>
                  ยังไม่มีหมวดหมู่ (ผู้ใช้เห็นใน &quot;แบบประเมินเพิ่มเติม&quot;)
                </option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-staff-muted">{busy === "category" ? "กำลังย้าย…" : "เปลี่ยนแล้วมีผลทันที ไม่ผ่านฉบับร่าง"}</span>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold">
          คำอธิบายสั้นที่ผู้ใช้เห็น
          <input value={edit.description} onChange={(e) => change({ description: e.target.value })} maxLength={500} placeholder="แบบประเมินนี้ใช้ทำอะไร" className={inputCls} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold">
          แหล่งอ้างอิงของแบบประเมิน
          <input value={edit.source} onChange={(e) => change({ source: e.target.value })} maxLength={500} placeholder="เช่น กรมสุขภาพจิต กระทรวงสาธารณสุข" className={inputCls} />
        </label>
      </div>

      <div className="mt-4 flex gap-2 rounded-2xl border border-[#f6dca8] bg-[#fff8e8] p-4 text-sm text-[#8a5a00]">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <span>
          การแก้ไขมีผลกับการประเมินครั้งใหม่เท่านั้น ผลที่ผู้ใช้ทำไปแล้วผูกกับเวอร์ชันเดิม · ควรตรวจสอบคะแนนและเกณฑ์กับแหล่งอ้างอิงก่อนเผยแพร่
        </span>
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
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === t.key ? "border-staff-900 text-staff-ink" : "border-transparent text-staff-muted hover:text-staff-ink"
            }`}
          >
            {t.label}
            {t.dot && <span className="h-2 w-2 rounded-full bg-risk-crit" aria-label="มีระดับที่ยังไม่มีคำแนะนำ" />}
          </button>
        ))}
      </div>

      {tab === "questions" && <QuestionsTab questions={edit.questions} onChange={(questions) => change({ questions })} />}
      {tab === "levels" && (
        <LevelsTab
          label={detail.label}
          generic={detail.generic}
          levels={edit.levels}
          questions={edit.questions}
          levelMeta={detail.levelMeta}
          onChange={(levels) => change({ levels })}
        />
      )}
      {tab === "preview" && (
        <PreviewTab label={detail.label} description={edit.description} questions={edit.questions} levels={edit.levels} generic={detail.generic} />
      )}
      {/* โหลดใหม่หลังเผยแพร่ หรือเปิด/ปิดใช้งาน */}
      {tab === "history" && <HistoryTab typeId={detail.id} refreshKey={`${detail.published?.versionId ?? ""}|${active}`} />}
    </Card>
  );
}
