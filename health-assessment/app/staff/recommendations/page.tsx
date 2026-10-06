"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, Check, History, Phone } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import { SEVERITY_LABEL, type Severity } from "@/lib/staff/riskLevels";
import { Card, Empty, ErrorBox, PageHeader, btnGhost, btnPrimary, inputCls, thDate } from "../components/ui";

/* =========================================================
   TYPES (ตรงกับ /api/staff/recommendations)
========================================================= */

type TypeRow = { id: number; label: string; levels: number; missing: number };
type Level = {
  id: number;
  riskLevel: string;
  severity: number;
  text: string;
  reassessDays: number | null;
  hotline: string;
  source: string;
  editor: string | null;
  updatedAt: string | null;
};

const MAX_HINT = 300;

const HOTLINES = [
  { value: "", label: "ไม่แสดงสายด่วน" },
  { value: "1323 สายด่วนสุขภาพจิต", label: "1323 สายด่วนสุขภาพจิต" },
  { value: "1669 การแพทย์ฉุกเฉิน", label: "1669 การแพทย์ฉุกเฉิน" },
  { value: "1422 กรมควบคุมโรค", label: "1422 กรมควบคุมโรค" },
  { value: "1600 สายด่วนเลิกบุหรี่", label: "1600 สายด่วนเลิกบุหรี่" },
  { value: "1413 สายด่วนเลิกเหล้า", label: "1413 สายด่วนเลิกเหล้า" },
];

const SEV_DOT = ["bg-risk-ok", "bg-risk-mid", "bg-[#f07a3a]", "bg-risk-crit"];

/* =========================================================
   PAGE
========================================================= */

export default function RecommendationsPage() {
  return (
    <Suspense>
      <Recommendations />
    </Suspense>
  );
}

