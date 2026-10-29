import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Music, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';

const NOTES = ['♩', '♪', '♫', '♬', '𝄞', '𝄢'];

function MusicNote({ char, style }: { char: string; style: React.CSSProperties }) {
  return (
    <span
      className="note-particle select-none pointer-events-none text-brand-500/20 font-bold"
      style={style}
    >
      {char}
    </span>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      char: NOTES[i % NOTES.length],
      style: {
        left: `${Math.random() * 90 + 5}%`,
        top: `${Math.random() * 80 + 10}%`,
        fontSize: `${Math.random() * 24 + 16}px`,
        animationDelay: `${Math.random() * 4}s`,
        animationDuration: `${Math.random() * 3 + 3}s`,
      } as React.CSSProperties,
    }))
  );

  const { signIn } = useAuth();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await signIn(email, password);
      // Navigation handled by onAuthStateChange in App.tsx
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (msg.includes('Email not confirmed')) {
        setError('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen animated-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Floating music notes */}
      {notes.map((note) => (
        <MusicNote key={note.id} char={note.char} style={note.style} />
      ))}

      {/* Radial glow */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,158,11,0.06) 0%, transparent 70%)'
      }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 shadow-lg gold-glow">
            <Music2 size={28} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide font-display">Srinan Marching Band</h1>
          <p className="text-sm text-brand-400/70 mt-1">ระบบเช็คชื่อนักเรียน</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/10 p-7 shadow-2xl">
          <h2 className="text-lg font-semibold text-white text-center mb-6">เข้าสู่ระบบ</h2>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-300 text-sm">อีเมล</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-800/70 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-brand-500/50 h-11"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-300 text-sm">รหัสผ่าน</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-800/70 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-brand-500/50 h-11 pr-11"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-brand-400/80 hover:text-brand-400 transition-colors"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm transition-all duration-150 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </Button>
          </form>
        </div>

        {/* <p className="text-center text-xs text-gray-600 mt-6">
          ระบบเช็คชื่อวงโยธวาทิต v1.0
        </p> */}
        
      </div>
    </div>
  );
}
