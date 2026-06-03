import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface GPSSetting {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  is_active: boolean;
}

export function useGPSSettings() {
  const [settings, setSettings] = useState<GPSSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from('gps_settings')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (err) {
          console.warn('Failed to load GPS settings:', err);
          setError('ไม่สามารถโหลดตั้งค่า GPS');
          return;
        }

        setSettings(data);
        setError(null);
      } catch (err) {
        console.error('GPS settings error:', err);
        setError('เกิดข้อผิดพลาดในการโหลดตั้งค่า GPS');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  return { settings, loading, error };
}
