-- ตั้ง cron job
SELECT cron.schedule(
  'create-daily-sessions',
  '0 18 * * *',
  $$ SELECT public.create_daily_sessions(
       (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE + INTERVAL '1 day'
  ); $$
);

-- สร้าง session ย้อนหลัง 6 วัน + ล่วงหน้า 7 วันทันที
DO $$
DECLARE
  d DATE;
BEGIN
  FOR d IN
    SELECT generate_series(
      (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE - 6,
      (NOW() AT TIME ZONE 'Asia/Bangkok')::DATE + 7,
      '1 day'::INTERVAL
    )::DATE
  LOOP
    PERFORM public.create_daily_sessions(d);
  END LOOP;
END;
$$;

-- ยืนยันผล
SELECT date, session_type, start_time, end_time
FROM public.practice_sessions
ORDER BY date, start_time;