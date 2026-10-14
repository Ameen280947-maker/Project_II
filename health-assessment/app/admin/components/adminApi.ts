// สร้าง headers สำหรับเรียก API ฝั่ง Admin (รวม headers เพิ่มเติมถ้ามี)
export function adminHeaders(extra?: HeadersInit): HeadersInit {
  return { ...(extra ?? {}) };
}

// เรียก API Admin แบบไม่ cache แปลงผลเป็น JSON และเด้งไปหน้า login ถ้าได้ 401/403
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

// แปลงวันเวลาเป็นข้อความรูปแบบไทย (th-TH) หรือ "-" ถ้าไม่มีค่า
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// แปลงจำนวน byte เป็นข้อความหน่วย B/KB/MB/GB
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
