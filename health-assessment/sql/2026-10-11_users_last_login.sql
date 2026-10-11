-- เวลาเข้าสู่ระบบล่าสุดของผู้ใช้
-- ใช้นับ "ใช้งานล่าสุด" ในหน้าผู้ใช้งาน (staff) ร่วมกับวันสมัครและวันที่ทำแบบประเมินล่าสุด
-- เก็บเป็น timestamp (UTC) แบบเดียวกับ users.created_at
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
