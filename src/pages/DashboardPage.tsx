import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, Users, TrendingUp, Calendar,
  Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import {
  formatThaiDate, formatTime, getDayOfWeekThai,
  isWithinAttendanceWindow, getTodayBangkok, getBangkokDateWithOffset
} from '@/lib/utils';
import { PracticeSession, AttendanceRecord, SESSION_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const [todaySessions, setTodaySessions] = useState<PracticeSession[]>([]);
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0, excused: 0 });
  const [weeklyData, setWeeklyData] = useState<{ day: string; มาซ้อม: number; ขาดซ้อม: number }[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = getTodayBangkok();
  const isTeacher = profile?.role === 'admin' || profile?.role === 'teacher';

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Today's sessions
      const { data: sessions } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('date', today)
        .order('start_time');
      setTodaySessions(sessions || []);

      // My attendance records
      if (!isTeacher) {
        const { data: records } = await supabase
          .from('attendance_records')
          .select('*, session:practice_sessions(*)')
          .eq('student_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setMyRecords(records || []);

        // Stats
        const { data: allRecords } = await supabase
          .from('attendance_records')
          .select('status')
          .eq('student_id', profile.id);
        if (allRecords) {
          const s = { total: allRecords.length, present: 0, absent: 0, late: 0, excused: 0 };
          allRecords.forEach(r => { s[r.status as keyof typeof s]++; });
          setStats(s);
        }
      } else {
        // Teacher: get total students & today's stats
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student')
          .eq('is_active', true)
          .eq('is_graduated', false);
        setTotalStudents(count || 0);

        // Today attendance summary
        if (sessions && sessions.length > 0) {
          const { data: todayRecs } = await supabase
            .from('attendance_records')
            .select('status')
            .in('session_id', sessions.map(s => s.id));
          if (todayRecs) {
            const s = { total: todayRecs.length, present: 0, absent: 0, late: 0, excused: 0 };
            todayRecs.forEach(r => { s[r.status as keyof typeof s]++; });
            setStats(s);
          }
        }
      }

      // Weekly chart data (last 7 days) — อิงเวลาไทย
      const days = Array.from({ length: 7 }, (_, i) => getBangkokDateWithOffset(-(6 - i)));

      const chartData = await Promise.all(days.map(async (d) => {
        const dayLabel = getDayOfWeekThai(d);
        // For all roles: get sessions for this day, then get attendance
        const { data: daySessions } = await supabase
          .from('practice_sessions').select('id').eq('date', d);
        if (!daySessions?.length) return { day: dayLabel, 'มาซ้อม': 0, 'ขาดซ้อม': 0 };
        
        const sessionIds = daySessions.map(s => s.id);
        const { data } = !isTeacher
          ? await supabase.from('attendance_records').select('status').in('session_id', sessionIds).eq('student_id', profile.id)
          : await supabase.from('attendance_records').select('status').in('session_id', sessionIds);
        const present = data?.filter(r => r.status === 'present' || r.status === 'late').length || 0;
        return { day: dayLabel, 'มาซ้อม': present, 'ขาดซ้อม': data ? data.length - present : 0 };
      }));
      setWeeklyData(chartData);
    } finally {
      setLoading(false);
    }
  };

  const presentRate = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  const now = new Date();

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
        <Link to="/attendance">
          <Button variant="gold" size="sm" className="gap-1.5">
            <ClipboardCheck size={15} />
            <span className="hidden sm:inline">เช็คชื่อ</span>
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">มาซ้อม</span>
              <CheckCircle2 size={16} className="text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-400">{stats.present}</p>
            {isTeacher && <p className="text-xs text-muted-foreground mt-0.5">ครั้ง</p>}
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">ขาด</span>
              <XCircle size={16} className="text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-400">{stats.absent}</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">มาสาย</span>
              <AlertCircle size={16} className="text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-yellow-400">{stats.late}</p>
          </CardContent>
        </Card>

        <Card className="bg-brand-500/5 border-brand-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                {isTeacher ? 'นักเรียน' : 'อัตราเข้าร่วม'}
              </span>
              {isTeacher ? <Users size={16} className="text-brand-400" /> : <TrendingUp size={16} className="text-brand-400" />}
            </div>
            <p className="text-2xl font-bold text-brand-400">
              {isTeacher ? totalStudents : `${presentRate}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's sessions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-brand-400" />
              รอบซ้อมวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {todaySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ไม่มีรอบซ้อมวันนี้</p>
            ) : (
              todaySessions.map(session => {
                const isOpen = isWithinAttendanceWindow(session.session_type, undefined, session.start_time, session.end_time);
                const myRecord = myRecords.find(r => r.session_id === session.id);
                return (
                  <div key={session.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOpen ? 'border-brand-500/30 bg-brand-500/5' : 'border-border bg-muted/30'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{SESSION_TYPE_LABELS[session.session_type]}</span>
                        {isOpen && (
                          <Badge variant="gold" className="text-[9px] px-1.5 py-0 h-4 animate-pulse">
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
                      ) : (
                        <Link to="/attendance">
                          <Button size="sm" variant="outline" className="h-7 text-xs">เช็คชื่อ</Button>
                        </Link>
                      )
                    )}
                    {isTeacher && (
                      <Link to="/attendance">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          ดูผล <ChevronRight size={12} />
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Attendance rate + chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-400" />
              สถิติ 7 วัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isTeacher && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-muted-foreground">อัตราเข้าร่วม</span>
                  <span className="text-sm font-bold text-brand-400">{presentRate}%</span>
                </div>
                <Progress value={presentRate} className="h-2" />
              </div>
            )}
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#666' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="มาซ้อม" stroke="#22c55e" fill="url(#presentGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="ขาดซ้อม" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="3 3" />
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
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-brand-400">
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
    </div>
  );
}
