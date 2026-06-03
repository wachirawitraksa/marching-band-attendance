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

export function isWithinAttendanceWindow(sessionType: SessionType, date?: Date): boolean {
  const now = date || new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat

  if (sessionType === 'morning') {
    // Mon-Fri (1-5): 05:00-08:30
    if (dayOfWeek < 1 || dayOfWeek > 5) return false;
    const start = 5 * 60; // 05:00
    const end = 8 * 60; // 08:00
    return totalMinutes >= start && totalMinutes <= end;
  }

  if (sessionType === 'club') {
    // Thursday (4): 15:20-16:10
    if (dayOfWeek !== 4) return false;
    const start = 15 * 60 + 20; // 15:20
    const end = 15 * 60 + 45; // 15:45
    return totalMinutes >= start && totalMinutes <= end;
  }

  if (sessionType === 'extra') {
    return true; // Extra sessions are always open (teacher controlled)
  }

  return false;
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

// School GPS coordinates - Fixed location
export const SCHOOL_LOCATION = {
  lat: 18.7784475,
  lng: 100.780098,
  name: 'ห้องดนตรี',
  allowedRadius: 200, // meters
};

export function isWithinSchool(lat: number, lng: number): { inRange: boolean; distance: number } {
  const distance = haversineDistance(lat, lng, SCHOOL_LOCATION.lat, SCHOOL_LOCATION.lng);
  return {
    inRange: distance <= SCHOOL_LOCATION.allowedRadius,
    distance: Math.round(distance),
  };
}
