"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import { ErrorBox, btnGhost, btnPrimary, inputCls } from "../ui";

/* =========================================================
   สร้างแบบประเมินใหม่
========================================================= */

export function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
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
   ยืนยันการลบแบบประเมิน (พิมพ์ชื่อให้ตรงก่อนลบ)
========================================================= */

export function DeleteDialog({ typeId, name, onClose, onDeleted }: { typeId: number; name: string; onClose: () => void; onDeleted: () => void }) {
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
