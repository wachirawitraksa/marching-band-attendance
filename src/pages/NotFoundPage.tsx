import { Link } from 'react-router-dom';
import { Music2, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen animated-bg flex items-center justify-center px-4">
      <div className="text-center space-y-5">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center brand-glow">
            <Music2 size={28} className="text-white" />
          </div>
        </div>
        <h1 className="text-7xl font-bold text-brand-400">404</h1>
        <h2 className="text-xl font-semibold text-white">ไม่พบหน้าที่ต้องการ</h2>
        <p className="text-gray-400 text-sm">หน้าที่คุณกำลังมองหาไม่มีอยู่ในระบบ</p>
        <Link to="/dashboard">
          <Button className="bg-brand-500 hover:bg-brand-400 text-white gap-2 mt-2">
            <Home size={16} /> กลับหน้าหลัก
          </Button>
        </Link>
      </div>
    </div>
  );
}
