# Production System Design — FA Meeting Workspace

วันที่: 21 สิงหาคม 2569  
สถานะ: อนุมัติหลักการออกแบบรายส่วนแล้ว รออนุมัติเอกสารก่อนจัดทำ Implementation Plan

## 1. เป้าหมายและขอบเขต

ยกระดับแอป React + TypeScript เดิมจาก clickable mock ให้เป็นระบบใช้งานจริงสำหรับ FA สามกลุ่มบันทึกข้อมูลพร้อมกัน โดยคงข้อกำหนดต่อไปนี้:

- ใช้ React, TypeScript, Tailwind CSS, Supabase PostgreSQL และ Vercel
- FA ใช้ URL `/fa` เดียว เลือกกลุ่มก่อนทำงาน และไม่ต้องมีบัญชีผู้ใช้
- ห้ามเปลี่ยนชื่อสามกลุ่มและหัวข้อข้อมูลหกช่องโดยไม่ได้รับคำสั่ง
- Admin ใช้บัญชีอีเมล/รหัสผ่านผ่าน Supabase Auth
- ข้อมูลแต่ละรอบประชุมต้องแยกจากกัน และรองรับรอบประชุมในอนาคต
- มี Autosave, Offline Draft, Realtime, Presence, Final workflow และ Export จริง
- ไม่ฝัง Service Role Key หรือ Secret ใดใน Browser bundle

บัญชี Admin เริ่มต้นคือ `pichailakarm@gmail.com` โดยผู้ใช้ตั้งรหัสผ่านผ่านอีเมลเชิญ ห้ามกำหนดรหัสผ่านใน Seed, Source Code หรือเอกสารนี้

## 2. Environment และ Infrastructure

สร้าง Supabase สอง Project ใน Region Singapore:

- `fa-meeting-workspace-staging`
- `fa-meeting-workspace-production`

Vercel Preview เชื่อมกับ Staging และ Vercel Production เชื่อมกับ Production แต่ละ Environment ใช้ Secrets คนละชุดโดยเด็ดขาด โครงสร้างฐานข้อมูลทั้งสอง Project มาจาก Supabase Migration ชุดเดียวกัน ทุก Migration ต้องผ่าน Staging ก่อน และ Production จะไม่ถูกเปลี่ยนหรือ Deploy จนกว่าผู้ใช้อนุมัติในแชต

Frontend ใช้เฉพาะตัวแปรที่เปิดเผยได้:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Vercel Server ใช้ Secret ต่อ Environment เช่น:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `FA_SESSION_SIGNING_SECRET`
- `FA_CODE_PEPPER`

ชื่อ Environment Variable ขั้นสุดท้ายจะถูกตรึงใน Implementation Plan และตรวจด้วย Runtime Schema ห้าม Log ค่า Secret

## 3. สถาปัตยกรรม Hybrid

### 3.1 FA

FA ไม่ Login แต่ใช้รหัสสุ่มที่แยกเฉพาะกลุ่ม ระบบเก็บเฉพาะ Hash ของรหัส เมื่อรหัสถูกต้อง Vercel API ออก Session Token อายุจำกัดใน Secure, HttpOnly, SameSite cookie โดย Session ผูกกับ `meeting_id` และ `group_id`

Browser ของ FA ไม่มีสิทธิ์เขียน Supabase Table โดยตรง การเพิ่ม แก้ไข ลบ Autosave เปลี่ยนสถานะ และ Final ต้องผ่าน Vercel API ซึ่งตรวจ:

- Session ยังไม่หมดอายุหรือถูกเพิกถอน
- Meeting ยัง Active
- Group อยู่ใน Meeting และตรงกับ Session
- Group ยังไม่ Final สำหรับการแก้ไขของ FA
- Request แก้ไขเฉพาะ Field ที่อยู่ใน Whitelist
- `row_version` ตรงกับข้อมูลล่าสุด
- `mutation_id` ยังไม่เคยประมวลผล

### 3.2 Admin

