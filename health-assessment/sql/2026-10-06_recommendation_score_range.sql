-- ช่วงคะแนนของแต่ละระดับผล สำหรับแบบประเมินที่เจ้าหน้าที่สร้างเพิ่มเอง
-- แบบประเมินเดิม 12 แบบปล่อยเป็น NULL (ยังแปลผลด้วยโค้ดใน API ของแต่ละแบบ)
-- แบบประเมินที่ "ทุกระดับ" มีช่วงคะแนน = แบบประเมินทั่วไป ใช้หน้ากลาง /assessment/[id]
ALTER TABLE recommendation ADD COLUMN IF NOT EXISTS min_score numeric;
ALTER TABLE recommendation ADD COLUMN IF NOT EXISTS max_score numeric;
