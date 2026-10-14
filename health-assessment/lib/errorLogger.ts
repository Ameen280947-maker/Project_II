import pool from "@/lib/db";
import { ensureAdminTables } from "@/lib/adminSchema";

// ระดับความรุนแรงของ log
export type ErrorLevel = "error" | "warning" | "info";

// บันทึกข้อผิดพลาดของระบบลงตาราง system_error_logs (ถ้าบันทึกไม่ได้จะแค่ log ใน console)
export async function logSystemError(
  source: string,
  error: unknown,
  level: ErrorLevel = "error",
): Promise<void> {
  try {
    // แปลง error เป็นข้อความและ stack
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);

    const stack = error instanceof Error ? (error.stack ?? null) : null;

    // บันทึกลง DB (ตัดความยาวไม่ให้เกินคอลัมน์)
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
