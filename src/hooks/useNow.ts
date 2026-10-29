import { useEffect, useState } from 'react';

/**
 * re-render ทุก intervalMs เพื่อให้สถานะที่ขึ้นกับเวลา (เปิด/ปิดเช็คชื่อ) เปลี่ยนเองตอนถึงเวลา
 * โดยผู้ใช้ไม่ต้องกดรีเฟรช — คืนค่า Date ปัจจุบัน
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
