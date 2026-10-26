-- แก้ cron command ให้ cast เป็น DATE ก่อน
SELECT cron.unschedule(2);

SELECT cron.schedule(
  'create-daily-sessions',
  '0 18 * * *',
  $$ SELECT public.create_daily_sessions(
       ((NOW() AT TIME ZONE 'Asia/Bangkok') + INTERVAL '1 day')::DATE
  ); $$
);

-- ทดสอบสร้าง session วันพรุ่งนี้ทันที
SELECT public.create_daily_sessions(
  ((NOW() AT TIME ZONE 'Asia/Bangkok') + INTERVAL '1 day')::DATE
);

-- ยืนยัน
SELECT jobid, jobname, schedule, command, active FROM cron.job WHERE jobname = 'create-daily-sessions';