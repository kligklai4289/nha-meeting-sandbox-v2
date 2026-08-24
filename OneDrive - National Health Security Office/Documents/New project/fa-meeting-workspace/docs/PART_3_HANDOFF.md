# ส่งต่องาน Part 3 — Supabase Admin Authentication

อัปเดตล่าสุด: 22 สิงหาคม 2569 (Asia/Bangkok)

เอกสารนี้เป็น historical handoff ของ Part 3 เท่านั้น สถานะปัจจุบันให้ยึด `HANDOFF.md` ที่ root และ source/Git

## 1. เป้าหมาย

ทำ Part 3 ระบบ Admin Authentication ให้พร้อมใช้งานบน Supabase Staging และ Vercel Preview โดยมี:

- Email/password Login และ Logout
- Invite-only; ไม่มี public signup
- Forgot password และตั้งรหัสผ่านใหม่จากอีเมล
- หน้า confirm ที่ปลอดภัยต่อ email scanner: ห้ามตรวจ token ตอนเปิดหน้า ต้องให้ผู้ใช้กดปุ่มก่อน
- ตรวจสิทธิ์จาก `admin_profiles` ที่ `role = admin` และ `is_active = true` ภายใต้ RLS
- Initial Admin เพียงบัญชี `pichailakarm@gmail.com`
- Admin business data ยังคงเป็น mock-backed จนถึง Part 4 และต้องแสดง banner แจ้งผู้ใช้

## 2. Repository ปัจจุบัน

- Project folder: `fa-meeting-workspace`
- Branch: `codex/fa-meeting-workspace-foundation`
- HEAD: `b7cd204`
- Commit ล่าสุด: `fix: make Vercel headers deployable`
- Node.js ที่รองรับ: `>=22.0.0` (เครื่องปัจจุบันใช้ Node 24)
- ห้ามติดตั้งโปรแกรมหรือ remote-control software โดยไม่ขออนุญาตก่อน

ไฟล์เอกสาร Task 8 ที่ยังไม่ commit:

- `README.md`
- `docs/part-3-auth-runbook.md`
- `docs/part-3-verification.md`

ห้ามลบหรือเขียนทับการแก้ไขเหล่านี้

## 3. สถานะการตรวจสอบล่าสุด

Local verification หลังแก้ Vercel configuration:

- Focused tests: 30/30 ผ่าน
- Full Vitest: 31 files, 251 tests ผ่าน
- Build: ผ่าน พร้อม synthetic `VITE_*` canary/post-build bundle scan
- E2E: 47 ผ่าน, 1 skip ตาม configuration
- `verify:environment`, typecheck, lint และ `git diff --check`: ผ่าน
- ไม่มีการเรียก Supabase/Vercel/SMTP จริง
- Production ไม่ถูกอ่านหรือแก้ไข

ระบบที่ทำเสร็จแล้ว:

- Browser-safe Supabase client รับเฉพาะ URL และ publishable key
- Active-Admin gateway และ async route guard แบบ fail-closed
- Login/Logout พร้อม retry เมื่อ remote sign-out ล้มเหลว
- Invite/recovery confirmation, password-flow session readiness และ post-update authorization
- Supabase-shaped Playwright fixture ที่ตรวจ API key/Bearer และปิด external network
- Guarded initial-Admin operator, scanner-safe email templates และ runbook
- Bundle canary scanner และ `Cache-Control: no-store` rules สำหรับ Auth routes

## 4. ปัญหา Important เดิม — แก้แล้วใน commit `b7cd204`

ปัญหาเดิมคือ `vercel.json` ใช้ top-level `headers` พร้อม legacy `routes` ซึ่ง Vercel ไม่อนุญาตให้ใช้ร่วมกัน

