-- ============================================================================
-- Streak + Badge schema
-- แนวคิด: streak นับจาก "practice_sessions ที่มีจริง" เท่านั้น (เรียงตามวันที่/เวลา)
-- เพราะฉะนั้นวันที่ไม่มีซ้อม (เสาร์-อาทิตย์, วันหยุด) จะไม่ปรากฏใน practice_sessions
-- อยู่แล้ว → นับ consecutive present/late ของ session ที่มีจริงตามลำดับเวลา
-- ก็เท่ากับ "ข้ามวันหยุดโดยอัตโนมัติ" ไม่ต้อง hardcode logic วันหยุดเพิ่ม
-- ============================================================================

-- ตารางเก็บค่า streak ปัจจุบัน/สูงสุด ต่อนักเรียน 1 แถว (cache ไว้ไม่ต้องคำนวณสดทุกครั้ง)
CREATE TABLE IF NOT EXISTS streaks (
  student_id      uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak  integer NOT NULL DEFAULT 0,
  longest_streak  integer NOT NULL DEFAULT 0,
  last_session_id uuid REFERENCES practice_sessions(id),
  last_status      text,                  -- สถานะของ session ล่าสุดที่คำนวณ (present/late/absent/excused)
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- แคตตาล็อก badge ทั้งหมดในระบบ (เพิ่ม/แก้ได้ภายหลังโดยไม่กระทบโค้ด)
CREATE TABLE IF NOT EXISTS badges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,      -- เช่น 'streak_5', 'streak_10', 'streak_20', 'perfect_term'
  name         text NOT NULL,             -- เช่น 'นักซ้อมมือใหม่'
  description  text,
  icon         text,                      -- emoji หรือ lucide icon key เช่น '🔥' หรือ 'flame'
  threshold    integer,                   -- ใช้เทียบกับ current_streak/longest_streak ตอน trigger ให้ badge
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- badge ที่นักเรียนแต่ละคนได้รับแล้ว
CREATE TABLE IF NOT EXISTS user_badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id    uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_student ON user_badges (student_id);

-- ---------------------------------------------------------------------------
-- Seed badge เริ่มต้น (ปรับตัวเลข/ชื่อได้ตามใจ)
-- ---------------------------------------------------------------------------
INSERT INTO badges (code, name, description, icon, threshold) VALUES
  ('streak_3',  'เริ่มติดสตรีค',     'มาซ้อมต่อเนื่อง 3 ครั้งติด',   '🔥', 3),
  ('streak_5',  'ไฟลุก',            'มาซ้อมต่อเนื่อง 5 ครั้งติด',   '🔥', 5),
  ('streak_10', 'สตรีคทอง',         'มาซ้อมต่อเนื่อง 10 ครั้งติด',  '🏅', 10),
  ('streak_20', 'ตำนานวงโย',        'มาซ้อมต่อเนื่อง 20 ครั้งติด',  '👑', 20)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Function: คำนวณ streak ใหม่ของนักเรียน 1 คน (เรียกจาก trigger ด้านล่าง)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalc_student_streak(p_student_id uuid)
RETURNS void AS $$
DECLARE
  v_current  integer := 0;
  v_longest  integer := 0;
  v_last_id  uuid;
  v_last_status text;
  rec RECORD;
BEGIN
  -- เดินย้อนจาก session ล่าสุด → เก่าสุด นับ present/late ต่อเนื่อง
  FOR rec IN
    SELECT ar.status, ps.id AS session_id
    FROM attendance_records ar
    JOIN practice_sessions ps ON ps.id = ar.session_id
    WHERE ar.student_id = p_student_id
    ORDER BY ps.date DESC, ps.start_time DESC
  LOOP
    IF v_last_id IS NULL THEN
      v_last_id := rec.session_id;
      v_last_status := rec.status;
    END IF;

    IF rec.status IN ('present', 'late') THEN
      v_current := v_current + 1;
    ELSE
      EXIT; -- เจอ absent/excused ตัวแรก (นับจากล่าสุดย้อนกลับ) → สตรีคปัจจุบันหยุดตรงนี้
    END IF;
  END LOOP;

  -- longest streak: หาค่าที่มากที่สุดในประวัติทั้งหมด (คำนวณแยกจาก loop เดียวกันเพื่อความง่าย)
  SELECT COALESCE(MAX(streak_len), 0) INTO v_longest FROM (
    SELECT COUNT(*) AS streak_len
    FROM (
      SELECT ar.status,
             ps.date,
             SUM(CASE WHEN ar.status NOT IN ('present','late') THEN 1 ELSE 0 END)
               OVER (ORDER BY ps.date, ps.start_time) AS grp
      FROM attendance_records ar
      JOIN practice_sessions ps ON ps.id = ar.session_id
      WHERE ar.student_id = p_student_id
    ) t
    WHERE t.status IN ('present','late')
    GROUP BY grp
  ) streaks_calc;

  v_longest := GREATEST(v_longest, v_current);

  INSERT INTO streaks (student_id, current_streak, longest_streak, last_session_id, last_status, updated_at)
  VALUES (p_student_id, v_current, v_longest, v_last_id, v_last_status, now())
  ON CONFLICT (student_id) DO UPDATE SET
    current_streak  = EXCLUDED.current_streak,
    longest_streak  = GREATEST(streaks.longest_streak, EXCLUDED.longest_streak),
    last_session_id = EXCLUDED.last_session_id,
    last_status     = EXCLUDED.last_status,
    updated_at      = now();

  -- แจก badge ที่ threshold <= current_streak แล้วยังไม่เคยได้
  INSERT INTO user_badges (student_id, badge_id)
  SELECT p_student_id, b.id
  FROM badges b
  WHERE b.threshold IS NOT NULL AND b.threshold <= v_current
  ON CONFLICT (student_id, badge_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Trigger: ทุกครั้งที่ attendance_records ถูก insert/update → คำนวณ streak ใหม่
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_recalc_streak_on_attendance()
RETURNS trigger AS $$
BEGIN
  PERFORM recalc_student_streak(NEW.student_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_records_streak_trigger ON attendance_records;
CREATE TRIGGER attendance_records_streak_trigger
  AFTER INSERT OR UPDATE OF status ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION trg_recalc_streak_on_attendance();

-- ---------------------------------------------------------------------------
-- RLS: นักเรียนอ่าน streak/badge ของตัวเองได้, ครู/แอดมินอ่านได้ทุกคน
-- ---------------------------------------------------------------------------
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own streak" ON streaks FOR SELECT
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','teacher')
  ));

CREATE POLICY "read badges catalog" ON badges FOR SELECT USING (true);

CREATE POLICY "read own user_badges" ON user_badges FOR SELECT
  USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','teacher')
  ));

-- Index สำหรับ query streak ของนักเรียนคนเดียว (dashboard)
CREATE INDEX IF NOT EXISTS idx_streaks_student ON streaks (student_id);