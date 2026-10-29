import { getErrorMessage } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import {
  MapPin, QrCode, Clock, CheckCircle2, XCircle, AlertCircle,
  Loader2, FileText, RefreshCw, Info, UserCheck, ChevronDown, Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuthStore } from '@/store/authStore';
import { useAttendance, markAbsentOverdue } from '@/hooks/useAttendance';
import { useGPS } from '@/hooks/useGPS';
import { useAllAttendance } from '@/hooks/useAttendance';
import { useStudents } from '@/hooks/useSupabaseQueries';
import { useNow } from '@/hooks/useNow';
import {
  useMyLeaveRequests, useSessionLeaveRequests, submitLeaveRequest, cancelLeaveRequest, decideLeaveRequest,
} from '@/hooks/useLeaveRequests';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  formatThaiDate, formatTime, getDayOfWeekThai, getAttendanceWindowState, getAttendanceOpenTime, getCheckInStatus, getAvatarFallback, getTodayBangkok
} from '@/lib/utils';
import { AttendanceRecord, AttendanceStatus, LeaveRequest, Profile, SessionType, SESSION_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QRCodeSVG } from 'qrcode.react';
import { CheckInSuccessAnimation } from '@/components/CheckInSuccessAnimation';

export default function AttendancePage() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const today = getTodayBangkok();
  const { sessions, myRecords, loading, checkIn, refetch } = useAttendance(today);
  const { lat, lng, distance, inRange, loading: gpsLoading, error: gpsError, schoolLocation, getCurrentPosition } = useGPS();
  const isStudentView = profile?.role === 'student';
  const { data: myLeaves = [] } = useMyLeaveRequests(isStudentView ? profile?.id : undefined, sessions.map(s => s.id));

  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [qrDialog, setQrDialog] = useState<{ open: boolean; sessionId: string; token: string }>({ open: false, sessionId: '', token: '' });

  const isTeacher = profile?.role === 'admin' || profile?.role === 'teacher';
  const now = useNow();

  // Auto-mark absent สำหรับนักเรียนที่ไม่เช็คชื่อหลังหมดเวลา (ทำงานทุก 60 วินาที) — สำรองให้ cron ฝั่ง server
  // รันเฉพาะครู: บัญชีนักเรียนอ่านได้แค่แถวของตัวเอง (RLS) จึงเข้าใจว่าทุกคนยังไม่เช็ค แล้วพยายามบันทึกขาด
  // ให้คนอื่นทั้งวง ซึ่ง RLS ปฏิเสธ (403 ทุกนาทีจากนักเรียนทุกคนที่เปิดหน้านี้)
  useEffect(() => {
    if (!isTeacher) return;
    markAbsentOverdue(today);
    const timer = setInterval(() => markAbsentOverdue(today), 60_000);
    return () => clearInterval(timer);
  }, [today, isTeacher]);

  // Teacher override
  // current = record ตอนเปิด dialog (null = ยังไม่เช็ค) — ใช้ตั้งค่าเริ่มต้น, แสดงสถานะเดิม และย้อนกลับ
  const [overrideDialog, setOverrideDialog] = useState<{ open: boolean; studentId: string; sessionId: string; studentName: string; current: AttendanceRecord | null; leave: LeaveRequest | null } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus | null>(null);
  const openOverride = (sessionId: string, studentId: string, studentName: string, current: AttendanceRecord | null, leave: LeaveRequest | null) => {
    setOverrideDialog({ open: true, studentId, sessionId, studentName, current, leave });
    setOverrideStatus(current?.status ?? null);
    setOverrideNote(current?.override_note ?? '');
  };
  const [overrideNote, setOverrideNote] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
  const [decidingLeave, setDecidingLeave] = useState(false);

  // ครูอนุมัติ = บันทึกเป็น "ลา" พร้อมเหตุผล / ไม่อนุมัติ = ปิดคำขอ สถานะเช็คชื่อคงเดิม
  const handleDecideLeave = async (approve: boolean) => {
    if (!overrideDialog?.leave || !profile) return;
    setDecidingLeave(true);
    try {
      await decideLeaveRequest(overrideDialog.leave, approve, profile.id);
      toast({
        variant: approve ? 'success' : 'default',
        title: approve ? `อนุมัติลา: ${overrideDialog.studentName}` : `ไม่อนุมัติคำขอลาของ ${overrideDialog.studentName}`,
      });
      setOverrideDialog(null);
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    } catch (err) {
      toast({ variant: 'destructive', title: approve ? 'อนุมัติลาไม่สำเร็จ' : 'บันทึกไม่สำเร็จ', description: getErrorMessage(err) });
    } finally {
      setDecidingLeave(false);
    }
  };

  const handleCheckIn = async (sessionId: string) => {
    if (!profile) return;
    // ป้องกัน double-click
    if (checkingIn) return;
    setCheckingIn(sessionId);
    try {
      // ผลตำแหน่งที่ cache ไว้ใช้ได้เฉพาะตอนอยู่ในพื้นที่ — ถ้าเคยนอกพื้นที่/error ให้หาตำแหน่งใหม่ทุกครั้งที่กด
      const gpsData = await getCurrentPosition(!inRange);

      // GPS permission denied → หยุดทันที แสดง toast เดียว
      if (gpsData.error) {
        toast({
          variant: 'destructive',
          title: 'ตรวจสอบตำแหน่งไม่ได้',
          description: gpsData.error,
        });
        return;
      }

      // อยู่นอกพื้นที่ → หยุดทันที
      if (!gpsData.inRange) {
        const locationLabel = schoolLocation?.name || 'พื้นที่กำหนด';
        toast({
          variant: 'destructive',
          title: 'อยู่นอกพื้นที่',
          description: `คุณอยู่ห่างจาก ${locationLabel} ${gpsData.distance} เมตร (อนุญาตสูงสุด ${schoolLocation?.allowedRadius ?? 200} เมตร)`,
        });
        return;
      }

      await checkIn(
        sessionId,
        gpsData.lat ?? undefined,
        gpsData.lng ?? undefined,
        gpsData.inRange,
        gpsData.distance ?? undefined
      );
      toast({ variant: 'success', title: '✓ เช็คชื่อสำเร็จ!', description: 'บันทึกการเข้าร่วมแล้ว' });
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'เช็คชื่อไม่สำเร็จ',
        description: getErrorMessage(err),
      });
    } finally {
      setCheckingIn(null);
    }
  };

  // ย้อนการแก้ไขล่าสุด: คืนค่าแถวเดิม หรือลบแถวทิ้งถ้าก่อนหน้านี้ยังไม่เคยเช็ค
  const undoOverride = async (sessionId: string, studentId: string, studentName: string, previous: AttendanceRecord | null) => {
    const query = supabase.from('attendance_records');
    const { error } = previous
      ? await query.update({
          status: previous.status,
          check_in_time: previous.check_in_time,
          teacher_override: previous.teacher_override,
          override_by: previous.override_by,
          override_note: previous.override_note,
        }).eq('session_id', sessionId).eq('student_id', studentId)
      : await query.delete().eq('session_id', sessionId).eq('student_id', studentId);
    if (error) {
      toast({ variant: 'destructive', title: 'ย้อนกลับไม่สำเร็จ', description: getErrorMessage(error) });
      return;
    }
    toast({ title: `คืนสถานะของ ${studentName} แล้ว` });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const handleTeacherOverride = async () => {
    if (!overrideDialog || !profile || !overrideStatus) return;
    const { sessionId, studentId, studentName, current } = overrideDialog;
    const arrived = overrideStatus === 'present' || overrideStatus === 'late';
    setSavingOverride(true);
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          session_id: sessionId,
          student_id: studentId,
          status: overrideStatus,
          teacher_override: true,
          override_by: profile.id,
          override_note: overrideNote,
          // เก็บเวลาเข้าจริงไว้ถ้ามี (เช่น เช็คด้วย GPS แล้วครูเปลี่ยนเป็นสาย) — ไม่เขียนทับด้วยเวลาที่ครูกดบันทึก
          check_in_time: arrived
            ? (current?.check_in_time ?? (overrideStatus === 'present' ? new Date().toISOString() : null))
            : null,
        }, { onConflict: 'session_id,student_id' });
      if (error) throw error;
      const from = current ? ATTENDANCE_STATUS_LABELS[current.status] : 'ยังไม่เช็ค';
      toast({
        variant: 'success',
        title: `${studentName}: ${from} → ${ATTENDANCE_STATUS_LABELS[overrideStatus]}`,
        action: (
          <ToastAction altText="ย้อนกลับการแก้ไขสถานะ" onClick={() => undoOverride(sessionId, studentId, studentName, current)}>
            ย้อนกลับ
          </ToastAction>
        ),
      });
      setOverrideDialog(null);
      setOverrideNote('');
      // sync กับ Dashboard/Reports ที่ cache สถิติเดียวกันไว้
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    } catch (err) {
      toast({ variant: 'destructive', title: 'บันทึกการแก้ไขสถานะไม่สำเร็จ', description: getErrorMessage(err) });
    } finally {
      setSavingOverride(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-text" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">เช็คชื่อ</h1>
          <p className="text-sm text-muted-foreground">
            วัน{getDayOfWeekThai(now)}ที่ {formatThaiDate(now)}
          </p>
          {/* นโยบายการลา: นักเรียนแจ้งครูเอง ครูเป็นคนบันทึก "ลา" ในระบบ (ไม่มีปุ่มให้นักเรียนตั้งสถานะตัวเอง) */}
          {!isTeacher && (
            <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
              <Info size={14} className="mt-1 shrink-0" />
              <span>ถ้าจะลาหรือมาซ้อมไม่ได้ กด "ขอลา" ในรอบนั้นแล้วพิมพ์เหตุผล จากนั้นแจ้งครูผู้ดูแลให้กดอนุมัติในระบบ</span>
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw size={14} />
          รีเฟรช
        </Button>
      </div>

      {/* No sessions today */}
      {sessions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock size={40} className="mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">ไม่มีรอบซ้อมวันนี้</p>
          </CardContent>
        </Card>
      )}

      {/* Sessions */}
      {sessions.map(session => {
        const windowState = getAttendanceWindowState(session.session_type, session.start_time, session.end_time, now);
        const isOpen = windowState === 'open';
        const myRecord = myRecords.find(r => r.session_id === session.id);

        return (
          <Card key={session.id} className={isOpen ? 'border-brand-500/40 shadow-md' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{SESSION_TYPE_LABELS[session.session_type]}</CardTitle>
                  {isOpen && (
                    <Badge variant="brand" className="motion-safe:animate-pulse text-xs">เปิดเช็คชื่อ</Badge>
                  )}
                  {session.is_override && (
                    <Badge variant="info" className="text-xs">ซ้อมพิเศษ</Badge>
                  )}
                </div>
                {isTeacher && (
                  <Button
                    size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                    onClick={() => setQrDialog({ open: true, sessionId: session.id, token: session.qr_token })}
                  >
                    <QrCode size={13} /> QR Code
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <Clock size={12} />
                {formatTime(session.start_time)} - {formatTime(session.end_time)}
                {session.description && ` • ${session.description}`}
              </p>
            </CardHeader>

            <CardContent>
              {/* Student view */}
              {!isTeacher && (
                <div className="space-y-3">
                  {myRecord ? (
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                      myRecord.status === 'present' ? 'border-success/30 bg-success/5' :
                      myRecord.status === 'late' ? 'border-warning/30 bg-warning/5' :
                      myRecord.status === 'excused' ? 'border-info/30 bg-info/5' :
                      'border-danger/30 bg-danger/5'
                    }`}>
                      {myRecord.status === 'present' ? <CheckCircle2 size={20} className="text-success" /> :
                       myRecord.status === 'late' ? <AlertCircle size={20} className="text-warning" /> :
                       myRecord.status === 'excused' ? <FileText size={20} className="text-info" /> :
                       <XCircle size={20} className="text-danger" />}
                      <div>
                        <p className="text-sm font-medium">{ATTENDANCE_STATUS_LABELS[myRecord.status]}</p>
                        {myRecord.check_in_time && (
                          <p className="text-xs text-muted-foreground">
                            เวลา {new Date(myRecord.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                            {myRecord.gps_verified && ' • ยืนยัน GPS แล้ว'}
                          </p>
                        )}
                        {myRecord.reason && <p className="text-xs text-muted-foreground mt-0.5">เหตุผล: {myRecord.reason}</p>}
                        {myRecord.teacher_override && <Badge variant="info" className="text-xs mt-1">ครูแก้ไขแล้ว</Badge>}
                      </div>
                    </div>
                  ) : (
                    isOpen ? (
                      <div className="space-y-2">
                        <Button
                          className="w-full h-12 gap-2 bg-brand-500 hover:bg-brand-400 text-white text-base"
                          disabled={!!checkingIn}
                          onClick={() => handleCheckIn(session.id)}
                        >
                          {checkingIn === session.id ? (
                            <><Loader2 size={18} className="animate-spin" /> {gpsLoading ? 'กำลังหาตำแหน่ง...' : 'กำลังเช็คชื่อ...'}</>
                          ) : (
                            <><MapPin size={18} /> เช็คชื่อ</>
                          )}
                        </Button>
                        {/* ผลตรวจตำแหน่งล่าสุด — บอกเหตุผลถ้าเช็คไม่ได้ ไม่ต้องกดตรวจแยก */}
                        <p className="text-xs text-muted-foreground" aria-live="polite">
                          {gpsError ? (
                            <span className="text-danger">{gpsError} แล้วกดเช็คชื่ออีกครั้ง</span>
                          ) : lat !== null ? (
                            inRange
                              ? <span className="text-success">อยู่ในพื้นที่ · ห่าง {distance} ม.</span>
                              : <span className="text-danger">อยู่นอกพื้นที่ · ห่าง {distance} ม. (ต้องไม่เกิน {schoolLocation?.allowedRadius ?? 200} ม. จาก{schoolLocation?.name || 'จุดซ้อม'})</span>
                          ) : (
                            'ระบบจะตรวจตำแหน่งให้ตอนกดเช็คชื่อ'
                          )}
                          {getCheckInStatus(session.session_type) === 'late' && (
                            <span className="block text-warning mt-0.5">ตอนนี้เลยเวลามาปกติแล้ว เช็คชื่อจะนับเป็นสาย</span>
                          )}
                        </p>
                      </div>
                    ) : windowState === 'before' ? (
                      <div className="flex h-12 items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground">
                        <Clock size={16} />
                        เปิดเช็คชื่อ {getAttendanceOpenTime(session.session_type, session.start_time) ?? ''} น.
                      </div>
                    ) : null
                  )}

                  {(!myRecord || myRecord.status === 'absent') && profile && (
                    <StudentLeavePanel
                      sessionId={session.id}
                      sessionName={SESSION_TYPE_LABELS[session.session_type]}
                      studentId={profile.id}
                      request={myLeaves.find(l => l.session_id === session.id) ?? null}
                    />
                  )}

                  {windowState === 'after' && !myRecord && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info size={12} />
                      หมดเวลาเช็คชื่อแล้ว — ระบบบันทึกเป็นขาดซ้อม
                    </p>
                  )}
                </div>
              )}

              {/* Teacher view */}
              {isTeacher && (
                <TeacherAttendanceView
                  sessionId={session.id}
                  defaultExpanded={isOpen || sessions.length === 1}
                  onOverride={(studentId, studentName, current, leave) => openOverride(session.id, studentId, studentName, current, leave)}
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* QR Dialog (teacher) */}
      <Dialog open={qrDialog.open} onOpenChange={(o) => !o && setQrDialog({ open: false, sessionId: '', token: '' })}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">QR Code เช็คชื่อ</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="p-4 bg-white rounded-xl">
              <QRCodeSVG
                value={`${window.location.origin}/qr/${qrDialog.token}`}
                size={200}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">ให้นักเรียนสแกน QR Code นี้เพื่อเช็คชื่อ</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teacher override dialog */}
      {overrideDialog && (
        <Dialog open={!!overrideDialog} onOpenChange={(o) => !o && setOverrideDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไขการเช็คชื่อ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-sm">นักเรียน: <span className="font-semibold">{overrideDialog.studentName}</span></p>
                <p className="text-sm text-muted-foreground">
                  สถานะปัจจุบัน: <span className="font-medium text-foreground">
                    {overrideDialog.current ? ATTENDANCE_STATUS_LABELS[overrideDialog.current.status] : 'ยังไม่เช็ค'}
                  </span>
                  {overrideDialog.current?.check_in_time && (
                    <> · เข้า {new Date(overrideDialog.current.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</>
                  )}
                </p>
              </div>
              {overrideDialog.leave?.status === 'pending' && (
                <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
                  <p className="text-sm font-medium">นักเรียนขอลา</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">เหตุผล: {overrideDialog.leave.reason}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-brand-500 hover:bg-brand-400 text-white" disabled={decidingLeave} onClick={() => handleDecideLeave(true)}>
                      {decidingLeave ? <Loader2 size={14} className="animate-spin" /> : null}
                      อนุมัติลา
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" disabled={decidingLeave} onClick={() => handleDecideLeave(false)}>
                      ไม่อนุมัติ
                    </Button>
                  </div>
                </div>
              )}
              <div role="radiogroup" aria-label="สถานะใหม่" className="grid grid-cols-2 gap-2">
                {(['present', 'absent', 'late', 'excused'] as const).map(s => (
                  <Button
                    key={s}
                    role="radio"
                    aria-checked={overrideStatus === s}
                    variant={overrideStatus === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOverrideStatus(s)}
                    className={overrideStatus === s ? 'bg-brand-500 text-white hover:bg-brand-400' : ''}
                  >
                    {ATTENDANCE_STATUS_LABELS[s]}
                    {overrideDialog.current?.status === s && <span className="text-xs opacity-80">(เดิม)</span>}
                  </Button>
                ))}
              </div>
              <Textarea
                placeholder="หมายเหตุ (ถ้ามี)"
                value={overrideNote}
                onChange={e => setOverrideNote(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideDialog(null)}>ยกเลิก</Button>
              <Button
                onClick={handleTeacherOverride}
                disabled={
                  savingOverride || !overrideStatus ||
                  (overrideStatus === overrideDialog.current?.status && overrideNote === (overrideDialog.current?.override_note ?? ''))
                }
                className="bg-brand-500 hover:bg-brand-400 text-white"
              >
                {savingOverride ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <CheckInSuccessAnimation show={showSuccess} onDone={() => setShowSuccess(false)} />
    </div>
  );
}

// ตัวกรองรายชื่อของครู — 4 กลุ่มตามคำถามที่ครูถามจริง "ใครยังไม่มา / ใครมาแล้ว / ใครลา"
type RosterFilter = 'all' | 'missing' | 'here' | 'leave';
const ROSTER_FILTERS: { value: RosterFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'missing', label: 'ยังไม่มา' },
  { value: 'here', label: 'มาแล้ว' },
  { value: 'leave', label: 'ลา' },
];
// ลำดับเริ่มต้น: คนที่ครูต้องจัดการก่อนอยู่บนสุด
// คำขอลารออนุมัติ → ยังไม่เช็ค → ขาด → สาย → ลา → มา
function rosterRank(status: AttendanceStatus | null, pendingLeave: boolean): number {
  if (pendingLeave) return 0;
  if (!status) return 1;
  return { absent: 2, late: 3, excused: 4, present: 5 }[status];
}
function rosterGroup(status: AttendanceStatus | null, pendingLeave: boolean): Exclude<RosterFilter, 'all'> {
  if (pendingLeave || status === 'excused') return 'leave';
  if (status === 'present' || status === 'late') return 'here';
  return 'missing';
}

// รายชื่อไม่อยู่ในกล่อง scroll ซ้อน (เลื่อนยากบนมือถือ) — แสดงต่อกับหน้าเลย แล้วพับ/กางได้ต่อรอบ
// กางไว้ก่อนเฉพาะรอบที่กำลังเปิดเช็คชื่อ (หรือวันที่มีรอบเดียว)
function TeacherAttendanceView({ sessionId, onOverride, defaultExpanded }: { sessionId: string; onOverride: (id: string, name: string, current: AttendanceRecord | null, leave: LeaveRequest | null) => void; defaultExpanded: boolean }) {
  const { data: leaves = [] } = useSessionLeaveRequests(sessionId);
  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  // มีคำขอลารออนุมัติ → กางรายชื่อให้เห็นเลย
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => { if (pendingLeaves.length > 0) setExpanded(true); }, [pendingLeaves.length]);
  const listId = `attendance-list-${sessionId}`;
  const { records, loading: recordsLoading } = useAllAttendance(sessionId);
  // ใช้ cache เดียวกับ StudentsPage/ReportsPage — สลับหน้าไปมาไม่ fetch ซ้ำ
  const { data: allStudents = [], isLoading: studentsLoading } = useStudents({ graduated: false, activeOnly: true });
  const loading = recordsLoading || studentsLoading;

  const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const total = allStudents.length;

  const [filter, setFilter] = useState<RosterFilter>('all');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => allStudents.map(student => {
    const record = records.find(r => r.student_id === student.id) ?? null;
    const leave = leaves.find(l => l.student_id === student.id) ?? null;
    const pendingLeave = leave?.status === 'pending';
    return { student, record, leave, group: rosterGroup(record?.status ?? null, pendingLeave), rank: rosterRank(record?.status ?? null, pendingLeave) };
  }), [allStudents, records, leaves]);
  const counts = useMemo(() => {
    const c = { all: rows.length, missing: 0, here: 0, leave: 0 };
    rows.forEach(r => { c[r.group]++; });
    return c;
  }, [rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(r => filter === 'all' || r.group === filter)
      .filter(r => !q || [r.student.full_name, r.student.nickname, r.student.student_id, r.student.instrument?.name]
        .some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => a.rank - b.rank || (a.student.nickname || a.student.full_name).localeCompare(b.student.nickname || b.student.full_name, 'th'));
  }, [rows, filter, query]);

  // จัดกลุ่มตาม Section แบบที่หัววงนับคนจริง ("Brass 12/18")
  const sectionGroups = useMemo(() => {
    const totals = new Map<string, { here: number; total: number }>();
    rows.forEach(r => {
      const key = r.student.section_id ?? 'none';
      const t = totals.get(key) ?? { here: 0, total: 0 };
      t.total++;
      if (r.group === 'here') t.here++;
      totals.set(key, t);
    });
    const groups = new Map<string, { key: string; name: string; color: string | null; rows: typeof visible }>();
    visible.forEach(r => {
      const key = r.student.section_id ?? 'none';
      if (!groups.has(key)) {
        groups.set(key, { key, name: r.student.section?.name ?? 'ไม่ระบุ Section', color: r.student.section?.color ?? null, rows: [] });
      }
      groups.get(key)!.rows.push(r);
    });
    return [...groups.values()]
      .sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name, 'th')))
      .map(g => ({ ...g, ...(totals.get(g.key) ?? { here: 0, total: 0 }) }));
  }, [rows, visible]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-brand-text" /></div>;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-controls={listId}
        className="flex w-full items-center justify-between gap-3 min-h-11 -mx-2 px-2 rounded-lg text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="text-muted-foreground">
          มาแล้ว <span className="font-semibold text-brand-text tabular-nums">{present} / {total} คน</span>
          {pendingLeaves.length > 0 && <span className="ml-2 font-medium text-warning">· ขอลา {pendingLeaves.length}</span>}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {expanded ? 'ซ่อนรายชื่อ' : 'ดูรายชื่อ'}
          <ChevronDown size={14} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </span>
      </button>

      {expanded && <div id={listId} className="space-y-2">
        <div className="space-y-2">
          <div role="radiogroup" aria-label="กรองรายชื่อ" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {ROSTER_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`min-h-9 coarse:min-h-11 rounded-md px-1 text-xs font-medium transition-colors ${
                  filter === f.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label} <span className="tabular-nums opacity-80">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ ชื่อเล่น รหัส หรือเครื่องดนตรี"
              aria-label="ค้นหานักเรียน"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        {visible.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {query ? `ไม่พบ "${query}"` : filter === 'missing' ? 'มาครบทุกคนแล้ว' : 'ไม่มีนักเรียนในกลุ่มนี้'}
          </p>
        )}

        <div className="space-y-4">
        {sectionGroups.map(group => (
          <section key={group.key} aria-labelledby={`${listId}-${group.key}`} className="space-y-1">
            <h4 id={`${listId}-${group.key}`} className="flex items-center justify-between gap-2 px-2 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {group.color && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />}
                {group.name}
              </span>
              <span className="tabular-nums font-medium">มาแล้ว {group.here}/{group.total}</span>
            </h4>
        <div className="space-y-1.5">
        {group.rows.map(({ student, record, leave }) => {
          return (
            <div key={student.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50">
              <div className="flex items-center gap-2.5">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={student.profile_picture_url || ''} />
                  <AvatarFallback className="text-xs bg-brand-500/20 text-brand-text">
                    {getAvatarFallback(student.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs font-medium leading-tight">{student.nickname || student.full_name.split(' ')[0]}</p>
                  <p className="text-xs text-muted-foreground">{student.instrument?.name || 'ไม่ระบุ'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={!record ? 'outline' : record.status === 'present' ? 'success' : record.status === 'late' ? 'warning' : record.status === 'excused' ? 'info' : 'destructive'}
                  className="text-xs"
                >
                  {!record ? 'ยังไม่เช็ค' : ATTENDANCE_STATUS_LABELS[record.status]}
                </Badge>
                {leave?.status === 'pending' && (
                  <Badge variant="outline" className="text-xs border-warning/50 text-warning">ขอลา</Badge>
                )}
                <Button
                  size="icon-sm" variant="ghost"
                  aria-label={`แก้ไขสถานะของ ${student.full_name}`}
                  onClick={() => onOverride(student.id, student.full_name, record ?? null, leave)}
                >
                  <UserCheck size={13} />
                </Button>
              </div>
            </div>
          );
        })}
        </div>
          </section>
        ))}
        </div>
      </div>}
    </div>
  );
}

// คำขอลาฝั่งนักเรียน: พิมพ์เหตุผล → รอครูอนุมัติ (นักเรียนเปลี่ยนสถานะเช็คชื่อเองไม่ได้)
function StudentLeavePanel({ sessionId, sessionName, studentId, request }: {
  sessionId: string; sessionName: string; studentId: string; request: LeaveRequest | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const fieldId = `leave-reason-${sessionId}`;

  const openDialog = () => { setReason(request?.reason ?? ''); setOpen(true); };

  const handleSubmit = async () => {
    const text = reason.trim();
    if (!text) return;
    setSaving(true);
    try {
      await submitLeaveRequest(sessionId, studentId, text);
      toast({ variant: 'success', title: 'ส่งคำขอลาแล้ว', description: 'แจ้งครูผู้ดูแลให้กดอนุมัติในระบบด้วย' });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    } catch (err) {
      toast({ variant: 'destructive', title: 'ส่งคำขอลาไม่สำเร็จ', description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!request) return;
    setSaving(true);
    try {
      await cancelLeaveRequest(request.id);
      toast({ title: 'ยกเลิกคำขอลาแล้ว' });
      queryClient.invalidateQueries({ queryKey: ['leave'] });
    } catch (err) {
      toast({ variant: 'destructive', title: 'ยกเลิกคำขอลาไม่สำเร็จ', description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {request?.status === 'pending' ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5"><FileText size={15} className="text-warning" /> ส่งคำขอลาแล้ว · รอครูอนุมัติ</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">เหตุผล: {request.reason}</p>
          <p className="text-xs text-muted-foreground">แจ้งครูผู้ดูแลให้กดอนุมัติในระบบ สถานะจะเปลี่ยนเป็น "ลา" เมื่อครูอนุมัติ</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={openDialog} disabled={saving}>แก้ไขเหตุผล</Button>
            <Button size="sm" variant="ghost" className="flex-1 text-danger hover:text-danger" onClick={handleCancel} disabled={saving}>ยกเลิกคำขอ</Button>
          </div>
        </div>
      ) : request?.status === 'rejected' ? (
        <p className="text-xs text-danger flex items-center gap-1"><XCircle size={12} /> ครูไม่อนุมัติคำขอลารอบนี้</p>
      ) : request?.status === 'approved' ? null : (
        <Button variant="outline" className="w-full gap-2" onClick={openDialog}>
          <FileText size={16} /> ขอลา
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ขอลา · {sessionName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor={fieldId}>เหตุผล</Label>
            <Textarea
              id={fieldId}
              placeholder="เช่น ป่วย, ไปธุระกับผู้ปกครอง"
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              rows={4}
              className="resize-none"
              aria-describedby={`${fieldId}-hint`}
            />
            <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
              ส่งแล้วไปแจ้งครูผู้ดูแลให้กดอนุมัติในระบบ สถานะจะเปลี่ยนเป็น "ลา" เมื่อครูอนุมัติ
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={saving || !reason.trim()} className="bg-brand-500 hover:bg-brand-400 text-white">
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              ส่งคำขอลา
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
