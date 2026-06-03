-- =====================================================
-- 004: เพิ่มตาราง holidays (วันหยุด)
-- รัน SQL นี้ใน Supabase → SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.holidays (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date        DATE NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- ทุกคน login แล้วดูได้
CREATE POLICY "holidays_select_all"
  ON public.holidays FOR SELECT TO authenticated USING (true);

-- เฉพาะ admin/teacher เพิ่ม/แก้/ลบ
CREATE POLICY "holidays_manage_staff"
  ON public.holidays FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

-- ลบ session ที่ตรงกับวันหยุดที่มีอยู่แล้ว (ถ้ามี)
-- (ครั้งแรก run ไม่มีผลอะไร)
DELETE FROM public.practice_sessions
WHERE date IN (SELECT date FROM public.holidays)
  AND is_override = FALSE;
