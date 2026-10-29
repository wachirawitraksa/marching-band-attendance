<div align="center">

<img src="public/icons/icon-192.png" alt="โลโก้วงโยธวาทิต" width="110" />

# ระบบเช็คชื่อวงโยธวาทิต

**แตะเช็คชื่อด้วย GPS หรือ QR — สถิติ streak และรายงานจัดการให้อัตโนมัติ**

[English](README.md) · ภาษาไทย

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white&style=flat-square)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white&style=flat-square)
![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify&logoColor=white&style=flat-square)

[คุณสมบัติ](#คุณสมบัติ) · [สถาปัตยกรรม](#สถาปัตยกรรม) · [Flow](#flow-การทำงานของระบบ) · [ฐานข้อมูล](#โครงสร้างฐานข้อมูล) · [ติดตั้ง](#คู่มือการติดตั้ง) · [Deploy](#deploy)

</div>

เว็บแอปสำหรับมือถือ (ติดตั้งเป็น PWA ได้) ให้นักเรียนวงโยธวาทิตเช็คชื่อเข้าซ้อมด้วย **GPS** หรือ **QR Code** และให้ครู/แอดมินดูผลเช็คชื่อแบบเรียลไทม์ ดูรายงาน และจัดการตารางซ้อม

| เช็คชื่อ | อัตโนมัติ | ข้อมูลเชิงลึก |
|---|---|---|
| กดเช็คชื่อปุ่มเดียวด้วย GPS หรือสแกน QR เต็มจอที่ครูแสดง ตรวจช่วงเวลาซ้อมทั้งสองทาง | สร้างรอบซ้อมทุกคืน บันทึกขาดให้อัตโนมัติ เคารพวันหยุดและข้อยกเว้น ร.ด. | รายชื่อสดแยกตาม Section คำขอลาที่ครูอนุมัติ แดชบอร์ดรายรอบ รายงาน PDF ภาษาไทย |

| ชั้น | เทคโนโลยี |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS + shadcn/ui (Radix) · Zustand · TanStack Query · Recharts · `@react-pdf/renderer` · `qrcode.react` |
| **Backend** | Supabase — PostgreSQL · Auth · Realtime · Storage · Row Level Security · `pg_cron` |
| **Hosting** | Netlify (static SPA) |

---

## สารบัญ

1. [คุณสมบัติ](#คุณสมบัติ)
2. [สถาปัตยกรรม](#สถาปัตยกรรม)
3. [บทบาทและสิทธิ์](#บทบาทและสิทธิ์)
4. [กติกาการเช็คชื่อ](#กติกาการเช็คชื่อ)
5. [Flow การทำงานของระบบ](#flow-การทำงานของระบบ)
   - [1. การเข้าสู่ระบบและกู้คืน session](#1-การเข้าสู่ระบบและกู้คืน-session)
   - [2. สร้างรอบซ้อมรายวันอัตโนมัติ](#2-สร้างรอบซ้อมรายวันอัตโนมัติ)
   - [3. เช็คชื่อด้วย GPS](#3-เช็คชื่อด้วย-gps-นักเรียน)
   - [4. เช็คชื่อด้วย QR Code](#4-เช็คชื่อด้วย-qr-code-นักเรียน)
   - [5. คำขอลา (ครูอนุมัติ)](#5-คำขอลา-ครูอนุมัติ)
   - [6. ระบบบันทึกขาดอัตโนมัติ](#6-ระบบบันทึกขาดอัตโนมัติ)
   - [7. ครูแก้ไขสถานะ (Override)](#7-ครูแก้ไขสถานะ-override)
   - [8. Streak และ Badge](#8-streak-และ-badge)
   - [9. ข้อยกเว้น ร.ด. บ่ายวันพฤหัส](#9-ข้อยกเว้น-รด-บ่ายวันพฤหัส)
   - [10. ตารางซ้อม วันหยุด และรอบพิเศษ](#10-ตารางซ้อม-วันหยุด-และรอบพิเศษ)
   - [11. จัดการภาคเรียนและเลื่อนชั้น](#11-จัดการภาคเรียนและเลื่อนชั้น)
   - [12. รายงานและส่งออก PDF](#12-รายงานและส่งออก-pdf)
6. [โครงสร้างฐานข้อมูล](#โครงสร้างฐานข้อมูล)
7. [โครงสร้างไฟล์](#โครงสร้างไฟล์)
8. [คู่มือการติดตั้ง](#คู่มือการติดตั้ง)
9. [Deploy](#deploy)

---

## คุณสมบัติ

**นักเรียน**
- กดเช็คชื่อปุ่มเดียว ระบบหาตำแหน่งเองและเช็คชื่อให้ถ้าอยู่ในรัศมีที่ตั้งค่าไว้จากห้องดนตรี
  - ก่อนเปิดรอบ ปุ่มบอกเวลาเปิดเช็คชื่อ
  - เลยเวลามาปกติแล้ว ปุ่มเตือนว่าจะนับเป็นสาย
  - ใต้ปุ่มบอกว่าอยู่ในพื้นที่ หรือห่างออกไปกี่เมตร
- เช็คชื่อด้วยการสแกน QR Code ที่ครูแสดง (ระบบตรวจ GPS ด้วย)
- ส่งคำขอลาพร้อมเหตุผล สถานะเป็น *ลา* เมื่อครูอนุมัติแล้วเท่านั้น
- แดชบอร์ด: รอบซ้อมวันนี้พร้อมสิ่งที่ทำได้ตอนนี้ การ์ดเช็คชื่อด่วน และสถิติของตัวเอง
- ดูประวัติการเช็คชื่อและปฏิทินส่วนตัว
- สะสม streak และ badge จากการมาซ้อมต่อเนื่อง
- อัปโหลดรูปโปรไฟล์ เปลี่ยน/รีเซ็ตรหัสผ่าน

**ครู**
- แดชบอร์ดมีการ์ดของแต่ละรอบวันนี้:
  - มาแล้ว / ที่ต้องมา และสาย
  - "ยังไม่เช็ค" ตอนเปิด และ "ขาด" หลังปิด
  - กดไปที่รายชื่อของรอบนั้นได้เลย
- รายชื่อสดของแต่ละรอบ (Supabase Realtime):
  - แยกตาม Section ("Brass 11/32")
  - ตัวกรอง (ทั้งหมด / ยังไม่มา / มาแล้ว / ลา) และช่องค้นหา
  - คนที่ต้องจัดการขึ้นก่อน
- อนุมัติหรือไม่อนุมัติคำขอลา
- แก้ไขสถานะนักเรียน dialog เริ่มที่สถานะปัจจุบัน และกดย้อนกลับได้จาก toast
- หน้าจอ QR เต็มจอ พร้อมตัวนับ "มาแล้ว / ที่ต้องมา" แบบสด และรายชื่อคนล่าสุด
- เพิ่มรอบซ้อมพิเศษ จัดการวันหยุดและช่วงปิดเทอม
- จัดการรายชื่อนักเรียนและเลื่อนชั้นปีการศึกษา (ปี +1, ม.6 → จบการศึกษา)
- ดูรายงานทุก Section ปฏิทินรายบุคคล และส่งออก PDF

**แอดมิน** (ทำได้ทุกอย่างที่ครูทำได้ และเพิ่มเติม)
- สร้างบัญชีผู้ใช้ (นักเรียน/ครู/แอดมิน) เปลี่ยน Role เปิด/ปิดบัญชี
- จัดการภาคเรียน (ภาคเรียนที่ 1/2)
- จัดการ Section และเครื่องดนตรี
- ตั้งค่าพิกัด GPS และรัศมีที่อนุญาต

**ระบบอัตโนมัติ**
- `pg_cron` สร้างรอบซ้อมของวันถัดไปทุกคืน
- นักเรียนที่ไม่เช็คชื่อจะถูกบันทึกเป็น *ขาด* อัตโนมัติเมื่อหมดเวลา
- Trigger ในฐานข้อมูลคำนวณ streak และ badge ใหม่ทุกครั้งที่ข้อมูลเช็คชื่อเปลี่ยน
- หน้าเว็บตรวจสถานะตามเวลาใหม่ทุก 30 วินาที ปุ่มเช็คชื่อจึงเปิดเองโดยไม่ต้องรีเฟรช

---

## สถาปัตยกรรม

```mermaid
flowchart LR
    subgraph Client["Browser / PWA (React + Vite)"]
        UI["Pages<br/>Dashboard · Attendance · Schedule<br/>Reports · Students · Admin · Profile"]
        Hooks["Hooks<br/>useAuth · useAttendance · useGPS · useLeaveRequests<br/>useTerm · useNow · useSupabaseQueries"]
        Store["Zustand authStore<br/>(user, profile, theme — เก็บถาวร)"]
        UI --> Hooks --> Store
    end

    subgraph Supabase["Supabase"]
        Auth["Auth"]
        REST["PostgREST API<br/>(บังคับใช้ RLS)"]
        RT["Realtime<br/>postgres_changes"]
        Storage["Storage<br/>profile-pictures"]
        DB[("PostgreSQL")]
        Cron["pg_cron"]
        Fn["SQL functions + triggers<br/>create_daily_sessions · auto_mark_absent<br/>recalc_student_streak"]
    end

    Hooks -- "supabase-js" --> Auth
    Hooks -- "supabase-js" --> REST
    Hooks -- "subscribe" --> RT
    Hooks -- "อัปโหลดรูป" --> Storage
    REST --> DB
    RT --- DB
    Auth --> DB
    Cron --> Fn --> DB
    DB -. "triggers" .-> Fn

    Netlify["Netlify (static hosting)"] --> Client
```

เบราว์เซอร์คุยกับ Supabase โดยตรงด้วย anon key (public) **การตรวจสิทธิ์ทั้งหมดทำที่ Row Level Security ในฐานข้อมูล** ไม่ได้อาศัยฝั่งหน้าเว็บ การป้องกัน route ใน React (`ProtectedRoute`, `AdminRoute`) มีไว้เพื่อประสบการณ์ใช้งานเท่านั้น

แต่ละหน้าแยก chunk และโหลดเมื่อเข้าถึง `@react-pdf/renderer` โหลดตอนกดส่งออก PDF เท่านั้น ถ้า chunk ของหน้าโหลดไม่ได้หลัง deploy จะมีหน้าให้กดลองอีกครั้ง

> [!NOTE]
> `public/sw.js` (cache app shell และ push notification) **ยังไม่ถูก register** ในแอป การทำงานออฟไลน์และ push จึงยังไม่ทำงาน ส่วน manifest ยังใช้ *Add to Home Screen* ได้

---

## บทบาทและสิทธิ์

| ความสามารถ | นักเรียน | ครู | แอดมิน |
|---|:--:|:--:|:--:|
| เช็คชื่อของตัวเอง (GPS / QR) | ได้ | ได้ | ได้ |
| ดูประวัติ streak badge ของตัวเอง | ได้ | ได้ | ได้ |
| ส่งคำขอลาของตัวเอง (พร้อมเหตุผล) | ได้ | — | — |
| ดูการเช็คชื่อของทุกคน | ไม่ได้ | ได้ | ได้ |
| อนุมัติ / ไม่อนุมัติคำขอลา | ไม่ได้ | ได้ | ได้ |
| แก้ไข/เพิ่มสถานะให้คนอื่น | ไม่ได้ | ได้ | ได้ |
| แสดง QR Code ประจำรอบ | ไม่ได้ | ได้ | ได้ |
| จัดการรอบซ้อม วันหยุด ปิดเทอม | ไม่ได้ | ได้ | ได้ |
| หน้ารายชื่อนักเรียน / รายงาน | ไม่ได้ | ได้ | ได้ |
| สร้างบัญชี เปลี่ยน Role ปิดบัญชี | ไม่ได้ | ไม่ได้ | ได้ |
| จัดการภาคเรียน Section GPS (หน้า Admin) | ไม่ได้ | บางส่วน¹ | ได้ |

¹ ครูแก้ไขแถวตั้งค่า GPS ได้ แต่การเพิ่ม/ลบแถวทำได้เฉพาะแอดมิน

Route ของหน้าเว็บ:

| Route | ผู้เข้าถึง |
|---|---|
| `/login`, `/forgot-password`, `/reset-password`, `/qr/:token` | สาธารณะ (หน้า QR จะให้ผู้ใช้เข้าสู่ระบบก่อน) |
| `/dashboard`, `/attendance`, `/schedule`, `/reports`, `/profile` | ผู้ใช้ที่เข้าสู่ระบบแล้ว |
| `/students`, `/admin` | ครูหรือแอดมิน (`AdminRoute`) |

---

## กติกาการเช็คชื่อ

เวลาทั้งหมดเป็น **เวลาประเทศไทย (Asia/Bangkok)** กติกาอยู่ที่เดียวในฝั่งหน้าเว็บ (`ATTENDANCE_RULES` ใน [`src/lib/utils.ts`](src/lib/utils.ts)) และมีฟังก์ชัน SQL ที่ใช้เวลาเดียวกัน `getAttendanceWindowState()` (ก่อนเปิด / เปิด / หมดเวลา) เป็นจุดตรวจเดียวที่แดชบอร์ด หน้าเช็คชื่อ และการบันทึกเช็คชื่อใช้ร่วมกัน หน้าตารางซ้อมสร้างข้อความ "มาปกติถึง / สายถึง" จากกติกาเดียวกัน และ `lateUntil` ต้องตรงกับเวลาของ cron `auto_mark_absent`

| รอบ | วัน | เริ่มรับเช็คชื่อ | มาปกติถึง | สายถึง | ขาดหลัง |
|---|---|---|---|---|---|
| **ซ้อมเช้า** (`morning`) | จ.–ศ. | 05:00 | 07:45 | 08:30 | 08:30 |
| **คาบชุมนุม** (`club`) | พฤ. | 15:20 | 15:45 | 16:00 | 16:00 |
| **ซ้อมพิเศษ** (`extra`) | ตามที่ครูกำหนด | เวลาเริ่มรอบ | — (นับว่า *มา* เสมอ) | — | เวลาสิ้นสุดรอบ |

```mermaid
flowchart LR
    A["ก่อนเวลาเปิด<br/>เช็คชื่อไม่ได้"] --> B["เปิด → มาปกติถึง<br/>สถานะ = present"]
    B --> C["มาปกติ → สายถึง<br/>สถานะ = late"]
    C --> D["หลังเวลาสาย<br/>เช็คชื่อไม่ได้<br/>ระบบบันทึกขาดให้"]
```

สถานะที่เป็นไปได้: `present` (มา), `late` (สาย), `absent` (ขาด), `excused` (ลา)

> [!NOTE]
> `present` และ `late` นับว่าเข้าร่วม ส่วน `absent` และ `excused` ทำให้ streak ขาดช่วง

---

## Flow การทำงานของระบบ

### 1. การเข้าสู่ระบบและกู้คืน session

[`src/App.tsx`](src/App.tsx) ดูแลวงจรของการยืนยันตัวตน ออกแบบให้ทนต่ออินเทอร์เน็ตมือถือที่ช้า โดยไม่เด้งผู้ใช้ไปหน้า login โดยไม่จำเป็น

```mermaid
flowchart TD
    Start(["เปิดแอป"]) --> Init["initializeAuth()<br/>getSession() timeout 15 วิ + ลองซ้ำ 1 ครั้ง"]
    Init --> Has{"พบ session?"}
    Has -- ใช่ --> SetUser["setUser(session.user)"] --> LoadP["loadProfile()<br/>profiles + section + instrument<br/>timeout 12 วิ + ลองซ้ำ 1 ครั้ง"]
    Has -- "ไม่พบ (ยืนยันแล้ว)" --> Clear["setUser(null), setProfile(null)"]
    Has -- "เครือข่ายล้มเหลว 2 รอบ" --> Keep["คงข้อมูลที่ cache ไว้<br/>ไม่สรุปว่า session หมดอายุ"]
    LoadP --> Done["setLoading(false)<br/>didInitialAuthCheck = true"]
    Clear --> Done
    Keep --> Done

    Done --> Guard{"ProtectedRoute"}
    Guard -- "isLoading" --> Spin["แสดง spinner"]
    Guard -- "ไม่มี user" --> Login["Redirect /login"]
    Guard -- "มี user" --> App["แสดง AppLayout"]

    subgraph Listener["onAuthStateChange (callback แบบ synchronous)"]
        E1["SIGNED_IN"] --> Q{"เช็คครั้งแรก<br/>เสร็จแล้ว?"}
        Q -- "ใช่: login จริง" --> Nav["navigate /dashboard"]
        Q -- "ไม่: แค่กู้ session" --> Stay["อยู่ route เดิม<br/>(เช่น /qr/:token)"]
        E1 --> Defer["setTimeout 0 → loadProfile()"]
        E2["SIGNED_OUT"] --> ToLogin["ล้าง state, navigate /login"]
        E3["PASSWORD_RECOVERY"] --> Reset["navigate /reset-password"]
        E4["TOKEN_REFRESHED"] --> Upd["setUser()"]
    end
```

ข้อควรรู้ 2 ข้อ:

- callback ของ `onAuthStateChange` ห้าม `await` คำสั่ง Supabase เพราะ supabase-js ล็อก navigator lock ไว้ระหว่าง callback ทำงาน ถ้า await ข้างในจะ deadlock จึงเลื่อนงานฐานข้อมูลออกไปด้วย `setTimeout(0)`
- `SIGNED_IN` ถูกยิงตอนกู้ session ด้วย แอปจึงเด้งไป `/dashboard` เฉพาะตอน login จริง ไม่เช่นนั้นการสแกน QR จะถูกเด้งออกจาก `/qr/:token`

บัญชีใหม่สร้างด้วย `supabase.auth.signUp` โดย trigger `handle_new_user` ในฐานข้อมูลจะสร้างแถว `profiles` ให้ (Role เริ่มต้นเป็น `student`) จากนั้นฟอร์มของแอดมินจึงอัปเดตข้อมูลโปรไฟล์ที่เหลือ

---

### 2. สร้างรอบซ้อมรายวันอัตโนมัติ

นักเรียนเช็คชื่อกับ **แถวในตาราง `practice_sessions`** ดังนั้นแถวนี้ต้องมีก่อน `pg_cron` จะสร้างรอบของวันถัดไปทุกคืน

```mermaid
flowchart TD
    Cron["pg_cron job 'create-daily-sessions'<br/>0 18 * * * (UTC) = 01:00 เวลาไทย"] --> Call["create_daily_sessions(พรุ่งนี้)"]
    Call --> H1{"วันที่อยู่ใน holidays?"}
    H1 -- ใช่ --> Stop(["return — ไม่สร้างรอบ"])
    H1 -- ไม่ --> H2{"อยู่ในช่วง holiday_ranges?<br/>(ปิดเทอม)"}
    H2 -- ใช่ --> Stop
    H2 -- ไม่ --> D1{"จันทร์–ศุกร์?"}
    D1 -- ใช่ --> M["INSERT morning 07:00–08:30<br/>ON CONFLICT (date, session_type) DO NOTHING"]
    D1 -- ไม่ --> D2
    M --> D2{"วันพฤหัสบดี?"}
    D2 -- ใช่ --> C["INSERT club 15:20–16:10<br/>ON CONFLICT DO NOTHING"]
    D2 -- ไม่ --> End(["เสร็จ"])
    C --> End
```

- แต่ละรอบได้ `qr_token` แบบสุ่ม (16 ไบต์ เป็น hex) ตอน insert
- constraint `UNIQUE(date, session_type)` ทำให้รันซ้ำได้อย่างปลอดภัย รวมถึงการสร้างย้อนหลัง
- หน้า `SchedulePage` จะ upsert รอบของพรุ่งนี้ตอนโหลดเป็นตาข่ายสำรอง เผื่อ cron พลาด
- การเพิ่มวันหยุดจะลบรอบของวันนั้นที่ไม่ใช่ override ส่วนรอบที่ครูสร้างเองมี `is_override = true` จะถูกเก็บไว้

---

### 3. เช็คชื่อด้วย GPS (นักเรียน)

```mermaid
sequenceDiagram
    autonumber
    actor S as นักเรียน
    participant P as AttendancePage
    participant G as useGPS
    participant B as Browser Geolocation
    participant A as useAttendance.checkIn
    participant DB as Supabase (RLS)

    S->>P: กด "เช็คชื่อ"
    P->>G: getCurrentPosition()
    alt cache ไม่เกิน 5 นาที และครั้งก่อนอยู่ในพื้นที่
        G-->>P: ตำแหน่งจาก cache
    else
        G->>B: getCurrentPosition(highAccuracy, timeout 30 วิ)
        B-->>G: lat, lng, accuracy
        G->>G: haversine(ระยะถึงจุดใน gps_settings)
        Note over G: inRange = ระยะ ≤ รัศมี<br/>หรือ ระยะ − accuracy ≤ รัศมี
        G-->>P: {inRange, distance, lat, lng}
    end

    alt error (ไม่อนุญาต / หาตำแหน่งไม่ได้ / timeout)
        P-->>S: Toast แจ้งข้อผิดพลาด แล้วหยุด
    else อยู่นอกรัศมี
        P-->>S: "คุณอยู่ห่างจากห้องดนตรี N ม. (สูงสุด R ม.)"
    else อยู่ในรัศมี
        P->>A: checkIn(sessionId, lat, lng, true, distance)
        A->>DB: SELECT record ของ (session, student)
        alt เป็น present อยู่แล้ว
            A-->>S: "คุณเช็คชื่อไปแล้วในรอบนี้"
        else
            A->>DB: SELECT session_type, start_time, end_time
            A->>A: isWithinAttendanceWindow()?
            alt นอกช่วงเวลา
                A-->>S: "ไม่อยู่ในช่วงเวลาเช็คชื่อที่กำหนด"
            else อยู่ในช่วงเวลา
                A->>A: getCheckInStatus() → present | late
                A->>DB: UPSERT attendance_records ON CONFLICT (session_id, student_id)
                DB->>DB: trigger → recalc_student_streak()
                DB-->>A: แถวที่บันทึก
                A-->>S: แอนิเมชันสำเร็จ
            end
        end
    end
```

หมายเหตุ:

- มีปุ่มเดียว ใต้ปุ่มแสดงผลระยะห่าง และเตือนเมื่อการเช็คชื่อจะนับเป็นสาย การ์ดเช็คชื่อด่วนในแดชบอร์ดใช้ขั้นตอนเดียวกัน
- ใช้ตำแหน่งจาก cache ซ้ำเฉพาะถ้าครั้งก่อนอยู่ในพื้นที่ นักเรียนที่เดินเข้าพื้นที่แล้วกดใหม่จึงได้ตำแหน่งใหม่
- พิกัดและรัศมีมาจากตาราง `gps_settings` (แอดมินแก้ไขได้) ถ้าโหลดไม่ได้จะใช้ค่าเริ่มต้นที่ฝังในโค้ด
- การนับ accuracy เข้ามาช่วยไม่ให้ปฏิเสธนักเรียนที่ยืนอยู่ขอบรัศมีขณะที่ GPS คลาดเคลื่อน
- ช่วงเวลาและสถานะคำนวณจาก **นาฬิกาของเครื่องผู้ใช้ที่แปลงเป็นเวลาไทย** ส่วน policy ในฐานข้อมูลตรวจเพียงว่า `student_id = auth.uid()` ไม่ได้ตรวจเวลาซ้ำ ดังนั้นให้มองว่า GPS/QR ป้องกันการใช้งานผิดพลาดทั่วไป ไม่ใช่ระบบกันการปลอมแปลงเต็มรูปแบบ

---

### 4. เช็คชื่อด้วย QR Code (นักเรียน)

ครูกดปุ่ม **เปิด QR เช็คชื่อ** ที่การ์ดของรอบนั้นในหน้า `/attendance` หน้าจอเต็ม (`QRPresenter`) แสดง QR ขนาดใหญ่ของ `https://<host>/qr/<qr_token>` ตัวนับ "มาแล้ว / ที่ต้องมา" แบบสด รายชื่อ 5 คนล่าสุด และคำเตือนถ้ารอบยังไม่เปิดหรือหมดเวลา ครูสลับเป็นเต็มจอเบราว์เซอร์เพื่อฉายขึ้นจอได้ นักเรียนสแกนด้วยกล้องมือถือ แล้วหน้าเว็บจะเปิดขึ้น

```mermaid
flowchart TD
    T["ครู: การ์ดรอบซ้อม → QR เต็มจอ<br/>QRCodeSVG(origin + /qr/ + qr_token)"] --> Scan["นักเรียนสแกนด้วยกล้องมือถือ"]
    Scan --> Open["เปิด /qr/:token (public route)"]
    Open --> Auth{"เข้าสู่ระบบแล้ว?"}
    Auth -- ไม่ --> NA["not_auth → ปุ่มไปหน้า /login"]
    Auth -- ใช่ --> Find["SELECT practice_sessions WHERE qr_token = :token"]
    Find --> F{"พบรอบ?"}
    F -- ไม่ --> E1["error: QR ไม่ถูกต้องหรือหมดอายุ"]
    F -- ใช่ --> Today{"session.date = วันนี้ (เวลาไทย)?"}
    Today -- ไม่ --> E2["closed: QR นี้ไม่ใช่ของวันนี้"]
    Today -- ใช่ --> Win{"isWithinAttendanceWindow()?"}
    Win -- ไม่ --> E3["closed: ยังไม่ถึงเวลา หรือหมดเวลาแล้ว"]
    Win -- ใช่ --> GPS["getCurrentPosition()"]
    GPS --> R{"inRange?"}
    R -- ไม่ --> E4["out_of_location: ห่างจากห้องดนตรี N ม."]
    R -- ใช่ --> Ex{"record เดิมเป็น present?"}
    Ex -- ใช่ --> E5["already: เช็คชื่อแล้ว"]
    Ex -- ไม่ --> Up["UPSERT attendance_records<br/>status = present | late<br/>qr_code_used = true, gps_verified, lat/lng/distance"]
    Up --> OK["success + แอนิเมชัน"]
```

QR token พิสูจน์ว่านักเรียนถือโค้ดที่ครูแสดงอยู่จริง ส่วน GPS พิสูจน์ว่าอยู่ใกล้ห้องซ้อมจริง ต้องผ่านทั้งสองอย่าง ถ้ายังไม่ได้เข้าสู่ระบบ หน้าจะแสดงปุ่มไป login และหลัง login แอปไม่บังคับเด้งไปหน้าอื่น จึงกลับมาทำรายการที่ `/qr/:token` ต่อได้

---

### 5. คำขอลา (ครูอนุมัติ)

นักเรียนตั้งสถานะตัวเองเป็น "ลา" ไม่ได้ ต้องส่งคำขอพร้อมเหตุผล แล้วแจ้งครูให้กดอนุมัติในระบบ

```mermaid
flowchart TD
    S["นักเรียน: รอบของวันนี้<br/>ที่ยังไม่เช็ค หรือถูกบันทึกขาด"] --> Btn["กด 'ขอลา' พิมพ์เหตุผล"]
    Btn --> Up["UPSERT leave_requests<br/>status = 'pending'"]
    Up --> P["การ์ด: 'รอครูอนุมัติ'<br/>แก้ไขหรือยกเลิกได้"]
    Up --> RT["Realtime → รายชื่อของครู<br/>'ขอลา N' + ป้ายที่นักเรียน"]
    RT --> T{"ครูเปิด dialog แก้สถานะ"}
    T -- อนุมัติ --> A["UPSERT attendance_records<br/>status = 'excused', reason,<br/>teacher_override = true"]
    A --> D1["leave_requests.status = 'approved'"]
    T -- ไม่อนุมัติ --> D2["leave_requests.status = 'rejected'<br/>สถานะเช็คชื่อคงเดิม"]
```

RLS (migration `024`) ให้นักเรียนเพิ่ม แก้ และลบได้เฉพาะคำขอของตัวเองที่ยัง **รออนุมัติ** การอนุมัติหรือไม่อนุมัติทำได้เฉพาะครูและแอดมิน record สถานะ *ลา* ที่อนุมัติแล้วจะไม่ถูกงานบันทึกขาดอัตโนมัติเขียนทับ เพราะงานนั้นเพิ่มแถวเฉพาะนักเรียนที่ยังไม่มี record

---

### 6. ระบบบันทึกขาดอัตโนมัติ

นักเรียนที่ไม่เช็คชื่อต้องมีแถว `absent` เพื่อให้รายงานและ streak ถูกต้อง ระบบทำงาน **2 ที่** เพื่อความทนทาน

```mermaid
flowchart TD
    subgraph Server["ฝั่งเซิร์ฟเวอร์ — pg_cron (ตัวหลัก)"]
        C1["auto-mark-absent-morning<br/>35 1 * * * UTC = 08:35 เวลาไทย"] --> F["auto_mark_absent()"]
        C2["auto-mark-absent-club<br/>5 9 * * 4 UTC = พฤ. 16:05 เวลาไทย"] --> F
        F --> Q1["รอบวันนี้ที่ไม่ใช่ override<br/>morning หลัง 08:30 / club หลัง 16:00"]
        Q1 --> Ins["INSERT absent ให้นักเรียนที่ active ไม่จบการศึกษา<br/>is_in_club = true และยังไม่มี record<br/>ON CONFLICT DO NOTHING"]
    end

    subgraph Client["ฝั่งหน้าเว็บ — AttendancePage เฉพาะบัญชีครู (ทำเท่าที่ทำได้)"]
        Tm["ตอนเปิดหน้า + ทุก 60 วินาที"] --> MA["markAbsentOverdue(today)"]
        MA --> Over["รอบที่เลยช่วงเวลาแล้ว"]
        Over --> Stu["นักเรียน active ไม่จบการศึกษาทั้งหมด"]
        Stu --> Ups["UPSERT absent, ignoreDuplicates<br/>(ต้องมีสิทธิ์ครูตาม RLS)"]
    end

    Ins --> TG["Trigger → recalc_student_streak()"]
    Ups --> TG
```

- งาน cron เป็นแหล่งข้อมูลหลัก ส่วนการกวาดฝั่งหน้าเว็บช่วยให้ครูเห็นข้อมูลล่าสุดทันทีหลังหมดเวลา และรันเฉพาะบัญชีครู เพราะ RLS ให้นักเรียนอ่านได้แค่แถวของตัวเอง
- งาน SQL จะข้ามนักเรียนที่ `is_in_club = false` (ดู [ข้อยกเว้น ร.ด.](#9-ข้อยกเว้น-รด-บ่ายวันพฤหัส))

---

### 7. ครูแก้ไขสถานะ (Override)

```mermaid
sequenceDiagram
    autonumber
    actor T as ครู / แอดมิน
    participant P as AttendancePage
    participant DB as Supabase
    actor S as นักเรียน

    T->>P: เปิดรายชื่อของรอบ (useAllAttendance, realtime)
    T->>P: เลือกนักเรียน → dialog แก้สถานะ
    Note over P: dialog เลือกสถานะปัจจุบันไว้และแสดงให้เห็น<br/>ปุ่มบันทึกกดไม่ได้จนกว่าจะเปลี่ยนสถานะหรือหมายเหตุ
    T->>P: เลือกสถานะ (present / late / absent / excused) + หมายเหตุ
    P->>DB: UPSERT attendance_records<br/>teacher_override = true, override_by = teacher.id,<br/>override_note, เก็บ check_in_time เดิมถ้า present/late<br/>(ใช้ now() เฉพาะตอนยังไม่มี)
    P-->>T: Toast "ชื่อ: เดิม → ใหม่" พร้อมปุ่มย้อนกลับ
    opt ย้อนกลับ
        P->>DB: คืนค่าแถวเดิม (หรือลบทิ้งถ้าก่อนหน้านี้ไม่มี)
    end
    Note over DB: RLS อนุญาต role IN ('admin','teacher')<br/>เพิ่ม/แก้แถวของนักเรียนคนอื่น
    DB->>DB: trigger → recalc_student_streak()
    DB-->>P: Realtime event → รายชื่อรีเฟรช
    DB-->>S: Realtime event → รายการของนักเรียนรีเฟรช
```

แถวที่ถูก override จะเก็บ `teacher_override`, `override_by` และ `override_note` เพื่อให้ตรวจสอบย้อนหลังได้ ถ้านักเรียนมีคำขอลารออนุมัติ dialog เดียวกันจะแสดงคำขอพร้อมปุ่มอนุมัติ / ไม่อนุมัติ

---

### 8. Streak และ Badge

คำนวณในฐานข้อมูลทั้งหมด เพื่อให้ทุกช่องทางการบันทึก (GPS, QR, override, cron) ให้ผลตรงกัน

```mermaid
flowchart TD
    W["INSERT หรือ UPDATE OF status<br/>บน attendance_records"] --> TG["trigger attendance_records_streak_trigger"]
    TG --> RC["recalc_student_streak(student_id)"]
    RC --> Cur["เดินรอบจากใหม่สุด → เก่าสุด<br/>นับ present/late จนเจอ absent/excused ตัวแรก<br/>= current_streak"]
    RC --> Lng["Window function ทั้งประวัติ<br/>ช่วง present/late ที่ยาวที่สุด<br/>= longest_streak"]
    Cur --> Up["UPSERT streaks<br/>longest_streak = GREATEST(เดิม, ใหม่)"]
    Lng --> Up
    Up --> Bd["INSERT user_badges ทุก badge<br/>ที่ threshold ≤ current_streak<br/>ON CONFLICT DO NOTHING"]
    Bd --> UI["Dashboard แสดง streak + badge ที่ได้"]
```

- streak นับจาก **รอบซ้อมที่มีจริง** ตามลำดับ เสาร์-อาทิตย์และวันหยุดที่ไม่มีรอบจึงถูกข้ามอัตโนมัติ
- badge เริ่มต้น: `streak_3`, `streak_5`, `streak_10`, `streak_20` ตาราง `badges` เป็นแคตตาล็อก เพิ่มแถวใหม่ได้โดยไม่ต้อง deploy
- เมื่อลบรอบซ้อม `streaks.last_session_id` จะถูกตั้งเป็น `NULL` แทนที่จะบล็อกการลบ (migration `023`)

---

### 9. ข้อยกเว้น ร.ด. บ่ายวันพฤหัส

นักเรียนที่ `is_in_club = false` ไปเรียน ร.ด. ตอนบ่ายวันพฤหัสแทนคาบชุมนุม รอบนั้นจึงต้องไม่นับเป็นการขาด

```mermaid
flowchart TD
    R["record การเช็คชื่อ 1 รายการ"] --> J["join รอบซ้อม + โปรไฟล์นักเรียน"]
    J --> Q{"วันพฤหัส<br/>และรอบเริ่ม ≥ 12:00<br/>และ is_in_club = false?"}
    Q -- ใช่ --> X["ได้รับยกเว้น"]
    Q -- ไม่ --> K["นับตามปกติ"]

    X --> X1["DB: view effective_attendance_records<br/>ตัดแถวนี้ออก"]
    X --> X2["DB: recalc_student_streak<br/>ข้ามรอบนี้"]
    X --> X3["Web: filterOutRdExempt()<br/>ตัดออกจากสถิติ"]
    X --> X4["PDF: ช่องแสดง 'นศท.'<br/>แทนสถานะจริง"]
    X --> X5["auto_mark_absent()<br/>ไม่เพิ่ม absent ให้"]
    X --> X6["Web: splitRdExempt()<br/>ไม่นับในตัวเลขแดชบอร์ด<br/>รายชื่อ และหน้าจอ QR"]
```

กติกานี้อยู่ใน [`src/lib/attendanceExemption.ts`](src/lib/attendanceExemption.ts) และสะท้อนใน migration `022` ถ้าอนาคตมี `session_type` เฉพาะสำหรับรอบนี้ ให้ใส่ใน `THURSDAY_AFTERNOON_SESSION_TYPES` (ฝั่งเว็บ) และแก้เงื่อนไข `WHERE` ของ view (ฝั่ง SQL) เพื่อเปลี่ยนจากการเดาด้วยเวลามาใช้ชนิดรอบแทน

---

### 10. ตารางซ้อม วันหยุด และรอบพิเศษ

```mermaid
flowchart TD
    subgraph SchedulePage["/schedule — ครู/แอดมิน"]
        direction TB
        Add["เพิ่มรอบซ้อมพิเศษ<br/>วันที่ เริ่ม สิ้นสุด รายละเอียด"] --> Chk1{"วันนั้นเป็นวันหยุด?"}
        Chk1 -- ใช่ --> Rej["ปฏิเสธ: ให้ลบวันหยุดก่อน"]
        Chk1 -- ไม่ --> Chk2{"อยู่ในช่วงปิดเทอม?"}
        Chk2 -- ใช่ --> Warn["เตือน แต่ยังอนุญาต<br/>(ซ้อมพิเศษช่วงปิดเทอม)"]
        Chk2 -- ไม่ --> Ins
        Warn --> Ins["INSERT practice_sessions<br/>session_type = 'extra', is_override = true"]

        HAdd["เพิ่มวันหยุด"] --> HIns["INSERT holidays"] --> HDel["DELETE รอบของวันนั้น<br/>WHERE is_override = false"]
        RAdd["เพิ่มช่วงปิดเทอม"] --> RIns["INSERT holiday_ranges"] --> RDel["DELETE รอบในช่วงนั้น<br/>WHERE is_override = false"]
        Del["ลบรอบซ้อม"] --> DelS["DELETE practice_sessions<br/>(attendance_records ลบตาม cascade)"]
    end

    HIns --> Cron["cron รอบถัดไปจะข้ามวันหยุด / ช่วงปิดเทอม"]
    RIns --> Cron
    Ins --> Sync["invalidate React Query →<br/>Dashboard + Attendance รีเฟรช"]
```

รอบพิเศษไม่มีกติกาเวลาตายตัว: เช็คชื่อได้ระหว่าง `start_time` ถึง `end_time` ที่บันทึกไว้ และการเช็คชื่อสำเร็จนับเป็น `present` เสมอ

---

### 11. จัดการภาคเรียนและเลื่อนชั้น

```mermaid
flowchart TD
    A["แอดมิน → แท็บภาคเรียน"] --> L["แสดง academic_terms<br/>เน้นภาคเรียนปัจจุบัน"]
    A --> N["สร้างภาคเรียน<br/>ปี พ.ศ., ภาคเรียน 1 หรือ 2, วันที่เริ่ม"]
    N --> Dup{"(ปี, ภาคเรียน)<br/>มีอยู่แล้ว?"}
    Dup -- ใช่ --> Er["Error: ซ้ำ"]
    Dup -- ไม่ --> Ins["INSERT academic_terms"]
    L --> Sw["สลับภาคเรียนปัจจุบัน"] --> Cf["กล่องยืนยัน"] --> Up["is_current = false ทุกแถว<br/>แล้ว is_current = true ที่แถวที่เลือก"]

    P["หน้านักเรียน (ครู/แอดมิน) → เลื่อนชั้น"] --> Gr["นักเรียน ม.6 → is_graduated = true"]
    Gr --> Yr["นักเรียนที่เหลือ → year_level + 1"]
```

---

### 12. รายงานและส่งออก PDF

```mermaid
flowchart TD
    R["/reports (ครู/แอดมิน) หรือหน้าโปรไฟล์ (นักเรียน)"] --> F["ตัวกรอง: Section · ปีการศึกษา · เดือน"]
    F --> Q["query attendance_records<br/>join รอบซ้อม + นักเรียน + section"]
    Q --> Ex["filterOutRdExempt()<br/>ตัดแถว ร.ด. บ่ายวันพฤหัส"]
    Ex --> Agg["สรุปรายคน:<br/>present / late / absent / excused และอัตราการเข้าร่วม"]
    Agg --> Charts["กราฟ Recharts"]
    Agg --> Cal["StudentCalendarReport:<br/>ปฏิทินรายเดือนรายบุคคล"]
    Agg --> Pdf["ExportReportDialog → AttendanceReportPDF<br/>@react-pdf/renderer ฟอนต์ Sarabun<br/>getPdfCellStatus() ใส่ 'นศท.' ในช่องที่ได้รับยกเว้น"]
```

ฟอนต์ Sarabun อยู่ใน `public/fonts/` เพื่อให้ PDF แสดงภาษาไทยได้โดยไม่ต้องโหลดจากภายนอก หัวตารางพิมพ์ซ้ำทุกหน้า และคำอธิบายสัญลักษณ์อยู่ท้ายทุกหน้า

---

## โครงสร้างฐานข้อมูล

```mermaid
erDiagram
    profiles ||--o{ attendance_records : "student_id"
    profiles ||--o| streaks : "student_id"
    profiles ||--o{ user_badges : "student_id"
    profiles }o--|| sections : "section_id"
    profiles }o--|| instruments : "instrument_id"
    instruments }o--|| sections : "section_id"
    practice_sessions ||--o{ attendance_records : "session_id (cascade)"
    practice_sessions }o--o| academic_terms : "term_id"
    practice_sessions ||--o| streaks : "last_session_id (set null)"
    badges ||--o{ user_badges : "badge_id"
    profiles ||--o{ leave_requests : "student_id"
    practice_sessions ||--o{ leave_requests : "session_id (cascade)"

    profiles {
        uuid id PK "= auth.users.id"
        text role "admin | teacher | student"
        text student_id
        int year_level "1-6"
        text classroom
        bool is_in_club
        bool is_active
        bool is_graduated
    }
    practice_sessions {
        uuid id PK
        date date
        time start_time
        time end_time
        text session_type "morning | club | extra"
        bool is_override
        text qr_token UK
    }
    attendance_records {
        uuid id PK
        text status "present | late | absent | excused"
        timestamptz check_in_time
        bool gps_verified
        int gps_distance
        bool qr_code_used
        text reason
        bool teacher_override
        uuid override_by
        text override_note
    }
    academic_terms {
        uuid id PK
        int academic_year
        int semester "1 | 2"
        bool is_current
    }
    streaks {
        uuid student_id PK
        int current_streak
        int longest_streak
    }
    badges {
        uuid id PK
        text code UK
        int threshold
    }
    leave_requests {
        uuid id PK
        text reason
        text status "pending | approved | rejected"
        uuid decided_by
        timestamptz decided_at
    }
```

ตารางอื่น: `holidays`, `holiday_ranges`, `gps_settings`, `schedule_overrides`, `notifications` / Storage bucket: `profile-pictures` (อ่านได้สาธารณะ เขียนได้เมื่อเข้าสู่ระบบ) / View: `effective_attendance_records`

Constraint สำคัญ: `UNIQUE(date, session_type)` ของรอบซ้อม และ `UNIQUE(session_id, student_id)` ของการเช็คชื่อและคำขอลา ทำให้ทุกการเขียนเป็น upsert ที่รันซ้ำได้

### Migrations

รันไฟล์ใน [`supabase/migrations/`](supabase/migrations/) **ตามลำดับตัวเลข**:

| ไฟล์ | หน้าที่ |
|---|---|
| `001_initial` | Schema หลัก, RLS, storage bucket, ข้อมูลเริ่มต้น section/เครื่องดนตรี, ภาคเรียน |
| `002_hotfix_trigger` | แก้ trigger สร้างผู้ใช้ใหม่ |
| `003_fix_rls_recursion` | แก้ RLS วนซ้ำ (เพิ่ม `get_my_role()`) |
| `004_holidays`, `005_holiday_ranges` | ตารางวันหยุดและช่วงปิดเทอม |
| `006_gps_settings`, `007_fix_gps_settings_policies` | ตั้งค่า GPS ได้ + แก้ policy |
| `008_add_classroom` | เพิ่ม `profiles.classroom` |
| `009_attendance_rls_policies` | policy การเช็คชื่อของนักเรียน/ครู |
| `010_create_daily_sessions_fn` | ฟังก์ชัน `create_daily_sessions()` |
| `011_schedule_daily_sessions_cron` | cron รายคืน + สร้างย้อนหลังครั้งแรก |
| `012_daily_sessions_end_0810`, `013_daily_sessions_clean_descriptions` | ปรับเวลาสิ้นสุด / คำอธิบายรอบ |
| `014_teacher_insert_attendance_policy` | ครูเพิ่มการเช็คชื่อให้คนอื่นได้ |
| `015_fix_cron_date_cast` | แก้การ cast วันที่ใน cron |
| `016_backfill_sessions_jun_jul` | สร้างรอบย้อนหลัง (ครั้งเดียว) |
| `017_set_morning_end_0830`, `018_daily_sessions_end_0830` | ตั้งเวลาสิ้นสุดซ้อมเช้าเป็น 08:30 (แถวเดิม + ฟังก์ชัน) |
| `019_add_indexes` | index เพิ่มประสิทธิภาพ |
| `020_auto_mark_absent` | `auto_mark_absent()` + cron 2 งาน |
| `021_streaks_badges` | ตาราง streak/badge ฟังก์ชัน trigger RLS |
| `022_thursday_rd_exemption` | view `effective_attendance_records` + ปรับ streak |
| `023_fix_streak_session_fk` | `ON DELETE SET NULL` ให้ `streaks.last_session_id` |
| `024_leave_requests` | ตาราง `leave_requests`, RLS, realtime (จำเป็นตั้งแต่ v1.1.0) |

> [!IMPORTANT]
> หลายไฟล์นิยามฟังก์ชัน `create_daily_sessions()` ซ้ำ ไฟล์เลขสูงกว่าจะทับไฟล์ก่อนหน้า จึงควรรันครบทั้งชุด ไม่เลือกรันบางไฟล์

---

## โครงสร้างไฟล์

```
src/
├── App.tsx                         # Routes, วงจร auth, route guards
├── main.tsx
├── components/
│   ├── admin/                      # SemesterManager, GPSSettingsManager
│   ├── attendance/QRPresenter.tsx  # QR เต็มจอพร้อมตัวนับสด
│   ├── layout/AppLayout.tsx        # Layout หลัก เมนู สลับธีม
│   ├── reports/                    # StudentCalendarReport, ExportReportDialog, AttendanceReportPDF
│   ├── CheckInSuccessAnimation.tsx
│   └── ui/                         # shadcn/ui components
├── hooks/
│   ├── useAuth.ts                  # เข้า/ออกจากระบบ รหัสผ่าน
│   ├── useAttendance.ts            # checkIn, qrCheckIn, markAbsentOverdue, รายชื่อ realtime
│   ├── useLeaveRequests.ts         # คำขอลา: ส่ง ยกเลิก อนุมัติ / ไม่อนุมัติ
│   ├── useNow.ts                   # re-render ทุก 30 วินาทีสำหรับ UI ที่ขึ้นกับเวลา
│   ├── useGPS.ts                   # Geolocation, haversine, cache 5 นาที (เฉพาะตอนอยู่ในพื้นที่)
│   ├── useGPSSettings.ts           # อ่าน gps_settings
│   ├── useTerm.ts                  # ภาคเรียน
│   └── useSupabaseQueries.ts       # React Query hooks (รอบ, streak, badge, รายงาน)
├── lib/
│   ├── supabase.ts                 # Supabase client
│   ├── utils.ts                    # ATTENDANCE_RULES, getAttendanceWindowState, getErrorMessage, เวลาไทย
│   └── attendanceExemption.ts      # กติกายกเว้น ร.ด. บ่ายวันพฤหัส, splitRdExempt
├── pages/                          # Dashboard, Attendance, QRCheckIn, Schedule, Reports,
│                                   # Students, Admin, Profile, Login, Forgot/ResetPassword
├── store/authStore.ts              # Zustand (user, profile, theme) เก็บถาวร
└── types/index.ts
public/                             # PWA manifest, service worker (ยังไม่ register), ไอคอน, ฟอนต์ไทย
supabase/migrations/                # SQL รันตามลำดับตัวเลข
```

---

## คู่มือการติดตั้ง

### 1. สร้างโปรเจค Supabase
1. สมัครที่ [supabase.com](https://supabase.com) แล้วกด **New project**
2. ตั้งชื่อและรหัสผ่านฐานข้อมูล แล้วรอประมาณ 2 นาที

### 2. เปิดใช้ Extension
ไปที่ **Database → Extensions** แล้วเปิด **`pg_cron`** (จำเป็นสำหรับสร้างรอบรายคืนและบันทึกขาดอัตโนมัติ)

### 3. รัน Migration
เปิด **SQL Editor** แล้วรันทุกไฟล์ใน `supabase/migrations/` **ตามลำดับตัวเลข** (`001` → `024`)

### 4. ตั้งค่า Authentication
1. **Authentication → Providers → Email**: ปิด "Confirm email" หากแอดมินเป็นคนสร้างบัญชีและไม่ต้องการยืนยันอีเมล
2. **Authentication → URL Configuration**: เพิ่ม `http://localhost:5173` (และ URL จริงของเว็บ) ใน **Redirect URLs** เพื่อให้ลิงก์รีเซ็ตรหัสผ่านใช้งานได้

### 5. สร้างแอดมินคนแรก
สร้างผู้ใช้ 1 คน (Authentication → Users → Add user) แล้วเลื่อนเป็นแอดมินใน SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

บัญชีถัดไปสร้างจากในแอปได้ (**Admin → บัญชี**)

### 6. ตั้งค่าพิกัด GPS
เข้าสู่ระบบด้วยแอดมิน → **Admin → GPS** แล้วกำหนด latitude, longitude และรัศมีที่อนุญาต (เมตร) ของห้องดนตรี

### 7. รันในเครื่อง
```bash
cp .env.example .env
# แก้ .env ด้วยค่าจาก Supabase → Settings → API
#   VITE_SUPABASE_URL=https://xxxx.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-anon-key

npm install
npm run dev        # http://localhost:5173
```

สคริปต์อื่น: `npm run build` (ตรวจ type + build), `npm run preview` ส่วน `npm run lint` ตอนนี้ยังรันไม่ได้ เพราะ ESLint 9 ต้องมี `eslint.config.js` ซึ่งโปรเจกต์ยังไม่มี

> [!WARNING]
> ใส่เฉพาะ **anon** key ในฝั่งหน้าเว็บ ห้ามใส่ `service_role` key ใน `.env`

---

## Deploy

ใช้ Netlify ตั้งค่าไว้ใน [`netlify.toml`](netlify.toml) (build `npm run build`, publish `dist`, redirect ทุก path ไป `/index.html` สำหรับ SPA)

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

หรือเชื่อม Git repository ใน Netlify Dashboard แล้วตั้ง Environment variables `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` อย่าลืมเพิ่ม URL ของ Netlify ใน Supabase **Redirect URLs**

---

## License

ดู [LICENSE](LICENSE)
