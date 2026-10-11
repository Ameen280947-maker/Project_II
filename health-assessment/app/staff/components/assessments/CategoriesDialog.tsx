"use client";

import { useState } from "react";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import { CATEGORY_NAME_MAX, CATEGORY_SUBTITLE_MAX, THEME_INFO, type CategoryTheme } from "@/lib/assessmentCategories";
import { ErrorBox, btnGhost, btnPrimary, inputCls } from "../ui";
import { ThemePicker } from "./Dialogs";
import type { CategoryOption } from "./shared";

/* =========================================================
   จัดการหมวดหมู่แบบประเมิน
   - หมวดที่เจ้าหน้าที่สร้าง: แก้ชื่อ / คำอธิบายสั้น / สี และลบได้
     ลบแล้วแบบประเมินในหมวดถูกย้ายไปหมวดที่เลือก (หรือไม่มีหมวด)
   - หมวดหลัก 3 หมวดแก้ไขไม่ได้ (หน้าเมนูและการ์ดของหมวดเขียนไว้ในโค้ด)
   - มีผลกับหน้าผู้ใช้ทันที (ไม่ผ่านฉบับร่าง)
========================================================= */

type Mode = { kind: "edit"; id: number } | { kind: "delete"; id: number } | null;

export default function CategoriesDialog({
  categories,
  onClose,
  onChanged,
}: {
  categories: CategoryOption[];
  onClose: () => void;
  // โหลดรายการแบบประเมิน/หมวดใหม่ (หน้าต่างนี้ยังเปิดอยู่ จัดการต่อได้)
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [message, setMessage] = useState("");
  const done = (m: string) => {
    setMode(null);
    setMessage(m);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="categories-title">
      <button type="button" aria-label="ปิด" className="absolute inset-0 bg-staff-ink/30" onClick={onClose} />
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="categories-title" className="text-lg font-bold">
          จัดการหมวดหมู่
        </h2>
        <p className="mt-1 text-sm text-staff-muted">แก้ชื่อ เปลี่ยนสี หรือลบหมวดหมู่ที่สร้างเพิ่ม · มีผลกับหน้า &quot;เข้าสู่แบบประเมิน&quot; ของผู้ใช้ทันที</p>

        {message && (
          <p className="mt-3 rounded-xl bg-[#e8f7ed] px-3 py-2 text-sm font-semibold text-[#21733f]" role="status">
            {message}
          </p>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {categories.map((c) => (
            <li key={c.id} className="rounded-2xl border border-staff-line p-3">
              {mode?.id === c.id && mode.kind === "edit" ? (
                <EditForm category={c} categories={categories} onCancel={() => setMode(null)} onSaved={done} />
              ) : mode?.id === c.id && mode.kind === "delete" ? (
                <DeleteForm category={c} categories={categories} onCancel={() => setMode(null)} onDeleted={done} />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: THEME_INFO[c.theme].swatch }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {c.name}
                      {c.subtitle && <span className="font-normal text-staff-muted"> {c.subtitle}</span>}
                    </p>
                    <p className="text-xs text-staff-muted">
                      {c.types.toLocaleString("th-TH")} แบบประเมิน · สี{THEME_INFO[c.theme].label}
                      {c.builtIn && " · หมวดหลักของระบบ"}
                    </p>
                  </div>
                  {c.builtIn ? (
                    <span className="inline-flex items-center gap-1 text-xs text-staff-muted" title="หมวดหลักของระบบแก้ไขหรือลบไม่ได้">
                      <Lock size={14} /> แก้ไขไม่ได้
                    </span>
                  ) : (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => (setMessage(""), setMode({ kind: "edit", id: c.id }))}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-staff-line px-3 text-xs font-semibold transition hover:bg-staff-soft"
                      >
                        <Pencil size={14} /> แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => (setMessage(""), setMode({ kind: "delete", id: c.id }))}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#f7c6c9] px-3 text-xs font-semibold text-risk-crit transition hover:bg-[#fff5f5]"
                      >
                        <Trash2 size={14} /> ลบ
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!categories.some((c) => !c.builtIn) && (
          <p className="mt-3 text-sm text-staff-muted">ยังไม่มีหมวดหมู่ที่สร้างเพิ่ม · สร้างได้ตอนกด &quot;สร้างแบบประเมินใหม่&quot;</p>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className={btnGhost}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== แก้ชื่อ / คำอธิบายสั้น / สี ===== */
function EditForm({
  category,
  categories,
  onCancel,
  onSaved,
}: {
  category: CategoryOption;
  categories: CategoryOption[];
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(category.name);
  const [subtitle, setSubtitle] = useState(category.subtitle ?? "");
  const [theme, setTheme] = useState<CategoryTheme>(category.theme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameTaken = categories.some((c) => c.id !== category.id && c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const unchanged = name.trim() === category.name && subtitle.trim() === (category.subtitle ?? "") && theme === category.theme;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await staffFetch("/api/staff/categories", {
        method: "PATCH",
        body: JSON.stringify({ categoryId: category.id, name, subtitle, theme }),
      });
      onSaved(`บันทึกหมวด "${name.trim()}" แล้ว · มีผลกับหน้าผู้ใช้ทันที`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        ชื่อหมวดหมู่
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={CATEGORY_NAME_MAX} autoFocus className={inputCls} />
        {nameTaken && <span className="text-xs font-semibold text-risk-crit">มีหมวดหมู่ชื่อนี้แล้ว</span>}
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        คำอธิบายสั้น (ไม่บังคับ)
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={CATEGORY_SUBTITLE_MAX} className={inputCls} />
      </label>
      <ThemePicker value={theme} onChange={setTheme} />
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnGhost}>
          ยกเลิก
        </button>
        <button type="button" onClick={save} disabled={saving || !name.trim() || nameTaken || unchanged} className={btnPrimary}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </div>
  );
}

/* ===== ลบหมวด: เลือกว่าจะย้ายแบบประเมินในหมวดไปไหน ===== */
function DeleteForm({
  category,
  categories,
  onCancel,
  onDeleted,
}: {
  category: CategoryOption;
  categories: CategoryOption[];
  onCancel: () => void;
  onDeleted: (message: string) => void;
}) {
  // "" = ไม่มีหมวดหมู่
  const [moveTo, setMoveTo] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setDeleting(true);
    setError("");
    try {
      await staffFetch("/api/staff/categories", {
        method: "DELETE",
        body: JSON.stringify({ categoryId: category.id, moveTo: moveTo ? Number(moveTo) : null }),
      });
      onDeleted(`ลบหมวด "${category.name}" แล้ว`);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        ลบหมวด <span className="font-semibold">&quot;{category.name}&quot;</span>?
      </p>
      {category.types > 0 ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          ย้ายแบบประเมิน {category.types.toLocaleString("th-TH")} แบบในหมวดนี้ไปที่
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={inputCls}>
            {categories
              .filter((c) => c.id !== category.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            <option value="">ไม่มีหมวดหมู่ (แสดงในส่วน &quot;แบบประเมินเพิ่มเติม&quot;)</option>
          </select>
        </label>
      ) : (
        <p className="text-sm text-staff-muted">หมวดนี้ไม่มีแบบประเมิน</p>
      )}
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnGhost}>
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-risk-crit px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          <Trash2 size={16} />
          {deleting ? "กำลังลบ…" : "ลบหมวดหมู่"}
        </button>
      </div>
    </div>
  );
}
