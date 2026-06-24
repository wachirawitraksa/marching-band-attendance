CREATE OR REPLACE FUNCTION public.create_daily_sessions(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow        INTEGER;
  v_is_holiday BOOLEAN;
  v_in_range   BOOLEAN;
BEGIN
  v_dow := EXTRACT(DOW FROM target_date);

  SELECT EXISTS (
    SELECT 1 FROM public.holidays WHERE date = target_date
  ) INTO v_is_holiday;

  SELECT EXISTS (
    SELECT 1 FROM public.holiday_ranges
    WHERE target_date BETWEEN start_date AND end_date
  ) INTO v_in_range;

  IF v_is_holiday OR v_in_range THEN
    RETURN;
  END IF;

  IF v_dow BETWEEN 1 AND 5 THEN
    INSERT INTO public.practice_sessions
      (date, start_time, end_time, session_type, description, is_override)
    VALUES
      (target_date, '07:00', '08:30', 'morning', 'ซ้อมเช้า (ห้ามเกิน 07:45 น.)', false)
    ON CONFLICT (date, session_type) DO NOTHING;
  END IF;

  IF v_dow = 4 THEN
    INSERT INTO public.practice_sessions
      (date, start_time, end_time, session_type, description, is_override)
    VALUES
      (target_date, '15:20', '16:10', 'club', 'คาบชุมนุม (ห้ามสายเกิน 15:35 น.)', false)
    ON CONFLICT (date, session_type) DO NOTHING;
  END IF;
END;
$$;

-- อัปเดต session ที่สร้างไปแล้ว (08:30 → 08:10)
UPDATE public.practice_sessions
SET end_time = '08:10'
WHERE session_type = 'morning'
  AND end_time = '08:30'
  AND is_override = FALSE;

-- ยืนยัน
SELECT date, session_type, start_time, end_time
FROM public.practice_sessions
WHERE session_type = 'morning'
ORDER BY date;