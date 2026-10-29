/**
 * ThaiDateInput — input วัน/เดือน/ปี พ.ศ.
 * รับ/ส่งค่าเป็น ISO string "YYYY-MM-DD" (ค.ศ.) เหมือน <input type="date">
 * แต่แสดงเป็น พ.ศ. ไม่ขึ้นกับ locale ของ OS
 */
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;            // ISO ค.ศ. "2026-06-02" หรือ ""
  onChange: (iso: string) => void;
  min?: string;             // ISO ค.ศ. "2026-06-02"
  className?: string;
  id?: string;              // ผูกกับ <Label htmlFor> — ชี้ที่ช่อง "วัน"
  placeholder?: string;
  disabled?: boolean;
}

const MONTHS_TH = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];

/** วันในแต่ละเดือน (ค.ศ.) */
function daysInMonth(month: number, yearCE: number): number {
  if (!month || !yearCE) return 31;
  return new Date(yearCE, month, 0).getDate();
}

/** แปลง ISO ค.ศ. → { day, month, yearBE } */
function fromISO(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { day: '', month: '', yearBE: '' };
  const [y, m, d] = iso.split('-').map(Number);
  return { day: String(d), month: String(m), yearBE: String(y + 543) };
}

/** แปลง { day, month, yearBE } → ISO ค.ศ. หรือ '' ถ้าข้อมูลไม่ครบ */
function toISO(day: string, month: string, yearBE: string): string {
  const d = parseInt(day);
  const m = parseInt(month);
  const yBE = parseInt(yearBE);
  if (!d || !m || !yBE || yBE < 2500) return '';
  const yCE = yBE - 543;
  return `${yCE}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export function ThaiDateInput({ value, onChange, min, className, disabled, id }: Props) {
  const init = fromISO(value);
  const [day,     setDay]     = useState(init.day);
  const [month,   setMonth]   = useState(init.month);
  const [yearBE,  setYearBE]  = useState(init.yearBE);

  const monthRef = useRef<HTMLSelectElement>(null);
  const yearRef  = useRef<HTMLInputElement>(null);

  // sync เมื่อ value จากภายนอกเปลี่ยน (เช่น reset form)
  useEffect(() => {
    const parsed = fromISO(value);
    setDay(parsed.day);
    setMonth(parsed.month);
    setYearBE(parsed.yearBE);
  }, [value]);

  const emit = (d: string, m: string, y: string) => {
    const iso = toISO(d, m, y);
    onChange(iso);
  };

  // validate min
  const minParsed = fromISO(min || '');
  const minYearBE = minParsed.yearBE ? parseInt(minParsed.yearBE) : 0;

  const yearNum = parseInt(yearBE);
  const yCE = yearNum > 2400 ? yearNum - 543 : yearNum;
  const maxDay = daysInMonth(parseInt(month), yCE);

  return (
    <div role="group" className={cn('flex gap-1.5 items-center', className)}>
      {/* วัน */}
      <input
        id={id}
        type="number"
        aria-label="วัน"
        min={1}
        max={maxDay}
        placeholder="วัน"
        value={day}
        disabled={disabled}
        onChange={e => {
          const v = e.target.value;
          setDay(v);
          emit(v, month, yearBE);
          // auto-advance เมื่อกรอกครบ 2 หลัก
          if (v.length === 2 && parseInt(v) >= 1) monthRef.current?.focus();
        }}
        className={cn(
          'w-14 h-10 rounded-md border border-input bg-background px-2 py-2 text-sm text-center',
          'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
        )}
      />

      <span className="text-muted-foreground text-sm">/</span>

      {/* เดือน */}
      <select
        ref={monthRef}
        aria-label="เดือน"
        value={month}
        disabled={disabled}
        onChange={e => {
          setMonth(e.target.value);
          emit(day, e.target.value, yearBE);
          if (e.target.value) yearRef.current?.focus();
        }}
        className={cn(
          'flex-1 h-10 rounded-md border border-input bg-background px-2 py-2 text-sm',
          'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !month && 'text-muted-foreground'
        )}
      >
        <option value="">เดือน</option>
        {MONTHS_TH.map((m, i) => (
          <option key={i+1} value={String(i+1)}>{m}</option>
        ))}
      </select>

      <span className="text-muted-foreground text-sm">/</span>

      {/* ปี พ.ศ. */}
      <div className="relative">
        <input
          ref={yearRef}
          type="number"
          aria-label="ปี พ.ศ."
          min={minYearBE || 2567}
          max={2599}
          placeholder="ปี พ.ศ."
          value={yearBE}
          disabled={disabled}
          onChange={e => {
            setYearBE(e.target.value);
            emit(day, month, e.target.value);
          }}
          className={cn(
            'w-24 h-10 rounded-md border border-input bg-background px-2 py-2 text-sm text-center',
            'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
          )}
        />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
          พ.ศ.
        </span>
      </div>
    </div>
  );
}
