import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Toaster } from '@/components/ui/toaster';
import { AppLayout } from '@/components/layout/AppLayout';

// Pages
import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import AttendancePage from '@/pages/AttendancePage';
import QRCheckInPage from '@/pages/QRCheckInPage';
import ReportsPage from '@/pages/ReportsPage';
import StudentsPage from '@/pages/StudentsPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminPage from '@/pages/AdminPage';
import SchedulePage from '@/pages/SchedulePage';
import NotFoundPage from '@/pages/NotFoundPage';

// Idle timeout = 3 ชั่วโมง 30 นาที
const IDLE_TIMEOUT_MS = (3 * 60 + 30) * 60 * 1000;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore();
  if (!profile || !['admin', 'teacher'].includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { user, setUser, setProfile, setLoading, clear, theme } = useAuthStore();
  const navigate   = useNavigate();
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Auth state listener
  useEffect(() => {
    setLoading(true);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('*, section:sections(*), instrument:instruments(*, section:sections(*))')
          .eq('id', session.user.id)
          .single();
        if (data) setProfile(data);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const { data } = await supabase
          .from('profiles')
          .select('*, section:sections(*), instrument:instruments(*, section:sections(*))')
          .eq('id', session.user.id)
          .single();
        if (data) setProfile(data);
        setLoading(false);
        navigate('/dashboard', { replace: true });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        navigate('/login', { replace: true });
      } else if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setProfile, setLoading, navigate]);

  // Idle timeout — logout หลังไม่มีการใช้งาน 3 ชม. 30 นาที
  useEffect(() => {
    if (!user) {
      // ไม่ได้ login อยู่ — ไม่ต้องนับ
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }

    const signOutDueToIdle = async () => {
      await supabase.auth.signOut();
      clear();
      navigate('/login', { replace: true });
    };

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(signOutDueToIdle, IDLE_TIMEOUT_MS);
    };

    // events ที่ถือว่า "active"
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'visibilitychange'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // เริ่มนับครั้งแรก

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, navigate, clear]);

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/qr/:token"       element={<QRCheckInPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="schedule"   element={<SchedulePage />} />
          <Route path="reports"    element={<ReportsPage />} />
          <Route path="profile"    element={<ProfilePage />} />
          <Route path="students"   element={<AdminRoute><StudentsPage /></AdminRoute>} />
          <Route path="admin"      element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </>
  );
}