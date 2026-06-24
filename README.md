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

### 6. Deploy (Netlify)
```bash
npm install -g netlify-cli
netlify login
netlify init
# เลือก site ใหม่หรือเลือก site ปัจจุบัน
netlify deploy --prod
```

หรือใช้ Netlify Dashboard:
1. เชื่อม Git repository
2. ใส่ Build command: `npm run build`
3. ใส่ Publish directory: `dist`
4. ตั้ง Environment variables ใน Netlify dashboard

เพิ่มไฟล์ `netlify.toml` สำหรับ Vite app:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## คุณสมบัติ (Features)

### สำหรับนักเรียน
- เช็คชื่อด้วย GPS (ต้องอยู่ในรัศมี 50ม. จากห้องดนตรี)
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
- **จันทร์-ศุกร์**: 07:00-07:45 น. มาซ้อม, 07:46-08:10 น. มาสาย, 08:11-08:30 น.และหลังจากนั้น ขาด (ซ้อมเช้า)

- **พฤหัสบดี**: 15:20-15:45 น. มาซ้อม, 15:46-16:00 น. มาสาย, 16:00-16:10 น.และหลังจากนั้น ขาด (คาบชุมนุม)

### พิกัด GPS (ห้องดนตรี)
- Latitude: 18.7780793
- Longitude: 100.7799747
- รัศมีอนุญาต: 20 เมตร

### เพิ่มเติม
- ฟิกสร้างเช็คชื่อตามเวลาที่กำหนดแบบอัตโนมัติ
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
