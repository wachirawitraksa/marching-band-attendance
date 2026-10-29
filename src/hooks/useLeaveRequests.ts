import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LeaveRequest } from '@/types';

// คำขอลา (ตาราง leave_requests — migration 024)
// ถ้ายังไม่ได้รัน migration ตารางจะไม่มี: query คืนค่าว่างแทนการทำให้หน้าพัง

const leaveKey = (...parts: unknown[]) => ['leave', ...parts];

/** คำขอลาของนักเรียนคนนี้ ในรอบซ้อมที่กำหนด */
export function useMyLeaveRequests(studentId: string | undefined, sessionIds: string[]) {
  return useQuery({
    queryKey: leaveKey('mine', studentId, sessionIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', studentId as string)
        .in('session_id', sessionIds);
      if (error) { console.error('leave_requests:', error); return [] as LeaveRequest[]; }
      return (data ?? []) as LeaveRequest[];
    },
    enabled: !!studentId && sessionIds.length > 0,
  });
}

/** คำขอลาทั้งหมดของรอบซ้อม (ฝั่งครู) — อัปเดตสดเมื่อมีคนส่งคำขอใหม่ */
export function useSessionLeaveRequests(sessionId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: leaveKey('session', sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('session_id', sessionId);
      if (error) { console.error('leave_requests:', error); return [] as LeaveRequest[]; }
      return (data ?? []) as LeaveRequest[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`leave-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'leave_requests', filter: `session_id=eq.${sessionId}`,
      }, () => queryClient.invalidateQueries({ queryKey: leaveKey('session', sessionId) }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, queryClient]);

  return query;
}

/** นักเรียนส่ง/แก้เหตุผลคำขอลา (แก้ได้เฉพาะตอนยังรออนุมัติ — บังคับด้วย RLS) */
export async function submitLeaveRequest(sessionId: string, studentId: string, reason: string) {
  const { error } = await supabase
    .from('leave_requests')
    .upsert(
      { session_id: sessionId, student_id: studentId, reason, status: 'pending', updated_at: new Date().toISOString() },
      { onConflict: 'session_id,student_id' },
    );
  if (error) throw error;
}

export async function cancelLeaveRequest(requestId: string) {
  const { error } = await supabase.from('leave_requests').delete().eq('id', requestId);
  if (error) throw error;
}

/**
 * ครูตัดสินคำขอลา
 * อนุมัติ = บันทึกการเช็คชื่อเป็น 'ลา' พร้อมเหตุผล แล้วปิดคำขอ
 * ไม่อนุมัติ = ปิดคำขออย่างเดียว สถานะเช็คชื่อคงเดิม
 */
export async function decideLeaveRequest(request: LeaveRequest, approve: boolean, teacherId: string) {
  if (approve) {
    const { error: attErr } = await supabase
      .from('attendance_records')
      .upsert({
        session_id: request.session_id,
        student_id: request.student_id,
        status: 'excused',
        reason: request.reason,
        teacher_override: true,
        override_by: teacherId,
        override_note: 'อนุมัติคำขอลา',
        check_in_time: null,
      }, { onConflict: 'session_id,student_id' });
    if (attErr) throw attErr;
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('leave_requests')
    .update({ status: approve ? 'approved' : 'rejected', decided_by: teacherId, decided_at: now, updated_at: now })
    .eq('id', request.id);
  if (error) throw error;
}
