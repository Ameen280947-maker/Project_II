"use client";

import { useState } from "react";
import { Activity, AlertTriangle, Phone, Plus, Trash2 } from "lucide-react";
import { staffFetch } from "@/lib/staff/client";
import { SEVERITY_LABEL, severityForRank, type Severity } from "@/lib/staff/riskLevels";
import { inputCls, thDate } from "../ui";
import {
  HOTLINES,
  MAX_HINT,
  SEV_DOT,
  SEV_PILL_USER,
  isMissing,
  newKey,
  possibleRange,
  rangeText,
  type Detail,
  type ELevel,
  type EQuestion,
} from "./shared";

// ข้อความคำแนะนำฉบับก่อนหน้าของระดับผลหนึ่ง (จาก API ?history=)
type HistoryRow = {
  id: number;
  riskLevel: string;
  text: string;
  reassessDays: number | null;
  hotline: string;
  source: string;
  min: number | null;
  max: number | null;
  until: string;
  by: string | null;
};

// คำนวณระดับความรุนแรงของแต่ละระดับผล (แบบทั่วไปคิดจากลำดับช่วงคะแนน)
function severities(levels: ELevel[], generic: boolean): Record<string, Severity> {
  if (!generic) return Object.fromEntries(levels.map((l) => [l.key, l.severity as Severity]));
  const order = [...levels].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
  return Object.fromEntries(order.map((l, i) => [l.key, severityForRank(i, order.length)]));
}

