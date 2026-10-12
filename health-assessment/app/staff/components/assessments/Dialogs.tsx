"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import { ErrorBox, btnGhost, btnPrimary, inputCls } from "../ui";
import {
  CATEGORY_NAME_MAX,
  CATEGORY_SUBTITLE_MAX,
  CATEGORY_THEMES,
  THEME_INFO,
  firstUnusedTheme,
  type CategoryTheme,
} from "@/lib/assessmentCategories";
import type { CategoryOption } from "./shared";

/* =========================================================
   สร้างแบบประเมินใหม่
   - ต้องเลือกหมวดหมู่: หมวดที่มีอยู่ หรือ "สร้างหมวดหมู่ใหม่" (ชื่อ / คำอธิบายสั้น / สี)
   - หมวดใหม่ถูกสร้างพร้อมแบบประเมินใน transaction เดียว (POST /api/staff/assessments)
========================================================= */

// กล่องสร้างแบบประเมินใหม่: กรอกชื่อ คำอธิบาย เลือกหรือสร้างหมวดหมู่ แล้วส่งไป API
export function CreateDialog({
  categories,
  onClose,
  onCreated,
}: {
  categories: CategoryOption[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // "" = ยังไม่เลือก, "new" = สร้างหมวดใหม่, อื่น ๆ = category_id
  const [category, setCategory] = useState("");
  const [catName, setCatName] = useState("");
  const [catSubtitle, setCatSubtitle] = useState("");
  const [catTheme, setCatTheme] = useState<CategoryTheme>(() => firstUnusedTheme(categories.map((c) => c.theme)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isNew = category === "new";
  const nameTaken = isNew && categories.some((c) => c.name.trim().toLowerCase() === catName.trim().toLowerCase());
  const ready = name.trim() && category && (!isNew || (catName.trim() && !nameTaken));

  // ส่งคำขอสร้างแบบประเมิน (พร้อมสร้างหมวดใหม่ถ้าเลือก)
  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const d = await staffFetch<{ id: number }>("/api/staff/assessments", {
        method: "POST",
        body: JSON.stringify(
          isNew
            ? { name, description, newCategory: { name: catName, subtitle: catSubtitle, theme: catTheme } }
            : { name, description, categoryId: Number(category) }
        ),
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
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="create-title" className="text-lg font-bold">
          สร้างแบบประเมินใหม่
        </h2>
        <p className="mt-1 text-sm text-staff-muted">
          สำหรับแบบประเมินที่ตอบแบบเลือกตัวเลือก รวมคะแนน แล้วแปลผลตามช่วงคะแนน · แบบประเมินจะเริ่มแบบปิดไว้จนกว่าจะเพิ่มคำถาม ตั้งเกณฑ์แปลผล เผยแพร่ แล้วจึงกดเปิดใช้งาน
        </p>
        <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
          ชื่อแบบประเมิน
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus placeholder="เช่น แบบประเมินภาวะหมดไฟในการทำงาน" className={inputCls} />
        </label>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
          คำอธิบาย (แสดงให้ผู้ใช้เห็น)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={inputCls} placeholder="แบบประเมินนี้ใช้ทำอะไร ใช้เวลาประมาณกี่นาที" />
        </label>

        {/* ===== หมวดหมู่ที่ผู้ใช้จะเห็นแบบประเมินนี้ ===== */}
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold">
          หมวดหมู่
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="" disabled>
              เลือกหมวดหมู่…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.builtIn ? " (หมวดหลัก)" : ""}
              </option>
            ))}
            <option value="new">+ สร้างหมวดหมู่ใหม่</option>
          </select>
          <span className="text-xs font-normal text-staff-muted">ผู้ใช้จะพบแบบประเมินนี้ในหมวดที่เลือก (หน้า &quot;เข้าสู่แบบประเมิน&quot;)</span>
        </label>

        {isNew && (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-dashed border-staff-300 p-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              ชื่อหมวดหมู่
              <input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                maxLength={CATEGORY_NAME_MAX}
                placeholder="เช่น สุขภาพในที่ทำงาน"
                className={inputCls}
              />
              {nameTaken && <span className="text-xs font-semibold text-risk-crit">มีหมวดหมู่ชื่อนี้แล้ว เลือกจากรายการแทนได้</span>}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              คำอธิบายสั้น (ไม่บังคับ)
              <input
                value={catSubtitle}
                onChange={(e) => setCatSubtitle(e.target.value)}
                maxLength={CATEGORY_SUBTITLE_MAX}
                placeholder="แสดงใต้ชื่อหมวดบนการ์ด เช่น (Workplace)"
                className={inputCls}
              />
            </label>
            <ThemePicker value={catTheme} onChange={setCatTheme} />
          </div>
        )}

        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>
            ยกเลิก
          </button>
          <button type="button" onClick={submit} disabled={saving || !ready} className={btnPrimary}>
            {saving ? "กำลังสร้าง…" : "สร้างแบบประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== เลือกสีของหมวด (ใช้ทั้งตอนสร้างและแก้ไขหมวด) ===== */
export function ThemePicker({ value, onChange }: { value: CategoryTheme; onChange: (t: CategoryTheme) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">สีของหมวด</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {CATEGORY_THEMES.map((t) => {
          const on = t === value;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(t)}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                on ? "border-staff-600 bg-white text-staff-ink" : "border-staff-line bg-white text-staff-muted hover:border-staff-300"
              }`}
            >
              <span className="h-4 w-4 rounded-full" style={{ background: THEME_INFO[t].swatch }} aria-hidden />
              {THEME_INFO[t].label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* =========================================================
   ยืนยันการลบแบบประเมิน (พิมพ์ชื่อให้ตรงก่อนลบ)
========================================================= */

// กล่องยืนยันลบแบบประเมิน ต้องพิมพ์ชื่อให้ตรงก่อนลบ
export function DeleteDialog({
  typeId,
  name,
  resultCount,
  onClose,
  onDeleted,
}: {
  typeId: number;
  name: string;
  // ผลประเมินของผู้ใช้ในแบบนี้ (จะถูกลบไปด้วย)
  resultCount: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ส่งคำขอลบแบบประเมินพร้อมชื่อที่พิมพ์ยืนยัน
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
          คำถาม ตัวเลือก เกณฑ์แปลผล คำแนะนำ และประวัติการแก้ไขของแบบประเมินนี้จะถูกลบทั้งหมด และกู้คืนไม่ได้
        </p>
        {resultCount > 0 ? (
          <p className="mt-3 rounded-xl border border-[#f7c6c9] bg-[#fff5f5] px-3 py-2 text-sm font-semibold text-risk-crit" role="alert">
            มีผลการประเมินของผู้ใช้ {resultCount.toLocaleString("th-TH")} รายการ ผลเหล่านี้จะถูกลบออกจากประวัติของผู้ใช้ด้วย
            หากต้องการเก็บผลไว้ ให้ปิดใช้งานแทนการลบ
          </p>
        ) : (
          <p className="mt-3 text-sm text-staff-muted">ยังไม่มีผู้ใช้ทำแบบประเมินนี้</p>
        )}
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
