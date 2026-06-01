import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { formatThaiDate, formatTime, getDayOfWeekThai } from '@/lib/utils';
import { PracticeSession, SESSION_TYPE_LABELS } from '@/types';

const FIXED_SCHEDULE = [
  { day: 'จันทร์ - ศุกร์', time: '07:00 - 08:30 น.', type: 'morning', label: 'ซ้อมเช้า (สายไม่เกิน 7:45 น.)' },
  { day: 'พฤหัสบดี', time: '15:20 - 16:10 น.', type: 'club', label: 'คาบชุมนุม (สายไม่เกิน 15:35 น.)' },
];

export default function SchedulePage() {
  const { profile } = useAuthStore();
  const isTeacher = profile?.role === 'admin' || profile?.role === 'teacher';

  const [upcomingSessions, setUpcomingSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ date: '', start_time: '07:00', end_time: '08:30', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    setLoading(true);

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // คำนวณวันพรุ่งนี้
    const tomorrowObj = new Date(now);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = tomorrowObj.toISOString().split('T')[0];
    const tomorrowDow = tomorrowObj.getDay(); // 0=Sun,1=Mon,...,6=Sat

    // Auto-generate session วันพรุ่งนี้ถ้ายังไม่มี (จ-ศ เท่านั้น)
    if (tomorrowDow >= 1 && tomorrowDow <= 5) {
      await supabase.from('practice_sessions')
        .upsert(
          { date: tomorrow, start_time: '05:00', end_time: '08:30', session_type: 'morning', description: 'ซ้อมเช้า' },
          { onConflict: 'date,session_type', ignoreDuplicates: true }
        );
      if (tomorrowDow === 4) {
        await supabase.from('practice_sessions')
          .upsert(
            { date: tomorrow, start_time: '15:20', end_time: '16:10', session_type: 'club', description: 'คาบชุมนุม' },
            { onConflict: 'date,session_type', ignoreDuplicates: true }
          );
      }
    }

    const { data } = await supabase
      .from('practice_sessions')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(30);
    setUpcomingSessions(data || []);
    setLoading(false);
  };

  const handleAddSession = async () => {
    if (!addForm.date || !addForm.start_time || !addForm.end_time || !addForm.description) {
      toast({ variant: 'destructive', title: 'กรุณากรอกข้อมูลให้ครบ' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('practice_sessions').insert({
        date: addForm.date,
        start_time: addForm.start_time,
        end_time: addForm.end_time,
        session_type: 'extra',
        description: addForm.description,
        created_by: profile?.id,
        is_override: true,
      });
      if (error) throw error;
      toast({ variant: 'success', title: 'เพิ่มรอบซ้อมแล้ว' });
      setAddDialog(false);
      setAddForm({ date: '', start_time: '07:00', end_time: '08:30', description: '' });
      await loadSessions();
    } catch (err) {
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด', description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
      if (error) throw error;
      toast({ variant: 'success', title: 'ลบรอบซ้อมแล้ว' });
      await loadSessions();
    } catch (err) {
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ตารางซ้อม</h1>
          <p className="text-sm text-muted-foreground">ตารางการซ้อมและกิจกรรม</p>
        </div>
        {isTeacher && (
          <Button variant="gold" size="sm" className="gap-1.5" onClick={() => setAddDialog(true)}>
            <Plus size={15} /> เพิ่มซ้อมพิเศษ
          </Button>
        )}
      </div>

      {/* Fixed schedule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar size={16} className="text-brand-400" />
            ตารางประจำ
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
              <div className="text-right">
                <p className="text-sm text-brand-400 font-medium">{s.time}</p>
                <Badge variant="gold" className="text-[9px]">ประจำ</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Upcoming sessions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock size={16} className="text-brand-400" />
            รอบซ้อมที่กำลังจะมาถึง
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-brand-400" />
            </div>
          ) : upcomingSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">ไม่มีรอบซ้อมที่กำลังจะมาถึง</p>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map(session => {
                const dateObj = new Date(session.date + 'T00:00:00');
                const todayStr = new Date().toISOString().split('T')[0];
                const tomorrowObj = new Date(); tomorrowObj.setDate(tomorrowObj.getDate() + 1);
                const tomorrowStr = tomorrowObj.toISOString().split('T')[0];
                const isToday    = session.date === todayStr;
                const isTomorrow = session.date === tomorrowStr;
                return (
                  <div key={session.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isToday    ? 'border-brand-500/40 bg-brand-500/5' :
                    isTomorrow ? 'border-brand-500/20 bg-brand-500/[0.03]' :
                    'border-border bg-muted/20 hover:bg-muted/40'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-center ${
                        isToday    ? 'bg-brand-500 text-white' :
                        isTomorrow ? 'bg-brand-500/20 text-brand-400' :
                        'bg-muted text-foreground'
                      }`}>
                        <span className="text-[10px] leading-none">{getDayOfWeekThai(dateObj)}</span>
                        <span className="text-base font-bold leading-tight">{dateObj.getDate()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{session.description || SESSION_TYPE_LABELS[session.session_type]}</p>
                          {isToday    && <Badge variant="gold" className="text-[9px]">วันนี้</Badge>}
                          {isTomorrow && <Badge variant="outline" className="text-[9px] border-brand-500/40 text-brand-400">พรุ่งนี้</Badge>}
                          {session.is_override && <Badge variant="info" className="text-[9px]">พิเศษ</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </p>
                      </div>
                    </div>
                    {isTeacher && session.is_override && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDelete(session.id)}
                        disabled={deleting === session.id}
                      >
                        {deleting === session.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add session dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มรอบซ้อมพิเศษ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>วันที่</Label>
              <Input
                type="date"
                value={addForm.date}
                onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>เวลาเริ่ม</Label>
                <Input
                  type="time"
                  value={addForm.start_time}
                  onChange={e => setAddForm(f => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>เวลาสิ้นสุด</Label>
                <Input
                  type="time"
                  value={addForm.end_time}
                  onChange={e => setAddForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>รายละเอียด</Label>
              <Input
                placeholder="เช่น ซ้อมเตรียมการแสดง, ซ้อมใหญ่"
                value={addForm.description}
                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleAddSession} disabled={saving} className="bg-brand-500 hover:bg-brand-400 text-white">
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
