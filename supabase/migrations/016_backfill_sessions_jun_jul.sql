DO $$
DECLARE d DATE;
BEGIN
  FOR d IN
    SELECT generate_series('2026-06-26'::DATE, '2026-07-02'::DATE, '1 day'::INTERVAL)::DATE
  LOOP
    PERFORM public.create_daily_sessions(d);
  END LOOP;
END;
$$;