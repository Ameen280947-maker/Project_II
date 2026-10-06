import pool from "@/lib/db";

/* =========================================================
   ตารางสำหรับฝั่ง System Admin
   - system_error_logs : เก็บข้อผิดพลาดของระบบ (หน้า "แก้ไขข้อผิดพลาด")
   - backup_history    : เก็บประวัติการสำรองข้อมูล (หน้า "สำรองข้อมูล")

   ใช้ CREATE TABLE IF NOT EXISTS จึงเรียกซ้ำได้ปลอดภัย
   และ cache promise ไว้ จะสร้างจริงแค่ครั้งแรกที่ server เริ่มทำงาน
========================================================= */

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

declare global {
  var adminTablesReady: Promise<void> | undefined;
}

export function ensureAdminTables(): Promise<void> {
  if (!global.adminTablesReady) {
    global.adminTablesReady = pool
      .query(CREATE_SQL)
      .then(() => undefined)
      .catch((error) => {
        // ถ้าสร้างไม่สำเร็จ ให้ลองใหม่ในครั้งถัดไป
        global.adminTablesReady = undefined;
        throw error;
      });
  }
  return global.adminTablesReady;
}