Admin ใช้ Supabase Auth อีเมล/รหัสผ่าน โปรไฟล์ภายในระบบกำหนดสถานะ Active และบทบาท Admin RLS อนุญาตเฉพาะ Admin ที่ Active เท่านั้น Admin คนแรกสามารถเชิญและปิดสิทธิ์ Admin อื่นได้ การเชิญใช้กระบวนการตั้งรหัสผ่านผ่านอีเมล

### 3.3 Realtime และ Presence

Supabase Realtime ใช้อัปเดต Dashboard และข้อมูลกลุ่มโดยไม่ต้อง Reload Realtime Presence แจ้งเมื่อมี Session อื่นกำลังแก้ไขกลุ่มเดียวกัน แต่ไม่บังคับ Lock

การป้องกันเขียนทับใช้ Optimistic Concurrency ด้วย `row_version` หาก Version ไม่ตรง Server ตอบ Conflict, Autosave หยุดเฉพาะรายการนั้น และ UI ให้ผู้ใช้โหลดข้อมูลล่าสุดก่อนดำเนินการต่อ

## 4. Database Schema

ทุก Primary Key ใช้ UUID ทุกเวลาจัดเก็บเป็น `timestamptz` และแสดงผลใน `Asia/Bangkok`

### `meetings`

เก็บชื่อรอบ ปีงบประมาณ วัน เวลา สถานที่ สถานะ และ Timestamps อนุญาต Active Meeting เพียงหนึ่งรอบต่อ Environment ผ่าน Database Constraint/Transaction ที่ตรวจสอบได้

### `meeting_groups`

ผูกกับ Meeting เก็บหมายเลขและชื่อกลุ่ม ขอบเขตกลุ่ม ผู้นำเสนอ สถานะ `draft | review_ready | final`, `row_version`, `finalized_at` และ Timestamps กลุ่มหมายเลข 1–3 ต้องไม่ซ้ำใน Meeting เดียวกัน

### `issues`

ผูกกับ Meeting และ Group เก็บหกช่องข้อมูลตาม Template, ลำดับแสดงผล, `row_version`, Soft Delete และ Timestamps การเพิ่มประเด็นไม่จำกัดจำนวนภายใต้ Request/Payload limits

### `fa_access_codes`

ผูกกับ Meeting และ Group เก็บ Hash ของรหัสแบบสุ่ม สถานะ เวลาหมดอายุ ผู้สร้าง และเวลาเปลี่ยนรหัส รหัสเก่าใช้ไม่ได้ทันทีเมื่อสร้างรหัสใหม่

### `fa_sessions`

ผูกกับ Meeting และ Group เก็บ Hash/Identifier ของ Session, เวลาหมดอายุ, เวลาล่าสุด, การเพิกถอน และ Metadata ขั้นต่ำที่จำเป็น ไม่เก็บรหัส FA แบบ Plaintext

### `admin_profiles`

ผูกกับ `auth.users` เก็บชื่อ บทบาท สถานะ ผู้เชิญ และ Timestamps การปิดสิทธิ์ต้องทำให้ RLS ปฏิเสธการเข้าถึงทันที

### `audit_logs`

เก็บ Actor type/id, Action, Target table/id, Meeting/Group, Before/After ที่ผ่านการ Redact, Request ID และเวลา ครอบคลุม Final, Reopen, เปลี่ยนรหัส, จัดการ Admin, แก้ไขโดย Admin และ Export

### `mutation_receipts`

เก็บ `mutation_id` แบบไม่ซ้ำ, Session, Target, ผลลัพธ์และเวลา เพื่อให้ Offline Queue/Autosave ส่งซ้ำได้อย่าง Idempotent โดยไม่เพิ่มหรือแก้ข้อมูลซ้ำ

RLS ปิด Anonymous write ทุกตาราง FA เขียนผ่าน Server เท่านั้น Admin ที่ Active จึงอ่านและจัดการตาม Policy ได้ Service Role ใช้เฉพาะ Vercel Server

## 5. Seed Data

ทั้งสอง Environment เริ่มด้วยรอบประชุม:

