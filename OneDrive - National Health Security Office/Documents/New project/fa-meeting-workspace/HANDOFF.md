# FA Meeting Workspace — HANDOFF

อัปเดต: 24 สิงหาคม 2569 (Asia/Bangkok)
Branch: `codex/fa-meeting-workspace-foundation`  
Public URL: <https://fa-meeting-workspace-trial.vercel.app/fa>

Source code และ Git เป็น source of truth ของเอกสารนี้ ห้ามใส่ secret, password, plaintext group code, Auth token/hash, invite/recovery URL, user UUID หรือ SMTP credential ลงเอกสาร/commit/log

## 1. เป้าหมายระบบ

ระบบบันทึกผลการประชุมกลุ่มย่อย 3 กลุ่มสำหรับรอบวันที่ 27 สิงหาคม 2569 มี FA บันทึกข้อมูลแบบ autosave/offline/final เฉพาะกลุ่ม และ Admin ดูภาพรวม แก้ไข Reopen หมุนรหัส ดู Presence และ export Excel/PowerPoint ตาม template เดิม

## 2. Tech Stack

- React 19, TypeScript 6, React Router 7, Tailwind CSS 4, Vite 8
- Vercel Functions ใน `api/` ใช้ Web `Request`/`Response`
- Supabase PostgreSQL 17, Auth, RLS, Realtime/Presence
- IndexedDB Offline Draft
- ExcelJS 4.4.0 และ PptxGenJS 4.0.1
- Vitest/Testing Library/MSW/Playwright/Oxlint
- Node.js >=22; Vercel project ใช้ Node.js 24

## 3. Architecture / folders

```text
api/                 Vercel server functions และ server-only gateways
src/app/             providers/router
src/pages/fa/        FA group selection/workspace
src/pages/admin/     Auth, dashboard, meeting/group/settings/export
src/services/        live repositories, Auth, Realtime, export, offline
src/hooks/           autosave, offline replay, Presence
supabase/migrations/ schema/RPC/RLS/audit
supabase/seed/       staging และ production seed แยกกัน
supabase/templates/  scanner-safe invite/recovery templates
e2e/                 browser acceptance fixtures/specs
scripts/             safe build, verification, initial-admin operator
docs/                designs/plans/runbooks/verification
```

Runtime flow:

1. `/fa` อ่าน active meeting ผ่าน server API
2. รหัสกลุ่มถูก HMAC ด้วย `FA_CODE_PEPPER`; server ออก HttpOnly signed session cookie
3. FA bootstrap/autosave/reorder/final ใช้ server functions, mutation receipt และ row version
4. network failure เก็บ mutation ใน IndexedDB แล้ว replay ตามลำดับ
5. Admin ใช้ Supabase Auth และ active `admin_profiles`; business data ผ่าน RLS repository และ Realtime
6. export เรียก atomic server snapshot แล้วสร้าง `.xlsx`/`.pptx` ฝั่ง server

## 4. Database schema / relationships

- `meetings` parent ของ groups/issues/codes/sessions; active ได้หนึ่งรอบ
- `meeting_groups` กลุ่ม 1–3, presenter/status/final, FK ไป meeting
- `issues` เนื้อหา 6 ช่อง, position, soft delete, FK ไป meeting/group
- `fa_access_codes` เก็บ hash เท่านั้น; active หนึ่ง code ต่อ group
- `fa_access_attempts` เก็บ IP HMAC และจำนวนครั้งที่ลองต่อ group; ครั้งที่ 6 ล็อก 15 นาที
- `fa_sessions` server session hash/expiry/revocation
- `admin_profiles` FK ไป `auth.users`, role `admin`, active flag
- `audit_logs` audit ของ FA/Admin/System
- `mutation_receipts` idempotency

RPC สำคัญ: `fa_apply_mutation`, `fa_reorder_issues`, `fa_claim_access_attempt`, `fa_clear_access_attempts`, `admin_get_group_bundle`, `admin_rotate_fa_access_code`, `admin_export_snapshot` การเขียนสำคัญใช้ optimistic concurrency, transaction และ audit

Migration ล่าสุดที่ apply บน linked project: `20260823220000_add_fa_access_protection.sql`

