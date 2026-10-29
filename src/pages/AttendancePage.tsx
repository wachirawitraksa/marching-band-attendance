import { getErrorMessage } from '@/lib/utils';
import { useState, useEffect } from 'react';
import {
  MapPin, QrCode, Clock, CheckCircle2, XCircle, AlertCircle,
  Loader2, FileText, Navigation, RefreshCw, Info, UserCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuthStore } from '@/store/authStore';
import { useAttendance, markAbsentOverdue } from '@/hooks/useAttendance';
import { useGPS } from '@/hooks/useGPS';
import { useAllAttendance } from '@/hooks/useAttendance';
import { useStudents } from '@/hooks/useSupabaseQueries';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import {
  formatThaiDate, formatTime, getDayOfWeekThai, isWithinAttendanceWindow, isPastAttendanceWindow, getAvatarFallback, getTodayBangkok
} from '@/lib/utils';
import { AttendanceRecord, Profile, SessionType, SESSION_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QRCodeSVG } from 'qrcode.react';
import { CheckInSuccessAnimation } from '@/components/CheckInSuccessAnimation';

export default function AttendancePage() {
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const today = getTodayBangkok();
  const { sessions, myRecords, loading, checkIn, submitReason, refetch } = useAttendance(today);
  const { lat, lng, distance, inRange, loading: gpsLoading, error: gpsError, schoolLocation, getCurrentPosition } = useGPS();

  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<{ open: boolean; sessionId: string; sessionName: string }>({ open: false, sessionId: '', sessionName: '' });
  const [reason, setReason] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);
  const [qrDialog, setQrDialog] = useState<{ open: boolean; sessionId: string; token: string }>({ open: false, sessionId: '', token: '' });

  const isTeacher = profile?.role === 'admin' || profile?.role === 'teacher';
  const now = new Date();

  // Auto-mark absent สำหรับนักเรียนที่ไม่เช็คชื่อหลังหมดเวลา (ทำงานทุก 60 วินาที)
  useEffect(() => {
    markAbsentOverdue(today);
    const timer = setInterval(() => markAbsentOverdue(today), 60_000);
    return () => clearInterval(timer);
  }, [today]);

  // Teacher override
  const [overrideDialog, setOverrideDialog] = useState<{ open: boolean; studentId: string; sessionId: string; studentName: string } | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [overrideNote, setOverrideNote] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const handleCheckIn = async (sessionId: string) => {
    if (!profile) return;
    // ป้องกัน double-click
    if (checkingIn) return;
    setCheckingIn(sessionId);
    try {
      const gpsData = await getCurrentPosition();

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

  const handleSubmitReason = async () => {
    if (!reason.trim()) { toast({ variant: 'destructive', title: 'กรุณากรอกเหตุผล' }); return; }
    setSubmittingReason(true);
    try {
      await submitReason(reasonDialog.sessionId, reason.trim());
      setReasonDialog({ open: false, sessionId: '', sessionName: '' });
      setReason('');
      toast({ variant: 'success', title: 'บันทึกเหตุผลแล้ว' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'บันทึกเหตุผลไม่สำเร็จ', description: getErrorMessage(err) });
    } finally {
      setSubmittingReason(false);
    }
  };

  const handleTeacherOverride = async () => {
    if (!overrideDialog || !profile) return;
    setSavingOverride(true);
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          session_id: overrideDialog.sessionId,
          student_id: overrideDialog.studentId,
          status: overrideStatus,
          teacher_override: true,
          override_by: profile.id,
          override_note: overrideNote,
          check_in_time: overrideStatus === 'present' ? new Date().toISOString() : null,
        }, { onConflict: 'session_id,student_id' });
      if (error) throw error;
      toast({ variant: 'success', title: 'บันทึกแล้ว' });
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

  // helper สำหรับแสดง message ที่ถูกต้อง
  const isPastWindow = (sessionType: SessionType) =>
    isPastAttendanceWindow(sessionType);

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
          <h3>หากลา ให้แจ้งครู</h3>
          <p className="text-sm text-muted-foreground">
            วัน{getDayOfWeekThai(now)}ที่ {formatThaiDate(now)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw size={14} />
          รีเฟรช
        </Button>
      </div>

      {/* GPS status (student) */}
      {!isTeacher && (
        <>
          <Alert variant={inRange ? 'success' : gpsError ? 'destructive' : 'info'}>
            <Navigation size={16} />
            <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
              <span className="break-words">
                {gpsLoading ? 'กำลังตรวจสอบตำแหน่ง...' :
                  gpsError ? gpsError :
                  lat ? (inRange ? `อยู่ในพื้นที่ (${distance} ม.)` : `นอกพื้นที่ (${distance} ม. จาก ${schoolLocation?.name || 'พื้นที่กำหนด'}`) :
                    'กดเพื่อตรวจสอบตำแหน่ง GPS'}
              </span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => getCurrentPosition(true)} disabled={gpsLoading}>
                {gpsLoading ? <Loader2 size={12} className="animate-spin" /> : 'ตรวจสอบ'}
              </Button>
            </AlertDescription>
          </Alert>
          {gpsError && (
            <p className="text-xs text-muted-foreground">
              หากยังไม่ได้รับอนุญาต ให้ตรวจสอบการตั้งค่าเบราว์เซอร์และอนุญาตตำแหน่งสำหรับเว็บไซต์นี้ บน Netlify จะต้องอยู่บน HTTPS เท่านั้น
            </p>
          )}
        </>
      )}

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
        const isOpen = isWithinAttendanceWindow(session.session_type);
        const myRecord = myRecords.find(r => r.session_id === session.id);

        return (
          <Card key={session.id} className={isOpen ? 'border-brand-500/40 shadow-md' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{SESSION_TYPE_LABELS[session.session_type]}</CardTitle>
                  {isOpen && (
                    <Badge variant="gold" className="motion-safe:animate-pulse text-xs">เปิดเช็คชื่อ</Badge>
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
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        className="flex-1 gap-2 bg-brand-500 hover:bg-brand-400 text-white"
                        disabled={!isOpen || !!checkingIn}
                        onClick={() => handleCheckIn(session.id)}
                      >
                        {checkingIn === session.id ? (
                          <><Loader2 size={16} className="animate-spin" /> กำลังเช็คชื่อ...</>
                        ) : (
                          <><MapPin size={16} /> เช็คชื่อ (GPS)</>
                        )}
                      </Button>
                      {!isOpen && isTeacher && (
                        <Button
                          variant="outline" className="flex-1 gap-2"
                          onClick={() => setReasonDialog({ open: true, sessionId: session.id, sessionName: SESSION_TYPE_LABELS[session.session_type] })}
                        >
                          <FileText size={16} /> แจ้งเหตุผลไม่มา
                        </Button>
                      )}
                    </div>
                  )}

                  {!isOpen && !myRecord && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info size={12} />
                      {isPastWindow(session.session_type)
                        ? 'หมดเวลาเช็คชื่อแล้ว — ระบบบันทึกเป็นขาดซ้อม'
                        : 'ยังไม่ถึงเวลาเช็คชื่อ'}
                    </p>
                  )}
                </div>
              )}

              {/* Teacher view */}
              {isTeacher && (
                <TeacherAttendanceView
                  sessionId={session.id}
                  onOverride={(studentId, studentName) =>
                    setOverrideDialog({ open: true, studentId, sessionId: session.id, studentName })
                  }
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Reason dialog */}
      <Dialog open={reasonDialog.open} onOpenChange={(o) => !o && setReasonDialog({ open: false, sessionId: '', sessionName: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แจ้งเหตุผลไม่เข้าร่วม</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">รอบ: {reasonDialog.sessionName}</p>
            <Textarea
              placeholder="กรอกเหตุผลที่ไม่สามารถเข้าร่วมได้..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog({ open: false, sessionId: '', sessionName: '' })}>ยกเลิก</Button>
            <Button onClick={handleSubmitReason} disabled={submittingReason} className="bg-brand-500 hover:bg-brand-400 text-white">
              {submittingReason ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <p className="text-sm">นักเรียน: <span className="font-semibold">{overrideDialog.studentName}</span></p>
              <div className="grid grid-cols-2 gap-2">
                {(['present', 'absent', 'late', 'excused'] as const).map(s => (
                  <Button
                    key={s}
                    variant={overrideStatus === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setOverrideStatus(s)}
                    className={overrideStatus === s ? 'bg-brand-500 text-black hover:bg-brand-400' : ''}
                  >
                    {ATTENDANCE_STATUS_LABELS[s]}
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
              <Button onClick={handleTeacherOverride} disabled={savingOverride} className="bg-brand-500 hover:bg-brand-400 text-white">
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

function TeacherAttendanceView({ sessionId, onOverride }: { sessionId: string; onOverride: (id: string, name: string) => void }) {
  const { records, loading: recordsLoading } = useAllAttendance(sessionId);
  // ใช้ cache เดียวกับ StudentsPage/ReportsPage — สลับหน้าไปมาไม่ fetch ซ้ำ
  const { data: allStudents = [], isLoading: studentsLoading } = useStudents({ graduated: false, activeOnly: true });
  const loading = recordsLoading || studentsLoading;

  const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const total = allStudents.length;

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-brand-text" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">มาแล้ว</span>
        <span className="font-semibold text-brand-text">{present} / {total} คน</span>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {allStudents.map(student => {
          const record = records.find(r => r.student_id === student.id);
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
                <Button
                  size="icon-sm" variant="ghost"
                  aria-label={`แก้ไขสถานะของ ${student.full_name}`}
                  onClick={() => onOverride(student.id, student.full_name)}
                >
                  <UserCheck size={13} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}