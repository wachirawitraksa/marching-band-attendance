-- ให้ครู/admin insert attendance ของนักเรียนคนอื่นได้
DROP POLICY IF EXISTS "attendance_insert_own" ON public.attendance_records;

CREATE POLICY "attendance_insert_own"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR public.get_my_role() IN ('admin', 'teacher')
  );