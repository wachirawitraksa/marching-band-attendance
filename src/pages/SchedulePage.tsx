import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Calendar, Clock, Loader2,
  Ban, CalendarX, RefreshCw, AlertTriangle,
  BookX, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { formatThaiDate, formatTime, getDayOfWeekThai, getTodayBangkok, getBangkokDateWithOffset, getBangkokDayOfWeek } from '@/lib/utils';
import { ThaiDateInput } from '@/components/ui/thai-date-input';
import { PracticeSession, Holiday, HolidayRange, SESSION_TYPE_LABELS } from '@/types';

const FIXED_SCHEDULE = [
  { day: 'จันทร์ – ศุกร์', time: '07:00 – 08:30 น.', label: 'ซ้อมเช้า (ห้ามเกิน 07:45 น.)' },
  { day: 'พฤหัสบดี',       time: '15:20 – 16:10 น.', label: 'คาบชุมนุม  (ห้ามเกิน 15:35 น.)' },
];

export default function SchedulePage() {
  const { profile } = useAuthStore();
  const isTeacher = profile?.role === 'admin' || profile?.role === 'teacher';
  const queryClient = useQueryClient();

  // SchedulePage แก้ practice_sessions/holidays/ranges โดยตรง — sync ให้ Dashboard/AttendancePage
  // (ที่ใช้ useSessionsByDate/useSessionsInRange จาก React Query cache) เห็นข้อมูลใหม่ทันที
  const syncSharedCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const [tab, setTab] = useState('schedule');

  const [sessions,       setSessions]       = useState<PracticeSession[]>([]);
  const [holidays,       setHolidays]       = useState<Holiday[]>([]);
  const [ranges,         setRanges]         = useState<HolidayRange[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [deleting,       setDeleting]       = useState<string | null>(null);

  // add session dialog
  const [addDialog,  setAddDialog]  = useState(false);
  const [addForm,    setAddForm]    = useState({ date: '', start_time: '07:00', end_time: '08:30', description: '' });
  const [saving,     setSaving]     = useState(false);

  // holiday dialog
  const [holidayDialog, setHolidayDialog] = useState(false);
  const [holidayForm,   setHolidayForm]   = useState({ date: '', description: '' });
  const [savingHol,     setSavingHol]     = useState(false);
  const [holidayError,  setHolidayError]  = useState('');

  // holiday range dialog
  const [rangeDialog, setRangeDialog] = useState(false);
  const [rangeForm,   setRangeForm]   = useState({ start_date: '', end_date: '', label: '' });
  const [savingRange, setSavingRange] = useState(false);
  const [rangeError,  setRangeError]  = useState('');

  // delete confirms
  const [deleteSession, setDeleteSession] = useState<PracticeSession | null>(null);
  const [deleteRange,   setDeleteRange]   = useState<HolidayRange | null>(null);

  // ---- load ----
  const loadData = useCallback(async () => {
    setLoading(true);

    const today   = getTodayBangkok();

    // โหลด holidays + ranges ก่อน
    const [{ data: holData }, { data: rangeData }] = await Promise.all([
      supabase.from('holidays').select('*').order('date'),
      supabase.from('holiday_ranges').select('*').order('start_date'),
    ]);
    const holDates = new Set((holData || []).map((h: Holiday) => h.date));
    setHolidays(holData || []);
    setRanges(rangeData || []);

    // ฟังก์ชันตรวจว่าวันใดวันหนึ่งอยู่ในช่วงปิดเทอมหรือไม่
    const isInRange = (dateStr: string) =>
      (rangeData || []).some((r: HolidayRange) =>
        dateStr >= r.start_date && dateStr <= r.end_date
      );

    // auto-generate พรุ่งนี้ (ถ้าไม่ใช่วันหยุดและไม่ใช่ช่วงปิดเทอม) — อิงเวลาไทย
    const tomStr = getBangkokDateWithOffset(1);
    const tomDow = getBangkokDayOfWeek(new Date(Date.now() + 24 * 60 * 60 * 1000));

    if (tomDow >= 1 && tomDow <= 5 && !holDates.has(tomStr) && !isInRange(tomStr)) {
      await supabase.from('practice_sessions').upsert(
        { date: tomStr, start_time: '07:00', end_time: '08:30', session_type: 'morning', description: 'ซ้อมเช้า (ห้ามสายเกิน 7:45 น.)' },
        { onConflict: 'date,session_type', ignoreDuplicates: true }
      );
      if (tomDow === 4) {
        await supabase.from('practice_sessions').upsert(
          { date: tomStr, start_time: '15:20', end_time: '16:10', session_type: 'club', description: 'คาบชุมนุม (ห้ามสายเกิน 15:35 น.)' },
          { onConflict: 'date,session_type', ignoreDuplicates: true }
        );
      }
    }

    const { data: sessionData } = await supabase
      .from('practice_sessions')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(60);
    setSessions(sessionData || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ---- add extra session ----
  const handleAddSession = async () => {
    if (!addForm.date || !addForm.start_time || !addForm.end_time || !addForm.description) {
      toast({ variant: 'destructive', title: 'กรุณากรอกข้อมูลให้ครบ' }); return;
    }
    if (holidays.some(h => h.date === addForm.date)) {
      toast({ variant: 'destructive', title: 'วันที่เลือกเป็นวันหยุด', description: 'ลบวันหยุดก่อนถ้าต้องการซ้อมวันนั้น' }); return;
    }
    const inRange = ranges.some(r => addForm.date >= r.start_date && addForm.date <= r.end_date);
    if (inRange) {
      toast({ variant: 'destructive', title: 'วันที่เลือกอยู่ในช่วงปิดเทอม', description: 'ระบบจะเพิ่มเป็นซ้อมพิเศษแม้ปิดเทอม' });
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('practice_sessions').insert({
        date: addForm.date, start_time: addForm.start_time,
        end_time: addForm.end_time, session_type: 'extra',
        description: addForm.description, created_by: profile?.id, is_override: true,
      });
      if (error) throw error;
      toast({ variant: 'success', title: 'เพิ่มรอบซ้อมพิเศษแล้ว' });
      setAddDialog(false);
      setAddForm({ date: '', start_time: '07:00', end_time: '08:30', description: '' });
      await loadData();
      syncSharedCaches();
    } catch (err) {
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: err instanceof Error ? err.message : '' });
    } finally { setSaving(false); }
  };

  // ---- delete session ----
  const handleDeleteSession = async (s: PracticeSession) => {
    setDeleting(s.id);
    try {
      const { error } = await supabase.from('practice_sessions').delete().eq('id', s.id);
      if (error) throw error;

      toast({ variant: 'success', title: 'ลบรอบซ้อมแล้ว' });
      setDeleteSession(null);
      await loadData();
      syncSharedCaches();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'เกิดข้อผิดพลาดในการลบรอบซ้อม',
        description: err instanceof Error ? err.message : 'โปรดลองใหม่อีกครั้ง',
      });
    } finally { setDeleting(null); }
  };

  // ---- add holiday ----
  const handleAddHoliday = async () => {
    setHolidayError('');
    if (!holidayForm.date)        { setHolidayError('กรุณาเลือกวันที่'); return; }
    if (!holidayForm.description) { setHolidayError('กรุณากรอกคำอธิบาย'); return; }
    setSavingHol(true);
    try {
      const { error } = await supabase.from('holidays').insert({
        date: holidayForm.date, description: holidayForm.description.trim(), created_by: profile?.id,
      });
      if (error) {
        if (error.code === '23505') throw new Error('วันที่นี้มีวันหยุดอยู่แล้ว');
        throw error;
      }
      await supabase.from('practice_sessions').delete()
        .eq('date', holidayForm.date).eq('is_override', false);
      toast({ variant: 'success', title: `เพิ่มวันหยุด ${formatThaiDate(holidayForm.date)} แล้ว` });
      setHolidayDialog(false);
      setHolidayForm({ date: '', description: '' });
      await loadData();
      syncSharedCaches();
    } catch (err) { setHolidayError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'); }
    finally { setSavingHol(false); }
  };

  const handleDeleteHoliday = async (id: string) => {
    await supabase.from('holidays').delete().eq('id', id);
    toast({ variant: 'success', title: 'ลบวันหยุดแล้ว' });
    await loadData();
    syncSharedCaches();
  };

  // ---- add holiday range ----
  const handleAddRange = async () => {
    setRangeError('');
    if (!rangeForm.start_date)  { setRangeError('กรุณาเลือกวันเริ่มต้น'); return; }
    if (!rangeForm.end_date)    { setRangeError('กรุณาเลือกวันสิ้นสุด'); return; }
    if (!rangeForm.label.trim()){ setRangeError('กรุณากรอกชื่อช่วงเวลา'); return; }
    if (rangeForm.end_date < rangeForm.start_date) {
      setRangeError('วันสิ้นสุดต้องมากกว่าหรือเท่ากับวันเริ่มต้น'); return;
    }

    setSavingRange(true);
    try {
      const { error } = await supabase.from('holiday_ranges').insert({
        start_date: rangeForm.start_date, end_date: rangeForm.end_date,
        label: rangeForm.label.trim(), created_by: profile?.id,
      });
      if (error) throw error;

      // ลบ session ปกติ (ไม่ใช่ override) ในช่วงนี้ทั้งหมด
      await supabase
        .from('practice_sessions')
        .delete()
        .gte('date', rangeForm.start_date)
        .lte('date', rangeForm.end_date)
        .eq('is_override', false);

      toast({
        variant: 'success',
        title: `เพิ่มช่วงปิดเทอม "${rangeForm.label}" แล้ว`,
        description: `ลบรอบซ้อมในช่วงนั้นออกแล้ว`,
      });
      setRangeDialog(false);
      setRangeForm({ start_date: '', end_date: '', label: '' });
      await loadData();
      syncSharedCaches();
    } catch (err) { setRangeError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'); }
    finally { setSavingRange(false); }
  };

  // ---- delete holiday range ----
  const handleDeleteRange = async (r: HolidayRange) => {
    try {
      await supabase.from('holiday_ranges').delete().eq('id', r.id);
      toast({ variant: 'success', title: `ลบช่วงปิดเทอม "${r.label}" แล้ว` });
      setDeleteRange(null);
      await loadData();
      syncSharedCaches();
    } catch { toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด' }); }
  };

  const todayStr    = getTodayBangkok();
  const tomorrowStr = getBangkokDateWithOffset(1);

  // ตรวจสอบว่าตอนนี้อยู่ในช่วงปิดเทอมหรือไม่
  const currentRange = ranges.find(r => todayStr >= r.start_date && todayStr <= r.end_date);

  // คำนวณจำนวนวันในช่วง
  const countDays = (start: string, end: string) => {
    const s = new Date(start + 'T12:00:00Z');
    const e = new Date(end   + 'T12:00:00Z');
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">ตารางซ้อม</h1>
          <p className="text-sm text-muted-foreground">ตารางการซ้อม วันหยุด และช่วงปิดเทอม</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadData} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> รีเฟรช
          </Button>
          {isTeacher && (
            <>
              <Button variant="outline" size="sm"
                className="gap-1.5 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                onClick={() => { setRangeForm({ start_date:'', end_date:'', label:'' }); setRangeError(''); setRangeDialog(true); }}
              >
                <BookX size={13} /> ปิดเทอม
              </Button>
              <Button variant="outline" size="sm"
                className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => { setHolidayForm({ date:'', description:'' }); setHolidayError(''); setHolidayDialog(true); }}
              >
                <CalendarX size={13} /> วันหยุด
              </Button>
              <Button variant="gold" size="sm" className="gap-1.5"
                onClick={() => { setAddForm({ date:'', start_time:'07:00', end_time:'08:30', description:'' }); setAddDialog(true); }}
              >
                <Plus size={14} /> ซ้อมพิเศษ
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Banner ปิดเทอม */}
      {currentRange && (
        <Alert className="border-orange-500/40 bg-orange-500/10">
          <BookX size={16} className="text-orange-400" />
          <AlertDescription className="text-orange-300">
            <span className="font-semibold">{currentRange.label}</span>
            {' '}— ปิดถึง {formatThaiDate(currentRange.end_date)} ไม่มีรอบซ้อมปกติ
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4 md:w-auto md:flex">
          <TabsTrigger value="schedule"  className="text-xs">ประจำ</TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs">
            รอบซ้อม
            {sessions.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-4">{sessions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="term" className="text-xs">
            ปิดเทอม
            {ranges.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-4 border-orange-500/40 text-orange-400">{ranges.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="holidays" className="text-xs">
            วันหยุด
            {holidays.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0 h-4">{holidays.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ---- ตารางประจำ ---- */}
        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar size={15} className="text-brand-400" /> ตารางซ้อมประจำสัปดาห์
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {FIXED_SCHEDULE.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center">
                      <Clock size={14} className="text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">วัน{s.day}</p>
                    </div>
                  </div>
                  <p className="text-sm text-brand-400 font-medium">{s.time}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                * วันหยุดราชการ และช่วงปิดเทอม จะไม่มีรอบซ้อมอัตโนมัติ
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- รอบซ้อม ---- */}
        <TabsContent value="upcoming" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock size={15} className="text-brand-400" /> รอบซ้อมที่กำลังจะมาถึง
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-brand-400" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">ไม่มีรอบซ้อมที่กำลังจะมาถึง</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map(session => {
                    const dateObj    = new Date(session.date + 'T12:00:00Z');
                    const isToday    = session.date === todayStr;
                    const isTomorrow = session.date === tomorrowStr;
                    const isHolRange = ranges.some(r => session.date >= r.start_date && session.date <= r.end_date);
                    return (
                      <div key={session.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isToday    ? 'border-brand-500/40 bg-brand-500/5' :
                        isTomorrow ? 'border-brand-500/20 bg-brand-500/[0.03]' :
                        'border-border bg-muted/20 hover:bg-muted/40'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-center shrink-0 ${
                            isToday    ? 'bg-brand-500 text-white' :
                            isTomorrow ? 'bg-brand-500/20 text-brand-400' :
                            'bg-muted'
                          }`}>
                            <span className="text-[10px] leading-none">{getDayOfWeekThai(dateObj)}</span>
                            <span className="text-base font-bold leading-tight">{dateObj.getUTCDate()}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium">
                                {session.description || SESSION_TYPE_LABELS[session.session_type]}
                              </p>
                              {isToday    && <Badge variant="gold" className="text-[9px]">วันนี้</Badge>}
                              {isTomorrow && <Badge variant="outline" className="text-[9px] border-brand-500/40 text-brand-400">พรุ่งนี้</Badge>}
                              {session.is_override && <Badge variant="info" className="text-[9px]">พิเศษ</Badge>}
                              {isHolRange && <Badge className="text-[9px] bg-orange-500/20 text-orange-400 border-orange-500/30">ช่วงปิดเทอม</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {formatTime(session.start_time)} – {formatTime(session.end_time)}
                            </p>
                          </div>
                        </div>
                        {isTeacher && (
                          <Button size="sm" variant="ghost"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                            onClick={() => setDeleteSession(session)} disabled={!!deleting}
                          >
                            {deleting === session.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Trash2 size={13} />}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- ช่วงปิดเทอม ---- */}
        <TabsContent value="term" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookX size={15} className="text-orange-400" /> ช่วงปิดเทอม
                </CardTitle>
                {isTeacher && (
                  <Button size="sm" variant="outline"
                    className="gap-1.5 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10 h-7"
                    onClick={() => { setRangeForm({ start_date:'', end_date:'', label:'' }); setRangeError(''); setRangeDialog(true); }}
                  >
                    <Plus size={12} /> เพิ่ม
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {ranges.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีช่วงปิดเทอมที่กำหนด</p>
              ) : (
                <div className="space-y-2">
                  {ranges.map(r => {
                    const isActive = todayStr >= r.start_date && todayStr <= r.end_date;
                    const isPast   = r.end_date < todayStr;
                    const days     = countDays(r.start_date, r.end_date);
                    return (
                      <div key={r.id} className={`p-3 rounded-lg border transition-colors ${
                        isActive ? 'border-orange-500/40 bg-orange-500/8' :
                        isPast   ? 'border-border/30 bg-muted/10 opacity-50' :
                        'border-orange-500/20 bg-orange-500/5'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isActive ? 'bg-orange-500/25' : 'bg-muted'
                            }`}>
                              <BookX size={15} className={isActive ? 'text-orange-400' : 'text-muted-foreground'} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold">{r.label}</p>
                                {isActive && (
                                  <Badge className="text-[9px] bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
                                    กำลังปิดเทอม
                                  </Badge>
                                )}
                                {isPast && (
                                  <Badge variant="outline" className="text-[9px] text-muted-foreground">ผ่านไปแล้ว</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatThaiDate(r.start_date)}
                                <ChevronRight size={10} className="inline mx-0.5" />
                                {formatThaiDate(r.end_date)}
                                <span className="ml-1.5 text-muted-foreground/60">({days} วัน)</span>
                              </p>
                            </div>
                          </div>
                          {isTeacher && !isPast && (
                            <Button size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 shrink-0"
                              onClick={() => setDeleteRange(r)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- วันหยุด ---- */}
        <TabsContent value="holidays" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Ban size={15} className="text-red-400" /> วันหยุด / ไม่มีซ้อม
                </CardTitle>
                {isTeacher && (
                  <Button size="sm" variant="outline"
                    className="gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 h-7"
                    onClick={() => { setHolidayForm({ date:'', description:'' }); setHolidayError(''); setHolidayDialog(true); }}
                  >
                    <Plus size={12} /> เพิ่ม
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีวันหยุดที่กำหนด</p>
              ) : (
                <div className="space-y-2">
                  {holidays.map(h => {
                    const isPast = h.date < todayStr;
                    return (
                      <div key={h.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                        isPast ? 'border-border/30 bg-muted/10 opacity-50' : 'border-red-500/20 bg-red-500/5'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-center shrink-0 ${
                            isPast ? 'bg-muted' : 'bg-red-500/20'
                          }`}>
                            <CalendarX size={14} className={isPast ? 'text-muted-foreground' : 'text-red-400'} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{h.description}</p>
                            <p className="text-xs text-muted-foreground">
                              วัน{getDayOfWeekThai(h.date + 'T12:00:00Z')}ที่ {formatThaiDate(h.date)}
                              {isPast && ' (ผ่านไปแล้ว)'}
                            </p>
                          </div>
                        </div>
                        {isTeacher && !isPast && (
                          <Button size="sm" variant="ghost"
                            className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10 shrink-0"
                            onClick={() => handleDeleteHoliday(h.id)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ======== Add Extra Session ======== */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={16} className="text-brand-400" /> เพิ่มรอบซ้อมพิเศษ
            </DialogTitle>
            <DialogDescription>นอกเหนือจากตารางซ้อมปกติ</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">วันที่</Label>
              <ThaiDateInput value={addForm.date}
                onChange={v => setAddForm(f => ({ ...f, date: v }))}
                min={todayStr}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">เวลาเริ่ม</Label>
                <Input type="time" value={addForm.start_time}
                  onChange={e => setAddForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">เวลาสิ้นสุด</Label>
                <Input type="time" value={addForm.end_time}
                  onChange={e => setAddForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">รายละเอียด</Label>
              <Input placeholder="เช่น ซ้อมใหญ่ก่อนแสดง"
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddSession()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialog(false)}>ยกเลิก</Button>
            <Button size="sm" onClick={handleAddSession} disabled={saving}
              className="bg-brand-500 hover:bg-brand-400 text-white gap-1.5">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Add Holiday ======== */}
      <Dialog open={holidayDialog} onOpenChange={o => { if (!o) setHolidayDialog(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarX size={16} className="text-red-400" /> เพิ่มวันหยุด
            </DialogTitle>
            <DialogDescription>รอบซ้อมในวันนั้นจะถูกลบออกอัตโนมัติ</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {holidayError && <Alert variant="destructive"><AlertDescription className="text-sm">{holidayError}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label className="text-xs">วันที่</Label>
              <ThaiDateInput value={holidayForm.date}
                onChange={v => setHolidayForm(f => ({ ...f, date: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">คำอธิบาย</Label>
              <Input placeholder="เช่น วันหยุดนักขัตฤกษ์, สอบกลางภาค"
                value={holidayForm.description}
                onChange={e => setHolidayForm(f => ({ ...f, description: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddHoliday()}
              />
            </div>
            {holidayForm.date && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-xs text-red-400">
                  วัน{getDayOfWeekThai(holidayForm.date + 'T12:00:00Z')}ที่ {formatThaiDate(holidayForm.date)} จะไม่มีรอบซ้อม
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHolidayDialog(false)}>ยกเลิก</Button>
            <Button size="sm" onClick={handleAddHoliday} disabled={savingHol}
              className="bg-red-500 hover:bg-red-600 text-white gap-1.5">
              {savingHol ? <Loader2 size={13} className="animate-spin" /> : <CalendarX size={13} />} เพิ่มวันหยุด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Add Holiday Range ======== */}
      <Dialog open={rangeDialog} onOpenChange={o => { if (!o) setRangeDialog(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookX size={16} className="text-orange-400" /> เพิ่มช่วงปิดเทอม
            </DialogTitle>
            <DialogDescription>
              รอบซ้อมปกติในช่วงนั้นจะถูกลบออก ยังสามารถเพิ่มซ้อมพิเศษได้
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {rangeError && <Alert variant="destructive"><AlertDescription className="text-sm">{rangeError}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label className="text-xs">ชื่อช่วงเวลา</Label>
              <Input placeholder="เช่น ปิดเทอม ภาค 1/2568, สอบปลายภาค"
                value={rangeForm.label}
                onChange={e => setRangeForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">วันเริ่มต้น</Label>
              <ThaiDateInput value={rangeForm.start_date}
                onChange={v => setRangeForm(f => ({ ...f, start_date: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">วันสิ้นสุด</Label>
              <ThaiDateInput value={rangeForm.end_date}
                onChange={v => setRangeForm(f => ({ ...f, end_date: v }))}
                min={rangeForm.start_date}
              />
            </div>
            {rangeForm.start_date && rangeForm.end_date && rangeForm.end_date >= rangeForm.start_date && (
              <div className="px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-xs text-orange-300 font-medium">
                  {formatThaiDate(rangeForm.start_date)} – {formatThaiDate(rangeForm.end_date)}
                </p>
                <p className="text-xs text-orange-400/70 mt-0.5">
                  รวม {countDays(rangeForm.start_date, rangeForm.end_date)} วัน — รอบซ้อมปกติในช่วงนี้จะถูกลบออก
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRangeDialog(false)}>ยกเลิก</Button>
            <Button size="sm" onClick={handleAddRange} disabled={savingRange}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5">
              {savingRange ? <Loader2 size={13} className="animate-spin" /> : <BookX size={13} />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Delete Session Confirm ======== */}
      <Dialog open={!!deleteSession} onOpenChange={o => !o && setDeleteSession(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-400" /> ยืนยันการลบรอบซ้อม
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            {deleteSession && (
              <div className="px-3 py-2 bg-muted/40 rounded-lg text-sm">
                <p className="font-medium">{deleteSession.description || SESSION_TYPE_LABELS[deleteSession.session_type]}</p>
                <p className="text-xs text-muted-foreground">
                  {formatThaiDate(deleteSession.date)} • {formatTime(deleteSession.start_time)} – {formatTime(deleteSession.end_time)}
                </p>
              </div>
            )}
            <Alert variant="warning">
              <AlertTriangle size={13} />
              <AlertDescription className="text-xs">ข้อมูลการเช็คชื่อในรอบนี้จะถูกลบด้วย</AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteSession(null)}>ยกเลิก</Button>
            <Button size="sm" disabled={!!deleting}
              onClick={() => deleteSession && handleDeleteSession(deleteSession)}
              className="bg-red-500 hover:bg-red-600 text-white gap-1.5">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======== Delete Range Confirm ======== */}
      <Dialog open={!!deleteRange} onOpenChange={o => !o && setDeleteRange(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-400" /> ยืนยันการลบช่วงปิดเทอม
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            {deleteRange && (
              <div className="px-3 py-2 bg-muted/40 rounded-lg text-sm">
                <p className="font-medium">{deleteRange.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatThaiDate(deleteRange.start_date)} – {formatThaiDate(deleteRange.end_date)}
                </p>
              </div>
            )}
            <Alert className="border-orange-500/30 bg-orange-500/10">
              <AlertTriangle size={13} className="text-orange-400" />
              <AlertDescription className="text-xs text-orange-300">
                รอบซ้อมในช่วงนี้จะ<span className="font-semibold">ไม่</span>ถูกสร้างคืน — ต้องเพิ่มเองถ้าต้องการ
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteRange(null)}>ยกเลิก</Button>
            <Button size="sm" onClick={() => deleteRange && handleDeleteRange(deleteRange)}
              className="bg-red-500 hover:bg-red-600 text-white gap-1.5">
              <Trash2 size={13} /> ลบช่วงปิดเทอม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
