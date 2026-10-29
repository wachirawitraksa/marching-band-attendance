import { useState } from 'react';
import {
  Calendar, Plus, CheckCircle2, AlertTriangle, Loader2,
  ChevronRight, BookOpen, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTerm } from '@/hooks/useTerm';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/use-toast';
import { AcademicTerm } from '@/types';
import { formatThaiDate } from '@/lib/utils';

export function SemesterManager() {
  const { profile } = useAuthStore();
  const { currentTerm, allTerms, loading, switchTerm, createTerm, refetch } = useTerm();

  const [createDialog, setCreateDialog] = useState(false);
  const [switchDialog, setSwitchDialog] = useState<AcademicTerm | null>(null);
  const [newYear, setNewYear] = useState(String(new Date().getFullYear() + 543));
  const [newSemester, setNewSemester] = useState<'1' | '2'>('1');
  const [newStart, setNewStart] = useState(new Date().toISOString().split('T')[0]);
  const [newEnd, setNewEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [createError, setCreateError] = useState('');

  // Validation
  const validateCreate = (): string | null => {
    const yr = parseInt(newYear);
    if (isNaN(yr) || yr < 2560 || yr > 2580) return 'ปีการศึกษาต้องอยู่ระหว่าง 2560-2580';
    if (!newStart) return 'กรุณาเลือกวันเริ่มต้น';
    if (newEnd && newEnd <= newStart) return 'วันสิ้นสุดต้องมากกว่าวันเริ่มต้น';
    const exists = allTerms.find(t => t.academic_year === yr && String(t.semester) === newSemester);
    if (exists) return `ภาคเรียนที่ ${newSemester}/${yr} มีอยู่แล้ว`;
    return null;
  };

  const handleCreate = async () => {
    setCreateError('');
    const err = validateCreate();
    if (err) { setCreateError(err); return; }

    setCreating(true);
    try {
      await createTerm(
        parseInt(newYear),
        parseInt(newSemester) as 1 | 2,
        newStart,
        newEnd || null,
        profile!.id
      );
      toast({ variant: 'success', title: `สร้างภาคเรียนที่ ${newSemester}/${newYear} แล้ว` });
      setCreateDialog(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setCreating(false);
    }
  };

  const handleSwitch = async () => {
    if (!switchDialog) return;
    setSwitching(true);
    try {
      await switchTerm(switchDialog.id);
      toast({
        variant: 'success',
        title: 'เปลี่ยนภาคเรียนแล้ว',
        description: `ตอนนี้ใช้งาน ${switchDialog.label}`,
      });
      setSwitchDialog(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'เกิดข้อผิดพลาด' });
    } finally {
      setSwitching(false);
    }
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-brand-text" /></div>;

  return (
    <div className="space-y-4">
      {/* Current Term Banner */}
      {currentTerm ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-500/10 border border-brand-500/30">
          <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-brand-text" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-brand-text/70 font-medium">ภาคเรียนปัจจุบัน</p>
            <p className="font-bold text-brand-text">{currentTerm.label}</p>
            <p className="text-xs text-muted-foreground">
              เริ่ม {formatThaiDate(currentTerm.start_date)}
              {currentTerm.end_date && ` ถึง ${formatThaiDate(currentTerm.end_date)}`}
            </p>
          </div>
          <Badge variant="gold" className="text-xs">ใช้งานอยู่</Badge>
        </div>
      ) : (
        <Alert variant="warning">
          <AlertTriangle size={16} />
          <AlertDescription>ยังไม่มีภาคเรียนที่ใช้งาน กรุณาสร้างหรือเลือกภาคเรียน</AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline" size="sm" className="gap-1.5 text-xs"
          onClick={() => setCreateDialog(true)}
        >
          <Plus size={13} /> สร้างภาคเรียนใหม่
        </Button>
        <Button
          variant="ghost" size="sm" className="gap-1.5 text-xs"
          onClick={refetch}
        >
          <RotateCcw size={13} /> รีเฟรช
        </Button>
      </div>

      {/* All terms list */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">ประวัติภาคเรียน</p>
        {allTerms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีภาคเรียน</p>
        ) : (
          allTerms.map(term => (
            <div
              key={term.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                term.is_current
                  ? 'border-brand-500/40 bg-brand-500/5'
                  : 'border-border bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${term.is_current ? 'bg-brand-400 motion-safe:animate-pulse' : 'bg-muted-foreground/30'}`} />
                <div>
                  <p className="text-sm font-medium">{term.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatThaiDate(term.start_date)}
                    {term.end_date && ` – ${formatThaiDate(term.end_date)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {term.is_current ? (
                  <Badge variant="gold" className="text-xs">ปัจจุบัน</Badge>
                ) : (
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => setSwitchDialog(term)}
                  >
                    เลือก <ChevronRight size={12} />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={o => { if (!o) { setCreateDialog(false); setCreateError(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar size={16} className="text-brand-text" /> สร้างภาคเรียนใหม่
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลภาคเรียนที่ต้องการสร้าง
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {createError && (
              <Alert variant="destructive">
                <AlertTriangle size={14} />
                <AlertDescription className="text-sm">{createError}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="semester-manager-1" className="text-xs">ปีการศึกษา (พ.ศ.)</Label>
                <Input id="semester-manager-1"
                  value={newYear}
                  onChange={e => setNewYear(e.target.value)}
                  placeholder="2568"
                  className="h-9 text-sm"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="semester-manager-2" className="text-xs">ภาคเรียน</Label>
                <Select value={newSemester} onValueChange={v => setNewSemester(v as '1' | '2')}>
                  <SelectTrigger id="semester-manager-2" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
                    <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="semester-manager-3" className="text-xs">วันเริ่มต้น</Label>
                <Input id="semester-manager-3"
                  type="date"
                  value={newStart}
                  onChange={e => setNewStart(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="semester-manager-4" className="text-xs">วันสิ้นสุด (ไม่บังคับ)</Label>
                <Input id="semester-manager-4"
                  type="date"
                  value={newEnd}
                  onChange={e => setNewEnd(e.target.value)}
                  min={newStart}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {newYear && newSemester && (
              <div className="px-3 py-2 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                <p className="text-xs text-brand-text font-medium">
                  ตัวอย่าง: ภาคเรียนที่ {newSemester}/{newYear}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCreateDialog(false); setCreateError(''); }}>
              ยกเลิก
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating} className="bg-brand-500 hover:bg-brand-400 text-white">
              {creating ? <Loader2 size={13} className="animate-spin mr-1" /> : <Plus size={13} className="mr-1" />}
              สร้าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Switch confirmation dialog */}
      <Dialog open={!!switchDialog} onOpenChange={o => !o && setSwitchDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-warning" /> ยืนยันการเปลี่ยนภาคเรียน
            </DialogTitle>
            <DialogDescription>
              การเปลี่ยนภาคเรียนจะส่งผลต่อการแสดงข้อมูลในระบบ
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="p-3 bg-muted/40 rounded-lg space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">จาก:</span>
                <span className="font-medium">{currentTerm?.label || 'ไม่มี'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ไป:</span>
                <span className="font-bold text-brand-text">{switchDialog?.label}</span>
              </div>
            </div>
            <Alert variant="warning">
              <AlertTriangle size={14} />
              <AlertDescription className="text-xs">
                การเปลี่ยนภาคเรียนไม่กระทบข้อมูลการเช็คชื่อเดิม สามารถย้อนกลับได้ตลอดเวลา
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSwitchDialog(null)}>ยกเลิก</Button>
            <Button size="sm" onClick={handleSwitch} disabled={switching} className="bg-brand-500 hover:bg-brand-400 text-white">
              {switching ? <Loader2 size={13} className="animate-spin mr-1" /> : <CheckCircle2 size={13} className="mr-1" />}
              ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
