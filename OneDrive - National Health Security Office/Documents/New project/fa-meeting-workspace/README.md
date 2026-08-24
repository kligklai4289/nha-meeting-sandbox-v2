# FA Meeting Workspace

เว็บแอป React + TypeScript สำหรับบันทึกและบริหารผลการประชุมกลุ่มย่อย 3 กลุ่มของสำนักงานหลักประกันสุขภาพแห่งชาติ รอบตั้งต้นวันที่ 27 สิงหาคม 2569

ระบบเชื่อม Supabase จริงแล้วทั้ง FA และ Admin: FA ใช้รหัสเฉพาะกลุ่ม, HttpOnly session, autosave, Offline Draft, optimistic concurrency และ Final เฉพาะกลุ่ม ส่วน Admin ใช้ Supabase Auth/RLS, Dashboard/CRUD/Realtime, เปิดกลุ่มกลับ, หมุนรหัสกลุ่ม, Presence และส่งออก Excel/PowerPoint จริงตาม template

Public deployment ปัจจุบัน: <https://fa-meeting-workspace-trial.vercel.app/fa>

## ความต้องการ

- Node.js 22 ขึ้นไป (Vercel ใช้ Node.js 24)
- npm
- Chromium สำหรับ Playwright
- Supabase project และ Vercel project สำหรับ remote deployment

## เริ่มใช้งาน

```powershell
npm install
npm run dev
```

คำสั่งตรวจคุณภาพ:

```powershell
npm run verify:environment
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
npx vercel build --yes
```

## Routes

Public/FA:

- `/fa` — เลือกกลุ่มและกรอกรหัสเข้ากลุ่ม
- `/fa/workspace` — บันทึกประเด็น, autosave/offline, preview และ Final เฉพาะกลุ่ม
- `/preview` — ตัวอย่างสไลด์ 16:9

Admin:

- `/admin/login` — เข้าด้วยอีเมล/รหัสผ่าน
- `/admin/forgot-password` — ขออีเมลตั้งรหัสผ่านใหม่
- `/admin/auth/confirm` — ยืนยัน invite/recovery แบบ scanner-safe
- `/admin/update-password` — ตั้งรหัสผ่านจาก invite/recovery session
- `/admin/dashboard` — Dashboard จากข้อมูลจริงและ Realtime
- `/admin/meetings` และ `/admin/meetings/:meetingId` — จัดการรอบประชุม
- `/admin/groups/:groupId` — แก้ไขกลุ่ม/ประเด็นและ Reopen
- `/admin/export` — ดาวน์โหลด Excel/PowerPoint จริง
- `/admin/settings` — ตั้งค่ารอบประชุมและหมุนรหัสกลุ่ม

## Environment variables

Browser-safe:

```dotenv
VITE_SUPABASE_URL=<Supabase project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Server-only:

```dotenv
SUPABASE_URL=
SUPABASE_SECRET_KEY=
FA_SESSION_SIGNING_SECRET=
FA_CODE_PEPPER=
```

ห้าม commit ค่า secret, plaintext access code, password, Auth token/hash, invite/recovery URL หรือ SMTP credential ดูตัวอย่างชื่อทั้งหมดใน [.env.example](.env.example)

## Remote status

- Supabase Staging เชื่อมแล้วและมี migration ครบถึง atomic export snapshot
- Auth Staging ปิด public signup, บังคับรหัสผ่านขั้นต่ำ 12 ตัวพร้อมตัวพิมพ์เล็ก/ใหญ่ ตัวเลขและสัญลักษณ์ และตั้ง exact redirect ไป production alias แล้ว
- Vercel public alias deploy แล้ว; `/api/health` และ `/api/public/active-meeting` ตอบ `200`
- Custom Gmail SMTP และ template เชิญ/กู้รหัสผ่านภาษาไทยเปิดใช้แล้ว; ส่งคำเชิญ Initial Admin ไปยังอีเมลที่อนุมัติแล้ว
- เจ้าของระบบยืนยันแนวทางไม่มีค่าใช้จ่าย จึงใช้ Supabase project ปัจจุบันเป็นระบบ live แบบโปรเจกต์เดียวและไม่สร้าง Production project เพิ่ม

สถานะละเอียดและลำดับงานต่ออยู่ใน [HANDOFF.md](HANDOFF.md) และ [TODO.md](TODO.md)
