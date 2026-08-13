-- Fix deleting a session when a streak row still points to it.
-- The session row is deleted, and the child streak reference must become NULL instead of blocking the delete.

ALTER TABLE public.streaks
  DROP CONSTRAINT IF EXISTS streaks_last_session_id_fkey;

ALTER TABLE public.streaks
  ADD CONSTRAINT streaks_last_session_id_fkey
  FOREIGN KEY (last_session_id) REFERENCES public.practice_sessions(id) ON DELETE SET NULL;
