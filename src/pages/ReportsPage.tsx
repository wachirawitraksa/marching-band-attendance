import { useState } from 'react';
import { BarChart3, Loader2, TrendingUp, Users, Calendar, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/authStore';
import { useSections, useStudents, useAllAttendanceRecords } from '@/hooks/useSupabaseQueries';
import { formatThaiDate, getAvatarFallback, calculateAttendanceRate, getAcademicYearOf, getCurrentAcademicYear } from '@/lib/utils';
import { Profile, AttendanceRecord, ATTENDANCE_STATUS_LABELS } from '@/types';
import { StudentCalendarReport } from '@/components/reports/StudentCalendarReport';
import { ExportReportDialog } from '@/components/reports/ExportReportDialog';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell
} from 'recharts';

export default function ReportsPage() {
  const { profile } = useAuthStore();
  const { data: sections = [], isLoading: sectionsLoading } = useSections();
  const { data: students = [], isLoading: studentsLoading } = useStudents({ graduated: false, activeOnly: true });
  const { data: allRecords = [], isLoading: recordsLoading } = useAllAttendanceRecords();
  const loading = sectionsLoading || studentsLoading || recordsLoading;

  const [filterSection, setFilterSection] = useState('all');
  const [filterYear, setFilterYear] = useState(String(getCurrentAcademicYear()));
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth().toString());
  const [tab, setTab] = useState('overview');
  const [calendarStudent, setCalendarStudent] = useState<Profile | null>(null);

  const isTeacher = profile?.role === 'admin' || profile?.role === 'teacher';

  const filtered = students.filter(s => filterSection === 'all' || s.section_id === filterSection);

  // ปีการศึกษาที่มีข้อมูล (รวมปีปัจจุบันเสมอ) เรียงจากใหม่ไปเก่า
  const availableYears = Array.from(new Set([
    getCurrentAcademicYear(),
    ...allRecords.filter(r => r.session).map(r => getAcademicYearOf(r.session!.date)),
  ])).sort((a, b) => b - a);

  const matchesYear = (r: AttendanceRecord) =>
    filterYear === 'all' || (!!r.session && String(getAcademicYearOf(r.session.date)) === filterYear);
  const matchesMonth = (r: AttendanceRecord) =>
    filterMonth === 'all' || (!!r.session && new Date(r.session.date).getMonth().toString() === filterMonth);

  const getStudentStats = (studentId: string) => {
    const records = allRecords.filter(r => r.student_id === studentId && matchesYear(r) && matchesMonth(r));
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const excused = records.filter(r => r.status === 'excused').length;
    return { present, late, absent, excused, total: records.length, rate: calculateAttendanceRate(present + late, records.length) };
  };

  const totalRecords = allRecords.filter(r => matchesYear(r) && matchesMonth(r));
  const overallPresent = totalRecords.filter(r => r.status === 'present' || r.status === 'late').length;
  const overallRate = calculateAttendanceRate(overallPresent, totalRecords.length);

  const pieData = [
    { name: 'มาซ้อม', value: totalRecords.filter(r => r.status === 'present').length, color: '#22c55e' },
    { name: 'ขาดซ้อม', value: totalRecords.filter(r => r.status === 'absent').length, color: '#ef4444' },
    { name: 'มาสาย', value: totalRecords.filter(r => r.status === 'late').length, color: '#2d8912' },
    { name: 'ลา', value: totalRecords.filter(r => r.status === 'excused').length, color: '#3b82f6' },
  ].filter(d => d.value > 0);

  const sectionStats = sections.map(sec => {
    const secStudents = students.filter(s => s.section_id === sec.id);
    const secRecords = totalRecords.filter(r => secStudents.some(s => s.id === r.student_id));
    const present = secRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    return { name: sec.name.replace('เครื่อง', '').substring(0, 8), present, total: secRecords.length, rate: calculateAttendanceRate(present, secRecords.length) };
  });

  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  if (!isTeacher) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <h1 className="text-xl font-bold">รายงานของฉัน</h1>
        <StudentSelfReport profile={profile!} allRecords={allRecords.filter(r => r.student_id === profile?.id)} onViewCalendar={() => setCalendarStudent(profile!)} />
        {calendarStudent && <StudentCalendarReport student={calendarStudent} onClose={() => setCalendarStudent(null)} />}
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={32} className="animate-spin text-brand-text" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Calendar overlay */}
      {calendarStudent && <StudentCalendarReport student={calendarStudent} onClose={() => setCalendarStudent(null)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 size={20} className="text-brand-text" /> รายงาน</h1>
          <p className="text-sm text-muted-foreground">ภาพรวมการเข้าร่วมซ้อม</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกปีการศึกษา</SelectItem>
              {availableYears.map(y => <SelectItem key={y} value={String(y)}>ปีการศึกษา {y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              {months.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="ทุก section" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุก Section</SelectItem>
              {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ExportReportDialog students={filtered} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'นักเรียน', value: filtered.length, color: 'text-brand-text', icon: <Users size={16} /> },
          { label: 'อัตราเข้าร่วม', value: `${overallRate}%`, color: overallRate >= 80 ? 'text-success' : overallRate >= 60 ? 'text-warning' : 'text-danger', icon: <TrendingUp size={16} /> },
          { label: 'มาซ้อม', value: totalRecords.filter(r => r.status === 'present').length, color: 'text-success', icon: <Calendar size={16} /> },
          { label: 'ขาดซ้อม', value: totalRecords.filter(r => r.status === 'absent').length, color: 'text-danger', icon: <Calendar size={16} /> },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto grid grid-cols-3 md:flex">
          <TabsTrigger value="overview" className="text-xs">ภาพรวม</TabsTrigger>
          <TabsTrigger value="students" className="text-xs">รายนักเรียน</TabsTrigger>
          <TabsTrigger value="section" className="text-xs">รายSection</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">สัดส่วนการเข้าร่วม</CardTitle></CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">เปรียบเทียบ Section</CardTitle></CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectionStats} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#666' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#666' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v}%`, 'อัตราเข้าร่วม']} />
                      <Bar dataKey="rate" fill="#2d8912" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">นักเรียน</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Section</th>
                      <th className="text-center p-3 font-medium text-success text-xs">มา</th>
                      <th className="text-center p-3 font-medium text-warning text-xs">สาย</th>
                      <th className="text-center p-3 font-medium text-danger text-xs">ขาด</th>
                      <th className="text-center p-3 font-medium text-info text-xs">ลา</th>
                      <th className="text-left p-3 font-medium text-muted-foreground text-xs">อัตรา</th>
                      <th className="text-center p-3 font-medium text-muted-foreground text-xs">ดูรายงาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(student => {
                      const s = getStudentStats(student.id);
                      return (
                        <tr key={student.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="w-7 h-7">
                                <AvatarImage src={student.profile_picture_url || ''} />
                                <AvatarFallback className="text-xs bg-brand-500/20 text-brand-text">{getAvatarFallback(student.full_name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-xs">{student.nickname || student.full_name}</p>
                                <p className="text-xs text-muted-foreground">{student.instrument?.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 hidden md:table-cell"><span className="text-xs text-muted-foreground">{student.section?.name || '-'}</span></td>
                          <td className="p-3 text-center text-success font-semibold text-xs">{s.present}</td>
                          <td className="p-3 text-center text-warning font-semibold text-xs">{s.late}</td>
                          <td className="p-3 text-center text-danger font-semibold text-xs">{s.absent}</td>
                          <td className="p-3 text-center text-info font-semibold text-xs">{s.excused}</td>
                          <td className="p-3 min-w-[80px]">
                            <div className="flex items-center gap-1.5">
                              <Progress value={s.rate} className="h-1.5 flex-1" />
                              <span className={`text-xs font-bold w-8 text-right ${s.rate >= 80 ? 'text-success' : s.rate >= 60 ? 'text-warning' : 'text-danger'}`}>{s.rate}%</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 px-2 text-xs gap-1 text-brand-text hover:bg-brand-500/10"
                              onClick={() => setCalendarStudent(student)}
                            >
                              <Eye size={12} /> ปฏิทิน
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="section" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {sections.map(sec => {
              const secStudents = students.filter(s => s.section_id === sec.id);
              const secRecords = totalRecords.filter(r => secStudents.some(s => s.id === r.student_id));
              const present = secRecords.filter(r => r.status === 'present' || r.status === 'late').length;
              const rate = calculateAttendanceRate(present, secRecords.length);
              return (
                <Card key={sec.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full" style={{ background: sec.color }} />
                      <span className="font-semibold text-sm">{sec.name}</span>
                      <Badge variant="outline" className="text-xs ml-auto">{secStudents.length} คน</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={rate} className="flex-1 h-2" />
                      <span className={`text-sm font-bold ${rate >= 80 ? 'text-success' : rate >= 60 ? 'text-warning' : 'text-danger'}`}>{rate}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">เข้าร่วม {present} / {secRecords.length} ครั้ง</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StudentSelfReport({ profile, allRecords, onViewCalendar }: { profile: Profile; allRecords: AttendanceRecord[]; onViewCalendar: () => void }) {
  const present = allRecords.filter(r => r.status === 'present').length;
  const late = allRecords.filter(r => r.status === 'late').length;
  const absent = allRecords.filter(r => r.status === 'absent').length;
  const excused = allRecords.filter(r => r.status === 'excused').length;
  const rate = calculateAttendanceRate(present + late, allRecords.length);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-16 h-16 -rotate-90">
                <circle cx="32" cy="32" r="26" stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
                <circle cx="32" cy="32" r="26" stroke="#2d8912" strokeWidth="6" fill="none"
                  strokeDasharray={`${2 * Math.PI * 26 * rate / 100} ${2 * Math.PI * 26}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-brand-text">{rate}%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">อัตราเข้าร่วม</p>
              <p className="text-sm text-muted-foreground">รวมทั้งหมด {allRecords.length} ครั้ง</p>
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1 text-brand-text border-brand-500/30" onClick={onViewCalendar}>
                <Calendar size={12} /> ดูปฏิทิน
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'มา', value: present, color: 'text-success', bg: 'bg-success/10' },
              { label: 'สาย', value: late, color: 'text-warning', bg: 'bg-warning/10' },
              { label: 'ขาด', value: absent, color: 'text-danger', bg: 'bg-danger/10' },
              { label: 'ลา', value: excused, color: 'text-info', bg: 'bg-info/10' },
            ].map(s => (
              <div key={s.label} className={`p-2 rounded-lg ${s.bg}`}>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">ประวัติล่าสุด</CardTitle></CardHeader>
        <CardContent className="p-0">
          {allRecords.slice(0, 10).map(record => (
            <div key={record.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm">{record.session?.description || 'ซ้อม'}</p>
                <p className="text-xs text-muted-foreground">{record.session?.date ? formatThaiDate(record.session.date) : ''}</p>
              </div>
              <Badge variant={record.status === 'present' ? 'success' : record.status === 'late' ? 'warning' : record.status === 'excused' ? 'info' : 'destructive'} className="text-xs">
                {ATTENDANCE_STATUS_LABELS[record.status]}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}