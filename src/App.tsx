import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Toaster } from '@/components/ui/toaster';
import { AppLayout } from '@/components/layout/AppLayout';

// Login อยู่ใน bundle หลัก (หน้าแรกของคนที่ยังไม่ล็อกอิน) — หน้าอื่นแยก chunk โหลดเมื่อเข้าถึง
import LoginPage from '@/pages/LoginPage';

// deploy ใหม่ทำให้ชื่อ chunk เก่าหาย (404) → ลอง reload หน้าครั้งเดียวเพื่อดึง index ใหม่ ถ้ายังพังค่อยปล่อย error
function lazyPage<T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) {
  const key = 'chunk-reload';
  return lazy(() =>
    load().then(
      (mod) => { sessionStorage.removeItem(key); return mod; },
      (err) => {
        if (sessionStorage.getItem(key)) throw err;
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }
    )
  );
}

const ForgotPasswordPage = lazyPage(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazyPage(() => import('@/pages/ResetPasswordPage'));
const DashboardPage      = lazyPage(() => import('@/pages/DashboardPage'));
const AttendancePage     = lazyPage(() => import('@/pages/AttendancePage'));
const QRCheckInPage      = lazyPage(() => import('@/pages/QRCheckInPage'));
const ReportsPage        = lazyPage(() => import('@/pages/ReportsPage'));
const StudentsPage       = lazyPage(() => import('@/pages/StudentsPage'));
const ProfilePage        = lazyPage(() => import('@/pages/ProfilePage'));
const AdminPage          = lazyPage(() => import('@/pages/AdminPage'));
const SchedulePage       = lazyPage(() => import('@/pages/SchedulePage'));
const NotFoundPage       = lazyPage(() => import('@/pages/NotFoundPage'));

function PageLoader() {
  return (
    <div role="status" className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      </div>
    </div>
  );
}

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
  const { setUser, setProfile, setLoading, theme } = useAuthStore();
  const navigate   = useNavigate();

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Auth state listener
  useEffect(() => {
    setLoading(true);

    // ลอง promise พร้อม timeout, ถ้าไม่ทันให้ retry อีกครั้งก่อนยอมแพ้
    // (กันเน็ตช้าแล้วโดนตีความว่า session หมดอายุทั้งที่จริงยังไม่หมด)
    async function withRetry<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
      const attempt = () => Promise.race([
        fn(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs)),
      ]);
      try {
        return await attempt();
      } catch {
        // เน็ตอาจแค่ช้าชั่วคราว — ลองอีกครั้งก่อนยอมแพ้จริง
        return await attempt();
      }
    }

    // ใช้แยกว่าตอนนี้เป็นการ "restore session ตอนแอปเพิ่งโหลด" หรือ "login จริง ๆ"
    // (SIGNED_IN ยิงทั้งสองกรณี) — ก่อนเช็คเสร็จรอบแรกถือว่ายังเป็นการ restore เสมอ
    const didInitialAuthCheck = { current: false };

    // โหลดโปรไฟล์ — เรียกได้นอก callback ของ onAuthStateChange เท่านั้น
    const loadProfile = async (userId: string) => {
      try {
        const { data } = await withRetry(
          () => supabase
            .from('profiles')
            .select('*, section:sections(*), instrument:instruments(*, section:sections(*))')
            .eq('id', userId)
            .single() as unknown as Promise<{ data: any }>,
          12000,
          'Profile fetch'
        ) as unknown as { data: any };
        setProfile(data ?? null);
      } catch (profileError) {
        console.error('Profile fetch error:', profileError);
        // อย่าล้าง profile ที่ cache ไว้จากรอบก่อน (persist ผ่าน authStore แล้ว) —
        // ปล่อยให้แอปใช้ข้อมูลเดิมต่อไปได้ระหว่างเน็ตมีปัญหาชั่วคราว แทนที่จะเด้งจอว่าง
      }
    };

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await withRetry(
          () => supabase.auth.getSession(),
          15000,
          'Session check'
        );

        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
        } else {
          // getSession() ตอบกลับมาแล้วจริงๆ ว่าไม่มี session — ค่อยเคลียร์
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        // ทั้ง 2 รอบ (ครั้งแรก + retry) ล้มเหลวจริง — เน็ตน่าจะมีปัญหาจริงจัง
        // ไม่ฟันธงว่า session หมดอายุ (จะได้ไม่เด้งไปหน้า login ทั้งที่ token ยังใช้ได้)
        // ปล่อยให้ ProtectedRoute โชว์ loading ต่อ แล้วให้ onAuthStateChange
        // หรือการเรียก API ครั้งถัดไปเป็นคนตัดสินใจแทน
        console.error('Supabase session check failed after retry:', error);
      } finally {
        setLoading(false);
        didInitialAuthCheck.current = true;
      }
    };

    initializeAuth();

    // สำคัญ: callback นี้ต้องเป็น synchronous และห้าม await คำสั่ง supabase ใด ๆ
    // ภายใน เพราะ supabase-js ถือ navigator lock ตลอดช่วงที่ callback ทำงาน หาก
    // await supabase.from()/auth ข้างในจะเกิด deadlock (สปินค้าง / เด้งกลับหน้า
    // login). ต้องเลื่อนงานที่เรียก DB ออกไปด้วย setTimeout(0) ให้ lock ถูกปล่อยก่อน
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const userId = session.user.id;
        setUser(session.user);
        setLoading(false);
        // เด้งไป dashboard เฉพาะตอน login จริง ๆ (กดปุ่มเข้าสู่ระบบ) ไม่ใช่ตอน
        // restore session ตอนแอปเพิ่งโหลด (SIGNED_IN ยิงตอน restore ด้วย) — ไม่งั้น
        // จะเด้งทับ route ที่ผู้ใช้ตั้งใจเข้า เช่น /qr/:token ตอนสแกน QR
        if (didInitialAuthCheck.current) {
          navigate('/dashboard', { replace: true });
        }
        setTimeout(() => { loadProfile(userId); }, 0);
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

  return (
    <>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
      <Toaster />
    </>
  );
}
