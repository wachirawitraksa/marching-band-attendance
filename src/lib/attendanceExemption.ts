// src/lib/attendanceExemption.ts
//
// นักเรียนที่ is_in_club = false (ไม่ได้อยู่ชุมนุมดนตรี) จะไปเรียน ร.ด. แทน
// ในวันพฤหัสรอบบ่าย — ดังนั้นช่วงเวลานี้ไม่ควรนับว่า "ขาดซ้อม" สำหรับคนกลุ่มนี้
//
// จุดเดียวที่ต้องปรับ ถ้า session_type มีค่าเฉพาะสำหรับรอบนี้ (เช่น 'rd_afternoon'):
// ใส่ค่านั้นลงใน THURSDAY_AFTERNOON_SESSION_TYPES ด้านล่าง ระบบจะเช็คจาก session_type
// แทนการเดาจากเวลาเริ่มทันที

import { PracticeSession, Profile, AttendanceRecord } from '@/types';

// TODO: ยืนยันจาก `SELECT DISTINCT session_type FROM practice_sessions;` แล้วใส่ค่าที่ตรงกับ
// "รอบบ่ายวันพฤหัส" ตรงนี้ ถ้ามี session_type เฉพาะ เช่น ['rd_afternoon']
const THURSDAY_AFTERNOON_SESSION_TYPES: string[] = [];

// ถ้าไม่มี session_type เฉพาะ ใช้เวลาเริ่ม >= ชั่วโมงนี้เป็นตัวตัดสิน "รอบบ่าย"
const AFTERNOON_START_HOUR = 12;

const THURSDAY_DOW = 4; // JS: 0=อาทิตย์, 1=จันทร์, ... 4=พฤหัสบดี

export function isThursdayAfternoonSession(
  session: Pick<PracticeSession, 'date' | 'session_type' | 'start_time'>
): boolean {
  const dow = new Date(`${session.date}T12:00:00`).getDay();
  if (dow !== THURSDAY_DOW) return false;

  if (THURSDAY_AFTERNOON_SESSION_TYPES.length > 0) {
    return THURSDAY_AFTERNOON_SESSION_TYPES.includes(session.session_type);
  }
  const hour = parseInt(session.start_time.split(':')[0], 10);
  return hour >= AFTERNOON_START_HOUR;
}

// นักเรียนที่ไม่ได้อยู่ชุมนุมดนตรี = อยู่ ร.ด. แทน
export function isRdInsteadOfClub(student: Pick<Profile, 'is_in_club'>): boolean {
  return student.is_in_club === false;
}

// true = ควรตัด record นี้ออกจากการนับสถิติ (เว็บ) เพราะเป็นช่วง ร.ด. ของนักเรียนคนนี้
export function shouldExcludeFromStats(
  session: Pick<PracticeSession, 'date' | 'session_type' | 'start_time'>,
  student: Pick<Profile, 'is_in_club'>
): boolean {
  return isThursdayAfternoonSession(session) && isRdInsteadOfClub(student);
}

// กรอง record ทั้งชุดก่อนนับสถิติ (ใช้กับข้อมูลที่ join session มาด้วยแล้ว เช่น
// useStudentAllAttendance, useAllAttendanceRecords)
export function filterOutRdExempt<T extends { session?: PracticeSession | null; student?: Pick<Profile, 'is_in_club'> | null }>(
  records: T[],
  studentOverride?: Pick<Profile, 'is_in_club'>
): T[] {
  return records.filter((r) => {
    const student = studentOverride ?? r.student;
    if (!r.session || !student) return true; // ข้อมูลไม่ครบ ไม่กรอง (กันพลาด)
    return !shouldExcludeFromStats(r.session, student);
  });
}

// ใช้ตอนสร้าง PDF: คืนค่า label พิเศษ 'นศท.' แทนสถานะจริง ถ้าเข้าเงื่อนไขยกเว้น
export type PdfCellStatus = AttendanceRecord['status'] | 'rd_exempt' | null;

export function getPdfCellStatus(
  rawStatus: AttendanceRecord['status'] | null,
  session: Pick<PracticeSession, 'date' | 'session_type' | 'start_time'>,
  student: Pick<Profile, 'is_in_club'>
): PdfCellStatus {
  if (shouldExcludeFromStats(session, student)) return 'rd_exempt';
  return rawStatus;
}

// แยกนักเรียนของรอบนี้: คนที่ต้องมาซ้อม (ใช้เป็นตัวหาร) กับคนที่ไป ร.ด. (ไม่นับในรอบนี้)
export function splitRdExempt<T extends Pick<Profile, 'is_in_club'>>(
  session: Pick<PracticeSession, 'date' | 'session_type' | 'start_time'>,
  students: T[]
): { expected: T[]; exempt: T[] } {
  if (!isThursdayAfternoonSession(session)) return { expected: students, exempt: [] };
  const expected: T[] = [];
  const exempt: T[] = [];
  students.forEach((s) => (isRdInsteadOfClub(s) ? exempt : expected).push(s));
  return { expected, exempt };
}
