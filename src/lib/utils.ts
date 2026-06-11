import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseISO } from 'date-fns';
import { AttendanceStatus, SessionType } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** แปลง Date เป็น วว/ดด/ปปปป (พ.ศ.) เช่น 05/06/2569 */
function toBE(d: Date): string {
  // ใช้ UTC เพื่อป้องกัน timezone shift
  const day   = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year  = d.getUTCFullYear() + 543;
  return `${day}/${month}/${year}`;
}

/** แปลง date string/Date → Date object (UTC-safe) */
function toDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  // ISO date only "YYYY-MM-DD" → parse as UTC noon to avoid timezone shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(date + 'T12:00:00Z');
  }
  return parseISO(date);
}

/** เดิมชื่อ formatDate — ตอนนี้คืน วว/ดด/ปปปป พ.ศ. */
export function formatDate(date: string | Date): string {
  return toBE(toDate(date));
}

/**
 * แก้ปัญหา Windows Thai locale ส่ง input date value เป็น พ.ศ. (2569-06-05)
 * แทน ค.ศ. (2026-06-05) → ตรวจสอบและแปลงกลับก่อนใช้
 */
export function normalizeInputDate(value: string): string {
  if (!value) return value;
  const [yearStr, month, day] = value.split('-');
  const year = parseInt(yearStr, 10);
  // ถ้าปี > 2400 แสดงว่าเป็น พ.ศ. → ลบ 543
  const ceYear = year > 2400 ? year - 543 : year;
  return `${ceYear}-${month}-${day}`;
}

/** วว/ดด/ปปปป พ.ศ. — ใช้ทั่วทั้งระบบ */
export function formatThaiDate(date: string | Date): string {
  return toBE(toDate(date));
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  return `${h}:${m} น.`;
}

