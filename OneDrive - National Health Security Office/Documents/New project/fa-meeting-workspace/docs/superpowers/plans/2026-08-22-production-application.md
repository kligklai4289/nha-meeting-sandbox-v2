# Production Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน FA Meeting Workspace จาก mock-backed UI ให้เป็นระบบจริงบน Supabase และ Vercel ครบการบันทึกพร้อมกัน, Autosave/Offline, Admin Realtime, Final และ Export

**Architecture:** FA ใช้รหัสเฉพาะกลุ่มแลก Secure HttpOnly session กับ Vercel API และไม่มีสิทธิ์เขียน Supabase โดยตรง ส่วน Admin ใช้ Supabase Auth/RLS และ typed repository เดียวกับ UI การเขียนทุกครั้งใช้ UUID mutation id และ row version เพื่อป้องกันข้อมูลซ้ำหรือเขียนทับ Export สร้างฝั่ง Server จาก snapshot เดียว

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Supabase PostgreSQL/Auth/Realtime, Vercel Functions, Zod, IndexedDB, ExcelJS, PptxGenJS, Vitest และ Playwright

**Spec:** `docs/superpowers/specs/2026-08-21-production-system-design.md`

## Global Constraints

- UI ภาษาไทย, UTF-8 และเวลาแสดงผลใน `Asia/Bangkok`
- FA ใช้ `/fa` URL เดียวและไม่ Login; รหัส FA แยกต่อกลุ่มและไม่เก็บใน Browser หลังแลก Session
- ชื่อสามกลุ่มและหัวข้อข้อมูลหกช่องต้องคงตามสเปก
- Browser รับเฉพาะ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY`; secret อยู่ใน Vercel Server เท่านั้น
- Anonymous ไม่มีสิทธิ์เขียนตาราง Supabase โดยตรง และ Admin ต้องเป็น `admin_profiles.is_active = true`
- Production application path ห้ามใช้ `MockMeetingRepository`
- ทุก behavior ใหม่ใช้ RED → GREEN และทุก task ต้องผ่าน focused tests ก่อน commit

---

### Task 1: FA Session and Server Boundary

**Files:**
- Create: `api/_lib/faSession.ts`
- Create: `api/_lib/faAuthorization.ts`
- Create: `api/fa/session.ts`
- Create: `api/fa/bootstrap.ts`
- Create: `api/_tests/fa-session.test.ts`
- Create: `api/_tests/fa-bootstrap.test.ts`
- Modify: `api/_lib/http.ts`
- Modify: `src/services/supabase/database.types.ts`

**Interfaces:**
- Produces: `createFaSessionToken`, `verifyFaSessionToken`, `authorizeFaRequest` และ JSON contracts สำหรับ session/bootstrap
- Consumes: `parseServerEnv`, `createSupabaseServerClient`, `meeting_groups`, `fa_access_codes`, `fa_sessions`

- [ ] เขียน failing tests ให้รหัสผิดตอบ 401, กลุ่มไม่ตรงตอบ 403, meeting ปิดตอบ 409 และรหัสถูกออก cookie `HttpOnly; Secure; SameSite=Strict`
- [ ] รัน `npm run test:run -- api/_tests/fa-session.test.ts api/_tests/fa-bootstrap.test.ts` และยืนยันว่า fail เพราะ endpoints ยังไม่มี
- [ ] สร้าง HMAC-signed session token, hash lookup ของ access code ด้วย pepper, session expiry 12 ชั่วโมง และ safe error mapping ที่ไม่คืน hash/token
- [ ] รัน focused tests ให้ผ่านและรัน `npm run typecheck`
- [ ] Commit เฉพาะไฟล์ Task 1 ด้วยข้อความ `feat: add secure FA sessions`

### Task 2: Idempotent FA Mutations and Final Workflow

**Files:**
- Create: `api/_lib/faMutations.ts`
- Create: `api/fa/issues.ts`
- Create: `api/fa/issues/[id].ts`
- Create: `api/fa/group.ts`
- Create: `api/fa/finalize.ts`
- Create: `api/_tests/fa-mutations.test.ts`
- Create: `supabase/migrations/20260822_add_fa_mutation_functions.sql` ผ่าน `supabase migration new add_fa_mutation_functions`

**Interfaces:**
- Produces: create/update/delete/reorder issue และ update/finalize group contracts ที่รับ `mutationId`, `expectedRowVersion`
- Consumes: FA authorization จาก Task 1 และ `mutation_receipts`

- [ ] เขียน failing tests สำหรับ whitelist, group isolation, duplicate mutation, version conflict, final lock และสามกลุ่มเขียนพร้อมกันโดยไม่ทับกัน
- [ ] รัน `npm run test:run -- api/_tests/fa-mutations.test.ts` ให้เห็น expected failures
- [ ] สร้าง transaction functions ที่ตรวจ meeting/group/session/version และบันทึก receipt/audit แบบ atomic
- [ ] สร้าง Vercel handlers พร้อม request size 64 KiB, Origin check และ status 200/201/409 ตาม contract
- [ ] รัน focused tests, database tests และ typecheck ให้ผ่าน
- [ ] Commit ด้วยข้อความ `feat: add conflict-safe FA mutations`

### Task 3: Real Browser Repository, Autosave, and Offline Draft

**Files:**
- Create: `src/services/httpFaRepository.ts`
- Create: `src/services/faContracts.ts`
- Create: `src/services/offline/offlineQueue.ts`
- Create: `src/services/offline/indexedDbQueue.ts`
- Create: `src/hooks/useAutosave.ts`
- Create: `src/services/httpFaRepository.test.ts`
- Create: `src/services/offline/offlineQueue.test.ts`
- Create: `src/hooks/useAutosave.test.tsx`
- Modify: `src/pages/fa/FASelectGroupPage.tsx`
- Modify: `src/pages/fa/FAWorkspacePage.tsx`
- Modify: `src/app/AppProviders.tsx`

**Interfaces:**
- Produces: `FaRepository.bootstrap`, `saveGroup`, `upsertIssue`, `deleteIssue`, `finalize`; `OfflineMutationQueue.enqueue/flush`; `useAutosave`
- Consumes: API contracts จาก Tasks 1–2

- [ ] เขียน failing tests สำหรับ code exchange, debounce 1500 ms ต่อ record, offline enqueue, ordered retry, idempotent replay และ conflict หยุดเฉพาะ record
- [ ] รัน focused tests และยืนยัน failure จาก repository/hooks ที่ยังไม่มี
- [ ] Implement HTTP repository และ IndexedDB queue โดยไม่เก็บ access code หรือ secret
- [ ] เปลี่ยน Workspace ให้โหลด/บันทึกข้อมูลจริง ลบ mock banner และแสดง Saving/Saved/Unsynced/Conflict อย่างถูกต้อง
- [ ] รัน focused tests, router tests และ E2E FA flow
- [ ] Commit ด้วยข้อความ `feat: connect FA workspace to live autosave`

### Task 4: Admin Data Repository and Realtime

**Files:**
- Create: `src/services/supabase/adminMeetingRepository.ts`
- Create: `src/hooks/useRealtimeMeeting.ts`
- Create: `src/services/supabase/adminMeetingRepository.test.ts`
- Create: `src/hooks/useRealtimeMeeting.test.tsx`
- Modify: `src/services/meetingRepository.ts`
- Modify: `src/app/AppProviders.tsx`
- Modify: `src/pages/admin/AdminDashboardPage.tsx`
- Modify: `src/pages/admin/AdminGroupDetailPage.tsx`
- Modify: `src/pages/admin/AdminMeetingDetailPage.tsx`
- Modify: `src/pages/admin/AdminMeetingsPage.tsx`
- Modify: `src/layouts/AdminLayout.tsx`

**Interfaces:**
- Produces: authenticated CRUD repository และ realtime invalidation/subscription สำหรับ `meeting_groups`, `issues`
- Consumes: Supabase browser client และ active-admin guard ที่มีอยู่

- [ ] เขียน failing tests ให้ inactive Admin ถูกปฏิเสธ, Dashboard เปลี่ยนเมื่อ Realtime event มา, Reopen ปลด Final และ CRUD แยกรอบประชุม
- [ ] รัน focused tests ให้ fail เพราะ production repository ยังไม่มี
- [ ] Implement typed Supabase repository ผ่าน RLS และ realtime subscription พร้อม cleanup/reconnect
- [ ] เปลี่ยน Admin pages ให้ใช้ข้อมูลจริง ลบ mock banner และสร้าง audit-backed Final/Reopen
- [ ] รัน Admin unit/router/E2E tests และ typecheck
- [ ] Commit ด้วยข้อความ `feat: connect admin workspace to realtime data`

### Task 5: Presence and Access-Code Administration

**Files:**
- Create: `src/hooks/useGroupPresence.ts`
- Create: `api/admin/access-codes.ts`
- Create: `api/_lib/adminAuthorization.ts`
- Create: `api/_tests/admin-access-codes.test.ts`
- Create: `src/hooks/useGroupPresence.test.tsx`
- Modify: `src/pages/admin/AdminSettingsPage.tsx`
- Modify: `src/pages/fa/FAWorkspacePage.tsx`

**Interfaces:**
- Produces: presence count/message และ rotate-code response ที่คืน plaintext เพียงครั้งเดียวแก่ active Admin
- Consumes: Supabase Auth bearer validation, audit log และ Realtime Presence

- [ ] เขียน failing tests สำหรับ two-session warning, presence cleanup, inactive Admin denial และ rotation ทำให้รหัสเก่าใช้ไม่ได้
- [ ] รัน focused tests ให้ fail ตาม behavior ที่ขาด
- [ ] Implement presence channel scoped ด้วย meeting/group และ protected rotation endpoint
- [ ] แสดงรหัสใหม่ครั้งเดียวพร้อมปุ่มคัดลอก โดยห้าม log/persist plaintext
- [ ] รัน focused tests และ security assertions
- [ ] Commit ด้วยข้อความ `feat: add FA presence and code rotation`

### Task 6: Excel and PowerPoint Export

**Files:**
- Create: `api/exports/excel.ts`
- Create: `api/exports/powerpoint.ts`
- Create: `api/_lib/exportSnapshot.ts`
- Create: `src/services/exportService.ts`
- Create: `api/_tests/export-excel.test.ts`
- Create: `api/_tests/export-powerpoint.test.ts`
- Create: `src/services/exportService.test.ts`
- Modify: `src/pages/admin/ExportCenterPage.tsx`
- Modify: `src/pages/admin/AdminDashboardPage.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: authenticated download endpoints `?scope=group&groupId=` หรือ `?scope=all&draft=true`
- Consumes: snapshot loader, ExcelJS, PptxGenJS และ `Template กลุ่ม 1-3.pptx` เป็น design reference