## 5. Environment variables

Browser-safe:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Server-only:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `FA_SESSION_SIGNING_SECRET` (อย่างน้อย 32 ตัว)
- `FA_CODE_PEPPER` (อย่างน้อย 32 ตัวและแยกจาก signing secret)

Initial Admin operator เพิ่ม `INITIAL_ADMIN_REDIRECT_TO` และ `INITIAL_ADMIN_REDIRECT_ORIGINS` เฉพาะ process ที่รัน script

## 6. Features ที่เสร็จแล้ว

- FA live session, group-scoped authorization, CRUD/reorder, debounced autosave, Offline Draft/replay/conflict, Preview และ Final เฉพาะกลุ่ม
- Admin Login/Logout/Forgot/Confirm/Update password UI และ active-profile guard
- Admin Dashboard/Meeting/Group CRUD, Reopen พร้อม audit, Realtime reconnect/cleanup
- Presence และ Admin กำหนด/เปลี่ยนรหัสตัวเลข 4 หลักเอง; ห้ามซ้ำข้ามกลุ่ม; revoke session เดิม
- FA code rate limit 5 ครั้ง แล้วล็อก 15 นาที; เก็บเฉพาะ HMAC ของ code/IP
- Excel/PowerPoint export จริงแบบ group/all, Draft confirmation/watermark, audit และ NHSO logo จาก template
- Responsive UI; หน้า Admin มีปุ่มกลับหน้าบันทึกข้อมูล
- Public Vercel deployment พร้อม `health`, active-meeting และ PowerPoint production ที่ตรวจใช้งานจริงแล้ว
- Supabase Staging Auth ปิด signup, password policy 12 ตัวแบบ complex, exact production redirect และ secure password change

Commits หลักล่าสุด:

- `6188a2a4 feat: connect FA workspace to live autosave`
- `5b784494 feat: connect admin workspace to Supabase`
- `b1eed8dd feat: add FA presence and code rotation`
- `1bc76897 feat: add production Excel and PowerPoint exports`

## 7. Features ที่กำลังทำ

Production rollout, Custom SMTP, Admin password/recovery, migration รหัส 4 หลัก และ PowerPoint production เสร็จแล้ว ขณะนี้รอ Admin กำหนดรหัสจริงของทั้ง 3 กลุ่มและทำ FA live acceptance

## 8. Features ที่ยังไม่ได้ทำ

- หมุนรหัสกลุ่มจริงหลัง Admin พร้อม แล้วส่งรหัสผ่านช่องทางปลอดภัย
- เปลี่ยนข้อมูลใน project ปัจจุบันจากชุดทดลองเป็นข้อมูลใช้งานจริงหลัง Admin/email flow พร้อมและผู้ใช้ยืนยันการล้าง sample issues
- full live acceptance ครบ FA edit/offline/final → Admin realtime/reopen/export บน Production database

## 9. Bugs / known issues

- Gmail Custom SMTP และ password recovery ใช้งานจริงแล้ว
- ใช้ no-cost single-project deployment ตามคำยืนยันผู้ใช้ จึงไม่มี isolation ระหว่าง Staging/Production; ต้อง backup และยืนยันก่อนล้าง sample data
- `npm audit` มี 4 transitive advisories ที่ upstream ยังไม่มี fix: `image-size` ผ่าน PptxGenJS (trusted bundled logo only) และ `uuid` ผ่าน ExcelJS (vulnerable code paths ไม่ได้ใช้)
- bundle ประมาณ 653 kB minified มี advisory >500 kB; ไม่บล็อก production
- หลังหมุน `FA_CODE_PEPPER` รหัสเดิมใช้ไม่ได้ ต้องหมุนรหัสใหม่ผ่าน Admin เมื่อบัญชีพร้อม
- ไม่มี remote-control software ถูกติดตั้ง

## 10. ไฟล์สำคัญ

