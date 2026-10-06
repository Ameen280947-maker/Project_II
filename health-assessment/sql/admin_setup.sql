-- =========================================================
-- ตั้งค่าส่วน System Admin (รันครั้งเดียวใน PostgreSQL)
-- หมายเหตุ: ตาราง system_error_logs / backup_history
-- ระบบจะสร้างให้อัตโนมัติตอนเรียก /api/admin ครั้งแรกอยู่แล้ว
-- ไฟล์นี้มีไว้กรณีอยากสร้างเองล่วงหน้า หรือแนบในเล่มรายงาน
-- =========================================================

CREATE TABLE IF NOT EXISTS system_error_logs (
  log_id          SERIAL PRIMARY KEY,
  source          VARCHAR(200) NOT NULL,
  message         TEXT NOT NULL,
  stack           TEXT,
  level           VARCHAR(20)  NOT NULL DEFAULT 'error',   -- error | warning | info
  status          VARCHAR(20)  NOT NULL DEFAULT 'open',    -- open | resolved | ignored
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
  status          VARCHAR(20)  NOT NULL DEFAULT 'success',  -- success | failed
  note            TEXT,
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- =========================================================
-- สร้างบัญชี System Admin
-- 1) สมัครสมาชิกผ่านหน้า /register ตามปกติ (เช่น username = admin)
-- 2) รันคำสั่งด้านล่างเพื่อเปลี่ยนบทบาทเป็น system_admin
-- 3) เข้าสู่ระบบที่หน้า /login เดิม → ระบบจะพาไป /admin อัตโนมัติ
-- =========================================================

-- ตรวจว่ามี role ชื่อ system_admin แล้วหรือยัง
SELECT * FROM roles;

-- ถ้ายังไม่มี ให้เพิ่ม (ปรับคอลัมน์ให้ตรงกับตาราง roles ของคุณ)
-- INSERT INTO roles (role_name) VALUES ('system_admin');

UPDATE users
SET role_id = (SELECT role_id FROM roles WHERE role_name = 'system_admin' LIMIT 1)
WHERE username = 'admin';