- [ ] เพิ่ม pinned ExcelJS/PptxGenJS dependencies หลังได้รับสิทธิ์ดาวน์โหลด dependency
- [ ] เขียน failing tests ตรวจชื่อ Sheet, Thai headers, freeze/filter/wrap, 16:9 slides, group ordering, Draft mark และ long-text continuation
- [ ] รัน focused tests ให้ fail เพราะ exporters ยังไม่มี
- [ ] Implement snapshot-once exporters และ download service; บันทึก export audit โดยไม่เก็บไฟล์ถาวร
- [ ] เชื่อมปุ่มรายกลุ่ม/รวมและ Draft confirmation ให้ดาวน์โหลดไฟล์จริง
- [ ] เปิดไฟล์ที่สร้างด้วย parser/render verification และรัน focused tests
- [ ] Commit ด้วยข้อความ `feat: export meeting reports to Excel and PowerPoint`

### Task 7: Remote Supabase Configuration and Data

**Files:**
- Modify: `supabase/config.toml`
- Modify: `supabase/seed/production.sql`
- Modify: `supabase/seed/staging.sql`
- Modify: `docs/part-3-auth-runbook.md`
- Create: `docs/production-runbook.md`

**Interfaces:**
- Produces: migrated Staging/Production projects, active meeting 27 สิงหาคม 2569, three groups, three random FA codes และ initial Admin invitation
- Consumes: checked-in migrations/templates และ secrets supplied through authenticated CLI/dashboard only

