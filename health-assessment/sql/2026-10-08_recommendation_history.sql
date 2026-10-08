-- เก็บประวัติคำแนะนำ เพื่อไม่ให้การแก้คำแนะนำของ staff ไปเปลี่ยนคำแนะนำที่ผู้ใช้เคยได้รับในอดีต
--
-- หลักการ
--   - ตาราง recommendation ยังเป็นคำแนะนำ "ปัจจุบัน" ใช้ตอนผู้ใช้ทำแบบประเมินใหม่เหมือนเดิม
--   - ทุกครั้งที่แก้แถวใน recommendation (ทั้งหน้าคำแนะนำและหน้าแก้แบบประเมินของ staff)
--     trigger จะเก็บเนื้อหาเดิมลง recommendation_history พร้อมเวลาที่ถูกแทนที่ (valid_to)
--   - หน้าแสดงผลย้อนหลังเรียก recommendation_at(rec_id, assessed_at)
--     ได้คำแนะนำฉบับที่ใช้อยู่ตอนผู้ใช้ทำแบบประเมินครั้งนั้น
--
-- เวลา: assessment.assessed_at เป็น timestamp (UTC) ฐานข้อมูลตั้ง TimeZone = UTC
-- valid_to จึงเก็บเป็น timestamp (UTC) ให้เทียบกันได้ตรง ๆ

BEGIN;

CREATE TABLE IF NOT EXISTS recommendation_history (
  history_id          SERIAL PRIMARY KEY,
  rec_id              INTEGER NOT NULL,
  assessment_type_id  INTEGER,
  risk_level          VARCHAR(255),
  recommendation_text TEXT,
  reassess_days       INTEGER,
  hotline             TEXT,
  source              TEXT,
  min_score           NUMERIC,
  max_score           NUMERIC,
  updated_by          INTEGER,
  -- ฉบับนี้ใช้อยู่จนถึงเวลานี้ (เวลาที่ถูกแก้)
  valid_to            TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);

CREATE INDEX IF NOT EXISTS recommendation_history_rec_valid_idx
  ON recommendation_history (rec_id, valid_to);

/* ---------- trigger: เก็บฉบับเดิมทุกครั้งที่เนื้อหาเปลี่ยน ---------- */