- `src/app/AppProviders.tsx` — wiring repositories/Auth
- `src/app/router.tsx` — routes/guards
- `src/pages/fa/FAWorkspacePage.tsx` — FA editor/autosave/final
- `src/services/supabase/adminMeetingRepository.ts` — Admin live data/RLS/Realtime
- `src/services/exportService.ts` — download client
- `api/_lib/serverEnv.ts` — server env contract
- `api/admin/access-codes.ts` — rotate code API
- `api/exports/{excel,powerpoint}.ts` — export endpoints
- `supabase/migrations/20260823220000_add_fa_access_protection.sql` — 4-digit uniqueness, rate limit และ session revocation
- `supabase/migrations/` — schema/RPC source of truth
- `supabase/config.toml` — hosted Auth target config + local services
- `scripts/invite-initial-admin.mjs` — guarded Staging initial-admin operator
- `vercel.json` — build output, functions, asset inclusion, SPA/auth headers

## 11. API / external services

- Supabase Data/Auth/Realtime
- Vercel Functions/deployment
- Public: `GET /api/health`, `GET /api/public/active-meeting`
- FA: `/api/fa/session`, `/bootstrap`, `/group`, `/issues`, `/reorder`, `/finalize`
- Admin: `/api/admin/access-codes`
- Export: `/api/exports/excel`, `/api/exports/powerpoint`

## 12. Commands

```powershell
npm install
npm run dev
npm run verify:environment
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
npx vercel build --yes
npx supabase migration list --linked
```

## 13. Architecture decisions

- แยก FA session จาก Admin Auth เพื่อลดสิทธิ์และไม่บังคับ FA มีบัญชี
- plaintext group code ไม่เข้า DB/browser storage; เก็บ HMAC เท่านั้น
- Admin เป็นผู้กำหนดรหัส 4 หลัก; unique index ป้องกันรหัสซ้ำใน meeting แม้เกิด concurrent request
- rate limit ทำใน PostgreSQL transaction เพื่อใช้ร่วมกันทุก Vercel instance
- server-only secret key ไม่เข้า client bundle; build scanner fail-closed
- optimistic concurrency + idempotency + atomic RPC ป้องกัน autosave/replay ซ้ำและข้อมูลทับกัน
- Offline Draft เก็บเฉพาะ business mutation ไม่เก็บ credential
- Final เป็น group-scoped; Admin เท่านั้นที่ Reopen พร้อม audit
- export ใช้ atomic snapshot เพื่อให้ไฟล์หนึ่งชุดสอดคล้องกัน
- invite/recovery scanner-safe ต้องกดผู้ใช้ก่อน verify token; ไม่ยอม fallback เป็น unsafe default template

## 14. งานล่าสุดก่อนหยุด

- apply migration `20260823220000_add_fa_access_protection.sql` และตรวจ rate-limit/duplicate-code แบบ transaction rollback บน linked project ผ่าน
- deploy production `dpl_DnRkuT7KpJ2a57wiBU6cWU5e9YEQ`; alias canonical ทำงาน
- แก้ PowerPoint production: Vercel โหลด ESM build ของ PptxGenJS ใน CommonJS wrapper; ใช้ `createRequire` เพื่อเลือก `pptxgen.cjs.js`
- ยืนยัน Export PowerPoint รวม 3 กลุ่มบน canonical URL สำเร็จและหน้า Settings แสดงช่องรหัส 4 หลักครบ
- local gates: verify/typecheck/lint/build ผ่าน และ unit/integration 47 files / 320 tests ผ่าน

## 15. ลำดับที่ Agent ถัดไปควรทำ

1. ให้ Admin กำหนดรหัสตัวเลข 4 หลักที่ไม่ซ้ำกันสำหรับทั้ง 3 กลุ่มและส่งผ่านช่องทางปลอดภัย
2. ทำ live FA code → edit/autosave → offline/reconnect → Final และ Admin realtime/reopen acceptance
3. เปิดไฟล์ Excel/PowerPoint ที่ดาวน์โหลดเพื่อตรวจ layout/content กับ Template เดิม
4. ขอการยืนยันแยกก่อนลบ sample issues แล้วใช้ project ปัจจุบันเป็น live database แบบโปรเจกต์เดียว
5. ตรวจ responsive/accessibility และ remote logs ว่าไม่มี token/code/secret

ห้าม rewrite ระบบ, เปลี่ยน architecture/schema/UI โดยไม่จำเป็น, ลบ feature, reset worktree หรือแตะ Supabase project อื่น
