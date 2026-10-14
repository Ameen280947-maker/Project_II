import pool from "@/lib/db";

// SQL สร้างตาราง system_error_logs (บันทึก error) และ backup_history (ประวัติสำรองข้อมูล)
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS system_error_logs (
  log_id          SERIAL PRIMARY KEY,
  source          VARCHAR(200) NOT NULL,
  message         TEXT NOT NULL,
  stack           TEXT,
  level           VARCHAR(20)  NOT NULL DEFAULT 'error',
  status          VARCHAR(20)  NOT NULL DEFAULT 'open',
  resolution_note TEXT,
  resolved_by     INTEGER,
  resolved_at     TIMESTAMP,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_error_logs_status
  ON system_error_logs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS backup_history (
  backup_id       SERIAL PRIMARY KEY,
  created_by      INTEGER,
  file_name       VARCHAR(255) NOT NULL,
  tables          TEXT[]       NOT NULL,
  total_rows      INTEGER      NOT NULL DEFAULT 0,
  file_size_bytes BIGINT       NOT NULL DEFAULT 0,
  status          VARCHAR(20)  NOT NULL DEFAULT 'success',
  note            TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);
`;

// เก็บ Promise การสร้างตารางไว้ใน global เพื่อรันครั้งเดียว
declare global {
  var adminTablesReady: Promise<void> | undefined;
}

// สร้างตาราง system_error_logs และ backup_history ถ้ายังไม่มี (รันครั้งเดียวต่อ process)
export function ensureAdminTables(): Promise<void> {
  if (!global.adminTablesReady) {
    global.adminTablesReady = pool
      .query(CREATE_SQL)
      .then(() => undefined)
      .catch((error) => {
        global.adminTablesReady = undefined;
        throw error;
      });
  }
  return global.adminTablesReady;
}
