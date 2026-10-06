-- ปรับข้อมูลแบบประเมินให้ตรงกับเอกสารอ้างอิง
-- "แนวทางการวิเคราะห์ข้อมูลการคัดกรองสุขภาพและพฤติกรรมเสี่ยงโรคไม่ติดต่อ (Online Survey)" กองโรคไม่ติดต่อ กรมควบคุมโรค
-- รันซ้ำได้ (ทุกคำสั่งเช็กก่อนเพิ่ม)

BEGIN;

-- =========================================================
-- 1. การสูบบุหรี่ (ตารางที่ 13): เพิ่มข้อ 1-2 ที่ยังไม่มี
--    ข้อ 3-4 (question_id 3, 4) มีอยู่แล้ว display_order = 3, 4
-- =========================================================

INSERT INTO questions (assessment_type_id, question_text, question_type, display_order, is_required, is_active)
SELECT 6, 'ปัจจุบันในช่วง 30 วันที่ผ่านมาท่านสูบผลิตภัณฑ์ยาสูบหรือไม่', 'choice', 1, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM questions
  WHERE assessment_type_id = 6
    AND question_text = 'ปัจจุบันในช่วง 30 วันที่ผ่านมาท่านสูบผลิตภัณฑ์ยาสูบหรือไม่'
);

INSERT INTO questions (assessment_type_id, question_text, question_type, display_order, is_required, is_active)
SELECT 6, 'ตลอดชีวิตที่ผ่านมาคุณเคยสูบบุหรี่หรือไม่', 'choice', 2, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM questions
  WHERE assessment_type_id = 6
    AND question_text = 'ตลอดชีวิตที่ผ่านมาคุณเคยสูบบุหรี่หรือไม่'
);

INSERT INTO question_choices (question_id, choice_text, score, display_order, is_active)
SELECT q.question_id, c.choice_text, c.score, c.display_order, true
FROM questions q
CROSS JOIN (VALUES ('ไม่สูบ', 0, 1), ('เคยสูบ', 1, 2)) AS c(choice_text, score, display_order)
WHERE q.assessment_type_id = 6
  AND q.question_text IN (
    'ปัจจุบันในช่วง 30 วันที่ผ่านมาท่านสูบผลิตภัณฑ์ยาสูบหรือไม่',
    'ตลอดชีวิตที่ผ่านมาคุณเคยสูบบุหรี่หรือไม่'
  )
  AND NOT EXISTS (
    SELECT 1 FROM question_choices x
    WHERE x.question_id = q.question_id
      AND x.choice_text = c.choice_text
  );

-- =========================================================
-- 2. การสูบบุหรี่ (ตารางที่ 14): คำแนะนำ 3 ระดับ
--    0 = เสี่ยงต่ำ, 1-4 = เสี่ยงปานกลาง, 5-8 = เสี่ยงสูง
--    แถวเดิม (ติดนิโคติน…) เก็บไว้ เพราะผลประเมินเก่ายังอ้างอิง rec_id อยู่
-- =========================================================

