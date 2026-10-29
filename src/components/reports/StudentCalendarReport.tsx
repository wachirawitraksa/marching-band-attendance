import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentAllAttendance, useStudentMonthAttendance } from '@/hooks/useSupabaseQueries';
import { filterOutRdExempt, shouldExcludeFromStats } from '@/lib/attendanceExemption';
import { Profile, AttendanceRecord, ATTENDANCE_STATUS_LABELS, SESSION_TYPE_LABELS } from '@/types';
import { getAvatarFallback, calculateAttendanceRate, formatTime, getAcademicYearOf, getCurrentAcademicYear, getTodayBangkok } from '@/lib/utils';

interface Props {
  student: Profile;
  onClose: () => void;
}

interface DayRecord {
  date: string;
  sessions: {
    session: { id: string; date: string; session_type: string; start_time: string; end_time: string; description: string | null };
    record: AttendanceRecord | null;
  }[];
}

const STATUS_COLOR: Record<string, string> = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
  late: 'bg-yellow-500',
  excused: 'bg-blue-500',
  rd: 'bg-gray-400',
  none: 'bg-muted',
};

const STATUS_BG: Record<string, string> = {
  present: 'bg-success/10 border-success/30 text-success',
  absent: 'bg-danger/10 border-danger/30 text-danger',
  late: 'bg-warning/10 border-warning/30 text-warning',
  excused: 'bg-info/10 border-info/30 text-info',
  rd: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
};

