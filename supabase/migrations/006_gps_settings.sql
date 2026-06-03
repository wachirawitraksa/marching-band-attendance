-- Add GPS location settings table
CREATE TABLE IF NOT EXISTS gps_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'ห้องดนตรี',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  allowed_radius INTEGER NOT NULL DEFAULT 200, -- in meters
  is_active BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE gps_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read GPS settings
CREATE POLICY "anyone_can_read_gps_settings"
  ON gps_settings FOR SELECT
  USING (TRUE);

-- Only teachers/admins can update
CREATE POLICY "only_teachers_can_update_gps_settings"
  ON gps_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'teacher')
    )
  );

-- Only admins can insert/delete
CREATE POLICY "only_admins_can_insert_gps_settings"
  ON gps_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default location
INSERT INTO gps_settings (name, latitude, longitude, allowed_radius, is_active)
VALUES ('ห้องดนตรี', 18.7784475, 100.780098, 200, TRUE)
ON CONFLICT DO NOTHING;
