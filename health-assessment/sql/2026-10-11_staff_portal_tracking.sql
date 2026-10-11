-- ข้อมูลเพิ่มสำหรับ Staff Portal ชุดใหม่ (เพิ่มอย่างเดียว ไม่ลบ/แก้ข้อมูลเดิม)
--
-- 1) assessment_sessions : บันทึกตอนผู้ใช้เปิดหน้าแบบประเมิน และตอนบันทึกผลสำเร็จ
--    ใช้คำนวณ "เวลาเฉลี่ยต่อครั้ง" และ "% ทำแบบประเมินจนจบ"
--    ข้อมูลเริ่มมีหลังจากรัน migration นี้ (ผลเก่าไม่มีเวลาเริ่ม)
--
-- 2) assessment_versions : ฉบับร่าง / เวอร์ชันที่เผยแพร่ของแบบประเมิน
--    snapshot เก็บเนื้อหาทั้งชุด (คำถาม ตัวเลือก คะแนน เกณฑ์ คำแนะนำ คำอธิบาย แหล่งอ้างอิง)
--    - status = 'draft'     : มีได้ 1 ฉบับต่อแบบประเมิน ยังไม่มีผลกับผู้ใช้
--    - status = 'published' : เวอร์ชันที่เคยเผยแพร่ version_no เรียง 1, 2, 3 ...
--    ตารางคำถาม/ตัวเลือก/คำแนะนำเดิมยังเป็นเนื้อหา "ที่ใช้งานอยู่" เหมือนเดิม
--    การเผยแพร่ = นำ snapshot ไปเขียนลงตารางเดิม + บันทึกเป็นเวอร์ชันใหม่
--
-- 3) assessment.version_id : ผลประเมินแต่ละครั้งผูกกับเวอร์ชันที่ใช้อยู่ตอนทำ
-- 4) assessment_types.source : แหล่งอ้างอิงของแบบประเมิน (แสดงในหน้า staff)
--
-- เวลา: ใช้ timestamp (UTC) แบบเดียวกับ assessment.assessed_at

BEGIN;

CREATE TABLE IF NOT EXISTS assessment_sessions (
  session_id         SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  assessment_type_id INTEGER NOT NULL,
  started_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMP,
  assessment_id      INTEGER REFERENCES assessment (assessment_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS assessment_sessions_open_idx
  ON assessment_sessions (user_id, assessment_type_id, started_at DESC);
CREATE INDEX IF NOT EXISTS assessment_sessions_started_idx
  ON assessment_sessions (started_at);

CREATE TABLE IF NOT EXISTS assessment_versions (
  version_id         SERIAL PRIMARY KEY,
  assessment_type_id INTEGER NOT NULL,
  version_no         INTEGER,
  status             TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  snapshot           JSONB NOT NULL,
  created_by         INTEGER,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by         INTEGER,
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  published_by       INTEGER,
  published_at       TIMESTAMP,
  CHECK ((status = 'draft' AND version_no IS NULL) OR (status = 'published' AND version_no IS NOT NULL))
);

-- ฉบับร่างได้ 1 ฉบับต่อแบบประเมิน / เลขเวอร์ชันไม่ซ้ำในแบบประเมินเดียวกัน
CREATE UNIQUE INDEX IF NOT EXISTS assessment_versions_one_draft
  ON assessment_versions (assessment_type_id) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS assessment_versions_no
  ON assessment_versions (assessment_type_id, version_no) WHERE status = 'published';

ALTER TABLE assessment ADD COLUMN IF NOT EXISTS version_id INTEGER
  REFERENCES assessment_versions (version_id) ON DELETE SET NULL;

ALTER TABLE assessment_types ADD COLUMN IF NOT EXISTS source TEXT;

COMMIT;