export function StudentCalendarReport({ student, onClose }: Props) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState(String(getCurrentAcademicYear()));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // ทุกอย่าง cache ผ่าน React Query — เปิดซ้ำหรือเลื่อนเดือนไปมาไม่ fetch ใหม่
  const { data: allRecords = [] } = useStudentAllAttendance(student.id);
  const { data: monthData, isLoading: loading } = useStudentMonthAttendance(student.id, year, month);

  const dayRecords: Record<string, DayRecord> = {};
  (monthData?.sessions ?? []).forEach((session) => {
    if (!dayRecords[session.date]) dayRecords[session.date] = { date: session.date, sessions: [] };
    const record = (monthData?.records ?? []).find((r) => r.session_id === session.id) || null;
    dayRecords[session.date].sessions.push({ session, record });
  });

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = firstDay === 0 ? 6 : firstDay - 1; // Mon-start grid

  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const getDayStatus = (day: number): string => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dr = dayRecords[dateStr];
    if (!dr) return 'none';
    // ตัด session ที่เป็นช่วง ร.ด. ของนักเรียนคนนี้ออกก่อน (ไม่นับว่าขาด)
    const countedSessions = dr.sessions.filter(s => !shouldExcludeFromStats({ ...s.session, session_type: s.session.session_type as any }, student));
    if (countedSessions.length === 0) return dr.sessions.length > 0 ? 'rd' : 'none';
    const statuses = countedSessions.map(s => s.record?.status || 'absent');
    if (statuses.every(s => s === 'present')) return 'present';
    if (statuses.some(s => s === 'absent')) return 'absent';
    if (statuses.some(s => s === 'late')) return 'late';
    if (statuses.every(s => s === 'excused')) return 'excused';
    return 'none';
  };

  const hasSession = (day: number): boolean => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return !!dayRecords[dateStr];
  };

  const today = getTodayBangkok();
  const todayNum = new Date().getDate();
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();

  // Overall stats (ตามปีการศึกษาที่เลือก)
  const scopedRecords = filterOutRdExempt(allRecords, student).filter(r =>
    filterYear === 'all' || (!!r.session && String(getAcademicYearOf(r.session.date)) === filterYear)
  );
  const totalPresent = scopedRecords.filter(r => r.status === 'present').length;
  const totalLate = scopedRecords.filter(r => r.status === 'late').length;
  const totalAbsent = scopedRecords.filter(r => r.status === 'absent').length;
  const totalExcused = scopedRecords.filter(r => r.status === 'excused').length;
  const totalAll = scopedRecords.length;
  const rate = calculateAttendanceRate(totalPresent + totalLate, totalAll);

  // ปีการศึกษาที่มีข้อมูล (รวมปีปัจจุบันเสมอ) เรียงจากใหม่ไปเก่า
  const availableYears = Array.from(new Set([
    getCurrentAcademicYear(),
    ...allRecords.filter(r => r.session).map(r => getAcademicYearOf(r.session!.date)),
  ])).sort((a, b) => b - a);

  // เปลี่ยนปีการศึกษา → กระโดดปฏิทินไปยังปีนั้น (ไม่เกินเดือนปัจจุบัน)
  const handleYearChange = (value: string) => {
    setFilterYear(value);
    setSelectedDay(null);
    if (value === 'all') return;
    const startCE = parseInt(value, 10) - 543; // ปีการศึกษาเริ่มเดือนพฤษภาคม (เดือน index 4)
    const target = new Date(startCE, 4, 1);
    const now = new Date();
    setViewDate(target > now ? now : target);
  };

  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selectedDayRecord = selectedDateStr ? dayRecords[selectedDateStr] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl animate-fade-in my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={student.profile_picture_url || ''} alt={student.full_name} />
              <AvatarFallback className="bg-brand-500/20 text-brand-text font-semibold">
                {getAvatarFallback(student.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-sm">{student.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {student.nickname && `"${student.nickname}" • `}
                {student.instrument?.name || 'ไม่ระบุเครื่อง'}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="ปิดรายงาน" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Academic year selector */}
          <Select value={filterYear} onValueChange={handleYearChange}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกปีการศึกษา</SelectItem>
              {availableYears.map(y => <SelectItem key={y} value={String(y)}>ปีการศึกษา {y}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'มา', value: totalPresent, color: 'text-success', bg: 'bg-success/10' },
              { label: 'สาย', value: totalLate, color: 'text-warning', bg: 'bg-warning/10' },
              { label: 'ขาด', value: totalAbsent, color: 'text-danger', bg: 'bg-danger/10' },
              { label: 'ลา', value: totalExcused, color: 'text-info', bg: 'bg-info/10' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-lg p-2 text-center`}>
                <p className={`text-lg font-bold leading-none ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Attendance rate bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">
                อัตราเข้าร่วม ({filterYear === 'all' ? 'รวมทั้งหมด' : `ปีการศึกษา ${filterYear}`})
              </span>
              <span className={`font-bold ${rate >= 80 ? 'text-success' : rate >= 60 ? 'text-warning' : 'text-danger'}`}>{rate}%</span>
            </div>
            <Progress value={rate} className="h-2" />
          </div>

          {/* Month navigator */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="เดือนก่อนหน้า" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-semibold">
              {thaiMonths[month]} {year + 543}
            </span>
            <Button
              variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="เดือนถัดไป"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              disabled={isCurrentMonth}
            >
              <ChevronRight size={16} />
            </Button>
          </div>

          {/* Calendar grid */}
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['จ','อ','พ','พฤ','ศ','ส','อา'].map(d => (
                <div key={d} className="text-center text-[10px] text-muted-foreground py-1 font-medium">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const status = getDayStatus(day);
                const hasSess = hasSession(day);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === today;
                const isSelected = selectedDay === day;
                const isFuture = new Date(dateStr) > new Date();

                return (
                  <button
                    key={i}
                    onClick={() => hasSess ? setSelectedDay(isSelected ? null : day) : undefined}
                    className={`
                      relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all
                      ${hasSess ? 'cursor-pointer hover:ring-1 hover:ring-brand-500/50' : 'cursor-default'}
                      ${isSelected ? 'ring-2 ring-brand-500' : ''}
                      ${isToday ? 'ring-1 ring-brand-400' : ''}
                      ${isFuture ? 'opacity-40' : ''}
                      ${hasSess && !isFuture ? STATUS_BG[status] || 'bg-muted/30' : 'bg-transparent'}
                    `}
                  >
                    <span className={`font-medium text-[11px] leading-none ${isToday ? 'text-brand-text' : ''}`}>{day}</span>
                    {hasSess && !isFuture && (
                      <div className={`w-1 h-1 rounded-full mt-0.5 ${STATUS_COLOR[status]}`} />
                    )}
                    {hasSess && isFuture && (
                      <div className="w-1 h-1 rounded-full mt-0.5 bg-muted-foreground/30" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {[
                { color: 'bg-green-500', label: 'มาซ้อม' },
                { color: 'bg-yellow-500', label: 'มาสาย' },
                { color: 'bg-red-500', label: 'ขาดซ้อม' },
                { color: 'bg-blue-500', label: 'ลา' },
                { color: 'bg-muted', label: 'ไม่มีซ้อม' },
                { color: 'bg-gray-400', label: 'นศท. (ร.ด.)' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-[10px] text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedDay && selectedDayRecord && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 border-b border-border">
                <p className="text-xs font-semibold">
                  รายละเอียดวันที่ {selectedDay} {thaiMonths[month]} {year + 543}
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {selectedDayRecord.sessions.map(({ session, record }, i) => (
                  <div key={i} className="px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">
                        {session.description || SESSION_TYPE_LABELS[session.session_type as keyof typeof SESSION_TYPE_LABELS]}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock size={9} />
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </p>
                      {record?.reason && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">เหตุผล: {record.reason}</p>
                      )}
                      {record?.check_in_time && (
                        <p className="text-[10px] text-muted-foreground">
                          เช็คเวลา {new Date(record.check_in_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                          {record.gps_verified && ' ✓GPS'}
                        </p>
                      )}
                      {record?.teacher_override && (
                        <Badge variant="info" className="text-[9px] mt-0.5">ครูแก้ไข</Badge>
                      )}
                    </div>
                    <div>
                      {shouldExcludeFromStats({ ...session, session_type: session.session_type as any }, student) ? (
                        <Badge variant="outline" className="text-xs text-gray-400 border-gray-500/30">นศท.</Badge>
                      ) : record ? (
                        <Badge variant={
                          record.status === 'present' ? 'success' :
                          record.status === 'late' ? 'warning' :
                          record.status === 'excused' ? 'info' : 'destructive'
                        } className="text-xs">
                          {ATTENDANCE_STATUS_LABELS[record.status]}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">ไม่มีข้อมูล</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}