/** วว/ดด/ปปปป พ.ศ. HH:mm เช่น 05/06/2569 07:30 */
export function formatDatetime(datetime: string): string {
  const d = parseISO(datetime);
  const datePart = toBE(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hh}:${mm}`;
}

export function getDayOfWeekThai(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return days[d.getDay()];
}

/**
 * เขตเวลาประเทศไทย — ใช้คำนวณวันที่/เวลาทุกครั้งที่เกี่ยวกับการเช็คชื่อ
 * เพื่อกันบั๊ก timezone: toISOString() / getHours() อิงเวลา UTC หรือเวลาเครื่อง
 * ซึ่งช่วงตี 5–เที่ยงคืนของไทย (UTC+7) จะถูกตีความเป็น "เมื่อวาน" ทำให้หารอบซ้อมไม่เจอ
 */
const BANGKOK_TZ = 'Asia/Bangkok';

/** วันที่วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function getTodayBangkok(base: Date = new Date()): string {
  // en-CA ให้รูปแบบ YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(base);
}

/** วันที่ตามเวลาไทย บวก/ลบจำนวนวัน รูปแบบ YYYY-MM-DD (ไทยไม่มี DST จึงบวกเป็นมิลลิวินาทีได้) */
export function getBangkokDateWithOffset(days: number, base: Date = new Date()): string {
  return getTodayBangkok(new Date(base.getTime() + days * 24 * 60 * 60 * 1000));
}

/** จำนวนนาทีนับจากเที่ยงคืนตามเวลาไทย */
export function getBangkokMinutesOfDay(base: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(base);
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0') % 24;
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

/** วันในสัปดาห์ตามเวลาไทย: 0=อาทิตย์ ... 6=เสาร์ */
export function getBangkokDayOfWeek(base: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: BANGKOK_TZ, weekday: 'short' }).format(base);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

/**
 * กติกาเวลาเช็คชื่อแต่ละประเภทรอบซ้อม (นาทีนับจากเที่ยงคืน เวลาไทย)
 *  - open         : เริ่มเปิดให้เช็คชื่อ
 *  - presentUntil : เช็คภายในเวลานี้ = มาปกติ (present)
 *  - lateUntil    : เช็คภายในเวลานี้ = มาสาย (late) — เลยจากนี้ถือว่าขาด (absent) และปิดรับเช็ค
 */
export const ATTENDANCE_RULES: Record<SessionType, { open: number; presentUntil: number; lateUntil: number } | null> = {
  // ซ้อมเช้า จ.–ศ.:
  //   เปิดรับเช็ค: 05:00
  //   มาปกติ:     05:00–07:45
  //   มาสาย:      07:46–08:09
  //   ขาด/ปิด:    08:10 เป็นต้นไป (ไม่รับเช็คอีก → ระบบอัพเดตเป็นขาดอัตโนมัติ)
  morning: { open: 5 * 60, presentUntil: 7 * 60 + 45, lateUntil: 8 * 60 + 9 },
  // คาบชุมนุม:
  //   เปิดรับเช็ค: 15:20
  //   มาปกติ:     15:20–15:35
  //   มาสาย:      15:36–15:45
  //   ขาด/ปิด:    15:46 เป็นต้นไป (ไม่รับเช็คอีก → ระบบอัพเดตเป็นขาดอัตโนมัติ)
  club: { open: 15 * 60 + 20, presentUntil: 15 * 60 + 35, lateUntil: 15 * 60 + 45 },
  // ซ้อมพิเศษ: ครูควบคุมเอง ไม่มีกติกาเวลาตายตัว
  extra: null,
};

/**
 * คำนวณสถานะการเช็คชื่อจากเวลาไทยปัจจุบัน: present / late / absent
 * โยน Error ถ้าเช็คนอกหน้าต่างเวลาที่อนุญาต (ก่อนเปิด หรือ หลังปิด)
 */
export function getCheckInStatus(
  sessionType: SessionType,
  minutes: number = getBangkokMinutesOfDay(),
): AttendanceStatus {
  const rule = ATTENDANCE_RULES[sessionType];
  if (!rule) return 'present'; // ซ้อมพิเศษ: ครูควบคุมเอง

  if (minutes < rule.open) {
    const openH = String(Math.floor(rule.open / 60)).padStart(2, '0');
    const openM = String(rule.open % 60).padStart(2, '0');
    throw new Error(`ยังไม่ถึงเวลาเช็คชื่อ — เปิดรับเช็คเวลา ${openH}:${openM} น.`);
  }
  if (minutes > rule.lateUntil) {
    throw new Error('หมดเวลาเช็คชื่อแล้ว — ระบบบันทึกเป็นขาดซ้อมอัตโนมัติ');
  }
  if (minutes <= rule.presentUntil) return 'present';
  return 'late';
}

export function isWithinAttendanceWindow(sessionType: SessionType, date?: Date, startTime?: string, endTime?: string): boolean {
  const base = date || new Date();
  const totalMinutes = getBangkokMinutesOfDay(base);
  const rule = ATTENDANCE_RULES[sessionType];

  // รอบที่มีกติกาเวลา (ซ้อมเช้า / คาบชุมนุม) ใช้กติกากลางเสมอ เพื่อให้เช็คได้ตั้งแต่เวลาเปิดจริง
  if (rule) {
    // ซ้อมเช้าเปิดเฉพาะวันจันทร์–ศุกร์
    if (sessionType === 'morning') {
      const dayOfWeek = getBangkokDayOfWeek(base);
      if (dayOfWeek < 1 || dayOfWeek > 5) return false;
    }
    // เปิดตั้งแต่เวลาเริ่ม จนถึงนาทีสุดท้ายที่ยังนับว่าสาย (หลังจากนั้นถือว่าขาด → ปิดรับเช็ค)
    return totalMinutes >= rule.open && totalMinutes <= rule.lateUntil;
  }

  // ซ้อมพิเศษ: ใช้เวลาเริ่ม–สิ้นสุดจากฐานข้อมูลถ้ามี
  if (startTime && endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    return totalMinutes >= startHour * 60 + startMin && totalMinutes <= endHour * 60 + endMin;
  }

  return true; // ไม่มีเวลากำหนด = เปิดตลอด (ครูควบคุม)
}

export function getStatusColor(status: AttendanceStatus): string {
  const colors: Record<AttendanceStatus, string> = {
    present: 'text-green-500 bg-green-500/10 border-green-500/30',
    absent: 'text-red-500 bg-red-500/10 border-red-500/30',
    late: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
    excused: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  };
  return colors[status];
}

export function getStatusBadgeVariant(status: AttendanceStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<AttendanceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    present: 'default',
    absent: 'destructive',
    late: 'secondary',
    excused: 'outline',
  };
  return variants[status];
}

export function calculateAttendanceRate(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

export function getCurrentAcademicYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const buddhistYear = now.getFullYear() + 543;
  // Academic year starts in May
  return month >= 5 ? buddhistYear : buddhistYear - 1;
}

/**
 * คืนปีการศึกษา (พ.ศ.) ของวันที่ที่กำหนด โดยใช้เกณฑ์เดียวกับ getCurrentAcademicYear
 * คือปีการศึกษาเริ่มเดือนพฤษภาคม เช่น 2025-06-01 → 2568, 2026-03-01 → 2568
 */
export function getAcademicYearOf(date: string | Date): number {
  const d = toDate(date);
  const month = d.getUTCMonth() + 1;
  const buddhistYear = d.getUTCFullYear() + 543;
  return month >= 5 ? buddhistYear : buddhistYear - 1;
}


/**
 * ตรวจว่ารอบนี้ควรถูกปิดและ mark absent หรือยัง
 * คืน true ถ้าเลยหน้าต่าง lateUntil แล้ว (ควร auto-mark absent)
 */
export function isPastAttendanceWindow(sessionType: SessionType, minutes: number = getBangkokMinutesOfDay()): boolean {
  const rule = ATTENDANCE_RULES[sessionType];
  if (!rule) return false; // ซ้อมพิเศษ: ไม่มี auto-close
  if (sessionType === 'morning') {
    const dayOfWeek = getBangkokDayOfWeek();
    if (dayOfWeek < 1 || dayOfWeek > 5) return false;
  }
  return minutes > rule.lateUntil;
}

export function getAvatarFallback(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}