-- แก้คำตอบ BMI ที่บันทึกสลับข้อ
-- โค้ดเดิมถือว่า display_order 1 = น้ำหนัก, 2 = ส่วนสูง
-- แต่ในฐานข้อมูล question_id 5 (display_order 1) คือ "ส่วนสูง" และ question_id 6 (display_order 2) คือ "น้ำหนักตัว"
-- สลับ question_id เฉพาะการประเมินที่ค่าในข้อ 5 / (ข้อ 6 / 100)^2 ตรงกับ BMI ที่บันทึกไว้
-- (แปลว่าข้อ 5 เก็บน้ำหนัก) จึงรันซ้ำได้โดยไม่สลับข้อมูลที่ถูกต้องอยู่แล้ว

BEGIN;

WITH swapped AS (
  SELECT a.assessment_id
  FROM assessment a
  JOIN assessment_answers aa ON aa.assessment_id = a.assessment_id
  WHERE a.assessment_type_id = 1
  GROUP BY a.assessment_id, a.total_score
  HAVING abs(
    a.total_score::numeric - round(
      max(CASE WHEN aa.question_id = 5 THEN aa.answer_value::numeric END)
      / power(max(CASE WHEN aa.question_id = 6 THEN aa.answer_value::numeric END) / 100, 2),
      2
    )
  ) < 0.02
)
UPDATE assessment_answers aa
SET question_id = CASE aa.question_id WHEN 5 THEN 6 WHEN 6 THEN 5 END
FROM swapped s
WHERE aa.assessment_id = s.assessment_id
  AND aa.question_id IN (5, 6);

COMMIT;