// แท็บเกณฑ์แปลผล: แสดงการ์ดระดับผล ตรวจช่วงคะแนนที่ขาด/ไม่ครอบคลุม และฟอร์มแก้ระดับที่เลือก
// รับ levels/questions และ onChange สำหรับอัปเดตร่าง (generic = แบบประเมินที่แก้ช่วงคะแนนได้)
export default function LevelsTab({
  label,
  generic,
  levels,
  questions,
  levelMeta,
  onChange,
}: {
  label: string;
  generic: boolean;
  levels: ELevel[];
  questions: EQuestion[];
  levelMeta: Detail["levelMeta"];
  onChange: (levels: ELevel[]) => void;
}) {
  // ระดับที่เลือกอยู่ (เริ่มที่ระดับที่ยังไม่มีคำแนะนำ) และความรุนแรงของแต่ละระดับ
  const [selKey, setSelKey] = useState<string | null>(() => (levels.find(isMissing) ?? levels[0])?.key ?? null);
  const sev = severities(levels, generic);
  const level = levels.find((l) => l.key === selKey) ?? levels[0];

  // อัปเดตค่าบางฟิลด์ของระดับผลตาม key
  const set = (key: string, patch: Partial<ELevel>) => onChange(levels.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // ตรวจช่วงคะแนน: ครบทุกระดับไหม มีช่องว่างไหม และครอบคลุมคะแนนที่เป็นไปได้ไหม
  const range = possibleRange(questions);
  const complete = levels.every((l) => l.min !== null && l.max !== null && l.min <= l.max);
  const sorted = [...levels].sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
  const gapAt = complete ? sorted.findIndex((l, i) => i > 0 && l.min !== sorted[i - 1].max! + 1) : -1;
  const covers = complete && sorted.length > 0 && sorted[0].min! <= range.min && sorted[sorted.length - 1].max! >= range.max;

  // แบ่งช่วงคะแนนที่เป็นไปได้ให้ทุกระดับเท่า ๆ กันอัตโนมัติ
  const autoSplit = () => {
    const n = levels.length;
    const span = range.max - range.min + 1;
    onChange(
      levels.map((l, i) => ({
        ...l,
        min: range.min + Math.floor((span * i) / n),
        max: i === n - 1 ? range.max : range.min + Math.floor((span * (i + 1)) / n) - 1,
      }))
    );
  };

  // เพิ่มระดับผลใหม่ต่อท้ายช่วงคะแนนเดิมแล้วเลือกระดับนั้น
  const addLevel = () => {
    const last = sorted[sorted.length - 1];
    const start = last?.max !== null && last?.max !== undefined ? last.max + 1 : range.min;
    const l: ELevel = { key: newKey(), riskLevel: "", min: start, max: start, severity: 0, text: "", reassessDays: null, hotline: "", source: "" };
    onChange([...levels, l]);
    setSelKey(l.key);
  };

  // ยืนยันแล้วลบระดับผลออก (มีผลจริงเมื่อเผยแพร่)
  const removeLevel = (key: string) => {
    if (!confirm("ลบระดับผลนี้? (มีผลเมื่อเผยแพร่)")) return;
    const next = levels.filter((l) => l.key !== key);
    onChange(next);
    setSelKey(next[0]?.key ?? null);
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* แถบช่วงคะแนนที่เป็นไปได้ / คำอธิบายสำหรับแบบประเมินสูตรเฉพาะ */}
      {generic ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-staff-soft px-4 py-3 text-sm">
          <span>
            คะแนนรวมที่เป็นไปได้จากคำถามปัจจุบัน: <b>{range.min}–{range.max}</b> คะแนน · เรียงระดับจากคะแนนน้อย (ปกติ) ไปมาก (เสี่ยงสูง)
          </span>
          <button type="button" onClick={autoSplit} disabled={!range.count || !levels.length} className="font-semibold text-staff-600 hover:underline disabled:opacity-40">
            แบ่งช่วงอัตโนมัติ
          </button>
        </div>
      ) : (
        <p className="text-sm text-staff-muted">
          แบบประเมินนี้แปลผลด้วยสูตรเฉพาะในระบบ ชื่อระดับและเกณฑ์ตัดคะแนนจึงแก้จากหน้านี้ไม่ได้ · แก้ได้เฉพาะข้อความคำแนะนำ รอบประเมินซ้ำ สายด่วน และแหล่งอ้างอิง
        </p>
      )}

      {/* การ์ดเลือกระดับผล และปุ่มเพิ่มระดับ */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
        {levels.map((l) => {
          const on = l.key === level?.key;
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => setSelKey(l.key)}
              aria-pressed={on}
              className={`flex min-w-0 flex-col gap-1 rounded-2xl border bg-white p-4 text-left transition ${
                on ? "border-staff-900 ring-1 ring-staff-900" : "border-staff-line hover:border-staff-300"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEV_DOT[sev[l.key]] ?? SEV_DOT[0]}`} />
                <span className="truncate">{l.riskLevel || "ระดับใหม่"}</span>
              </span>
              <span className="text-xs text-staff-muted">{rangeText(l)}</span>
              {isMissing(l) ? (
                <span className="text-xs font-semibold text-risk-crit">ยังไม่มีคำแนะนำ</span>
              ) : (
                <span className="text-xs font-semibold text-staff-ink">
                  {l.reassessDays ? `ประเมินซ้ำ ${l.reassessDays} วัน` : "ประเมินซ้ำตามค่าเริ่มต้น"}
                </span>
              )}
            </button>
          );
        })}
        {generic && (
          <button
            type="button"
            onClick={addLevel}
            disabled={levels.length >= 8}
            className="flex min-h-[92px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-staff-200 text-sm font-semibold text-staff-600 transition hover:border-staff-400 hover:bg-staff-50 disabled:opacity-40"
          >
            <Plus size={18} /> เพิ่มระดับ
          </button>
        )}
      </div>

      {/* คำเตือนช่วงคะแนนไม่ต่อกัน / ไม่ครอบคลุม / ยังไม่มีเกณฑ์ */}
      {generic && complete && gapAt > 0 && (
        <p className="text-sm font-semibold text-risk-crit">
          ช่วงคะแนนไม่ต่อกัน: หลัง &quot;{sorted[gapAt - 1].riskLevel}&quot; (ถึง {sorted[gapAt - 1].max}) ระดับถัดไปควรเริ่มที่ {sorted[gapAt - 1].max! + 1}
        </p>
      )}
      {generic && complete && gapAt <= 0 && !covers && range.count > 0 && levels.length > 0 && (
        <p className="text-sm font-semibold text-[#8a5a00]">
          เกณฑ์ยังไม่ครอบคลุมคะแนน {range.min}–{range.max} ทั้งหมด ผู้ใช้ที่ได้คะแนนนอกช่วงจะส่งแบบประเมินไม่ได้
        </p>
      )}
      {generic && levels.length === 0 && <p className="text-sm text-staff-muted">ยังไม่มีเกณฑ์แปลผล กด “เพิ่มระดับ” อย่างน้อย 2 ระดับ</p>}

      {/* ฟอร์มแก้ไขระดับที่เลือก */}
      {level && (
        <LevelForm
          key={level.key}
          label={label}
          level={level}
          severity={sev[level.key] ?? 0}
          generic={generic}
          canRemove={generic && levels.length > 2}
          meta={level.id ? levelMeta[String(level.id)] : undefined}
          onChange={(p) => set(level.key, p)}
          onRemove={() => removeLevel(level.key)}
        />
      )}
    </div>
  );
}

// แปลงข้อความในช่องตัวเลขเป็นจำนวนเต็ม หรือ null ถ้าเว้นว่าง
const numOrNull = (v: string) => (v.trim() === "" ? null : Math.trunc(Number(v)));

