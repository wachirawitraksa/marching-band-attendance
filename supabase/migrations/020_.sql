-- ประวัติเช็คชื่อของนักเรียนคนเดียว ข้าม session (หน้าโปรไฟล์/รายงาน)
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id 
  ON attendance_records (student_id);

-- เรียงตามเวลาเช็คอินล่าสุด (ใช้ partial index กรองเฉพาะ non-null จะเบากว่า)
CREATE INDEX IF NOT EXISTS idx_attendance_records_checkin_time 
  ON attendance_records (check_in_time DESC) 
  WHERE check_in_time IS NOT NULL;

-- filter session ตามเทอม (dashboard/calendar per เทอม)
CREATE INDEX IF NOT EXISTS idx_practice_sessions_term_id 
  ON practice_sessions (term_id);

-- profiles: ยังไม่มี index อื่นนอกจาก pkey เลย — ตัวนี้สำคัญสุด
CREATE INDEX IF NOT EXISTS idx_profiles_section_id 
  ON profiles (section_id);

CREATE INDEX IF NOT EXISTS idx_profiles_classroom 
  ON profiles (classroom);

-- filter "นักเรียนที่ active อยู่ใน section ไหน" ใช้บ่อยสุดในหน้ารายชื่อ
CREATE INDEX IF NOT EXISTS idx_profiles_active_section 
  ON profiles (is_active, section_id) 
  WHERE is_active = true;

-- filter role (เช่นดึงเฉพาะ role = 'student' หรือ 'teacher')
CREATE INDEX IF NOT EXISTS idx_profiles_role 
  ON profiles (role);