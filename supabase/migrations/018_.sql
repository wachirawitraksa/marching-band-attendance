UPDATE public.practice_sessions
SET end_time = '08:30'
WHERE session_type = 'morning'
  AND is_override = FALSE;