function Recommendations() {
  const params = useSearchParams();
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [typeId, setTypeId] = useState<number | null>(Number(params.get("type")) || null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [levelId, setLevelId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadTypes = useCallback(() => {
    staffFetch<{ types: TypeRow[] }>("/api/staff/recommendations")
      .then((d) => {
        setTypes(d.types);
        setTypeId((t) => (t && d.types.some((x) => x.id === t) ? t : d.types[0]?.id ?? null));
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadLevels = useCallback((id: number, keep?: number) => {
    staffFetch<{ levels: Level[] }>(`/api/staff/recommendations?type=${id}`)
      .then((d) => {
        setLevels(d.levels);
        const firstMissing = d.levels.find((l) => !l.text.trim());
        setLevelId(keep ?? firstMissing?.id ?? d.levels[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    if (typeId) loadLevels(typeId);
  }, [typeId, loadLevels]);

  const type = types.find((t) => t.id === typeId);
  const level = levels.find((l) => l.id === levelId);
  const missing = levels.filter((l) => !l.text.trim()).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Recommendations"
        title="จัดการ"
        highlight="คำแนะนำสุขภาพ"
        desc="ข้อความคำแนะนำที่ผู้ใช้ได้รับตามระดับผลประเมิน และรอบประเมินซ้ำของแต่ละระดับ"
      />
      <ErrorBox message={error} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex w-full items-center gap-3 text-sm font-bold sm:w-auto">
          <span className="shrink-0 whitespace-nowrap">แบบประเมิน</span>
          <select value={typeId ?? ""} onChange={(e) => setTypeId(Number(e.target.value))} className={`${inputCls} min-w-0 flex-1 bg-white sm:w-64`}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.missing ? ` (ขาด ${t.missing})` : ""}
              </option>
            ))}
          </select>
        </label>
        {missing > 0 ? (
          <span className="text-sm font-semibold text-risk-crit">มี {missing} ระดับที่ยังไม่มีข้อความคำแนะนำ</span>
        ) : (
          levels.length > 0 && <span className="text-sm text-staff-muted">ทุกระดับมีข้อความคำแนะนำแล้ว</span>
        )}
      </div>

      {/* ระดับผล */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {levels.map((l) => {
          const on = l.id === levelId;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevelId(l.id)}
              aria-pressed={on}
              className={`flex flex-col gap-1 rounded-2xl border bg-white p-4 text-left transition ${
                on ? "border-staff-500 ring-2 ring-staff-200" : "border-staff-line hover:border-staff-300"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${SEV_DOT[l.severity]}`} />
                <span className="truncate">{l.riskLevel}</span>
              </span>
              <span className="text-xs text-staff-muted">ระดับ{SEVERITY_LABEL[l.severity as Severity]}</span>
              {l.text.trim() ? (
                <span className="text-xs font-semibold text-staff-ink">
                  {l.reassessDays ? `รอบประเมินซ้ำ ${l.reassessDays} วัน` : "รอบประเมินซ้ำตามค่าเริ่มต้น"}
                </span>
              ) : (
                <span className="text-xs font-semibold text-risk-crit">ยังไม่มีข้อความคำแนะนำ</span>
              )}
            </button>
          );
        })}
      </div>

      {level && type && (
        <LevelEditor
          key={level.id}
          typeLabel={type.label}
          level={level}
          onSaved={() => {
            loadLevels(type.id, level.id);
            loadTypes();
          }}
        />
      )}
      {typeId && levels.length === 0 && <Card><Empty>แบบประเมินนี้ยังไม่มีระดับผลในระบบ</Empty></Card>}
    </div>
  );
}

/* =========================================================
   EDITOR + PREVIEW
========================================================= */

function LevelEditor({ typeLabel, level, onSaved }: { typeLabel: string; level: Level; onSaved: () => void }) {
  const [text, setText] = useState(level.text);
  const [days, setDays] = useState(level.reassessDays ? String(level.reassessDays) : "");
  const [hotline, setHotline] = useState(level.hotline);
  const [source, setSource] = useState(level.source);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<{ by: string | null; at: string; before: string }[] | null>(null);

  const dirty =
    text !== level.text || days !== (level.reassessDays ? String(level.reassessDays) : "") || hotline !== level.hotline || source !== level.source;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await staffFetch("/api/staff/recommendations", {
        method: "PUT",
        body: JSON.stringify({ recId: level.id, text, reassessDays: days || null, hotline, source }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setHistory(null);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const showHistory = () => {
    if (history) return setHistory(null);
    staffFetch<{ history: { by: string | null; at: string; before: string }[] }>(`/api/staff/recommendations?history=${level.id}`)
      .then((d) => setHistory(d.history))
      .catch((e) => setError(e.message));
  };

  const pillTone = ["bg-[#e8f7ed] text-[#21733f]", "bg-[#fff3dc] text-[#8a5a00]", "bg-[#ffe9dc] text-[#9a4210]", "bg-[#fde6e7] text-[#a61e28]"][level.severity];

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <Card className="flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-bold">
            {typeLabel} · {level.riskLevel}
          </h2>
          <p className="text-xs text-staff-muted">
            {level.updatedAt ? `แก้ไขล่าสุด ${level.editor ?? "-"} · ${thDate(level.updatedAt)}` : "ยังไม่เคยแก้ไขผ่านระบบเจ้าหน้าที่"}
          </p>
        </div>

        <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
          ข้อความคำแนะนำ
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={1000} className={`${inputCls} resize-y`} />
        </label>
        <p className={`mt-1 text-xs ${text.length > MAX_HINT ? "font-semibold text-[#8a5a00]" : "text-staff-muted"}`}>
          {text.length} ตัวอักษร · แนะนำไม่เกิน {MAX_HINT} ตัวอักษรเพื่อให้อ่านง่ายบนมือถือ
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            รอบประเมินซ้ำ (วัน)
            <input type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} placeholder="ค่าเริ่มต้น" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            สายด่วนที่แสดงคู่กัน
            <select value={hotline} onChange={(e) => setHotline(e.target.value)} className={inputCls}>
              {HOTLINES.some((h) => h.value === hotline) ? null : <option value={hotline}>{hotline}</option>}
              {HOTLINES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            แหล่งอ้างอิง
            <input value={source} onChange={(e) => setSource(e.target.value)} maxLength={300} placeholder="เช่น กรมสุขภาพจิต" className={inputCls} />
          </label>
        </div>

        <div className="mt-3">
          <ErrorBox message={error} />
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={showHistory} className={btnGhost}>
            <History size={16} /> {history ? "ซ่อนประวัติ" : "ดูประวัติการแก้ไข"}
          </button>
          <button type="button" onClick={save} disabled={saving || !dirty || !text.trim()} className={btnPrimary}>
            {saved ? <><Check size={16} /> บันทึกแล้ว</> : saving ? "กำลังบันทึก…" : "บันทึกคำแนะนำ"}
          </button>
        </div>

        {history && (
          <div className="mt-5 border-t border-staff-line pt-4">
            <h3 className="mb-2 text-sm font-bold">ประวัติการแก้ไข</h3>
            {history.length === 0 ? (
              <p className="text-sm text-staff-muted">ยังไม่มีประวัติการแก้ไข</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((h, i) => (
                  <li key={i} className="rounded-2xl bg-staff-soft p-3 text-sm">
                    <p className="text-xs text-staff-muted">
                      {h.by ?? "เจ้าหน้าที่"} แก้ไขเมื่อ {thDate(h.at, true)} · ข้อความก่อนแก้ไข:
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{h.before || "(ว่าง)"}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {/* ตัวอย่างฝั่งผู้ใช้ (โทนเดียวกับหน้าผู้ใช้จริง) */}
      <div className="xl:w-[360px] xl:shrink-0">
        <p className="mb-2 text-sm font-semibold text-staff-muted">ตัวอย่างที่ผู้ใช้เห็นในหน้าคำแนะนำสุขภาพ</p>
        <div className="rounded-3xl bg-[#fbf7f7] p-4">
          <div className="rounded-3xl border border-[#eee5e6] bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
                <Activity size={20} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-[#2f3037]">{typeLabel}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pillTone}`}>{level.riskLevel}</span>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#faf8f8] p-3 text-sm leading-relaxed text-[#2f3037]">
              {text.trim() || <span className="text-[#85858d]">ยังไม่มีข้อความคำแนะนำ</span>}
            </p>
            {hotline && (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#b91c2b]">
                <Phone size={15} /> {hotline}
              </p>
            )}
            {days && <p className="mt-3 text-sm text-[#777780]">ประเมินซ้ำในอีก {days} วัน</p>}
            <div className="mt-4 rounded-2xl bg-[#b91c2b] py-3 text-center text-sm font-semibold text-white">ทำแบบประเมินซ้ำ</div>
            {source && <p className="mt-3 text-xs text-[#85858d]">อ้างอิง: {source}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
