-- =====================================================
-- FIX 003: แก้ RLS infinite recursion บน profiles table
-- root cause: policy ที่ query profiles ใน USING clause
--             ทำให้ RLS trigger ซ้ำ → infinite loop → error
-- รัน SQL นี้ใน Supabase → SQL Editor ก่อนใช้งาน
-- =====================================================

-- 1. สร้าง helper function ที่ bypass RLS (SECURITY DEFINER)
--    ใช้แทนการ query profiles โดยตรงใน policy
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 2. ลบ policies เก่าทั้งหมดที่มีปัญหา
DROP POLICY IF EXISTS "profiles_select"         ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin"          ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_service" ON public.profiles;

DROP POLICY IF EXISTS "sections_manage"    ON public.sections;
DROP POLICY IF EXISTS "instruments_manage" ON public.instruments;
DROP POLICY IF EXISTS "sessions_select"    ON public.practice_sessions;
DROP POLICY IF EXISTS "sessions_manage"    ON public.practice_sessions;
DROP POLICY IF EXISTS "attendance_select"  ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_insert"  ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_update"  ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_teacher_manage" ON public.attendance_records;
DROP POLICY IF EXISTS "schedule_select"    ON public.schedule_overrides;
DROP POLICY IF EXISTS "schedule_manage"    ON public.schedule_overrides;
DROP POLICY IF EXISTS "terms_select"       ON public.academic_terms;
DROP POLICY IF EXISTS "terms_manage"       ON public.academic_terms;

-- 3. สร้าง policies ใหม่โดยใช้ get_my_role() แทน
--    ไม่มี recursive query แล้ว

-- PROFILES: ทุกคนที่ login อ่านได้, แก้ไขตัวเองได้, admin/teacher แก้ทุกคนได้
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.get_my_role() IN ('admin', 'teacher'))
  WITH CHECK (auth.uid() = id OR public.get_my_role() IN ('admin', 'teacher'));

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');

-- SECTIONS: อ่านได้ทุกคน, แก้ไขได้ admin/teacher
CREATE POLICY "sections_select_all"
  ON public.sections FOR SELECT TO authenticated USING (true);

CREATE POLICY "sections_manage_staff"
  ON public.sections FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

-- INSTRUMENTS: อ่านได้ทุกคน, แก้ไขได้ admin/teacher
CREATE POLICY "instruments_select_all"
  ON public.instruments FOR SELECT TO authenticated USING (true);

CREATE POLICY "instruments_manage_staff"
  ON public.instruments FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

-- PRACTICE SESSIONS: อ่านได้ทุกคน, แก้ไขได้ admin/teacher
CREATE POLICY "sessions_select_all"
  ON public.practice_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "sessions_manage_staff"
  ON public.practice_sessions FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

-- ATTENDANCE: นักเรียนดูของตัวเอง, ครู/admin ดูทุกคน
CREATE POLICY "attendance_select_own"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.get_my_role() IN ('admin', 'teacher')
  );

CREATE POLICY "attendance_insert_own"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "attendance_update_own"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    OR public.get_my_role() IN ('admin', 'teacher')
  );

CREATE POLICY "attendance_manage_staff"
  ON public.attendance_records FOR DELETE TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

-- SCHEDULE OVERRIDES
CREATE POLICY "schedule_select_all"
  ON public.schedule_overrides FOR SELECT TO authenticated USING (true);

CREATE POLICY "schedule_manage_staff"
  ON public.schedule_overrides FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

-- ACADEMIC TERMS
CREATE POLICY "terms_select_all"
  ON public.academic_terms FOR SELECT TO authenticated USING (true);

CREATE POLICY "terms_manage_staff"
  ON public.academic_terms FOR ALL TO authenticated
  USING (public.get_my_role() IN ('admin', 'teacher'));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;

CREATE POLICY "notif_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_insert_all"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. ตรวจสอบว่า profile ของ admin มีอยู่จริง
--    ถ้าไม่มี trigger จะสร้างให้อัตโนมัติ
--    แต่ถ้าสร้าง user ด้วย Dashboard จะไม่มี trigger → ต้องเช็ค
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  -- ดึง users ที่ยังไม่มี profile
  FOR v_user_id, v_email IN
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  LOOP
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      v_user_id,
      v_email,
      COALESCE(split_part(v_email, '@', 1), 'User'),
      'student'
    )
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE 'Created missing profile for: %', v_email;
  END LOOP;
END;
$$;

-- 5. ตรวจสอบ: แสดง policies ทั้งหมดที่ active
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','attendance_records','practice_sessions')
ORDER BY tablename, policyname;
