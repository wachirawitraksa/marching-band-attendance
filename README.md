# 🎼 วงโยธวาทิต - ระบบเช็คชื่อนักเรียน

## Setup Guide (คู่มือการติดตั้ง)

### 1. สร้างโปรเจค Supabase
1. ไปที่ [https://supabase.com](https://supabase.com) → สร้างบัญชีฟรี
2. กด "New project" → กรอกชื่อ → ตั้งรหัสผ่าน Database
3. รอประมาณ 2 นาที

### 2. รัน SQL Migration
1. ไป **SQL Editor** ใน Supabase Dashboard
2. คัดลอก SQL ทั้งหมดใน `supabase/migrations/001_initial.sql`
3. วางใน SQL Editor → กด **Run**

### 3. ตั้งค่า Authentication
1. ไป **Authentication → Providers → Email**
2. ปิด "Confirm email" (สำหรับการทดสอบ) ✓
3. ไป **Authentication → URL Configuration**
4. เพิ่ม `http://localhost:5173` ใน "Redirect URLs"

### 5. ติดตั้งและรัน
```bash
# สร้างไฟล์ .env
cp .env.example .env

# แก้ไข .env ใส่ค่าจาก Supabase → Settings → API
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# ติดตั้ง dependencies
npm install

# รันเซิร์ฟเวอร์
npm run dev
```

### 6. Deploy (Vercel ฟรี)
```bash
npm install -g vercel
vercel --prod
# ตั้งค่า Environment Variables ใน Vercel Dashboard
```

---

## คุณสมบัติ (Features)

### สำหรับนักเรียน
- เช็คชื่อด้วย GPS (ต้องอยู่ในรัศมี 200ม. จากห้องดนตรี)
- เช็คชื่อด้วย QR Code (ที่ครูแสดง)
- แจ้งเหตุผลไม่เข้าร่วม (เขียนคำอธิบาย)
- ดูประวัติการเช็คชื่อ + ปฏิทิน
- อัปโหลดรูปโปรไฟล์
- เปลี่ยนรหัสผ่าน / ลืมรหัสผ่าน

### สำหรับครู
- ดูผลเช็คชื่อ Real-time
- Override การเช็คชื่อนักเรียน
- แสดง QR Code สำหรับเช็คชื่อ
- เพิ่มรอบซ้อมพิเศษ
- ดูรายงานทุก Section
- ดูปฏิทินการเข้าร่วมรายบุคคล

### สำหรับ Admin
- สร้างบัญชีผู้ใช้ (นักเรียน/ครู/admin)
- จัดการภาคเรียน (สลับภาคเรียน 1/2)
- เลื่อนชั้นปีการศึกษา (ม.6 → จบการศึกษา)
- เปิด/ปิดบัญชีผู้ใช้
- ดูรายงานทั้งระบบ

### เวลาเช็คชื่อ
- **จันทร์-ศุกร์**: 07:00-08:30 น. (ซ้อมเช้า)
- **พฤหัสบดี**: 15:20-16:10 น. (คาบชุมนุม)
- นอกเวลา: แจ้งเหตุผลได้ แต่เช็คชื่อไม่ได้

### พิกัด GPS (ห้องดนตรี)
- Latitude: 18.7784475
- Longitude: 100.780098
- รัศมีอนุญาต: 200 เมตร

---

## โครงสร้างไฟล์
```
src/
├── components/
│   ├── admin/SemesterManager.tsx   # จัดการภาคเรียน
│   ├── layout/AppLayout.tsx        # Layout หลัก
│   ├── reports/StudentCalendarReport.tsx  # ปฏิทินรายบุคคล
│   └── ui/                         # shadcn components
├── hooks/
│   ├── useAuth.ts     # Auth logic
│   ├── useAttendance.ts  # เช็คชื่อ
│   ├── useGPS.ts      # GPS
│   └── useTerm.ts     # ภาคเรียน
├── pages/             # หน้าต่างๆ
├── store/authStore.ts # Zustand store
├── lib/
│   ├── supabase.ts   # Supabase client
│   └── utils.ts      # Utilities
└── types/index.ts     # TypeScript types
```