-- ไม่ใส่ min_score/max_score เพราะแบบประเมินที่มีช่วงคะแนนครบทุกระดับจะถูกมองเป็นแบบประเมินที่เจ้าหน้าที่สร้างเอง
INSERT INTO recommendation (assessment_type_id, risk_level, recommendation_text, hotline, source)
SELECT 6, v.risk_level, v.recommendation_text, v.hotline, 'กองงานคณะกรรมการควบคุมผลิตภัณฑ์ยาสูบ'
FROM (VALUES
  (
    'เสี่ยงต่ำ',
    'ยินดีด้วยคุณมีความเสี่ยงด้านพฤติกรรมการบริโภคยาสูบในระดับต่ำ อย่างไรก็ตามคุณยังคงต้องหลีกเลี่ยงการได้รับควันบุหรี่มือสอง เนื่องจากในควันบุหรี่ ประกอบด้วย สารประกอบต่างๆ ที่อาจทำให้เกิดโรคมะเร็งต่างๆ เช่น มะเร็งปอด รวมถึงโรคทางเดินหายใจอื่นๆ',
    NULL
  ),
  (
    'เสี่ยงปานกลาง',
    E'คุณเป็นนักสูบแล้ว ซึ่งจะยิ่งเพิ่มโอกาสเสี่ยงให้มีปัญหาสุขภาพเกี่ยวกับโรคไม่ติดต่อเรื้อรังมากยิ่งขึ้น นำไปสู่ปัญหาอื่นๆ ตามมา เช่น โรคหัวใจ ถุงลมโป่งพอง มะเร็งปอด หากคุณยังสูบบุหรี่ตามพฤติกรรมปัจจุบัน คุณควรเลิกบุหรี่ หรือลดการสูบบุหรี่ โดยคุณมีโอกาสเลิกบุหรี่ได้ด้วยตนเองด้วยวิธีการง่ายๆ ตามขั้นตอน 5D โดยกำหนดวันเลิกและทดลองทำเลย หรือใช้บริการเลิกบุหรี่ของสายด่วนเลิกบุหรี่ โทร 1600 หรือติดต่อสถานบริการใกล้บ้านท่าน\n\nขั้นตอนการปรับเปลี่ยนพฤติกรรม 5D เพื่อการเลิกบุหรี่อย่างยั่งยืน\n1. Delay อย่าสูบบุหรี่ทันที ที่อยากสูบ\n2. Deep Breath หายใจเข้าออกลึกๆ จำนวน 5-10 ครั้ง\n3. Drink Water จิบน้ำบ่อยๆ หรือดื่มน้ำผลไม้ที่มีรสเปรี้ยว\n4. Do something else หาสิ่งอื่น หรือกิจกรรมอื่นแทนการสูบบุหรี่\n5. Destination คิดถึงข้อดีของการเลิกบุหรี่สำเร็จ',
    '1600'
  ),
  (
    'เสี่ยงสูง',
    'คุณเป็นผู้ติดบุหรี่ และมีความเสี่ยงมากที่จะเกิดปัญหาสุขภาพร้ายแรง เช่น โรคหัวใจ ถุงลมโป่งพอง มะเร็งปอด โดยผลกระทบจากการสูบบุหรี่ ส่งผลต่อปีสุขภาวะที่สูญเสียไปทำให้อายุเฉลี่ยสั้นลง 12 ปี และป่วยหนักเป็นเวลา 1.7 ปี ก่อนเสียชีวิต หากคุณยังคงสูบบุหรี่อยู่จะทำให้คุณมีโอกาสเสพติดนิโคติน โอกาสการเจ็บป่วยและเสียชีวิตมากขึ้น คุณควรเลิกสูบบุหรี่โดยคุณจำเป็นต้องได้รับความช่วยเหลือจากบุคลากรทางการแพทย์ในการเลิกบุหรี่ โดยติดต่อสถานบริการใกล้บ้านท่าน หรือช่องทางสายด่วนเลิกบุหรี่ โทร 1600',
    '1600'
  )
) AS v(risk_level, recommendation_text, hotline)
WHERE NOT EXISTS (
  SELECT 1 FROM recommendation r
  WHERE r.assessment_type_id = 6
    AND r.risk_level = v.risk_level
);

-- =========================================================
-- 3. เบาหวาน TDS: ผลเก่าที่ไม่ได้คำแนะนำ เพราะ API เคยค้นด้วยคีย์อังกฤษ
--    (assessment.risk_level = low/moderate/high/very_high, recommendation.risk_level = ภาษาไทย)
-- =========================================================

UPDATE assessment a
SET recommendation_id = r.rec_id
FROM recommendation r
WHERE a.assessment_type_id = 4
  AND a.recommendation_id IS NULL
  AND r.assessment_type_id = 4
  AND r.risk_level = CASE a.risk_level
    WHEN 'low' THEN 'เสี่ยงน้อย'
    WHEN 'moderate' THEN 'เสี่ยงปานกลาง'
    WHEN 'high' THEN 'เสี่ยงสูง'
    WHEN 'very_high' THEN 'เสี่ยงสูงมาก'
  END;

COMMIT;
