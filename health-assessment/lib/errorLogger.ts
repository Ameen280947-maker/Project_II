import pool from "@/lib/db";
import { ensureAdminTables } from "@/lib/adminSchema";

/* =========================================================
   บันทึกข้อผิดพลาดลงตาราง system_error_logs
   เรียกใน catch ของ API ได้เลย เช่น

     } catch (error) {
       console.error("LOGIN API ERROR:", error);
       await logSystemError("POST /api/auth/login", error);
       ...
     }

   ฟังก์ชันนี้จะไม่ throw ต่อ (ถ้าบันทึกไม่ได้ก็แค่ console.error)
   จึงไม่ทำให้ API เดิมพังเพิ่ม
========================================================= */

export type ErrorLevel = "error" | "warning" | "info";

export async function logSystemError(
  source: string,
  error: unknown,
  level: ErrorLevel = "error",
): Promise<void> {
  try {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);

    const stack = error instanceof Error ? (error.stack ?? null) : null;

    await ensureAdminTables();

    await pool.query(
      `
      INSERT INTO system_error_logs (source, message, stack, level)
      VALUES ($1, $2, $3, $4)
      `,
      [
        source.slice(0, 200),
        (message || "Unknown error").slice(0, 5000),
        stack ? stack.slice(0, 10000) : null,
        level,
      ],
    );
  } catch (logError) {
    console.error("logSystemError failed:", logError);
  }
}