// ฟอร์มแก้ไขระดับผลหนึ่งระดับ (ชื่อ ช่วงคะแนน คำแนะนำ รอบประเมินซ้ำ สายด่วน แหล่งอ้างอิง)
function LevelForm({
  label,
  level,
  severity,
  generic,
  canRemove,
  meta,
  onChange,
  onRemove,
}: {
  label: string;
  level: ELevel;
  severity: Severity;
  generic: boolean;
  canRemove: boolean;
  meta?: { at: string | null; by: string | null };
  onChange: (p: Partial<ELevel>) => void;
  onRemove: () => void;
}) {
  // state ประวัติคำแนะนำฉบับก่อน (null = ยังไม่เปิดดู)
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [histError, setHistError] = useState("");

  // เปิด/ปิดประวัติคำแนะนำฉบับก่อนหน้าของระดับนี้ (โหลดจาก API ?history=)
  const toggleHistory = () => {
    if (history) return setHistory(null);
    if (!level.id) return;
    staffFetch<{ history: HistoryRow[] }>(`/api/staff/assessments?history=${level.id}`)
      .then((d) => setHistory(d.history))
      .catch((e) => setHistError(e.message));
  };

  const labelCls = "flex min-w-0 flex-col gap-1.5 text-sm font-semibold";

  return (
    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start">
      <div className="min-w-0 flex-1 rounded-2xl border border-staff-line p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="min-w-0 break-words text-lg font-bold">{level.riskLevel || "ระดับใหม่"}</h3>
          {canRemove && (
            <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 text-sm font-semibold text-risk-crit hover:underline">
              <Trash2 size={15} /> ลบระดับนี้
            </button>
          )}
        </div>

        {generic && (
          <label className={`${labelCls} mt-3`}>
            ชื่อระดับผล
            <input value={level.riskLevel} onChange={(e) => onChange({ riskLevel: e.target.value })} maxLength={100} className={inputCls} />
          </label>
        )}

        {/* ช่องคะแนนต่ำสุด/สูงสุด และความรุนแรง */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className={labelCls}>
            คะแนนต่ำสุด
            <input
              type="number"
              value={level.min ?? ""}
              disabled={!generic}
              placeholder={generic ? "" : "คำนวณในระบบ"}
              onChange={(e) => onChange({ min: numOrNull(e.target.value) })}
              className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>
          <label className={labelCls}>
            คะแนนสูงสุด
            <input
              type="number"
              value={level.max ?? ""}
              disabled={!generic}
              placeholder={generic ? "" : "คำนวณในระบบ"}
              onChange={(e) => onChange({ max: numOrNull(e.target.value) })}
              className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>
          <label className={labelCls}>
            ความรุนแรง
            <select value={severity} disabled className={`${inputCls} cursor-not-allowed opacity-80`} title="กำหนดโดยระบบ">
              {([0, 1, 2, 3] as Severity[]).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-1 text-xs text-staff-muted">
          {generic ? "ความรุนแรงคิดจากลำดับช่วงคะแนน (คะแนนน้อย = ปกติ, คะแนนมาก = เสี่ยงสูง)" : "เกณฑ์คะแนนและความรุนแรงของแบบประเมินนี้คำนวณในโค้ดของระบบ"}
        </p>

        {/* ข้อความคำแนะนำพร้อมตัวนับตัวอักษร */}
        <label className={`${labelCls} mt-4`}>
          ข้อความคำแนะนำ
          <textarea
            value={level.text}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={6}
            maxLength={1000}
            className={`${inputCls} resize-y`}
          />
        </label>
        <p className={`mt-1 text-xs ${level.text.length > MAX_HINT ? "font-semibold text-[#8a5a00]" : "text-staff-muted"}`}>
          {level.text.length} ตัวอักษร · แนะนำไม่เกิน {MAX_HINT} ตัวอักษรเพื่อให้อ่านง่ายบนมือถือ
        </p>

        {/* รอบประเมินซ้ำ สายด่วน และแหล่งอ้างอิง */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className={labelCls}>
            รอบประเมินซ้ำ (วัน)
            <input
              type="number"
              min={1}
              max={730}
              value={level.reassessDays ?? ""}
              onChange={(e) => onChange({ reassessDays: numOrNull(e.target.value) })}
              placeholder="ค่าเริ่มต้น"
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            สายด่วนที่แสดงคู่กัน
            <select value={level.hotline} onChange={(e) => onChange({ hotline: e.target.value })} className={inputCls}>
              {!HOTLINES.some((h) => h.value === level.hotline) && <option value={level.hotline}>{level.hotline}</option>}
              {HOTLINES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            แหล่งอ้างอิงคำแนะนำ
            <input value={level.source} onChange={(e) => onChange({ source: e.target.value })} maxLength={300} placeholder="เช่น กรมสุขภาพจิต" className={inputCls} />
          </label>
        </div>

        {/* ข้อมูลการแก้ไขล่าสุด และรายการประวัติคำแนะนำ */}
        <p className="mt-4 border-t border-staff-line pt-3 text-xs text-staff-muted">
          {!level.id ? (
            "ระดับใหม่ · จะถูกสร้างเมื่อเผยแพร่"
          ) : (
            <>
              {meta?.at ? `แก้ไขล่าสุด ${meta.by ?? "ระบบ"} · ${thDate(meta.at, true)}` : "ยังไม่เคยแก้ไขผ่านระบบเจ้าหน้าที่"}
              {" · "}
              <button type="button" onClick={toggleHistory} className="font-semibold text-staff-600 hover:underline">
                {history ? "ซ่อนประวัติการแก้ไข" : "ดูประวัติการแก้ไข"}
              </button>
            </>
          )}
        </p>
        {histError && <p className="mt-2 text-xs text-risk-crit">{histError}</p>}

        {history && (
          <div className="mt-3">
            {history.length === 0 ? (
              <p className="text-sm text-staff-muted">ยังไม่มีประวัติการแก้ไข</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-2xl bg-staff-soft p-3 text-sm">
                    <p className="text-xs text-staff-muted">
                      ฉบับก่อนหน้า{h.by ? ` (เขียนโดย ${h.by})` : ""} · ใช้ถึง {thDate(h.until, true)}
                      {h.riskLevel !== level.riskLevel && ` · ชื่อระดับเดิม “${h.riskLevel}”`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{h.text || "(ว่าง)"}</p>
                    <p className="mt-1 text-xs text-staff-muted">
                      {[
                        h.min !== null && h.max !== null ? `คะแนน ${h.min}–${h.max}` : null,
                        h.reassessDays ? `ประเมินซ้ำ ${h.reassessDays} วัน` : null,
                        h.hotline || null,
                        h.source ? `อ้างอิง: ${h.source}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ตัวอย่างหน้าผลที่ผู้ใช้เห็น */}
      <ResultPreview label={label} level={level} severity={severity} />
    </div>
  );
}

// ตัวอย่างหน้าผลประเมินบนมือถือที่ผู้ใช้จะเห็นสำหรับระดับนี้
function ResultPreview({ label, level, severity }: { label: string; level: ELevel; severity: Severity }) {
  return (
    <div className="w-full 2xl:w-[300px] 2xl:shrink-0">
      <p className="mb-2 text-sm font-semibold text-staff-muted">ตัวอย่างหน้าผลที่ผู้ใช้เห็น</p>
      <div className="mx-auto max-w-[320px] rounded-[34px] border-[6px] border-staff-ink bg-[#fbf7f7] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-staff-ink/80" />
        <div className="rounded-3xl border border-[#eee5e6] bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#fff0f2] text-[#b91c2b]">
              <Activity size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-[#2f3037]">{label}</p>
              <span className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold ${SEV_PILL_USER[severity]}`}>
                {level.riskLevel || "ระดับใหม่"}
              </span>
            </div>
          </div>
          {/* ข้อความคำแนะนำ หรือคำเตือนว่ายังไม่มี + สายด่วน/รอบประเมินซ้ำ */}
          {level.text.trim() ? (
            <p className="mt-4 whitespace-pre-wrap break-words rounded-2xl bg-[#faf8f8] p-3 text-sm leading-relaxed text-[#2f3037]">{level.text}</p>
          ) : (
            <p className="mt-4 flex gap-2 rounded-2xl border border-[#f7c6c9] bg-[#fff5f5] p-3 text-sm font-semibold text-risk-crit">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              ยังไม่มีข้อความคำแนะนำ — ผู้ใช้ที่ได้ผลระดับนี้จะไม่เห็นคำแนะนำ
            </p>
          )}
          {level.hotline && (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#b91c2b]">
              <Phone size={15} /> {level.hotline}
            </p>
          )}
          {level.reassessDays ? <p className="mt-3 text-sm text-[#777780]">ประเมินซ้ำในอีก {level.reassessDays} วัน</p> : null}
          {level.source && <p className="mt-2 text-xs text-[#85858d]">อ้างอิง: {level.source}</p>}
          <p className="mt-4 border-t border-[#f1eaea] pt-3 text-[11px] leading-relaxed text-[#85858d]">
            ผลนี้เป็นการประเมินเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์
          </p>
        </div>
      </div>
    </div>
  );
}
