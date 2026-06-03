export type Role = 'admin' | 'teacher' | 'student';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type SessionType = 'morning' | 'club' | 'extra';

export interface Section {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  color: string;
  created_at: string;
}

export interface Instrument {
  id: string;
  name: string;
  name_en: string | null;
  section_id: string | null;
  created_at: string;
  section?: Section;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  nickname: string | null;
  role: Role;
  student_id: string | null;
  year_level: number | null;
  section_id: string | null;
  instrument_id: string | null;
  profile_picture_url: string | null;
  is_graduated: boolean;
  is_in_club: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  section?: Section;
  instrument?: Instrument;
}

export interface PracticeSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  session_type: SessionType;
  description: string | null;
  created_by: string | null;
  is_override: boolean;
  qr_token: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_verified: boolean;
  gps_distance: number | null;
  qr_code_used: boolean;
  reason: string | null;
  teacher_override: boolean;
  override_by: string | null;
  override_note: string | null;
  created_at: string;
  updated_at: string;
  student?: Profile;
  session?: PracticeSession;
}

export interface ScheduleOverride {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  description: string;
  created_by: string | null;
  created_at: string;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  presentRate: number;
}

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  morning: 'ซ้อมเช้า',
  club: 'คาบชุมนุม',
  extra: 'ซ้อมพิเศษ',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'มาซ้อม',
  absent: 'ขาดซ้อม',
  late: 'มาสาย',
  excused: 'ลา',
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'ผู้ดูแลระบบ',
  teacher: 'ครู',
  student: 'นักเรียน',
};

export const YEAR_LEVEL_LABELS: Record<number, string> = {
  1: 'มัธยมศึกษาปีที่ 1',
  2: 'มัธยมศึกษาปีที่ 2',
  3: 'มัธยมศึกษาปีที่ 3',
  4: 'มัธยมศึกษาปีที่ 4',
  5: 'มัธยมศึกษาปีที่ 5',
  6: 'มัธยมศึกษาปีที่ 6',
};

export interface AcademicTerm {
  id: string;
  academic_year: number;
  semester: 1 | 2;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  label: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Holiday {
  id: string;
  date: string;
  description: string;
  created_by: string | null;
  created_at: string;
}

export interface HolidayRange {
  id: string;
  start_date: string;
  end_date: string;
  label: string;
  created_by: string | null;
  created_at: string;
}
