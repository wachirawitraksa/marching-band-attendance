// src/components/CheckInSuccessAnimation.tsx
//
// Overlay สั้นๆ ตอนเช็คชื่อสำเร็จ — checkmark เด้ง + fade ออกเองใน ~1.4 วิ
// ใช้ CSS keyframes ล้วน เบามาก ไม่ต้องพึ่ง animation library

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

interface Props {
  show: boolean;
  onDone?: () => void;
  label?: string;
}

export function CheckInSuccessAnimation({ show, onDone, label = 'เช็คชื่อสำเร็จ!' }: Props) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1400);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 animate-[checkinFadeIn_0.15s_ease-out]" />
      <div className="relative flex flex-col items-center gap-3 animate-[checkinPop_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-2xl shadow-green-500/40">
          <Check size={40} strokeWidth={3} className="text-white animate-[checkinDraw_0.3s_ease-out_0.15s_both]" />
        </div>
        <p className="text-white font-semibold text-sm bg-black/60 px-3 py-1 rounded-full">{label}</p>
      </div>

      <style>{`
        @keyframes checkinFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes checkinPop {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkinDraw {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}