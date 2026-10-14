"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { inputCls } from "./ui";

// คืนวันที่วันนี้ตามเขตเวลากรุงเทพฯ รูปแบบ YYYY-MM-DD
export const todayInBangkok = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

// เลื่อนวันที่ YYYY-MM-DD ไปข้างหน้า/ถอยหลังตามจำนวนวัน
export const shiftDate = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

// แปลงวันที่ YYYY-MM-DD เป็นรูปแบบไทยแบบย่อ
export const formatThaiDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

// ข้อความช่วงวันที่ภาษาไทย (วันเดียวแสดงวันเดียว)
export const rangeText = (from: string, to: string) =>
  from === to ? formatThaiDate(from) : `${formatThaiDate(from)} – ${formatThaiDate(to)}`;

// เติม 0 ข้างหน้าให้เป็นเลข 2 หลัก
const pad = (n: number) => String(n).padStart(2, "0");
// คืนวันสุดท้ายของเดือน m ปี y รูปแบบ YYYY-MM-DD
const lastDayOf = (y: number, m: number) => `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;

// ช่วงวันที่สำเร็จรูป: เดือนที่แล้ว ไตรมาสที่แล้ว ปีที่แล้ว เดือนนี้ (คำนวณจากวันนี้)
export const QUICK_RANGES: { key: string; label: string; range: (today: string) => [string, string] }[] = [
  {
    key: "lastMonth",
    label: "เดือนที่แล้ว",
    range: (t) => {
      const end = shiftDate(`${t.slice(0, 7)}-01`, -1);
      return [`${end.slice(0, 7)}-01`, end];
    },
  },
  {
    key: "lastQuarter",
    label: "ไตรมาสที่แล้ว",
    range: (t) => {
      const y = Number(t.slice(0, 4));
      const q = Math.floor((Number(t.slice(5, 7)) - 1) / 3);
      const [py, pq] = q === 0 ? [y - 1, 3] : [y, q - 1];
      return [`${py}-${pad(pq * 3 + 1)}-01`, lastDayOf(py, pq * 3 + 3)];
    },
  },
  {
    key: "lastYear",
    label: "ปีที่แล้ว",
    range: (t) => {
      const y = Number(t.slice(0, 4)) - 1;
      return [`${y}-01-01`, `${y}-12-31`];
    },
  },
  { key: "thisMonth", label: "เดือนนี้", range: (t) => [`${t.slice(0, 7)}-01`, t] },
];

// ช่วงวันที่ที่เลือกพร้อมผลตรวจความถูกต้อง
export type DateRange = {
  from: string;
  to: string;
  invalid: boolean;
  error: string;
};

// Hook: เก็บช่วงวันที่ (เริ่มต้นเดือนที่แล้ว) พร้อมตรวจความถูกต้องของช่วง
export function useDateRange() {
  const today = todayInBangkok();
  const [initFrom, initTo] = QUICK_RANGES[0].range(today);
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);

  const error =
    !from || !to
      ? "กรุณาเลือกวันที่ให้ครบ"
      : from > today || to > today
        ? "เลือกวันที่ในอนาคตไม่ได้"
        : from > to
          ? "วันที่เริ่มต้องไม่อยู่หลังวันที่สิ้นสุด"
          : "";

  const range: DateRange = { from, to, invalid: error !== "", error };
  // ตั้งวันเริ่มและวันสิ้นสุดพร้อมกัน
  const setRange = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
  };
  // คืนช่วงวันที่กลับเป็นค่าเริ่มต้น
  const reset = () => setRange(initFrom, initTo);
  return { range, today, setFrom, setTo, setRange, reset };
}

// ค่าที่ useDateRange คืนมา ใช้เป็น props ของตัวเลือกวันที่
type RangeState = ReturnType<typeof useDateRange>;

// นับจำนวนวันในช่วง (รวมวันเริ่มและวันสิ้นสุด)
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

// ช่องเลือกช่วงวันที่แบบป๊อปอัป แสดงจำนวนวันและข้อความ error
export default function DateRangeField({ state }: { state: RangeState }) {
  const { range, today, setFrom, setTo } = state;
  const [open, setOpen] = useState(false);
  const days = range.invalid ? null : daysBetween(range.from, range.to);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`${inputCls} flex h-12 items-center gap-3 text-left font-medium`}
      >
        <CalendarDays size={18} className="shrink-0 text-staff-muted" />
        <span className="min-w-0 flex-1 truncate font-semibold text-staff-ink">
          {range.from ? formatThaiDate(range.from) : "–"} <span className="font-normal text-staff-muted">→</span>{" "}
          {range.to ? formatThaiDate(range.to) : "–"}
        </span>
        {days !== null && (
          <span className="shrink-0 text-xs text-staff-muted">
            {days.toLocaleString("th-TH")} วัน
            {range.to === today && <span className="ml-1.5 font-semibold text-[#8a5a00]">· ข้อมูลถึงวันนี้ ยังไม่ครบช่วง</span>}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="ปิดการเลือกวันที่" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="เลือกช่วงวันที่" className="absolute left-0 top-full z-40 mt-2 w-full min-w-[280px] rounded-2xl border border-staff-line bg-white p-4 shadow-xl">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-staff-muted">
                ตั้งแต่วันที่
                <input type="date" className={inputCls} value={range.from} max={today} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-staff-muted">
                ถึงวันที่
                <input type="date" className={inputCls} value={range.to} max={today} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-risk-crit" role="alert">
                {range.error}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={range.invalid}
                className="h-9 shrink-0 rounded-xl bg-staff-600 px-4 text-sm font-semibold text-white transition hover:bg-staff-700 disabled:opacity-50"
              >
                ตกลง
              </button>
            </div>
          </div>
        </>
      )}

      {!open && range.invalid && (
        <p className="mt-1 text-xs font-semibold text-risk-crit" role="alert">
          {range.error}
        </p>
      )}
    </div>
  );
}

// ปุ่มเลือกช่วงวันที่ด่วน (เดือนที่แล้ว ไตรมาสที่แล้ว ปีที่แล้ว เดือนนี้)
export function QuickRanges({ state }: { state: RangeState }) {
  const { range, today, setRange } = state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-staff-muted">เลือกเร็ว</span>
      {QUICK_RANGES.map((q) => {
        const [f, t] = q.range(today);
        const on = f === range.from && t === range.to;
        return (
          <button
            key={q.key}
            type="button"
            aria-pressed={on}
            onClick={() => setRange(f, t)}
            className={`min-h-9 rounded-full border px-4 text-sm font-semibold transition ${
              on ? "border-staff-900 bg-staff-900 text-white" : "border-staff-line bg-white text-staff-muted hover:border-staff-300 hover:text-staff-ink"
            }`}
          >
            {q.label}
          </button>
        );
      })}
    </div>
  );
}
