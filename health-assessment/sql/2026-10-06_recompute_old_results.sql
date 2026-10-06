-- คำนวณผลเก่าใหม่จากคำตอบที่บันทึกไว้ใน assessment_answers
-- 1) Thai CVD : total_score (% ความเสี่ยง), risk_level, recommendation_id
--    สูตรเดิมในระบบลืม exp() ทำให้ % ความเสี่ยงของผลเก่าผิด
-- 2) Diet     : risk_level ตามกฎ "ด้านที่แย่ที่สุด" (เหมือน app/api/assessments/diet/route.ts)
-- ไม่แตะการสูบบุหรี่ เพราะผลเก่าไม่มีคำตอบข้อ 1-2 ที่เพิ่มเข้ามาใหม่
--
-- รันซ้ำได้: อัปเดตเฉพาะแถวที่ค่าที่คำนวณได้ยังไม่ตรงกับที่บันทึกไว้
-- ข้ามผลที่คำตอบไม่ครบ หรือค่าตัวเลขอ่านไม่ได้ (ไม่เดาค่าแทน)
--
-- วิธีบันทึกคำตอบ (อ้างอิงจาก route):
--   Thai CVD (assessment_name = 'Thai CVD') ใช้ questions.display_order
--     1 อายุ          answer_value (ตัวเลข)
--     2 เพศ           choice_id → question_choices.score (ชาย = 1, หญิง = 0)
--     3 สูบบุหรี่      choice_id → score (สูบ = 1, ไม่สูบ = 0)
--     4 เบาหวาน       choice_id → score (เป็น = 1, ไม่เป็น = 0)
--     5 SBP           answer_value
--     6 รอบเอว        answer_value
--     7 ส่วนสูง        answer_value
--   Diet (assessment_type_id = 10) ใช้ display_order 1-9 และคะแนนของตัวเลือก
--     1 = ผัก, 2-4 = น้ำตาล, 5 = ไขมัน, 6-9 = โซเดียม
--
-- ---------------------------------------------------------
-- ดูตัวอย่างก่อนรัน (คัดลอกส่วน WITH ... SELECT ด้านล่างไปรันแยกได้)
-- ---------------------------------------------------------
-- WITH cvd_values AS (
--   SELECT
--     a.assessment_id,
--     MAX(CASE WHEN q.display_order = 1 AND aa.answer_value ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN aa.answer_value::numeric END) AS age,
--     MAX(CASE WHEN q.display_order = 2 THEN COALESCE(qc.score, aa.score) END) AS sex,
--     MAX(CASE WHEN q.display_order = 3 THEN COALESCE(qc.score, aa.score) END) AS smoke,
--     MAX(CASE WHEN q.display_order = 4 THEN COALESCE(qc.score, aa.score) END) AS dm,
--     MAX(CASE WHEN q.display_order = 5 AND aa.answer_value ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN aa.answer_value::numeric END) AS sbp,
--     MAX(CASE WHEN q.display_order = 6 AND aa.answer_value ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN aa.answer_value::numeric END) AS waist,
--     MAX(CASE WHEN q.display_order = 7 AND aa.answer_value ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN aa.answer_value::numeric END) AS height
--   FROM assessment a
--   JOIN assessment_types t ON t.assessment_type_id = a.assessment_type_id AND t.assessment_name = 'Thai CVD'
--   JOIN assessment_answers aa ON aa.assessment_id = a.assessment_id
--   JOIN questions q ON q.question_id = aa.question_id
--   LEFT JOIN question_choices qc ON qc.choice_id = aa.choice_id AND qc.question_id = aa.question_id
--   GROUP BY a.assessment_id
-- ),
-- cvd_risk AS (
--   SELECT v.assessment_id,
--          LEAST(GREATEST(CASE
--            WHEN exp(GREATEST(LEAST(d, 700), -700)) * ln(0.978296) < -700 THEN 100
--            ELSE (1 - exp(exp(GREATEST(LEAST(d, 700), -700)) * ln(0.978296))) * 100
--          END, 0), 100) AS risk
--   FROM (
--     SELECT v.*, 0.079 * v.age::float8 + 0.128 * v.sex::float8 + 0.019350987 * v.sbp::float8
--            + 0.58454 * v.dm::float8 + 3.512566 * (v.waist::float8 / v.height::float8)
--            + 0.459 * v.smoke::float8 - 7.720484 AS d
--     FROM cvd_values v
--     WHERE v.age BETWEEN 18 AND 100 AND v.sex IN (0, 1) AND v.smoke IN (0, 1) AND v.dm IN (0, 1)
--       AND v.sbp BETWEEN 60 AND 250 AND v.waist BETWEEN 40 AND 200 AND v.height BETWEEN 120 AND 230
--   ) v
-- )
-- SELECT a.assessment_id, a.user_id, a.assessed_at,
--        a.total_score AS old_score, round(r.risk::numeric, 2) AS new_score,
--        a.risk_level AS old_level,
--        CASE WHEN r.risk < 10 THEN 'เสี่ยงน้อย' WHEN r.risk < 30 THEN 'เสี่ยงปานกลาง' ELSE 'เสี่ยงสูง' END AS new_level
-- FROM cvd_risk r
-- JOIN assessment a ON a.assessment_id = r.assessment_id
-- ORDER BY a.assessment_id;
-- ---------------------------------------------------------

