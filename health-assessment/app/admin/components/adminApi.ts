/* =========================================================
   ตัวช่วยเรียก API ฝั่ง Admin
   แนบ header x-user-id จาก localStorage ให้ทุก request
========================================================= */

export function adminHeaders(extra?: HeadersInit): HeadersInit {
  let userId = "";
  try {
    userId = localStorage.getItem("userId") ?? "";
  } catch {
    /* ignore */
  }
  return { "x-user-id": userId, ...(extra ?? {}) };
}

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

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