แก้แล้วโดยเปลี่ยน SPA fallback เป็น modern `rewrites` และคง `headers` เดิม:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/admin/login",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    },
    {
      "source": "/admin/forgot-password",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    },
    {
      "source": "/admin/auth/confirm",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    },
    {
      "source": "/admin/update-password",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

`scripts/vercel-config.test.ts` ตรวจว่า:

- ปฏิเสธการมี legacy `routes` ร่วมกับ `headers`
- ยืนยันว่าใช้ `rewrites` สำหรับ SPA fallback
- ยืนยัน no-store rules ครบ 4 routes
- ยืนยัน routing ของ `/api/*` และ static files ไม่ถูก SPA fallback ทำลาย

ดำเนินการแบบ RED → GREEN แล้ว และ local gates ทุกชุดผ่านหลังแก้ไข

## 5. คำสั่งตรวจสอบหลังแก้ปัญหา

ห้ามใช้ `npm install` หรือเพิ่ม dependency หากไม่จำเป็น ใช้ dependency ที่มีอยู่แล้ว

```powershell
npm run test:run -- scripts/vercel-config.test.ts scripts/build.test.ts
npm run verify:environment
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e -- --reporter=line
git diff --check
git status --short
```

ผลที่ต้องได้:

- ทุกคำสั่ง exit 0
- Build canary scanner ผ่าน
- E2E ใช้เฉพาะ localhost และ `auth-e2e.invalid`
- ไม่มี server key, SMTP credential, password, token/hash หรือ raw Auth error ใน bundle/log/report
- Worktree เหลือเฉพาะ Task 8 docs ที่ตั้งใจยังไม่ commit หลัง commit code fix

## 6. Approval gates — ต้องขอแยกกัน ห้ามรวม

หลัง local fix และ independent review ผ่านแล้ว จึงขออนุมัติทีละข้อ:

1. Local linked-project capture
   - บันทึก linked Staging ref ลง ignored local mapping
   - ห้ามแสดง project ref ในแชต/รายงาน

2. Supabase Staging Auth configuration
   - Snapshot ค่าเดิมแบบไม่เปิดเผย credential
   - ปิด public signup
   - รหัสผ่านขั้นต่ำ 12 ตัวอักษร
   - Site URL เป็น approved origin
   - Redirect URLs เป็น exact full callback URLs ลงท้าย `/admin/auth/confirm`
   - ตั้ง Custom SMTP และ templates ที่ checked-in
   - ผู้ใช้เป็นผู้กรอก SMTP password เอง ห้ามขอให้ส่ง password ในแชต

3. Initial Admin invitation/profile mutation
   - Dry-run ก่อน
   - Execute เฉพาะ `pichailakarm@gmail.com`
   - สร้าง/เปิด `admin_profiles` และ redacted system audit เฉพาะเมื่อ state เปลี่ยน

4. Linked migration/RLS transaction
   - ขออนุมัติแยกจาก provisioning
   - ใช้ read/rollback-safe transaction
   - ห้ามสร้างผู้ใช้ inactive เพิ่มแบบถาวร

5. Vercel Preview deployment/live acceptance
   - Preview เท่านั้น ห้าม `--prod`
   - ห้ามปิด Deployment Protection
   - ตรวจ HTTP 200, Auth flows, no-store headers, mock-data banner และ secret-free bundle/log

Production ต้องไม่ถูกอ่าน แก้ไข หรือ deploy ใน Part 3

## 7. ข้อกำหนดด้านความลับ

ห้ามพิมพ์ เก็บใน commit หรือแนบหลักฐานต่อไปนี้:

- Supabase secret/service-role key
- SMTP username/password หรือ credential values
- Email token/hash, invite link หรือ reset link จริง
- Admin password
- User UUID
- Supabase project ref
- Cookie/Auth raw response

Browser รับได้เฉพาะ:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## 8. เอกสารอ้างอิงใน repository

- Design: `docs/superpowers/specs/2026-08-22-admin-auth-design.md`
- Plan: `docs/superpowers/plans/2026-08-22-admin-auth.md`
- Runbook: `docs/part-3-auth-runbook.md`
- Verification: `docs/part-3-verification.md`
- Supabase templates: `supabase/templates/admin-invite.html`, `supabase/templates/admin-recovery.html`
- Operator: `scripts/invite-initial-admin.mjs`
- Build/bundle scanner: `scripts/build.mjs`
- Vercel config tests: `scripts/vercel-config.test.ts`

## 9. Prompt พร้อมนำไปสั่ง AI/ผู้พัฒนารายอื่น

คัดลอกข้อความต่อไปนี้พร้อมแนบ repository:

```text
ทำงานต่อจาก docs/PART_3_HANDOFF.md โดยอ่านไฟล์นี้ทั้งหมดก่อนเริ่ม

Vercel configuration issue แก้แล้วใน commit b7cd204 และ local quality gates ผ่านทั้งหมด งานถัดไปคือ Gate 1: Local linked-project capture เท่านั้น

ก่อนดำเนินการ ให้อ่านสถานะ repository และตรวจว่า uncommitted Task 8 docs ยังอยู่ครบ จากนั้นขออนุมัติ Gate 1 แบบชัดเจน ห้ามข้ามหรือรวม approval gates ห้ามติดตั้งโปรแกรม และห้ามแตะ Production

รักษา uncommitted Task 8 docs เดิม ห้ามเปิดเผย key, SMTP credential, password, token/hash, invite URL, user UUID หรือ project ref
```

## 10. เงื่อนไขจบ Part 3

Part 3 จะถือว่าเสร็จเมื่อ:

- Vercel configuration issue ถูกแก้และ local review ผ่าน
- Approval gates ทั้ง 5 ผ่านแยกกัน
- Staging Auth/SMTP/templates ถูกตรวจแบบไม่เปิดเผยข้อมูลลับ
- Initial Admin ทดลอง Login/Logout/Forgot-password สำเร็จ
- Linked RLS tests ผ่านโดยไม่มี persistent test state
- Preview พร้อมใช้งานและ Auth routes มี `Cache-Control: no-store`
- Verification/runbook/README อัปเดตและ commit แล้ว
- Admin business data ยังระบุชัดว่า mock-backed จนถึง Part 4
