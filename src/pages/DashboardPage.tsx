import { getErrorMessage } from '@/lib/utils';
import { splitRdExempt } from '@/lib/attendanceExemption';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, Users, TrendingUp, Calendar,
  Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight, Flame, Award, MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useAttendance } from '@/hooks/useAttendance';
import { useGPS } from '@/hooks/useGPS';
import { useNow } from '@/hooks/useNow';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { CheckInSuccessAnimation } from '@/components/CheckInSuccessAnimation';
import {
  formatThaiDate, formatTime, getDayOfWeekThai,
  getAttendanceWindowState, getAttendanceOpenTime, getCheckInStatus, getTodayBangkok, getBangkokDateWithOffset
} from '@/lib/utils';
import { SESSION_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  useSessionsByDate, useMyAttendance, useMyAttendanceStats,
  useStudents, useWeeklyAttendance, useTodayAttendanceSummary,
  useStudentStreak, useStudentBadges,
} from '@/hooks/useSupabaseQueries';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const today = getTodayBangkok();
  const isTeacher = profile?.role === 'admin' || profile?.role === 'teacher';
  const [checkingIn, setCheckingIn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ทุก hook ด้านล่างนี้ cache ผ่าน React Query — สลับหน้าไป/กลับมาไม่ fetch ซ้ำ
  const { data: todaySessions = [], isLoading: sessionsLoading } = useSessionsByDate(today);

  const { data: myRecords = [] } = useMyAttendance(!isTeacher ? profile?.id : undefined, 20);
  const { data: studentStats } = useMyAttendanceStats(!isTeacher ? profile?.id : undefined);
  const { data: streak } = useStudentStreak(!isTeacher ? profile?.id : undefined);
  const { data: badges = [] } = useStudentBadges(!isTeacher ? profile?.id : undefined);

  // รายชื่อ (cache เดียวกับหน้าเช็คชื่อ) — ใช้หาตัวหารต่อรอบ: คาบบ่ายวันพฤหัสไม่นับคนที่ไป ร.ด.
  const { data: activeStudents = [] } = useStudents({ graduated: false, activeOnly: true });
  const todaySessionIds = todaySessions.map((s) => s.id);
  const { data: teacherTodayStats } = useTodayAttendanceSummary(isTeacher ? todaySessionIds : []);

  // เช็คชื่อด่วนจากหน้าแรก — ใช้ hook เดียวกับหน้า Attendance เพื่อ logic ตรงกันเป๊ะ
  const { checkIn } = useAttendance(today);
  const { getCurrentPosition, schoolLocation, inRange } = useGPS();
  const queryClient = useQueryClient();

  const days = Array.from({ length: 7 }, (_, i) => getBangkokDateWithOffset(-(6 - i)));
  const { data: weeklyRaw = [] } = useWeeklyAttendance(days, profile?.id, isTeacher);
  const weeklyData = weeklyRaw.map((d) => ({
    day: getDayOfWeekThai(d.day),
    'มาซ้อม': d.present,
    'ขาดซ้อม': d.absent,
  }));

  const stats = studentStats ?? { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
  const loading = sessionsLoading;

  const presentRate = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  const now = useNow();

  // session ที่เปิดอยู่ตอนนี้ และนักเรียนยังไม่ได้เช็คชื่อ
  const openSession = !isTeacher
    ? todaySessions.find((s) => {
        const isOpen = getAttendanceWindowState(s.session_type, s.start_time, s.end_time, now) === 'open';
        const already = myRecords.find((r) => r.session_id === s.id);
        return isOpen && !already;
      })
    : undefined;

  const handleQuickCheckIn = async () => {
    if (!openSession || checkingIn) return;
    setCheckingIn(true);
    try {
      // ใช้ตำแหน่งที่จำไว้เฉพาะถ้าครั้งก่อนอยู่ในพื้นที่ (เหมือนหน้าเช็คชื่อ)
      const gpsData = await getCurrentPosition(!inRange);

      if (gpsData.error) {
        toast({ variant: 'destructive', title: 'ตรวจสอบตำแหน่งไม่ได้', description: gpsData.error });
        return;
      }
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
        openSession.id,
        gpsData.lat ?? undefined,
        gpsData.lng ?? undefined,
        gpsData.inRange,
        gpsData.distance ?? undefined
      );
      setShowSuccess(true);
      // ให้การ์ด "เปิดอยู่" หายและรายการรอบวันนี้แสดงสถานะใหม่ทันที
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'เช็คชื่อไม่สำเร็จ',
        description: getErrorMessage(err),
      });
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            สวัสดี{profile?.nickname ? `, ${profile.nickname}` : profile?.full_name?.split(' ')[0] ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            วัน{getDayOfWeekThai(now)}ที่ {formatThaiDate(now)}
          </p>
        </div>
      </div>

      {/* เช็คชื่อด่วน — โชว์เฉพาะตอนมี session เปิดอยู่และยังไม่ได้เช็ค */}
      {!isTeacher && openSession && (
        <Card className="border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="brand" className="text-xs px-1.5 py-0 h-5 motion-safe:animate-pulse">เปิดอยู่</Badge>
                <span className="text-sm font-semibold">{SESSION_TYPE_LABELS[openSession.session_type]}</span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin size={10} /> เช็คชื่อได้ทันทีถ้าอยู่ในพื้นที่
              </p>
              {getCheckInStatus(openSession.session_type) === 'late' && (
                <p className="text-xs text-warning mt-0.5">ตอนนี้เลยเวลามาปกติแล้ว เช็คชื่อจะนับเป็นสาย</p>
              )}
            </div>
            <Button
              variant="brand"
              className="gap-1.5 shrink-0"
              onClick={handleQuickCheckIn}
              disabled={checkingIn}
            >
              {checkingIn ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ClipboardCheck size={16} />
              )}
              เช็คชื่อเลย
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Streak + badge — ให้กำลังใจนักเรียน */}
      {!isTeacher && (streak?.current_streak ?? 0) > 0 && (
        <Card className="bg-gradient-to-br from-brand-500/10 to-transparent border-brand-500/20">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-brand-500/15 flex items-center justify-center">
                <Flame size={20} className="text-brand-text" />
              </div>
              <div>
                <p className="text-sm font-bold text-brand-text">มาซ้อมต่อเนื่อง {streak?.current_streak} ครั้งติด!</p>
                <p className="text-xs text-muted-foreground">สถิติสูงสุด {streak?.longest_streak} ครั้ง</p>
              </div>
            </div>
            {badges.length > 0 && (
              <div className="flex items-center gap-1.5">
                {badges.slice(0, 4).map((b) => (
                  <div key={b.badge.code} title={b.badge.name} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-base">
                    {b.badge.icon || <Award size={14} className="text-brand-text" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ครู: สรุปทีละรอบ (มาแล้วกี่คน / สาย / ยังไม่เช็คหรือขาด / ลา) แทนตัวเลขรวมทุกรอบ */}
      {isTeacher && (
        <section aria-labelledby="today-heading" className="space-y-2">
          <h2 id="today-heading" className="text-sm font-medium text-muted-foreground">รอบซ้อมวันนี้</h2>
          {sessionsLoading ? (
            <div className="h-28 rounded-lg bg-muted animate-pulse" />
          ) : todaySessions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">ไม่มีรอบซ้อมวันนี้</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {todaySessions.map(session => {
                const windowState = getAttendanceWindowState(session.session_type, session.start_time, session.end_time, now);
                const c = teacherTodayStats?.bySession[session.id] ?? { total: 0, present: 0, absent: 0, late: 0, excused: 0 };
                const here = c.present + c.late;
                const { expected, exempt } = splitRdExempt(session, activeStudents);
                const totalStudents = expected.length;
                const notChecked = Math.max(0, totalStudents - c.total);
                const pct = totalStudents > 0 ? Math.round((here / totalStudents) * 100) : 0;
                return (
                  <Card key={session.id} className={windowState === 'open' ? 'border-brand-500/40' : ''}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{SESSION_TYPE_LABELS[session.session_type]}</p>
                            {windowState === 'open' && <Badge variant="brand" className="text-xs px-1.5 py-0 h-5">เปิดเช็คชื่อ</Badge>}
                            {windowState === 'after' && <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">ปิดแล้ว</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock size={10} /> {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </p>
                        </div>
                        <Link to={`/attendance?session=${session.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                            ดูรายชื่อ <ChevronRight size={12} />
                          </Button>
                        </Link>
                      </div>

                      {windowState === 'before' ? (
                        <p className="text-sm text-muted-foreground">
                          เปิดเช็คชื่อ {getAttendanceOpenTime(session.session_type, session.start_time)} น.
                        </p>
                      ) : (
                        <>
                          <div>
                            <p className="text-2xl font-bold tabular-nums">
                              {here}<span className="text-base font-medium text-muted-foreground">/{totalStudents}</span>
                              <span className="ml-2 text-sm font-medium text-muted-foreground">มาแล้ว</span>
                            </p>
                            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden" role="presentation">
                              <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            <span className="text-warning">สาย {c.late}</span>
                            {' · '}
                            {windowState === 'open'
                              ? <span>ยังไม่เช็ค {notChecked}</span>
                              : <span className="text-danger">ขาด {c.absent + notChecked}</span>}
                            {' · '}
                            <span className="text-info">ลา {c.excused}</span>
                            {exempt.length > 0 && <span className="text-muted-foreground"> · ไป ร.ด. {exempt.length} (ไม่นับ)</span>}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* นักเรียน: สถิติสะสมของตัวเอง */}
      {!isTeacher && (
      <section aria-labelledby="stats-heading" className="space-y-2">
      <h2 id="stats-heading" className="text-sm font-medium text-muted-foreground">สถิติของฉัน · ทั้งหมด</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">มาซ้อม</span>
              <CheckCircle2 size={16} className="text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{stats.present}</p>
          </CardContent>
        </Card>

        <Card className="bg-danger/5 border-danger/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">ขาด</span>
              <XCircle size={16} className="text-danger" />
            </div>
            <p className="text-2xl font-bold text-danger">{stats.absent}</p>
          </CardContent>
        </Card>

        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">มาสาย</span>
              <AlertCircle size={16} className="text-warning" />
            </div>
            <p className="text-2xl font-bold text-warning">{stats.late}</p>
          </CardContent>
        </Card>

        <Card className="bg-brand-500/5 border-brand-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">อัตราเข้าร่วม</span>
              <TrendingUp size={16} className="text-brand-text" />
            </div>
            <p className="text-2xl font-bold text-brand-text">{presentRate}%</p>
          </CardContent>
        </Card>
      </div>
      </section>
      )}

      <div className={`grid gap-4 ${isTeacher ? '' : 'md:grid-cols-2'}`}>
        {/* Today's sessions (นักเรียน — ครูดูจากแถวต่อรอบด้านบน) */}
        {!isTeacher && <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-brand-text" />
              รอบซ้อมวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {todaySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ไม่มีรอบซ้อมวันนี้</p>
            ) : (
              todaySessions.map(session => {
                const windowState = getAttendanceWindowState(session.session_type, session.start_time, session.end_time, now);
                const isOpen = windowState === 'open';
                const myRecord = myRecords.find(r => r.session_id === session.id);
                return (
                  <div key={session.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOpen ? 'border-brand-500/30 bg-brand-500/5' : 'border-border bg-muted/30'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{SESSION_TYPE_LABELS[session.session_type]}</span>
                        {isOpen && (
                          <Badge variant="brand" className="text-xs px-1.5 py-0 h-5 motion-safe:animate-pulse">
                            เปิดอยู่
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </p>
                    </div>
                    {!isTeacher && (
                      myRecord ? (
                        <Badge variant={myRecord.status === 'present' ? 'success' : myRecord.status === 'late' ? 'warning' : myRecord.status === 'excused' ? 'info' : 'destructive'}>
                          {ATTENDANCE_STATUS_LABELS[myRecord.status]}
                        </Badge>
                      ) : isOpen ? (
                        <Link to="/attendance">
                          <Button size="sm" variant="brand" className="h-7 text-xs">เช็คชื่อ</Button>
                        </Link>
                      ) : windowState === 'before' ? (
                        <span className="text-xs text-muted-foreground">เปิด {getAttendanceOpenTime(session.session_type, session.start_time)} น.</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">หมดเวลาเช็คชื่อ</span>
                      )
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>}

        {/* Attendance rate + chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-text" />
              สถิติ 7 วัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="มาซ้อม" stroke="hsl(var(--success))" fill="url(#presentGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="ขาดซ้อม" stroke="hsl(var(--danger))" fill="none" strokeWidth={1.5} strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent records (student) */}
      {!isTeacher && myRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">ประวัติล่าสุด</CardTitle>
              <Link to="/reports">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-brand-text">
                  ดูทั้งหมด <ChevronRight size={12} />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myRecords.slice(0, 5).map(record => (
                <div key={record.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm">{record.session?.description || SESSION_TYPE_LABELS[record.session?.session_type || 'morning']}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.session?.date ? formatThaiDate(record.session.date) : ''} •{' '}
                      {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '-'}
                    </p>
                  </div>
                  <Badge variant={record.status === 'present' ? 'success' : record.status === 'late' ? 'warning' : record.status === 'excused' ? 'info' : 'destructive'}>
                    {ATTENDANCE_STATUS_LABELS[record.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CheckInSuccessAnimation show={showSuccess} onDone={() => setShowSuccess(false)} />
    </div>
  );
}