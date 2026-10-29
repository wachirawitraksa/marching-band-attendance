// QR เช็คชื่อแบบเต็มจอ — ครูชูมือถือหรือฉายขึ้นจอให้ทั้งวงสแกน
// ตัวนับ "มาแล้ว x/y" และรายชื่อคนล่าสุดอัปเดตสดผ่าน realtime ของ useAllAttendance
import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, Minimize2, X, Clock } from 'lucide-react';
import { useAllAttendance } from '@/hooks/useAttendance';
import { useStudents } from '@/hooks/useSupabaseQueries';
import { splitRdExempt } from '@/lib/attendanceExemption';
import { formatTime, type AttendanceWindowState } from '@/lib/utils';
import { PracticeSession, SESSION_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types';

interface Props {
  session: PracticeSession | null;
  windowState: AttendanceWindowState;
  onClose: () => void;
}

export function QRPresenter({ session, windowState, onClose }: Props) {
  return (
    <DialogPrimitive.Root open={!!session} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby="qr-presenter-hint"
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {session && <PresenterBody session={session} windowState={windowState} onClose={onClose} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PresenterBody({ session, windowState, onClose }: { session: PracticeSession; windowState: AttendanceWindowState; onClose: () => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { records } = useAllAttendance(session.id);
  const { data: activeStudents = [] } = useStudents({ graduated: false, activeOnly: true });
  // คาบบ่ายวันพฤหัสไม่นับคนที่ไป ร.ด.
  const students = splitRdExempt(session, activeStudents).expected;
  const expectedIds = new Set(students.map(s => s.id));
  const here = records.filter(r => expectedIds.has(r.student_id) && (r.status === 'present' || r.status === 'late')).length;
  const recent = records
    .filter(r => r.check_in_time && (r.status === 'present' || r.status === 'late'))
    .sort((a, b) => (b.check_in_time ?? '').localeCompare(a.check_in_time ?? ''))
    .slice(0, 5);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const url = `${window.location.origin}/qr/${session.qr_token}`;
  const sessionName = SESSION_TYPE_LABELS[session.session_type];

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-lg font-bold truncate">เช็คชื่อ · {sessionName}</DialogPrimitive.Title>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock size={13} /> {formatTime(session.start_time)} – {formatTime(session.end_time)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {typeof document !== 'undefined' && document.fullscreenEnabled && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'ออกจากโหมดเต็มจอ' : 'แสดงเต็มจอ'}
              className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-muted transition-colors"
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
          )}
          <DialogPrimitive.Close
            aria-label="ปิด QR Code"
            className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-muted transition-colors"
            onClick={onClose}
          >
            <X size={22} />
          </DialogPrimitive.Close>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto flex h-full max-w-5xl flex-col items-center justify-center gap-6 p-4 md:flex-row md:gap-10">
          {/* QR: พื้นขาวเสมอเพื่อให้สแกนติดทั้งธีมสว่างและมืด */}
          <div className="w-full max-w-[min(88vw,60vh)] md:max-w-[min(50vw,72vh)] rounded-2xl bg-white p-4 shadow-lg">
            <QRCodeSVG value={url} size={512} level="H" style={{ width: '100%', height: 'auto' }} />
          </div>

          <div className="flex w-full max-w-sm flex-col items-center gap-5 md:items-start">
            <div aria-live="polite" className="text-center md:text-left">
              <p className="text-sm text-muted-foreground">มาแล้ว</p>
              <p className="font-bold tabular-nums leading-none">
                <span className="text-6xl md:text-7xl text-success">{here}</span>
                <span className="text-3xl md:text-4xl text-muted-foreground">/{students.length}</span>
              </p>
            </div>

            {windowState !== 'open' && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
                {windowState === 'before'
                  ? `ยังไม่เปิดเช็คชื่อ — สแกนได้ตั้งแต่ ${formatTime(session.start_time)}`
                  : 'หมดเวลาเช็คชื่อรอบนี้แล้ว — สแกนตอนนี้ระบบจะไม่บันทึก'}
              </p>
            )}

            <div className="w-full">
              <p className="text-sm font-medium text-muted-foreground mb-2">เช็คชื่อล่าสุด</p>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีใครเช็คชื่อ</p>
              ) : (
                <ul className="space-y-1.5">
                  {recent.map(r => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-base">
                      <span className="truncate font-medium">
                        {r.student?.nickname || r.student?.full_name?.split(' ')[0] || 'นักเรียน'}
                        {r.student?.instrument?.name && <span className="ml-1.5 text-sm text-muted-foreground">{r.student.instrument.name}</span>}
                      </span>
                      <span className={`shrink-0 text-sm tabular-nums ${r.status === 'late' ? 'text-warning' : 'text-muted-foreground'}`}>
                        {r.status === 'late' && `${ATTENDANCE_STATUS_LABELS.late} · `}
                        {new Date(r.check_in_time as string).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p id="qr-presenter-hint" className="text-sm text-muted-foreground">
              สแกนด้วยกล้องมือถือ แล้วเข้าสู่ระบบด้วยบัญชีนักเรียน
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
