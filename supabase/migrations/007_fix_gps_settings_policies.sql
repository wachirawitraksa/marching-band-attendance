-- Fix missing DELETE policy for gps_settings table
-- This migration adds the missing DELETE policy that was omitted in 006_gps_settings.sql

-- Drop existing DELETE policies if any (for idempotency)
DROP POLICY IF EXISTS "only_admins_can_delete_gps_settings" ON gps_settings;

-- Add DELETE policy for admins only
CREATE POLICY "only_admins_can_delete_gps_settings"
  ON gps_settings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
