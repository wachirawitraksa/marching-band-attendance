-- =====================================================
-- 008: เพิ่ม column classroom ในตาราง profiles
-- ใช้เก็บห้องเรียน เช่น "1/1", "2/3", "3/2"
-- รัน SQL นี้ใน Supabase → SQL Editor
-- =====================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS classroom TEXT;

-- ไม่ต้องเพิ่ม RLS เพราะ profiles table มี policy ครอบอยู่แล้ว
-- (profiles_select_all, profiles_update_own, profiles_admin_all)

-- ตรวจสอบ column ที่เพิ่มเข้าไป
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profiles'
  AND column_name  = 'classroom';
