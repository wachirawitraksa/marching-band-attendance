// src/hooks/useSupabaseQueries.ts
//
// Shared, cached data-fetching hooks built on TanStack Query.
// เป้าหมาย: ข้อมูลที่หลายหน้าใช้ร่วมกัน (sections, instruments, students, sessions,
// attendance records) ให้ดึงจาก cache เดียวกัน แทนที่แต่ละหน้าจะยิง query ซ้ำ
//
// วิธีใช้: import hook ที่ต้องการในแต่ละ Page component แทนการเขียน
// useEffect + supabase.from(...).then(setState) เอง

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Profile, Section, Instrument, PracticeSession, AttendanceRecord } from '@/types';

// ---------------------------------------------------------------------------
// Reference data — เปลี่ยนไม่บ่อย, cache นาน
// ---------------------------------------------------------------------------

export function useSections() {
  return useQuery({
    queryKey: ['sections'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sections').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as Section[];
    },
    staleTime: 60 * 60 * 1000, // 1 ชม.
  });
}

export function useInstruments() {
  return useQuery({
    queryKey: ['instruments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instruments')
        .select('*, section:sections(*)')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Instrument[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Students / profiles — ใช้ร่วมกันใน StudentsPage, ReportsPage, AdminPage, AttendancePage
// ---------------------------------------------------------------------------

interface StudentsFilter {
  graduated?: boolean;
  activeOnly?: boolean;
}

export function useStudents({ graduated = false, activeOnly = true }: StudentsFilter = {}) {
  return useQuery({
    queryKey: ['students', { graduated, activeOnly }],
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('*, section:sections(*), instrument:instruments(*, section:sections(*))')
        .eq('role', 'student')
        .eq('is_graduated', graduated)
        .order('full_name');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    staleTime: 5 * 60 * 1000, // 5 นาที
  });
}

// AdminPage: ทุก role ไม่ filter role/graduated
export function useAllProfiles() {
  return useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, section:sections(*), instrument:instruments(*)')
        .order('role')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Practice sessions — ใช้ใน Dashboard, Attendance, Schedule
// ---------------------------------------------------------------------------

export function useSessionsByDate(date: string) {
  return useQuery({
    queryKey: ['sessions', 'byDate', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('date', date)
        .order('start_time');
      if (error) throw error;
      return (data ?? []) as PracticeSession[];
    },
    staleTime: 2 * 60 * 1000, // 2 นาที — วันนี้อาจมีการแก้ session
  });
}

export function useSessionsInRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['sessions', 'range', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');
      if (error) throw error;
      return (data ?? []) as PracticeSession[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Attendance records
// ---------------------------------------------------------------------------

// ประวัติของนักเรียนคนเดียว (DashboardPage, ReportsPage)
export function useMyAttendance(studentId?: string, limit = 20) {
  return useQuery({
    queryKey: ['attendance', 'byStudent', studentId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, session:practice_sessions(*)')
        .eq('student_id', studentId as string)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
    enabled: !!studentId,
    staleTime: 60 * 1000,
  });
}

// สถิติรวมของนักเรียนคนเดียว (นับ present/absent/late/excused)
// ใช้ effective_attendance_records — ตัดช่วงพฤหัสบ่ายของคนที่ไป ร.ด. ออกอัตโนมัติ
export function useMyAttendanceStats(studentId?: string) {
  return useQuery({
    queryKey: ['attendance', 'stats', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('effective_attendance_records')
        .select('status')
        .eq('student_id', studentId as string);
      if (error) throw error;
      const s = { total: data?.length ?? 0, present: 0, absent: 0, late: 0, excused: 0 };
      data?.forEach((r) => { s[r.status as keyof typeof s]++; });
      return s;
    },
    enabled: !!studentId,
    staleTime: 60 * 1000,
  });
}

// ทุก record ของ session เดียว (Attendance teacher view) — realtime-backed
export function useAttendanceBySession(sessionId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['attendance', 'bySession', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('session_id', sessionId);
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
    enabled: !!sessionId,
    staleTime: 10 * 1000,
  });

  return { ...query, invalidate: () => queryClient.invalidateQueries({ queryKey: ['attendance', 'bySession', sessionId] }) };
}

// รายงานทั้งหมด (ReportsPage) — ปกติหน้ารายงานควร filter ด้วยช่วงวันที่/section
// แทนที่จะดึงทุก record ทั้งตาราง ถ้าข้อมูลเยอะควรเพิ่ม .gte('created_at', ...) ด้วย
export function useAllAttendanceRecords(fromDate?: string) {
  return useQuery({
    queryKey: ['attendance', 'all', fromDate],
    queryFn: async () => {
      let q = supabase
        .from('attendance_records')
        .select('*, session:practice_sessions(*)')
        .order('created_at', { ascending: false });
      if (fromDate) q = q.gte('created_at', fromDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// จำนวนนักเรียน active ทั้งหมด (การ์ด "นักเรียน" ฝั่งครูใน DashboardPage)
export function useActiveStudentCount() {
  return useQuery({
    queryKey: ['students', 'count', 'active'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('is_active', true)
        .eq('is_graduated', false);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// กราฟ 7 วันย้อนหลัง (DashboardPage) — cache แยกตามช่วงวันที่ + user + role
export function useWeeklyAttendance(days: string[], studentId: string | undefined, isTeacher: boolean) {
  return useQuery({
    queryKey: ['attendance', 'weekly', days, isTeacher ? 'team' : studentId],
    queryFn: async () => {
      const results = await Promise.all(
        days.map(async (d) => {
          const { data: daySessions, error: sessErr } = await supabase
            .from('practice_sessions').select('id').eq('date', d);
          if (sessErr) throw sessErr;
          if (!daySessions?.length) return { day: d, present: 0, absent: 0 };

          const sessionIds = daySessions.map((s) => s.id);
          // effective_attendance_records ตัดช่วงพฤหัสบ่ายของคนที่ไป ร.ด. ออกให้แล้ว
          const recordsQuery = !isTeacher
            ? supabase.from('effective_attendance_records').select('status').in('session_id', sessionIds).eq('student_id', studentId as string)
            : supabase.from('effective_attendance_records').select('status').in('session_id', sessionIds);
          const { data, error } = await recordsQuery;
          if (error) throw error;
          const present = data?.filter((r) => r.status === 'present' || r.status === 'late').length ?? 0;
          return { day: d, present, absent: data ? data.length - present : 0 };
        })
      );
      return results;
    },
    enabled: isTeacher || !!studentId,
    staleTime: 5 * 60 * 1000,
  });
}

// สรุปสถานะเช็คชื่อวันนี้ (ฝั่งครู) จาก session ids ของวันนี้
// ใช้ effective_attendance_records — ตัดช่วงพฤหัสบ่ายของคนที่ไป ร.ด. ออกจากสถิติวันนี้ด้วย
export function useTodayAttendanceSummary(sessionIds: string[]) {
  return useQuery({
    queryKey: ['attendance', 'todaySummary', sessionIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('effective_attendance_records')
        .select('status')
        .in('session_id', sessionIds);
      if (error) throw error;
      const s = { total: data?.length ?? 0, present: 0, absent: 0, late: 0, excused: 0 };
      data?.forEach((r) => { s[r.status as keyof typeof s]++; });
      return s;
    },
    enabled: sessionIds.length > 0,
    staleTime: 60 * 1000,
  });
}

// ประวัติทั้งหมด (ไม่ limit) ของนักเรียนคนเดียว — ใช้ใน StudentCalendarReport
// สำหรับสถิติรวม/ตัวเลือกปีการศึกษา ต่างจาก useMyAttendance ที่ limit 20 รายการ
export function useStudentAllAttendance(studentId?: string) {
  return useQuery({
    queryKey: ['attendance', 'allByStudent', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*, session:practice_sessions(*)')
        .eq('student_id', studentId as string);
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });
}

// sessions + attendance ของนักเรียนคนเดียว ในเดือนที่กำลังดู (ปฏิทิน)
// cache แยกตาม studentId+year+month — เลื่อนเดือนไปมาหรือเปิดซ้ำจะไม่ fetch ใหม่
export function useStudentMonthAttendance(studentId: string, year: number, month: number) {
  return useQuery({
    queryKey: ['attendance', 'calendarMonth', studentId, year, month],
    queryFn: async () => {
      const mm = String(month + 1).padStart(2, '0');
      const lastDay = new Date(year, month + 1, 0).getDate();
      const start = `${year}-${mm}-01`;
      const end = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

      const [{ data: sessions, error: sessErr }, { data: records, error: recErr }] = await Promise.all([
        supabase.from('practice_sessions').select('*').gte('date', start).lte('date', end).order('date').order('start_time'),
        supabase.from('attendance_records').select('*, session:practice_sessions(*)')
          .eq('student_id', studentId)
          .gte('created_at', `${start}T00:00:00`)
          .lte('created_at', `${end}T23:59:59`),
      ]);
      if (sessErr) throw sessErr;
      if (recErr) throw recErr;
      return { sessions: sessions ?? [], records: (records ?? []) as AttendanceRecord[] };
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations — เช็คอิน / override / อัปเดตโปรไฟล์
// ---------------------------------------------------------------------------

export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: {
      session_id: string;
      student_id: string;
      status: string;
      check_in_time?: string | null;
      gps_verified?: boolean;
      gps_lat?: number;
      gps_lng?: number;
      gps_distance?: number;
      qr_code_used?: boolean;
      teacher_override?: boolean;
      override_by?: string;
      override_note?: string;
    }) => {
      const { data, error } = await supabase
        .from('attendance_records')
        .upsert(record, { onConflict: 'session_id,student_id' })
        .select()
        .single();
      if (error) throw error;
      return data as AttendanceRecord;
    },
    onMutate: async (newRecord) => {
      const key = ['attendance', 'bySession', newRecord.session_id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<AttendanceRecord[]>(key);
      queryClient.setQueryData<AttendanceRecord[]>(key, (old = []) => [
        ...old.filter((r) => r.student_id !== newRecord.student_id),
        newRecord as AttendanceRecord,
      ]);
      return { previous, key };
    },
    onError: (_err, _newRecord, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: (_data, _err, newRecord) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'bySession', newRecord.session_id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'byStudent', newRecord.student_id] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'stats', newRecord.student_id] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Profile> }) => {
      const { error } = await supabase.from('profiles').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      // profiles ถูกใช้หลายหน้า invalidate ทั้งหมดที่เกี่ยวข้อง
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}