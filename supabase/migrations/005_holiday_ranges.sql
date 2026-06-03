-- =====================================================
-- 005: เพิ่มตาราง holiday_ranges (ช่วงปิดเทอม)
-- รัน SQL นี้ใน Supabase → SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.holiday_ranges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  label       TEXT NOT NULL,          -- เช่น "ปิดเทอม ภาค 1/2568"
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT  valid_range CHECK (end_date >= start_date)
);

ALTER TABLE public.holiday_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ranges_select_all"
  ON public.holiday_ranges FOR SELECT TO authenticated USING (true);

CREATE POLICY "ranges_manage_staff"
  ON public.holiday_ranges FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

-- ลบ session ที่อยู่ในช่วงปิดเทอมที่มีอยู่แล้ว (ถ้ามี)
-- (ครั้งแรก run ไม่มีผล)
DELETE FROM public.practice_sessions ps
WHERE EXISTS (
  SELECT 1 FROM public.holiday_ranges hr
  WHERE ps.date BETWEEN hr.start_date AND hr.end_date
  AND ps.is_override = FALSE
);
