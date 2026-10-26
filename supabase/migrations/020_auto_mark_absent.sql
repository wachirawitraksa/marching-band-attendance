-- Function: mark absent สำหรับนักเรียนที่ไม่ได้เช็คชื่อหลังหมดเวลา
CREATE OR REPLACE FUNCTION public.auto_mark_absent()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
  v_now_minutes INTEGER;
  v_session RECORD;
  v_student RECORD;
BEGIN
  -- เวลาไทยปัจจุบัน
  v_today := (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE;
  v_now_minutes := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Bangkok')) * 60
                 + EXTRACT(MINUTE FROM (NOW() AT TIME ZONE 'Asia/Bangkok'));

  -- วนทุก session วันนี้ที่หมดเวลาแล้ว
  FOR v_session IN
    SELECT id, session_type
    FROM public.practice_sessions
    WHERE date = v_today
      AND is_override = FALSE
      AND (
        -- morning: หมดเวลาหลัง 08:30
        (session_type = 'morning' AND v_now_minutes > 510)
        OR
        -- club: หมดเวลาหลัง 16:00
        (session_type = 'club' AND v_now_minutes > 960)
      )
  LOOP
    -- insert absent สำหรับนักเรียนที่ยังไม่มี record
    INSERT INTO public.attendance_records (session_id, student_id, status)
    SELECT
      v_session.id,
      p.id,
      'absent'
    FROM public.profiles p
    WHERE p.role = 'student'
      AND p.is_active = TRUE
      AND p.is_graduated = FALSE
      AND p.is_in_club = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance_records ar
        WHERE ar.session_id = v_session.id
          AND ar.student_id = p.id
      )
    ON CONFLICT (session_id, student_id) DO NOTHING;
  END LOOP;
END;
$$;

-- cron: รัน 2 ครั้ง/วัน
--   08:35 เวลาไทย = 01:35 UTC → หลังซ้อมเช้าปิด
--   16:05 เวลาไทย = 09:05 UTC → หลังคาบชุมนุมปิด
SELECT cron.unschedule('auto-mark-absent-morning') FROM cron.job WHERE jobname = 'auto-mark-absent-morning';
SELECT cron.unschedule('auto-mark-absent-club')    FROM cron.job WHERE jobname = 'auto-mark-absent-club';

SELECT cron.schedule('auto-mark-absent-morning', '35 1 * * *',  $$ SELECT public.auto_mark_absent(); $$);
SELECT cron.schedule('auto-mark-absent-club',    '5  9 * * 4',  $$ SELECT public.auto_mark_absent(); $$);

-- ทดสอบรันทันที (mark absent วันนี้ถ้าหมดเวลาแล้ว)
SELECT public.auto_mark_absent();

-- ยืนยัน cron jobs
SELECT jobname, schedule, active FROM cron.job ORDER BY jobid;