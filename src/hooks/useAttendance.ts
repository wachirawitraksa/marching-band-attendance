import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PracticeSession, AttendanceRecord } from '@/types';
import { useAuthStore } from '@/store/authStore';

export function useAttendance(date?: string) {
  const { profile } = useAuthStore();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetDate = date || new Date().toISOString().split('T')[0];

  const fetchSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('date', targetDate)
        .order('start_time');

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching sessions');
    }
  }, [targetDate]);

  const fetchMyRecords = useCallback(async () => {
    if (!profile) return;
    try {
      // Get today's sessions first, then get attendance for those sessions
      const { data: sessions } = await supabase
        .from('practice_sessions')
        .select('id')
        .eq('date', targetDate);
      
      if (!sessions?.length) { setMyRecords([]); return; }
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, session:practice_sessions(*)')
        .eq('student_id', profile.id)
        .in('session_id', sessions.map(s => s.id));

      if (error) throw error;
      setMyRecords(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching records');
    }
  }, [profile, targetDate]);

  const checkIn = useCallback(async (
    sessionId: string,
    gpsLat?: number,
    gpsLng?: number,
    gpsVerified?: boolean,
    gpsDistance?: number
  ) => {
    if (!profile) throw new Error('Not authenticated');

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('student_id', profile.id)
      .single();

    if (existing && existing.status === 'present') {
      throw new Error('คุณเช็คชื่อไปแล้วในรอบนี้');
    }

    // ตรวจว่ามาสายหรือเปล่า
    const { data: session } = await supabase
      .from('practice_sessions')
      .select('session_type, start_time')
      .eq('id', sessionId)
      .single();

    const LATE_AFTER: Record<string, number> = {
      morning: 7 * 60 + 45,       // หลัง 07:00 น. = สาย
      club:    15 * 60 + 35, // หลัง 15:25 น. = สาย
      extra:   0,            // ไม่มี threshold
    };

    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes();
    const threshold = LATE_AFTER[session?.session_type || 'extra'];
    const checkInStatus = (threshold > 0 && totalMin > threshold) ? 'late' : 'present';


    const record = {
      session_id: sessionId,
      student_id: profile.id,
      status: checkInStatus, // ← เปลี่ยนบรรทัดนี้เป็น status: checkInStatus,
      check_in_time: new Date().toISOString(),
      gps_lat: gpsLat || null,
      gps_lng: gpsLng || null,
      gps_verified: gpsVerified || false,
      gps_distance: gpsDistance || null,
    };

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(record, { onConflict: 'session_id,student_id' })
      .select()
      .single();

    if (error) throw error;
    await fetchMyRecords();
    return data;
  }, [profile, fetchMyRecords]);

  const submitReason = useCallback(async (sessionId: string, reason: string) => {
    if (!profile) throw new Error('Not authenticated');

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', profile.id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('attendance_records')
        .update({ reason, status: 'excused' })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('attendance_records')
        .insert({
          session_id: sessionId,
          student_id: profile.id,
          status: 'excused',
          reason,
        });
      if (error) throw error;
    }

    await fetchMyRecords();
  }, [profile, fetchMyRecords]);

  const qrCheckIn = useCallback(async (sessionId: string, qrToken: string) => {
    if (!profile) throw new Error('Not authenticated');

    // Verify QR token matches session
    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('qr_token', qrToken)
      .single();

    if (sessionError || !session) throw new Error('QR Code ไม่ถูกต้อง');

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert({
        session_id: sessionId,
        student_id: profile.id,
        status: 'present',
        check_in_time: new Date().toISOString(),
        qr_code_used: true,
      }, { onConflict: 'session_id,student_id' })
      .select()
      .single();

    if (error) throw error;
    await fetchMyRecords();
    return data;
  }, [profile, fetchMyRecords]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchSessions(), fetchMyRecords()]);
      setLoading(false);
    };
    load();
  }, [fetchSessions, fetchMyRecords]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('attendance-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
        filter: profile ? `student_id=eq.${profile.id}` : undefined,
      }, () => {
        fetchMyRecords();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, fetchMyRecords]);

  return {
    sessions,
    myRecords,
    loading,
    error,
    checkIn,
    submitReason,
    qrCheckIn,
    refetch: () => Promise.all([fetchSessions(), fetchMyRecords()]),
  };
}

export function useAllAttendance(sessionId?: string) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, student:profiles(*, section:sections(*), instrument:instruments(*))')
        .eq('session_id', sessionId)
        .order('created_at');

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Real-time
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
        filter: `session_id=eq.${sessionId}`,
      }, fetchRecords)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchRecords]);

  return { records, loading, refetch: fetchRecords };
}
