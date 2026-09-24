// components/reports/ExportReportDialog.tsx
import { useState } from 'react';
import { FileDown, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { Profile, PracticeSession, AttendanceRecord, AttendanceStatus } from '@/types';
import { formatThaiDate, getTodayBangkok, normalizeInputDate } from '@/lib/utils';
import { downloadAttendancePDF, ReportSession, ReportRow } from './AttendanceReportPDF';
import { shouldExcludeFromStats } from '@/lib/attendanceExemption';

const DAY_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// preset ranges
function getPresetRange(preset: string): { start: string; end: string } {
  const today = getTodayBangkok();
  const d = new Date(today);

  if (preset === 'this_week') {
    const dow = d.getDay(); // 0=Sun
    const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
    return { start: mon.toISOString().slice(0, 10), end: fri.toISOString().slice(0, 10) };
  }
  if (preset === 'last_week') {
    const dow = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) - 7);
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
    return { start: mon.toISOString().slice(0, 10), end: fri.toISOString().slice(0, 10) };
  }
  if (preset === 'this_month') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    return { start, end: today };
  }
  if (preset === 'last_month') {
    const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const last  = new Date(d.getFullYear(), d.getMonth(), 0);
    return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
  }
  // term — ตั้งแต่ต้นปีการศึกษา (พ.ค.) ถึงวันนี้
  if (preset === 'this_term') {
    const year = d.getMonth() >= 4 ? d.getFullYear() : d.getFullYear() - 1;
    return { start: `${year}-05-01`, end: today };
  }
  return { start: today, end: today };
}

interface Props {
  /** ส่ง students ที่ filter แล้วจาก ReportsPage มาใช้ */
  students: Profile[];
}

export function ExportReportDialog({ students }: Props) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('this_week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // เมื่อเปลี่ยน preset → อัปเดต date inputs
  const handlePreset = (val: string) => {
    setPreset(val);
    if (val !== 'custom') {
      const { start, end } = getPresetRange(val);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // init เมื่อ dialog เปิด
  const handleOpen = (o: boolean) => {
    if (o) {
      const { start, end } = getPresetRange('this_week');
      setStartDate(start);
      setEndDate(end);
      setPreset('this_week');
    }
    setOpen(o);
  };

  const handleExport = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const start = normalizeInputDate(startDate);
      const end   = normalizeInputDate(endDate);

      // 1. ดึง sessions ในช่วงที่เลือก
      const { data: sessionsRaw } = await supabase
        .from('practice_sessions')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date')
        .order('start_time');

      const sessions: PracticeSession[] = sessionsRaw || [];

      if (sessions.length === 0) {
        alert('ไม่มีรอบซ้อมในช่วงเวลาที่เลือก');
        setLoading(false);
        return;
      }

      // 2. ดึง attendance records ทั้งหมดของ sessions เหล่านี้
      // ⚠️ Supabase/PostgREST คืนได้สูงสุด 1,000 แถวต่อ query โดย default (ไม่ error แค่ตัดข้อมูลเงียบๆ)
      // นักเรียน 58 คน × จำนวนคาบที่เพิ่มขึ้นเรื่อยๆ ทำให้เกิน 1,000 แถวได้ง่าย ต้อง paginate ดึงทีละหน้า
      const records: Pick<AttendanceRecord, 'session_id' | 'student_id' | 'status'>[] = [];
      {
        const PAGE_SIZE = 1000;
        let from = 0;
        while (true) {
          const { data: page, error: pageErr } = await supabase
            .from('attendance_records')
            .select('session_id, student_id, status')
            .in('session_id', sessions.map(s => s.id))
            .range(from, from + PAGE_SIZE - 1);

          if (pageErr) throw pageErr;
          if (!page || page.length === 0) break;

          records.push(...page);
          if (page.length < PAGE_SIZE) break; // หน้าสุดท้ายแล้ว
          from += PAGE_SIZE;
        }
      }

      // 3. สร้าง lookup map: `${student_id}__${session_id}` → status
      const lookup: Record<string, AttendanceStatus> = {};
      records.forEach(r => {
        lookup[`${r.student_id}__${r.session_id}`] = r.status;
      });

      // 4. สร้าง ReportSession labels
      // หมายเหตุ: วันพฤหัสมีทั้งคาบเช้าและคาบชุมนุม ใช้ session_type แยกป้ายกำกับ
      // เพื่อไม่ให้ดูสับสนว่าคอลัมน์ไหนคือคาบไหน
      // ⚠️ ปรับเงื่อนไข s.session_type === 'club' ตรงนี้ให้ตรงกับค่า enum จริงใน types.ts
      const reportSessions: ReportSession[] = sessions.map(s => {
        const d = new Date(s.date + 'T12:00:00Z');
        const dowIndex = d.getUTCDay();
        const dateStr = `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}`;
        const dayName = dowIndex === 4
          ? `พฤ(${s.session_type === 'club' ? 'ชุมนุม' : 'เช้า'})`
          : DAY_TH[dowIndex];
        return {
          session: s,
          dayLabel: `${dayName}\n${dateStr}`,
        };
      });

      // 5. สร้าง ReportRow ต่อนักเรียน — คนที่ไม่อยู่ชุมนุมดนตรี (ไป ร.ด.) จะขึ้น "นศท." ช่วงพฤหัสบ่าย แทนสถานะจริง
      const rows: ReportRow[] = students.map(student => {
        const statusMap: Record<string, AttendanceStatus | 'rd_exempt' | null> = {};
        sessions.forEach(s => {
          statusMap[s.id] = shouldExcludeFromStats(s, student)
            ? 'rd_exempt'
            : (lookup[`${student.id}__${s.id}`] ?? null);
        });
        return { student, statusMap };
      });

      // 6. สร้าง title
      const startBE = formatThaiDate(start);
      const endBE   = formatThaiDate(end);
      const dateRange = startBE === endBE
        ? `วันที่ ${startBE}`
        : `ช่วง ${startBE} – ${endBE}`;

      await downloadAttendancePDF({
        title: 'รายงานการเข้าซ้อม วงโยธวาทิต',
        dateRange,
        sessions: reportSessions,
        rows,
      });

      setOpen(false);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสร้าง PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs border-brand-500/30 text-brand-400 hover:bg-brand-500/10">
          <FileDown size={14} />
          ดาวน์โหลด PDF
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calendar size={16} className="text-brand-400" />
            ออกรายงาน PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Preset */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ช่วงเวลา</Label>
            <Select value={preset} onValueChange={handlePreset}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_week">สัปดาห์นี้</SelectItem>
                <SelectItem value="last_week">สัปดาห์ที่แล้ว</SelectItem>
                <SelectItem value="this_month">เดือนนี้</SelectItem>
                <SelectItem value="last_month">เดือนที่แล้ว</SelectItem>
                <SelectItem value="this_term">ภาคเรียนนี้ (พ.ค. – ปัจจุบัน)</SelectItem>
                <SelectItem value="custom">กำหนดเอง</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">วันเริ่ม</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPreset('custom'); }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">วันสิ้นสุด</Label>
              <Input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPreset('custom'); }}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            จะแสดงนักเรียน <span className="text-brand-400 font-semibold">{students.length} คน</span> ตาม filter ที่เลือกไว้
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              className="flex-1 h-9 text-sm bg-brand-500 hover:bg-brand-400 text-white gap-1.5"
              onClick={handleExport}
              disabled={loading || !startDate || !endDate}
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> กำลังสร้าง...</>
              ) : (
                <><FileDown size={14} /> ดาวน์โหลด</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}