-- คำขอลา: นักเรียนพิมพ์เหตุผลในระบบ แล้วไปแจ้งครู ครูกดอนุมัติ/ไม่อนุมัติในระบบ
-- นักเรียนเปลี่ยนสถานะเช็คชื่อของตัวเองไม่ได้ — เมื่อครูอนุมัติ แอปฝั่งครูจะบันทึก attendance_records เป็น 'excused'
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by  UUID REFERENCES public.profiles(id),
  decided_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_session ON public.leave_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON public.leave_requests(student_id);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- อ่าน: นักเรียนเห็นของตัวเอง ครู/admin เห็นทั้งหมด
DROP POLICY IF EXISTS "leave_select" ON public.leave_requests;
CREATE POLICY "leave_select" ON public.leave_requests FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.get_my_role() IN ('admin', 'teacher'));

-- นักเรียนส่งคำขอของตัวเองได้เฉพาะสถานะ pending
DROP POLICY IF EXISTS "leave_insert_own" ON public.leave_requests;
CREATE POLICY "leave_insert_own" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND status = 'pending' AND decided_by IS NULL);

-- นักเรียนแก้เหตุผลได้ระหว่างรอ แต่เปลี่ยนสถานะเองไม่ได้
DROP POLICY IF EXISTS "leave_update_own_pending" ON public.leave_requests;
CREATE POLICY "leave_update_own_pending" ON public.leave_requests FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending')
  WITH CHECK (student_id = auth.uid() AND status = 'pending' AND decided_by IS NULL);

-- นักเรียนยกเลิกคำขอที่ยังรออยู่ได้
DROP POLICY IF EXISTS "leave_delete_own_pending" ON public.leave_requests;
CREATE POLICY "leave_delete_own_pending" ON public.leave_requests FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending');

-- ครู/admin ทำได้ทุกอย่าง (อนุมัติ / ไม่อนุมัติ)
DROP POLICY IF EXISTS "leave_staff_all" ON public.leave_requests;
CREATE POLICY "leave_staff_all" ON public.leave_requests FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (public.get_my_role() IN ('admin', 'teacher'));

-- realtime ให้รายชื่อฝั่งครูเห็นคำขอใหม่ทันที (ข้ามถ้าเพิ่มไว้แล้ว)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
