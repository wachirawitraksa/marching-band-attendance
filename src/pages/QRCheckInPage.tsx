import { getErrorMessage } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { isWithinAttendanceWindow, getTodayBangkok, getCheckInStatus } from '@/lib/utils';
import { useGPS } from '@/hooks/useGPS';
import { SessionType } from '@/types';
import { CheckInSuccessAnimation } from '@/components/CheckInSuccessAnimation';

type Status = 'loading' | 'success' | 'error' | 'already' | 'closed' | 'not_auth' | 'out_of_location';

export default function QRCheckInPage() {
  const { token } = useParams<{ token: string }>();
  const { user, profile } = useAuthStore();
  const { getCurrentPosition } = useGPS();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!user) { setStatus('not_auth'); return; }
    if (!token) { setStatus('error'); setMessage('ลิงก์ QR Code ไม่ถูกต้อง ขอ QR Code ใหม่จากครู'); return; }
    processQR();
  }, [token, user, profile]);

  const processQR = async () => {
    try {
      // Find session by QR token
      const { data: session, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('qr_token', token)
        .single();

      if (error || !session) { setStatus('error'); setMessage('QR Code ไม่ถูกต้องหรือหมดอายุ ขอ QR Code ใหม่จากครู'); return; }

      // Check if session is today
      const today = getTodayBangkok();
      if (session.date !== today) { setStatus('closed'); setMessage('QR Code นี้ไม่ใช่ของวันนี้'); return; }

      // Check time window
      if (!isWithinAttendanceWindow(session.session_type as SessionType, undefined, session.start_time, session.end_time)) {
        setStatus('closed'); setMessage('ยังไม่ถึงเวลาเช็คชื่อ หรือหมดเวลาแล้ว'); return;
      }

      if (!profile) { setStatus('error'); setMessage('ไม่พบข้อมูลผู้ใช้'); return; }

      // Check GPS location
      const gpsData = await getCurrentPosition();
      if (!gpsData.inRange) {
        setStatus('out_of_location');
        setMessage(gpsData.error || `คุณอยู่ห่างจากห้องดนตรี ${gpsData.distance} เมตร (อนุญาตสูงสุด 200 เมตร)`);
        return;
      }

      // Check if already checked in
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('session_id', session.id)
        .eq('student_id', profile.id)
        .single();

      if (existing?.status === 'present') { setStatus('already'); setMessage('คุณเช็คชื่อไปแล้ว'); return; }

      // Check in (สถานะ มาปกติ/สาย ตามเวลาไทย)
      const { error: insertErr } = await supabase
        .from('attendance_records')
        .upsert({
          session_id: session.id,
          student_id: profile.id,
          status: getCheckInStatus(session.session_type as SessionType),
          check_in_time: new Date().toISOString(),
          qr_code_used: true,
          gps_verified: gpsData.inRange,
          gps_lat: gpsData.lat ?? undefined,
          gps_lng: gpsData.lng ?? undefined,
          gps_distance: gpsData.distance ?? undefined,
        }, { onConflict: 'session_id,student_id' });

      if (insertErr) throw insertErr;
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setStatus('success');
      setShowSuccess(true);
      setMessage('เช็คชื่อสำเร็จ!');
    } catch (err) {
      setStatus('error');
      setMessage(getErrorMessage(err, 'ลองสแกนใหม่อีกครั้ง'));
    }
  };

  const iconMap = {
    loading: <Loader2 size={48} className="text-brand-400 animate-spin" />,
    success: <CheckCircle2 size={48} className="text-green-400" />,
    already: <CheckCircle2 size={48} className="text-blue-400" />,
    error: <XCircle size={48} className="text-red-400" />,
    closed: <XCircle size={48} className="text-yellow-400" />,
    out_of_location: <XCircle size={48} className="text-red-400" />,
    not_auth: <XCircle size={48} className="text-red-400" />,
  };

  const titleMap = {
    loading: 'กำลังตรวจสอบ...',
    success: 'เช็คชื่อสำเร็จ!',
    already: 'เช็คชื่อแล้ว',
    error: 'เช็คชื่อไม่สำเร็จ',
    closed: 'ไม่สามารถเช็คชื่อได้',
    out_of_location: 'อยู่นอกพื้นที่',
    not_auth: 'กรุณาเข้าสู่ระบบ',
  };

  return (
    <div className="min-h-screen animated-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 brand-glow">
            <Music2 size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">วงโยธวาทิต</h1>
        </div>

        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl text-center space-y-4">
          {iconMap[status]}
          <h2 className="text-xl font-bold text-white">{titleMap[status]}</h2>
          {message && <p className="text-sm text-gray-400">{message}</p>}

          {status === 'not_auth' && (
            <Button
              className="w-full bg-brand-500 hover:bg-brand-400 text-white font-semibold"
              onClick={() => navigate('/login')}
            >
              ไปหน้าเข้าสู่ระบบ
            </Button>
          )}
          {(status === 'success' || status === 'already' || status === 'error' || status === 'closed' || status === 'out_of_location') && (
            <Button
              className="w-full bg-brand-500 hover:bg-brand-400 text-white font-semibold"
              onClick={() => navigate('/attendance')}
            >
              กลับหน้าเช็คชื่อ
            </Button>
          )}
        </div>
      </div>
      <CheckInSuccessAnimation show={showSuccess} onDone={() => setShowSuccess(false)} />
    </div>
  );
}