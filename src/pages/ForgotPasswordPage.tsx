import { getErrorMessage } from '@/lib/utils';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Music2, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('กรุณากรอกอีเมล'); return; }
    setIsLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'ส่งลิงก์รีเซ็ตรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen animated-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 shadow-lg gold-glow">
            <Music2 size={24} className="text-black" />
          </div>
          <h1 className="text-xl font-bold text-white">วงโยธวาทิต</h1>
        </div>

        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/10 p-7 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle size={48} className="text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">ส่งอีเมลแล้ว!</h2>
              <p className="text-sm text-gray-400">
                กรุณาตรวจสอบอีเมล <span className="text-brand-400">{email}</span> และคลิกลิงก์เพื่อรีเซ็ตรหัสผ่าน
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full mt-2">
                  <ArrowLeft size={16} className="mr-2" />
                  กลับไปหน้าเข้าสู่ระบบ
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white text-center">ลืมรหัสผ่าน</h2>
                <p className="text-xs text-gray-400 text-center mt-1">กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-gray-300 text-sm">อีเมล</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-gray-800/70 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-brand-500/50 h-11 pl-10"
                      disabled={isLoading}
                    />
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-brand-500 hover:bg-brand-400 text-white font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      กำลังส่ง...
                    </span>
                  ) : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
                </Button>

                <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors mt-2">
                  <ArrowLeft size={12} />
                  กลับไปหน้าเข้าสู่ระบบ
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
