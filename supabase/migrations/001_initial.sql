-- ===================================================
-- วงโยธวาทิต - ระบบเช็คชื่อนักเรียน
-- Database Schema v1.0
-- ===================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- SECTIONS TABLE
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  color TEXT DEFAULT '#F59E0B',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INSTRUMENTS TABLE
CREATE TABLE instruments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_en TEXT,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROFILES TABLE
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  nickname TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
  student_id TEXT,
  year_level INTEGER CHECK (year_level BETWEEN 1 AND 6),
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  instrument_id UUID REFERENCES instruments(id) ON DELETE SET NULL,
  profile_picture_url TEXT,
  is_graduated BOOLEAN DEFAULT FALSE,
  is_in_club BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRACTICE SESSIONS TABLE
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('morning', 'club', 'extra')),
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_override BOOLEAN DEFAULT FALSE,
  qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, session_type)
);

-- ATTENDANCE RECORDS TABLE
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  check_in_time TIMESTAMPTZ,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_verified BOOLEAN DEFAULT FALSE,
  gps_distance INTEGER,
  qr_code_used BOOLEAN DEFAULT FALSE,
  reason TEXT,
  teacher_override BOOLEAN DEFAULT FALSE,
  override_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  override_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- SCHEDULE OVERRIDES TABLE
CREATE TABLE schedule_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS TABLE
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $func$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin" ON profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "sections_select" ON sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections_manage" ON sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

CREATE POLICY "instruments_select" ON instruments FOR SELECT TO authenticated USING (true);
CREATE POLICY "instruments_manage" ON instruments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

CREATE POLICY "sessions_select" ON practice_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_manage" ON practice_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

CREATE POLICY "attendance_select" ON attendance_records FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));
CREATE POLICY "attendance_insert" ON attendance_records FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "attendance_update" ON attendance_records FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));
CREATE POLICY "attendance_teacher_manage" ON attendance_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

CREATE POLICY "schedule_select" ON schedule_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "schedule_manage" ON schedule_overrides FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

CREATE POLICY "notif_select" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true) ON CONFLICT DO NOTHING;

CREATE POLICY "pp_select" ON storage.objects FOR SELECT USING (bucket_id = 'profile-pictures');
CREATE POLICY "pp_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-pictures');
CREATE POLICY "pp_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-pictures');
CREATE POLICY "pp_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-pictures');

-- SEED DATA
INSERT INTO sections (name, name_en, color) VALUES
  ('เครื่องเป่าลมไม้', 'Woodwind', '#3B82F6'),
  ('เครื่องเป่าลมทองเหลือง', 'Brass', '#F59E0B'),
  ('เครื่องตี', 'Percussion', '#EF4444'),
  ('ธงสี', 'Color Guard', '#8B5CF6'),
  ('กลองใหญ่', 'Bass Line', '#10B981');

INSERT INTO instruments (name, name_en, section_id) VALUES
  ('ฟลุต', 'Flute', (SELECT id FROM sections WHERE name_en = 'Woodwind')),
  ('คลาริเน็ต', 'Clarinet', (SELECT id FROM sections WHERE name_en = 'Woodwind')),
  ('แซกโซโฟนอัลโต', 'Alto Saxophone', (SELECT id FROM sections WHERE name_en = 'Woodwind')),
  ('แซกโซโฟนเทเนอร์', 'Tenor Saxophone', (SELECT id FROM sections WHERE name_en = 'Woodwind')),
  ('แซกโซโฟนบาริโทน', 'Baritone Saxophone', (SELECT id FROM sections WHERE name_en = 'Woodwind')),
  ('ทรัมเป็ต', 'Trumpet', (SELECT id FROM sections WHERE name_en = 'Brass')),
  ('เฟรนช์ฮอร์น', 'French Horn', (SELECT id FROM sections WHERE name_en = 'Brass')),
  ('ทรอมโบน', 'Trombone', (SELECT id FROM sections WHERE name_en = 'Brass')),
  ('บาริโทน', 'Baritone', (SELECT id FROM sections WHERE name_en = 'Brass')),
  ('ยูโฟเนียม', 'Euphonium', (SELECT id FROM sections WHERE name_en = 'Brass')),
  ('ทูบา', 'Tuba', (SELECT id FROM sections WHERE name_en = 'Brass')),
  ('สแนร์ดรัม', 'Snare Drum', (SELECT id FROM sections WHERE name_en = 'Percussion')),
  ('ควอด', 'Quad', (SELECT id FROM sections WHERE name_en = 'Percussion')),
  ('ฉาบ', 'Cymbal', (SELECT id FROM sections WHERE name_en = 'Percussion')),
  ('ไซโลโฟน', 'Xylophone', (SELECT id FROM sections WHERE name_en = 'Percussion')),
  ('มาริมบา', 'Marimba', (SELECT id FROM sections WHERE name_en = 'Percussion')),
  ('กลองใหญ่', 'Bass Drum', (SELECT id FROM sections WHERE name_en = 'Bass Line')),
  ('ธงสี', 'Color Guard Flag', (SELECT id FROM sections WHERE name_en = 'Color Guard')),
  ('ดาบ', 'Saber', (SELECT id FROM sections WHERE name_en = 'Color Guard')),
  ('ห่วง', 'Rifle', (SELECT id FROM sections WHERE name_en = 'Color Guard'));

-- ===================================================
-- ACADEMIC TERMS TABLE (เพิ่มเติม)
-- ===================================================
CREATE TABLE IF NOT EXISTS academic_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year INTEGER NOT NULL,
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)),
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  label TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academic_year, semester)
);

ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "terms_select" ON academic_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "terms_manage" ON academic_terms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

-- Link sessions to terms (optional column)
ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES academic_terms(id) ON DELETE SET NULL;

-- Insert default current term (2568/1)
INSERT INTO academic_terms (academic_year, semester, start_date, is_current, label)
VALUES (2568, 1, '2025-05-01', TRUE, 'ภาคเรียนที่ 1/2568')
ON CONFLICT (academic_year, semester) DO NOTHING;