- [ ] ตรวจ Supabase changelog/current docs และ CLI `--help`; snapshot schema/config โดยไม่แสดง project ref หรือ secrets
- [ ] Apply migrations และ staging seed; รัน pgTAP/RLS/advisor checks และ three-group concurrency smoke test
- [ ] ตั้ง Auth invite-only, minimum password 12, approved redirect URLs, SMTP และ templates
- [ ] เชิญ `pichailakarm@gmail.com`, สร้าง active profile และยืนยัน Login/Forgot-password flow
- [ ] Apply migrations/production seed หลัง Staging ผ่าน และสร้างรหัส FA สุ่มสามรหัสโดยเปิดเผยให้ผู้ใช้เพียงครั้งเดียว
- [ ] บันทึกหลักฐานแบบ redacted และ commit runbook ด้วยข้อความ `docs: add production operations runbook`

### Task 8: Vercel Production Deployment and Acceptance

**Files:**
- Modify: `README.md`
- Modify: `docs/part-3-verification.md`
- Create: `docs/production-verification.md`

**Interfaces:**
- Produces: Production URL ที่เชื่อม Production Supabase และ verification record
- Consumes: Vercel project link, six scoped environment values และ artifact จาก Tasks 1–7

- [ ] ตั้ง Vercel Preview env เป็น Staging และ Production env เป็น Production โดยไม่ echo values
- [ ] Deploy Preview, ตรวจ health/UI/API/Auth/no-store/bundle/log แล้วทดสอบ FA ทั้งสามกลุ่มพร้อมกันและลบข้อมูลทดสอบ
- [ ] Promote artifact เดิมเป็น Production เมื่อ Preview ผ่านทุก boundary
- [ ] ตรวจ Production `/fa`, Admin Login, Autosave, Realtime, Final/Reopen, Excel/PPT downloads, responsive UI และ server logs
- [ ] รัน `npm run verify:environment`, typecheck, lint, full Vitest, build, full Playwright และ `git diff --check`
- [ ] บันทึก URL/commit/test counts โดยไม่เปิดเผย secrets และ commit ด้วยข้อความ `docs: record production acceptance`