CREATE OR REPLACE FUNCTION archive_recommendation() RETURNS trigger AS $$
BEGIN
  IF OLD.recommendation_text IS DISTINCT FROM NEW.recommendation_text
     OR OLD.risk_level      IS DISTINCT FROM NEW.risk_level
     OR OLD.reassess_days   IS DISTINCT FROM NEW.reassess_days
     OR OLD.hotline         IS DISTINCT FROM NEW.hotline
     OR OLD.source          IS DISTINCT FROM NEW.source
     OR OLD.min_score       IS DISTINCT FROM NEW.min_score
     OR OLD.max_score       IS DISTINCT FROM NEW.max_score
  THEN
    INSERT INTO recommendation_history (
      rec_id, assessment_type_id, risk_level, recommendation_text,
      reassess_days, hotline, source, min_score, max_score, updated_by
    ) VALUES (
      OLD.rec_id, OLD.assessment_type_id, OLD.risk_level, OLD.recommendation_text,
      OLD.reassess_days, OLD.hotline, OLD.source, OLD.min_score, OLD.max_score, OLD.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recommendation_archive ON recommendation;
CREATE TRIGGER recommendation_archive
  AFTER UPDATE ON recommendation
  FOR EACH ROW EXECUTE FUNCTION archive_recommendation();

/* ---------- คำแนะนำฉบับที่ใช้อยู่ ณ เวลาที่กำหนด ----------
   ฉบับในประวัติที่ถูกแทนที่ "หลัง" เวลานั้นเป็นฉบับแรก = ฉบับที่ใช้อยู่ตอนนั้น
   ถ้าไม่มี แปลว่ายังไม่เคยถูกแก้หลังจากนั้น ใช้ฉบับปัจจุบัน */

CREATE OR REPLACE FUNCTION recommendation_at(p_rec_id INTEGER, p_at TIMESTAMP)
RETURNS TABLE (
  rec_id INTEGER,
  assessment_type_id INTEGER,
  risk_level VARCHAR,
  recommendation_text TEXT,
  reassess_days INTEGER,
  hotline TEXT,
  source TEXT,
  min_score NUMERIC,
  max_score NUMERIC
) AS $$
  SELECT x.rec_id, x.assessment_type_id, x.risk_level, x.recommendation_text,
         x.reassess_days, x.hotline, x.source, x.min_score, x.max_score
  FROM (
    SELECT h.rec_id, h.assessment_type_id, h.risk_level, h.recommendation_text,
           h.reassess_days, h.hotline, h.source, h.min_score, h.max_score,
           0 AS pick, h.valid_to AS sort_at
    FROM recommendation_history h
    WHERE h.rec_id = p_rec_id
      AND p_at IS NOT NULL
      AND h.valid_to > p_at
    UNION ALL
    SELECT r.rec_id, r.assessment_type_id, r.risk_level, r.recommendation_text,
           r.reassess_days, r.hotline, r.source, r.min_score, r.max_score,
           1 AS pick, NULL
    FROM recommendation r
    WHERE r.rec_id = p_rec_id
  ) x
  ORDER BY x.pick, x.sort_at
  LIMIT 1
$$ LANGUAGE sql STABLE;

/* ---------- view ผลการประเมิน (v_assessment_*) ให้ใช้คำแนะนำฉบับตอนทำแบบประเมิน ---------- */

DO $$
DECLARE
  v RECORD;
  def TEXT;
BEGIN
  FOR v IN
    SELECT viewname FROM pg_views
    WHERE schemaname = 'public' AND viewname LIKE 'v\_assessment\_%'
  LOOP
    def := pg_get_viewdef(v.viewname::regclass, true);
    IF position('LEFT JOIN recommendation r ON r.rec_id = a.recommendation_id' IN def) > 0 THEN
      def := replace(
        def,
        'LEFT JOIN recommendation r ON r.rec_id = a.recommendation_id',
        'LEFT JOIN LATERAL recommendation_at(a.recommendation_id, a.assessed_at) r(rec_id, assessment_type_id, risk_level, recommendation_text, reassess_days, hotline, source, min_score, max_score) ON true'
      );
      EXECUTE format('CREATE OR REPLACE VIEW %I AS %s', v.viewname, rtrim(def, '; '));
    END IF;
  END LOOP;
END $$;

/* ---------- ย้อนเก็บการแก้ที่เกิดขึ้นก่อนมีตารางนี้ (จาก access_logs ของหน้าคำแนะนำ staff) ----------
   log เก็บเฉพาะข้อความเดิม ส่วนค่าอื่นใช้ค่าปัจจุบัน */

INSERT INTO recommendation_history (
  rec_id, assessment_type_id, risk_level, recommendation_text,
  reassess_days, hotline, source, min_score, max_score, valid_to
)
SELECT r.rec_id, r.assessment_type_id, r.risk_level, (l.detail::jsonb ->> 'before'),
       r.reassess_days, r.hotline, r.source, r.min_score, r.max_score,
       (l.created_at AT TIME ZONE 'UTC')
FROM access_logs l
JOIN recommendation r ON r.rec_id = (l.detail::jsonb ->> 'recId')::int
WHERE l.action = 'edit_recommendation'
  -- ทำครั้งเดียวตอนตารางยังว่าง รันไฟล์นี้ซ้ำจะไม่เพิ่มแถวซ้ำกับที่ trigger เก็บไว้แล้ว
  AND NOT EXISTS (SELECT 1 FROM recommendation_history);

COMMIT;
