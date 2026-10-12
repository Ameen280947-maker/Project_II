/* =========================================================
   ตัวช่วยเรียก API ฝั่ง Admin
   ตัวตนผู้ใช้มาจาก session cookie (browser แนบให้อัตโนมัติ)
========================================================= */

// สร้าง header สำหรับเรียก API ฝั่งแอดมิน (รวม header เพิ่มเติมที่ส่งมา)
export function adminHeaders(extra?: HeadersInit): HeadersInit {
  return { ...(extra ?? {}) };
}

// เรียก API ฝั่งแอดมินแบบไม่ใช้ cache แปลงผลเป็น JSON และเด้งไปหน้า login ถ้าไม่มีสิทธิ์ (401/403)
export async function adminFetch<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T & { success: boolean; message?: string }> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(url, {
    cache: "no-store",
    ...rest,
    headers: adminHeaders(
      json !== undefined ? { "Content-Type": "application/json" } : undefined,
    ),
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง",
  }));

  if (response.status === 401 || response.status === 403) {
    window.location.replace("/login");
  }

  return { success: response.ok && data.success !== false, ...data };
}

// แปลงวันเวลาเป็นข้อความแบบไทย (ไม่มีค่า = "-")
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// แปลงจำนวนไบต์เป็นข้อความอ่านง่าย เช่น 1.5 MB
export function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i > 0 && v < 10 ? 1 : 0)} ${units[i]}`;
}