- ชื่อ: แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570
- วันที่: 27 สิงหาคม 2569
- เวลา: 09.00–16.30 น.
- สถานที่: โรงแรมกรุงศรีริเวอร์ จังหวัดพระนครศรีอยุธยา
- สามกลุ่มใช้ชื่อและขอบเขตตามข้อกำหนดเดิม

Staging มีข้อมูลตัวอย่างอย่างน้อยกลุ่มละสองประเด็น Production มีรอบและกลุ่มจริง แต่ไม่ใส่ข้อความตัวอย่างลงในประเด็น รหัส FA ทั้งสามกลุ่มสุ่มแยกกันและเก็บเฉพาะ Hash

## 6. Routes และ API

### Browser Routes

คง Route ปัจจุบัน:

- `/`, `/fa`, `/fa/workspace`, `/preview`
- `/admin/login`, `/admin/dashboard`, `/admin/meetings`
- `/admin/meetings/:meetingId`, `/admin/groups/:groupId`
- `/admin/export`, `/admin/settings`

### Server API

- `POST /api/fa/session` — แลกรหัสกลุ่มเป็น Session
- `GET /api/fa/bootstrap` — โหลด Meeting, Group และ Issues ที่ Session มีสิทธิ์
- `POST/PATCH /api/fa/issues` — เพิ่มหรือแก้ไขประเด็น
- `DELETE /api/fa/issues/:id` — Soft Delete ประเด็น
- `PATCH /api/fa/group` — แก้ไขข้อมูลกลุ่ม/สถานะที่อนุญาต
- `POST /api/fa/finalize` — Final พร้อมตรวจ Version
- `POST /api/admin/invitations` — เชิญหรือปิดสิทธิ์ Admin
- `POST /api/admin/access-codes` — สร้างรหัส FA ใหม่
- `GET /api/exports/excel` — Excel รายกลุ่มหรือรวม
- `GET /api/exports/powerpoint` — PowerPoint รายกลุ่มหรือรวม

API ทุกจุดใช้ Schema Validation, Rate Limit, Request Size Limit, Origin/CSRF protection, Request ID และ Safe Error Mapping ห้ามส่ง Stack Trace, Secret, Hash หรือ Token กลับ Client

## 7. FA Workflow และ Offline Draft

1. FA เปิด `/fa`, เลือกกลุ่ม และกรอกรหัสเฉพาะกลุ่ม
2. Server ออก Session ที่มีสิทธิ์เฉพาะรอบและกลุ่มนั้น
3. Workspace โหลดข้อมูลจริง และ Presence แสดง Session อื่นในกลุ่มเดียวกัน
4. การแก้ไขบันทึกแบบ Debounce ต่อ Record พร้อม Version และ Mutation ID
5. เมื่อ Offline การเปลี่ยนแปลงเก็บใน IndexedDB เป็น Queue โดยแยก Meeting/Group/Record
6. เมื่อ Online ระบบส่ง Queue ตามลำดับและตรวจ Version ทุก Mutation
7. Conflict ไม่ถูกเขียนทับอัตโนมัติ ผู้ใช้ต้องโหลดข้อมูลล่าสุดก่อน
8. Final ล็อกการแก้ไขของ FA ทั้งกลุ่ม Admin เท่านั้นที่เปิดกลับเป็น Draft ได้

IndexedDB มีเฉพาะ Draft ที่จำเป็น ไม่เก็บรหัส FA หรือ Service Secret และล้างรายการที่ Sync สำเร็จแล้ว

## 8. Admin Workflow

Admin Login ผ่าน Supabase Auth Dashboard แสดงสามกลุ่มและเปลี่ยนแบบ Realtime Admin เปิดรายละเอียด แก้ไขข้อมูล Final/Reopen จัดการ Meeting, Admin และรหัส FA ได้ ทุก Action สำคัญสร้าง Audit Log

Admin คนแรกคือ `pichailakarm@gmail.com` และสามารถเชิญ Admin เพิ่มผ่าน Settings การปิดสิทธิ์ต้อง Revoke Session/Access ตามความสามารถของ Supabase Auth และบังคับ RLS ปฏิเสธคำขอถัดไป

## 9. Export

### Excel

