-- นักเรียนเช็คชื่อตัวเองได้
CREATE POLICY "Students can insert own attendance"
ON attendance_records
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- นักเรียนอ่านของตัวเองได้
CREATE POLICY "Students can read own attendance"
ON attendance_records
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- ครู/admin ทำได้ทุกอย่าง
CREATE POLICY "Teachers full access"
ON attendance_records
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'admin')
  )
);