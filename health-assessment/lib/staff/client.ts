"use client";

// ลบข้อมูลเจ้าหน้าที่ที่เก็บใน localStorage
export function clearStaffSession() {
  ["staffUserId", "staffUsername"].forEach((k) => localStorage.removeItem(k));
}

// เรียก API ฝั่งเจ้าหน้าที่ แนบ header x-staff-id และ throw ข้อความ error ถ้าไม่สำเร็จ
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

// แปลงเวลาเป็นข้อความแบบสัมพัทธ์ เช่น "5 นาทีที่แล้ว", "เมื่อวาน"
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

// สร้างไฟล์ CSV (UTF-8 BOM รองรับภาษาไทยใน Excel) จากข้อมูลแถวแล้วสั่งดาวน์โหลด
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  // ครอบค่าด้วยเครื่องหมายคำพูดเมื่อมี , " หรือขึ้นบรรทัดใหม่
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
