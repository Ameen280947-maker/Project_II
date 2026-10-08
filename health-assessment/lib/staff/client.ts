"use client";

/* =========================================================
   fetch สำหรับหน้า Staff
   - ตัวตนจริงอยู่ที่ cookie session_staff (เบราว์เซอร์แนบให้เอง)
   - แนบ x-staff-id ไปด้วยให้ server เช็คว่าตรงกับ cookie
   - ค่าของ staff เก็บใน staffUserId / staffUsername แยกจากของผู้ใช้ทั่วไป
========================================================= */

export function clearStaffSession() {
  ["staffUserId", "staffUsername"].forEach((k) => localStorage.removeItem(k));
}

export async function staffFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const staffId = typeof window !== "undefined" ? localStorage.getItem("staffUserId") : null;
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
      "x-staff-id": staffId ?? "",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as { message?: string }).message || "โหลดข้อมูลไม่สำเร็จ");
  }
  return json as T;
}

export const relativeTime = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "เมื่อสักครู่";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
};

// แจ้ง Sidebar ให้โหลดจำนวนเคสรอติดตามใหม่ หลังบันทึกการติดตาม
export const FOLLOW_UP_UPDATED_EVENT = "staff-follow-up-updated";

// ดาวน์โหลดตารางเป็น CSV (มี BOM ให้ Excel อ่านภาษาไทยได้)
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
