# FA Meeting Workspace

เว็บแอป React + TypeScript สำหรับ FA บันทึกผลการประชุมกลุ่มย่อย ดูตัวอย่างสไลด์ และให้ผู้ดูแลตรวจสถานะ/แก้ไขข้อมูลรอบประชุม

สถานะปัจจุบันคือ **Phase 1 — clickable mock application** ข้อมูลทั้งหมดเป็น deterministic mock data และยังไม่เชื่อมระบบ production

## ความต้องการของระบบ

- Node.js 20.19 ขึ้นไป (ตรวจสอบล่าสุดด้วย Node.js 24.15.0)
- npm
- Chromium สำหรับ Playwright (`npx playwright install chromium`)

## เริ่มใช้งาน

```powershell
npm install
npm run dev
```

คำสั่งตรวจคุณภาพ:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

`npm run test:e2e` จะเปิด Vite Preview ชั่วคราวที่ `127.0.0.1:4173` และปิดเองหลังทดสอบ

## Routes

Public/FA:

- `/` — ส่งต่อไปหน้าเลือกกลุ่ม
- `/fa` — เลือก 1 ใน 3 กลุ่ม
- `/fa/workspace` — บันทึกข้อมูลกลุ่มที่เลือก
- `/preview` — ตัวอย่างสไลด์ 16:9

Admin:

- `/admin/login` — Mock Admin Login
- `/admin/dashboard` — KPI และสถานะ 3 กลุ่ม
- `/admin/meetings` — รอบประชุมปัจจุบัน
- `/admin/meetings/:meetingId` — แก้ไขรอบประชุม
- `/admin/groups/:groupId` — แก้ไขข้อมูลกลุ่มและ Admin reopen
- `/admin/export` — Mock Export Center
- `/admin/settings` — ตั้งค่ารอบประชุม

## ข้อจำกัดของ Phase 1

- Admin authentication เป็น mock session และไม่ใช่ Supabase Auth
- Repository เก็บ snapshot แบบ mock ใน `localStorage` จึงอยู่ต่อหลัง reload และเปิดแท็บใหม่ในเบราว์เซอร์เดียวกัน แต่ไม่แชร์ข้ามเครื่อง
- Admin Settings มีปุ่ม `ล้างข้อมูลทดลอง` เพื่อคืนค่า seed data ทั้งหมด
- Autosave เป็นการจำลองสถานะ ไม่มี offline queue หรือ concurrency control
- ไม่มี Supabase Database, RLS, Realtime หรือ Presence
- ปุ่ม Excel/PowerPoint แสดง feedback เท่านั้น ยังไม่สร้างไฟล์จริง
- ไม่มี service-role key หรือ secret ใดฝังใน frontend
- รองรับ Vercel SPA routing และมีโปรเจกต์ Preview สำหรับทดลอง โดยใช้ Deployment Protection

## Milestone ถัดไป

Phase ถัดไปต้องออกแบบ Supabase schema/API, authentication, RLS, autosave ต่อ record, offline queue และ concurrency โดยใช้ตัวแปรต่อไปนี้เท่านั้นใน frontend:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

ห้ามใส่ Supabase service-role key ในตัวแปร `VITE_*` หรือ client bundle

หลักฐานการตรวจ Phase 1 อยู่ที่ [docs/phase-1-verification.md](docs/phase-1-verification.md)
