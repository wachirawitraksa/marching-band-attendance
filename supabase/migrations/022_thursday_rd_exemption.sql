-- ============================================================================
-- Thursday-afternoon ร.ด. exemption
-- นักเรียน is_in_club = false ไปเรียน ร.ด. แทนตอนบ่ายวันพฤหัส → ไม่นับว่าขาดซ้อม
--
-- ปรับได้จุดเดียว: เงื่อนไขใน WHERE ของ view ด้านล่าง (บรรทัดที่คอมเมนต์ว่า TODO)
-- ถ้ายืนยันว่ามี session_type เฉพาะ ให้เปลี่ยนจาก start_time >= '12:00:00'
-- เป็น ps.session_type = 'ชื่อจริง' แทน
-- ============================================================================

CREATE OR REPLACE VIEW effective_attendance_records AS
SELECT ar.*
FROM attendance_records ar
JOIN practice_sessions ps ON ps.id = ar.session_id
JOIN profiles p ON p.id = ar.student_id
WHERE NOT (
  EXTRACT(DOW FROM ps.date) = 4       -- 4 = พฤหัสบดี (0=อาทิตย์ ... 6=เสาร์)
  AND ps.start_time >= '12:00:00'     -- TODO: เปลี่ยนเป็น ps.session_type = '...' ถ้ามีค่าเฉพาะ
  AND p.is_in_club = false
);

-- ให้สิทธิ์อ่าน view นี้เหมือนตารางเดิม (RLS ของตารางที่อ้างอิงยังคุมอยู่ เพราะเป็น view แบบ security invoker)
GRANT SELECT ON effective_attendance_records TO authenticated;

-- ---------------------------------------------------------------------------
-- อัปเดต recalc_student_streak ให้ข้าม session ที่เป็นช่วง ร.ด. ของนักเรียนคนนั้น
-- (เหมือนไม่มี session อยู่เลยสำหรับคนนี้ — ไม่นับมา ไม่ทำให้สตรีคขาด)
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
  FOR rec IN
    SELECT ar.status, ps.id AS session_id
    FROM attendance_records ar
    JOIN practice_sessions ps ON ps.id = ar.session_id
    WHERE ar.student_id = p_student_id
      AND NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = p_student_id
          AND p.is_in_club = false
          AND EXTRACT(DOW FROM ps.date) = 4
          AND ps.start_time >= '12:00:00'   -- TODO: sync กับเงื่อนไขใน view ด้านบน
      )
    ORDER BY ps.date DESC, ps.start_time DESC
  LOOP
    IF v_last_id IS NULL THEN
      v_last_id := rec.session_id;
      v_last_status := rec.status;
    END IF;

    IF rec.status IN ('present', 'late') THEN
      v_current := v_current + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

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
        AND NOT EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = p_student_id
            AND p.is_in_club = false
            AND EXTRACT(DOW FROM ps.date) = 4
            AND ps.start_time >= '12:00:00'
        )
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

  INSERT INTO user_badges (student_id, badge_id)
  SELECT p_student_id, b.id
  FROM badges b
  WHERE b.threshold IS NOT NULL AND b.threshold <= v_current
  ON CONFLICT (student_id, badge_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;