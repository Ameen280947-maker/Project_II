"use client";

import { useState } from "react";
import { RiskPill, inputCls } from "./ui";

/* =========================================================
   เลือกช่วงเวลา (ใช้ในหน้ารายงานและสถิติ)
   - ช่อง "ตั้งแต่วันที่" / "ถึงวันที่" เป็นตัวควบคุมเดียว (แสดงตลอด) ค่าเริ่มต้น = เดือนที่แล้วแบบเต็ม
   - วันที่เป็นเวลาไทย รูปแบบ YYYY-MM-DD รวมทั้งสองวัน (ตรงกับ parseRange ฝั่ง API)
   - คิดจากสตริงวันที่ของวันนี้ (todayInBangkok) ไม่ใช้ toISOString กับเวลาปัจจุบัน
========================================================= */

export const todayInBangkok = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

export const shiftDate = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export const formatThaiDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

export const rangeText = (from: string, to: string) =>
  from === to ? formatThaiDate(from) : `${formatThaiDate(from)} – ${formatThaiDate(to)}`;

// เดือนที่แล้วแบบเต็ม (วันแรกถึงวันสุดท้ายของเดือนก่อนหน้า) จากวันนี้ (YYYY-MM-DD)
const lastMonthOf = (today: string): [string, string] => {
  const end = shiftDate(`${today.slice(0, 7)}-01`, -1);
  return [`${end.slice(0, 7)}-01`, end];
};

export type DateRange = {
  from: string;
  to: string;
  // ยังไม่ครบ/ไม่ถูกต้อง → ไม่ต้องเรียก API
  invalid: boolean;
  error: string;
};

/* state ของช่วงเวลา: ค่าเริ่มต้น = เดือนที่แล้วแบบเต็ม */
export function useDateRange() {
  const today = todayInBangkok();
  const [initFrom, initTo] = lastMonthOf(today);
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
  return { range, today, setFrom, setTo };
}

export default function DateRangePicker({ state }: { state: ReturnType<typeof useDateRange> }) {
  const { range, today, setFrom, setTo } = state;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-staff-muted">
          ตั้งแต่วันที่
          <input type="date" className={inputCls} value={range.from} max={today} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-staff-muted">
          ถึงวันที่
          <input type="date" className={inputCls} value={range.to} max={today} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {range.invalid ? (
        <p className="text-xs font-semibold text-risk-crit" role="alert">
          {range.error}
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-staff-muted">
          {rangeText(range.from, range.to)}
          {range.to === today && <RiskPill severity={1}>ข้อมูลถึงวันนี้ ยังไม่ครบช่วง</RiskPill>}
        </p>
      )}
    </div>
  );
}
