-- หมวดหมู่แบบประเมิน (หน้า "เข้าสู่แบบประเมิน" ฝั่งผู้ใช้)
--
-- - 3 หมวดเดิม (โรคไม่ติดต่อเรื้อรัง / พฤติกรรม / สุขภาพจิต) เป็น is_builtin = true
--   มีหน้าเมนูของตัวเองอยู่แล้ว (route_path) แบบประเมินที่สร้างใหม่ในหมวดนี้จะแสดงต่อท้ายในหน้าเมนูนั้น
-- - หมวดใหม่ที่ staff สร้าง: route_path = NULL → ใช้หน้าเมนูกลาง /assessment-category/<id>
-- - theme = โทนสีการ์ด (red / green / blue / amber / violet / teal / pink)
-- - assessment_types.category_id: หมวดของแบบประเมิน (แบบที่สร้างก่อนหน้านี้ยังไม่มีหมวด = NULL)

BEGIN;

CREATE TABLE IF NOT EXISTS assessment_categories (
  category_id   SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  subtitle      TEXT,
  theme         TEXT NOT NULL DEFAULT 'violet'
                CHECK (theme IN ('red', 'green', 'blue', 'amber', 'violet', 'teal', 'pink')),
  route_path    TEXT,
  is_builtin    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 100,
  created_by    INTEGER,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS assessment_categories_name ON assessment_categories (LOWER(name));

INSERT INTO assessment_categories (name, subtitle, theme, route_path, is_builtin, display_order)
SELECT * FROM (VALUES
  ('โรคไม่ติดต่อเรื้อรัง', '(NCDs)', 'red', '/assessment-menu', TRUE, 1),
  ('ความเสี่ยงด้านพฤติกรรม', NULL, 'green', '/assessment-menu-behavior', TRUE, 2),
  ('ความเสี่ยงด้านสุขภาพจิต', NULL, 'blue', '/assessment-menu-mental-health', TRUE, 3)
) AS v(name, subtitle, theme, route_path, is_builtin, display_order)
WHERE NOT EXISTS (SELECT 1 FROM assessment_categories WHERE is_builtin);

ALTER TABLE assessment_types ADD COLUMN IF NOT EXISTS category_id INTEGER
  REFERENCES assessment_categories (category_id) ON DELETE SET NULL;

-- แบบประเมินเดิมของระบบ → หมวดเดิม
UPDATE assessment_types t SET category_id = c.category_id
  FROM assessment_categories c
 WHERE t.category_id IS NULL AND c.route_path = '/assessment-menu'
   AND t.assessment_name IN ('BMI', 'Blood Pressure', 'Thai CVD', 'Diabetes TDS', 'Diabetes Risk');
UPDATE assessment_types t SET category_id = c.category_id
  FROM assessment_categories c
 WHERE t.category_id IS NULL AND c.route_path = '/assessment-menu-behavior'
   AND t.assessment_name IN ('Smoking', 'Alcohol', 'Physical Activity', 'Sleep', 'Diet', 'Oral Health');
UPDATE assessment_types t SET category_id = c.category_id
  FROM assessment_categories c
 WHERE t.category_id IS NULL AND c.route_path = '/assessment-menu-mental-health'
   AND t.assessment_name IN ('Stress', 'PHQ-2', '9Q');

COMMIT;