ใช้ ExcelJS สร้าง Excel รายกลุ่มและรวมสามกลุ่ม หนึ่งแถวต่อประเด็น มีคอลัมน์ชื่อกลุ่ม Header Bold, Freeze Header, Auto Filter, Wrap Text, Border และความกว้างคอลัมน์ที่อ่านภาษาไทยได้

### PowerPoint

ใช้ PptxGenJS และยึด `Template กลุ่ม 1-3.pptx` เป็น Design Reference/Template สัดส่วน 16:9 คงสี ฟอนต์ ตำแหน่ง หน้าปก และลำดับเนื้อหาหลัก ข้อความยาวแตกเป็น Slide ต่อเนื่องโดยไม่ลด Font จนอ่านยาก PowerPoint รวมเรียงกลุ่ม 1, 2, 3

หาก Group ยังไม่ Final Admin ต้องยืนยัน Export Draft และไฟล์มีเครื่องหมาย Draft การ Export ใช้ Snapshot จาก Server ใน Request เดียว ไฟล์สร้างชั่วคราวและส่งดาวน์โหลดโดยไม่เก็บถาวร Audit Log บันทึกผู้ Export, Scope และเวลา

## 10. Component และ File Boundaries

คง UI/Routes/Domain เดิมและแทนเฉพาะ Service boundary ไม่ Rewrite ทั้งโครงการ ไฟล์ใหม่หลัก:

- `supabase/migrations/` และ `supabase/seed/`
- `api/fa/`, `api/admin/`, `api/exports/`
- `src/services/supabase/`, `src/services/offline/`
- `src/hooks/useAutosave.ts`, `src/hooks/useRealtimeGroup.ts`
- `src/features/export/`
- `tests/integration/` และ E2E ที่มีอยู่

Mock repository คงไว้เฉพาะ Automated tests และ Story/Fixture ที่ไม่รันใน Production application path

## 11. Testing และ Acceptance

ก่อน Promotion ทุกครั้งต้องผ่าน Typecheck, Lint, Unit, Integration, E2E, Build และ Security audit อย่างน้อยครอบคลุม:

- FA เลือกกลุ่ม รหัสถูก/ผิด เพิ่ม แก้ไข ลบ Autosave Final และ Session expiry
- สามกลุ่มบันทึกพร้อมกันโดยข้อมูลไม่ทับกัน
- สอง Session กลุ่มเดียวกันเห็น Presence และเกิด Version Conflict โดยไม่เขียนทับ
- Offline Queue ส่งซ้ำอย่าง Idempotent และ Sync เมื่อ Online
- Admin Login, Dashboard, Realtime, Reopen, Invite/Disable Admin และ Access-code rotation
- Anonymous ไม่สามารถเขียน Table โดยตรง; Admin inactive ถูก RLS ปฏิเสธ
- Excel ภาษาไทยและรูปแบบถูกต้อง
- PowerPoint Render แล้วไม่ล้นและสอดคล้องกับ Template
- Desktop, Tablet และ Mobile ไม่มี Regression สำคัญ

ต้องสำรองข้อมูลและทดสอบ Recovery ก่อนวันประชุม Production จะเปิดใช้หลังผู้ใช้ตรวจ Staging และอนุมัติเท่านั้น

## 12. Implementation Sequence และ Approval Gates

ดำเนินงานเป็นหกส่วน โดยขออนุมัติก่อนเริ่มแต่ละส่วน:

1. Infrastructure — Supabase Projects, Migration, Seeds, Environment validation และ Vercel API foundation
2. Supabase Repository — Client/Server access และแทน Production mock path
3. FA Access + Autosave — Group codes, Session, IndexedDB queue, concurrency และ Final
4. Admin Auth + Realtime — Auth, RLS, Dashboard, Presence และ Admin management
5. Export — ExcelJS, PptxGenJS และ Template
6. Security + Verification — Security tests, concurrency/E2E, runbook และ Production promotion

แต่ละส่วนต้องมี Test-first implementation, หลักฐานคำสั่งตรวจคุณภาพ และสรุปสิ่งที่เปลี่ยนก่อนขออนุมัติไปส่วนถัดไป