BEGIN;

-- =========================================================
-- 1. Thai CVD
--    FS = 0.079*อายุ + 0.128*เพศ + 0.019350987*SBP + 0.58454*เบาหวาน
--         + 3.512566*(รอบเอว/ส่วนสูง) + 0.459*สูบบุหรี่
--    P  = (1 - 0.978296^exp(FS - 7.720484)) * 100   (จำกัด 0-100)
--    < 10 เสี่ยงน้อย, 10 - < 30 เสี่ยงปานกลาง, >= 30 เสี่ยงสูง
--    (แบ่งระดับจากค่าก่อนปัดเศษ แล้วบันทึกค่าปัด 2 ตำแหน่ง เหมือน route)
-- =========================================================

WITH cvd_values AS (
  SELECT
    a.assessment_id,
    a.assessment_type_id,
    MAX(CASE WHEN q.display_order = 1 AND aa.answer_value ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN aa.answer_value::numeric END) AS age,
    MAX(CASE WHEN q.display_order = 2 THEN COALESCE(qc.score, aa.score) END) AS sex,
    MAX(CASE WHEN q.display_order = 3 THEN COALESCE(qc.score, aa.score) END) AS smoke,
    MAX(CASE WHEN q.display_order = 4 THEN COALESCE(qc.score, aa.score) END) AS dm,
    MAX(CASE WHEN q.display_order = 5 AND aa.answer_value ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN aa.answer_value::numeric END) AS sbp,
    MAX(CASE WHEN q.display_order = 6 AND aa.answer_value ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN aa.answer_value::numeric END) AS waist,
    MAX(CASE WHEN q.display_order = 7 AND aa.answer_value ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' THEN aa.answer_value::numeric END) AS height
  FROM assessment a
  JOIN assessment_types t
    ON t.assessment_type_id = a.assessment_type_id
   AND t.assessment_name = 'Thai CVD'
  JOIN assessment_answers aa ON aa.assessment_id = a.assessment_id
  JOIN questions q ON q.question_id = aa.question_id
  LEFT JOIN question_choices qc
    ON qc.choice_id = aa.choice_id
   AND qc.question_id = aa.question_id
  GROUP BY a.assessment_id, a.assessment_type_id
),
cvd_fs AS (
  -- ข้ามผลที่ค่าอยู่นอกช่วงที่ API รับ (เช่น ข้อมูลทดสอบอายุ 1000 หรือ SBP ติดลบ)
  SELECT
    v.assessment_id,
    v.assessment_type_id,
    0.079 * v.age::float8
      + 0.128 * v.sex::float8
      + 0.019350987 * v.sbp::float8
      + 0.58454 * v.dm::float8
      + 3.512566 * (v.waist::float8 / v.height::float8)
      + 0.459 * v.smoke::float8
      - 7.720484 AS fs_diff
  FROM cvd_values v
  WHERE v.age BETWEEN 18 AND 100
    AND v.sex IN (0, 1)
    AND v.smoke IN (0, 1)
    AND v.dm IN (0, 1)
    AND v.sbp BETWEEN 60 AND 250
    AND v.waist BETWEEN 40 AND 200
    AND v.height BETWEEN 120 AND 230
),
cvd_risk AS (
  -- 0.978296^exp(d) = exp(exp(d) * ln(0.978296))
  -- Postgres โยน error "underflow" เมื่อผลเล็กมาก (JS คืน 0 ให้เฉย ๆ)
  -- จึงจำกัดเลขชี้กำลัง: ต่ำกว่า -700 ถือว่าเป็น 0 → ความเสี่ยง 100%
  SELECT
    f.assessment_id,
    f.assessment_type_id,
    LEAST(GREATEST(
      CASE
        WHEN exp(GREATEST(LEAST(f.fs_diff, 700), -700)) * ln(0.978296) < -700 THEN 100
        ELSE (1 - exp(exp(GREATEST(LEAST(f.fs_diff, 700), -700)) * ln(0.978296))) * 100
      END,
    0), 100) AS risk
  FROM cvd_fs f
),
cvd_new AS (
  SELECT
    r.assessment_id,
    round(r.risk::numeric, 2) AS total_score,
    CASE
      WHEN r.risk < 10 THEN 'เสี่ยงน้อย'
      WHEN r.risk < 30 THEN 'เสี่ยงปานกลาง'
      ELSE 'เสี่ยงสูง'
    END AS risk_level,
    r.assessment_type_id
  FROM cvd_risk r
),
cvd_final AS (
  SELECT
    n.assessment_id,
    n.total_score,
    n.risk_level,
    (
      SELECT rec.rec_id
      FROM recommendation rec
      WHERE rec.assessment_type_id = n.assessment_type_id
        AND rec.risk_level = n.risk_level
      ORDER BY rec.rec_id
      LIMIT 1
    ) AS recommendation_id
  FROM cvd_new n
)
UPDATE assessment a
SET
  total_score = f.total_score,
  risk_level = f.risk_level,
  recommendation_id = COALESCE(f.recommendation_id, a.recommendation_id)
FROM cvd_final f
WHERE a.assessment_id = f.assessment_id
  AND (
       a.total_score IS DISTINCT FROM f.total_score
    OR a.risk_level IS DISTINCT FROM f.risk_level
    OR (f.recommendation_id IS NOT NULL
        AND a.recommendation_id IS DISTINCT FROM f.recommendation_id)
  );

-- =========================================================
-- 2. Diet (assessment_type_id = 10)
--    แต่ละด้านแปลเป็นสี 0 = เขียว ... 3 = แดง แล้วใช้ด้านที่แย่ที่สุด
--    ผัก (ข้อ 1)      : >=4 → 0, 3 → 1, 2 → 2, อื่นๆ → 3  (ผักมาก = ดี)
--    น้ำตาล (ข้อ 2-4) : >=11 → 0, >=8 → 1, >=4 → 2, อื่นๆ → 3
--    ไขมัน (ข้อ 5)    : >=4 → 0, 3 → 1, 2 → 2, อื่นๆ → 3
--    โซเดียม (ข้อ 6-9): >=15 → 0, >=9 → 1, >=5 → 2, อื่นๆ → 3
--    0 พฤติกรรมเหมาะสม, 1 ควรใส่ใจ, 2 ควรปรับพฤติกรรม, 3 ควรปรับพฤติกรรมมาก
--    คะแนนใช้ของตัวเลือกในฐานข้อมูล (ถ้าไม่มี choice ใช้ score ที่บันทึกไว้)
--    ปรับเฉพาะ risk_level ตามที่ตกลง ไม่แตะ total_score / recommendation_id
-- =========================================================

WITH diet_scores AS (
  SELECT
    a.assessment_id,
    COUNT(DISTINCT q.display_order) FILTER (WHERE q.display_order BETWEEN 1 AND 9) AS answered,
    COALESCE(SUM(COALESCE(qc.score, aa.score)) FILTER (WHERE q.display_order = 1), 0) AS veg,
    COALESCE(SUM(COALESCE(qc.score, aa.score)) FILTER (WHERE q.display_order BETWEEN 2 AND 4), 0) AS sugar,
    COALESCE(SUM(COALESCE(qc.score, aa.score)) FILTER (WHERE q.display_order = 5), 0) AS fat,
    COALESCE(SUM(COALESCE(qc.score, aa.score)) FILTER (WHERE q.display_order BETWEEN 6 AND 9), 0) AS sodium
  FROM assessment a
  JOIN assessment_answers aa ON aa.assessment_id = a.assessment_id
  JOIN questions q ON q.question_id = aa.question_id
  LEFT JOIN question_choices qc
    ON qc.choice_id = aa.choice_id
   AND qc.question_id = aa.question_id
  WHERE a.assessment_type_id = 10
  GROUP BY a.assessment_id
),
diet_new AS (
  SELECT
    s.assessment_id,
    (ARRAY['พฤติกรรมเหมาะสม', 'ควรใส่ใจ', 'ควรปรับพฤติกรรม', 'ควรปรับพฤติกรรมมาก'])[
      GREATEST(
        CASE WHEN s.veg >= 4 THEN 0 WHEN s.veg = 3 THEN 1 WHEN s.veg = 2 THEN 2 ELSE 3 END,
        CASE WHEN s.sugar >= 11 THEN 0 WHEN s.sugar >= 8 THEN 1 WHEN s.sugar >= 4 THEN 2 ELSE 3 END,
        CASE WHEN s.fat >= 4 THEN 0 WHEN s.fat = 3 THEN 1 WHEN s.fat = 2 THEN 2 ELSE 3 END,
        CASE WHEN s.sodium >= 15 THEN 0 WHEN s.sodium >= 9 THEN 1 WHEN s.sodium >= 5 THEN 2 ELSE 3 END
      ) + 1
    ] AS risk_level
  FROM diet_scores s
  WHERE s.answered = 9
)
UPDATE assessment a
SET risk_level = n.risk_level
FROM diet_new n
WHERE a.assessment_id = n.assessment_id
  AND a.risk_level IS DISTINCT FROM n.risk_level;

COMMIT;
