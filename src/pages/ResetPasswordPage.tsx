import { getErrorMessage } from '@/lib/utils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Music2, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) { setError('กรุณากรอกรหัสผ่าน'); return; }
    if (password.length < 6) { setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (password !== confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }

    setIsLoading(true);
    setError('');
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(getErrorMessage(err, 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลองขอลิงก์รีเซ็ตใหม่อีกครั้ง'));
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
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle size={48} className="text-green-400 mx-auto" />
              <h2 className="text-lg font-semibold text-white">เปลี่ยนรหัสผ่านสำเร็จ!</h2>
              <p className="text-sm text-gray-400">กำลังพาไปหน้าเข้าสู่ระบบ...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white text-center">ตั้งรหัสผ่านใหม่</h2>
                <p className="text-xs text-gray-400 text-center mt-1">กรอกรหัสผ่านใหม่ของคุณ</p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-password-page-1" className="text-gray-300 text-sm">รหัสผ่านใหม่</Label>
                  <div className="relative">
                    <Input id="reset-password-page-1"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="อย่างน้อย 6 ตัวอักษร"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-gray-800/70 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-brand-500/50 h-11 pl-10 pr-11"
                      disabled={isLoading}
                    />
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-gray-400 hover:text-gray-200">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reset-password-page-2" className="text-gray-300 text-sm">ยืนยันรหัสผ่านใหม่</Label>
                  <div className="relative">
                    <Input id="reset-password-page-2"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="bg-gray-800/70 border-gray-700 text-white placeholder:text-gray-500 focus-visible:ring-brand-500/50 h-11 pl-10 pr-11"
                      disabled={isLoading}
                    />
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 bg-brand-500 hover:bg-brand-400 text-white font-semibold" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      กำลังบันทึก...
                    </span>
                  ) : 'บันทึกรหัสผ่านใหม่'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
