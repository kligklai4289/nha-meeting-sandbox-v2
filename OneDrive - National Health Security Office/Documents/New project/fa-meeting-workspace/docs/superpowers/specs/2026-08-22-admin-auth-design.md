# Part 3 Admin Auth Design

วันที่: 22 สิงหาคม 2569
สถานะ: อนุมัติแบบออกแบบในแชตแล้ว รอผู้ใช้ตรวจเอกสารก่อนจัดทำ Implementation Plan

## 1. เป้าหมาย

แทนที่ Mock Admin Login ด้วย Supabase Auth แบบอีเมล/รหัสผ่านบน Supabase Staging และอนุญาตหน้า `/admin/*` เฉพาะผู้ใช้ที่มี session ถูกต้องและมี `admin_profiles.is_active = true` เท่านั้น บัญชีเริ่มต้นคือ `pichailakarm@gmail.com` ซึ่งต้องรับคำเชิญและตั้งรหัสผ่านด้วยตนเอง ห้ามกำหนด เก็บ หรือบันทึกรหัสผ่านใน seed, source code, log หรือเอกสาร

Part 3 รวม Login, Logout, session restoration, Invite confirmation, Forgot password, Recovery confirmation และ Update password แต่ยังไม่เปลี่ยนข้อมูล Dashboard/Meeting/Group/Export/Settings จาก mock repository เป็น Supabase repository และยังไม่เพิ่ม Realtime หรือระบบจัดการ Admin คนอื่น งานเหล่านั้นอยู่ใน Part 4

## 2. ขอบเขต Environment

- พัฒนาและตรวจรับกับ Supabase Staging และ Vercel Preview เท่านั้น
- ไม่สร้าง เปลี่ยนแปลง หรือ deploy Supabase Production และ Vercel Production
- Browser ใช้เฉพาะ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` ใช้ได้เฉพาะ operator script หรือ Vercel Server และห้ามเข้า client bundle
- Custom SMTP credentials เก็บใน Supabase Staging configuration ไม่เก็บใน repository หรือ Vercel browser variables
- ทุก remote mutation ได้แก่ Auth configuration, SMTP, email template, invitation และ Preview deployment ต้องมี approval gate ก่อนดำเนินการ

## 3. แนวทางที่เลือก

ใช้ `@supabase/supabase-js` ใน Browser ตามรูปแบบ React SPA โดยเปิด session persistence และ automatic refresh ตามค่าเริ่มต้นของ Supabase Auth วิธีนี้รองรับ RLS และ Realtime ใน Part 4 โดยไม่ต้องสร้างระบบ refresh token เอง

ไม่ใช้ server-managed HttpOnly cookie สำหรับ Admin ใน Part 3 เพราะแอปเป็น Vite SPA และ flow ที่เลือกต้องให้ Browser ใช้ JWT กับ RLS/Realtime โดยตรง ข้อกำหนด HttpOnly cookie เดิมยังคงใช้กับ FA group session ใน Part ถัดไป ไม่ใช่ Admin Supabase Auth

การตัดสินสิทธิ์ห้ามใช้ `user_metadata` หรือข้อมูลจากฟอร์ม Login ให้ตรวจสองชั้น:

1. Supabase Auth session ยืนยันตัวผู้ใช้
2. Query `admin_profiles` ภายใต้ RLS ต้องพบแถวที่ `user_id` ตรงกับผู้ใช้และ `is_active = true`

หาก Auth สำเร็จแต่ไม่พบ active profile ระบบต้อง sign out ทันทีและแสดงข้อความทั่วไปว่าไม่มีสิทธิ์ โดยไม่เปิดเผยว่าบัญชีหรือ profile ใดมีอยู่

เอกสารอ้างอิงปัจจุบัน:

- [Supabase Auth with React](https://supabase.com/docs/guides/auth/quickstarts/react)
- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

## 4. Browser Routes และ User Flow

คง route เดิมและเพิ่ม route ต่อไปนี้:

- `/admin/login` — กรอกอีเมล/รหัสผ่านและเรียก `signInWithPassword`
- `/admin/forgot-password` — ขอ recovery email ด้วย `resetPasswordForEmail`
- `/admin/auth/confirm` — รับ `token_hash` และ `type` สำหรับ `invite` หรือ `recovery`
- `/admin/update-password` — ตั้งรหัสผ่านใหม่ด้วย `updateUser`
- `/admin/*` — protected routes ที่ผ่านได้เฉพาะ active Admin

### Login

เมื่อ submit ให้ disable ปุ่มระหว่างคำขอและไม่บันทึกรหัสผ่านลง storage หาก Auth หรือ authorization ไม่ผ่าน ให้แสดงข้อความกลางว่าอีเมล รหัสผ่าน หรือสิทธิ์ไม่ถูกต้อง เมื่อผ่านให้ไป `/admin/dashboard` และเก็บ route ปลายทางเดิมไว้เฉพาะ path ภายใน `/admin` เพื่อกลับหลัง Login โดยไม่รับ external redirect

### Logout

เรียก Supabase sign out, ล้าง Auth state และข้อมูล Admin ชั่วคราว แล้ว replace route ไป `/admin/login` การ sign out ไม่ล้าง FA selection หรือ offline data ที่อยู่นอก Admin scope

### Forgot password

รับอีเมลที่ normalize ด้วย trim และ lowercase แล้วเรียก recovery API ไม่ว่าบัญชีมีจริงหรือไม่ UI แสดงข้อความเดียวกันว่า หากอีเมลมีสิทธิ์ ระบบจะส่งวิธีตั้งรหัสผ่านใหม่ เพื่อลด account enumeration

### Invite และ Recovery confirmation

Custom email template ส่งผู้ใช้มายัง `/admin/auth/confirm` พร้อม `token_hash` และ `type` ที่ยอมรับเฉพาะ `invite` หรือ `recovery` หน้า confirm ต้องไม่เรียก `verifyOtp` ตอน page load เพื่อป้องกัน email scanner หรือ Microsoft Safe Links ใช้ token ก่อนเจ้าของอีเมล ผู้ใช้ต้องกดปุ่ม “ยืนยันดำเนินการ” จึงตรวจ token

เมื่อ token ผ่าน ให้สร้าง Supabase session แล้วนำไป `/admin/update-password` หาก token ผิด หมดอายุ หรือ type ไม่อยู่ใน allow-list ให้แสดงข้อความปลอดภัยพร้อมทางกลับหน้า Login/Forgot password ห้าม echo token หรือ error ภายใน

### Update password

หน้าเปลี่ยนรหัสผ่านเปิดได้เมื่อมี session จาก invite/recovery เท่านั้น รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษรและช่องยืนยันต้องตรงกัน หลัง `updateUser` สำเร็จให้แสดงผลสำเร็จและนำไป Dashboard เมื่อ active profile ผ่านการตรวจ มิฉะนั้น sign out และแสดงว่าไม่มีสิทธิ์

## 5. Component และ Service Boundaries

โครงสร้างเป้าหมายแบ่งตามความรับผิดชอบ:

- `src/services/supabase/supabaseBrowserClient.ts` — สร้าง Browser client จาก environment ที่ validate แล้ว ไม่มี server secret
- `src/services/auth/adminAuth.ts` — adapter สำหรับ sign in, sign out, restore session, reset password, verify email token, update password และ load active profile
- `src/services/auth/adminAuthContext.tsx` — Provider/state machine และ hook สำหรับ UI
- `src/components/admin/RequireAdminSession.tsx` — async guard ที่รองรับ loading, anonymous, unauthorized และ active-admin โดยไม่ render protected content ก่อนตรวจเสร็จ
- `src/pages/admin/AdminLoginPage.tsx` — Login form และ generic errors
- `src/pages/admin/AdminForgotPasswordPage.tsx` — recovery request
- `src/pages/admin/AdminAuthConfirmPage.tsx` — scanner-safe explicit confirmation
- `src/pages/admin/AdminUpdatePasswordPage.tsx` — password validation/update
- `scripts/invite-initial-admin.mjs` — operator-only idempotent provisioning สำหรับอีเมลที่อนุมัติ
- `docs/part-3-auth-runbook.md` — Staging configuration, SMTP/template, invitation, verification และ rollback

Service interface ต้อง injectable เพื่อให้ unit/E2E ใช้ fake ที่ deterministic โดย production path ไม่มี mock fallback หาก Supabase Auth ขัดข้อง UI ต้องแสดงความขัดข้องและ retry ได้ ไม่สร้าง mock session แบบเงียบ

## 6. Auth State Machine

สถานะหลักมีสี่ค่า:

- `loading` — กำลัง initialize/restore และตรวจ active profile
- `anonymous` — ไม่มี session หรือ sign out แล้ว
- `active-admin` — Auth session และ active profile ผ่าน
- `unauthorized` — มี identity แต่ไม่มี active profile; ระบบต้อง sign out ก่อนแสดงสถานะนี้

Provider subscribe `onAuthStateChange` ตั้งแต่ต้น app lifecycle และ cleanup subscription เมื่อ unmount การ query profile ต้องยกเลิกหรือเพิกเฉยผลเก่าหาก auth event ใหม่เกิดก่อนคำขอเดิมเสร็จ เพื่อป้องกัน stale state หลัง logout/login สลับบัญชี

Protected routes แสดง loading state ที่เข้าถึงได้ด้วย screen reader ระหว่างตรวจ ห้ามแสดง Admin layout หรือข้อมูลก่อนสถานะเป็น `active-admin`

## 7. Initial Admin Provisioning

ปิด public signup ใน Supabase Staging บัญชีแรกสร้างผ่าน operator script server-only เท่านั้น สคริปต์รับ configuration จาก environment, จำกัดอีเมลเป้าหมายเป็น `pichailakarm@gmail.com`, ใช้ Supabase Admin API เชิญผู้ใช้และสร้างหรือเปิด `admin_profiles` ที่ role `admin`

สคริปต์ต้อง:

- ตรวจ environment และยืนยันว่าเป็น Staging ก่อน mutation
- ทำงานซ้ำได้โดยไม่ส่งคำเชิญหรือสร้าง profile ซ้ำโดยไม่ตั้งใจ
- ไม่รับหรือกำหนด password
- ไม่พิมพ์ API key, token, invite link หรือข้อมูล session
- รายงานเฉพาะสถานะที่ไม่อ่อนไหว
- บันทึก audit action แบบ system หาก schema/API ที่มีอยู่รองรับโดยไม่เปิดเผย token

การรันสคริปต์จริงต้องหยุดขออนุมัติ remote mutation และให้ผู้ใช้เป็นผู้เปิดอีเมล กดยืนยัน และตั้งรหัสผ่านเอง

## 8. SMTP, Templates และ Redirect Safety

ใช้ Custom SMTP ที่ผู้ใช้ยืนยันว่ามีอยู่แล้ว ตั้งค่าใน Supabase Staging เท่านั้น Sender, host, port และ credential จะรับใน approval/configuration gate และห้ามบันทึกลง repository

Template Invite และ Recovery ใช้ข้อความภาษาไทยที่ชัดเจน ไม่ใส่ข้อมูลลับ และนำไป scanner-safe confirmation page Redirect allow-list จำกัดเฉพาะ localhost ที่ใช้ทดสอบกับ origin ของ Vercel Preview โปรเจกต์นี้ ห้ามใช้ wildcard ที่ครอบคลุมโดเมนอื่นหรือรับ `redirect_to` จาก query โดยไม่มี allow-list

Production SMTP, Site URL, templates และ redirect URLs ไม่เปลี่ยนใน Part 3

## 9. Error Handling และ Security

- Login/forgot password ใช้ generic user-facing errors เพื่อลด account enumeration
- Validation error แสดงเฉพาะ field ที่ผู้ใช้แก้ได้
- Supabase/network error ไม่ส่ง stack, internal code, token หรือ raw response ไป UI/log
- Password มีอย่างน้อย 12 ตัวอักษรและต้องยืนยันตรงกัน; Supabase project policy ต้องไม่อ่อนกว่านี้
- Auth/session response และหน้าที่เกี่ยวข้องกับ token ต้องไม่ถูก cache
- callback ยอมรับเฉพาะ `invite` และ `recovery` และไม่ redirect ออกนอก `/admin`
- ไม่ใช้ `user_metadata` ทำ authorization
- ไม่สร้าง module-scope server client ที่มี user session; Browser client singleton ใช้ได้เฉพาะ client runtime
- Environment verifier ต้องตรวจว่า server secret ไม่อยู่ใน source, test fixture ที่ไม่อนุญาต หรือ built assets

## 10. Testing และ Acceptance

ใช้ test-first implementation และเพิ่ม coverage อย่างน้อย:

- Browser environment/client validation และไม่มี server secret ใน bundle
- Login success, wrong credentials, missing profile และ inactive profile
- async guard ไม่ render protected content ก่อน authorization
- session restoration หลัง reload และ stale async result ไม่ย้อนสถานะหลัง logout
- logout ล้าง Admin auth state และ redirect ถูกต้อง
- forgot password แสดง generic success ทั้งกรณีบัญชีมี/ไม่มี
- confirm page ไม่เรียก `verifyOtp` ก่อนผู้ใช้กด
- invite/recovery success, invalid type, missing token, expired/invalid token
- password ต่ำกว่า 12 ตัวอักษร, confirmation mismatch และ update success/failure
- RLS integration: active Admin อ่านข้อมูลที่อนุญาต; inactive Admin และ anonymous ถูกปฏิเสธ
- operator script dry/characterization tests สำหรับ allow-listed email, idempotency และ output non-disclosure
- Router/E2E สำหรับ Login → protected route, refresh restoration, Logout และ Recovery UI
- Mock Admin session เดิมใช้เข้า production route ไม่ได้

Quality gate ก่อน remote configuration:

```powershell
npm run verify:environment
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
git diff --check
```

Live Staging acceptance หลัง approval:

- ส่ง Invite ผ่าน Custom SMTP ถึง `pichailakarm@gmail.com`
- email scanner เปิด link แล้ว token ยังไม่ถูก consume จนผู้ใช้กดยืนยัน
- ผู้ใช้ตั้งรหัสผ่านเองและ Login/Logout ได้
- Forgot password ส่งอีเมลและตั้งรหัสผ่านใหม่ได้
- anonymous/inactive profile เข้า Admin ไม่ได้
- Preview ยังแสดง banner ว่าข้อมูล Admin เป็น mock-backed จนถึง Part 4

## 11. Rollout และ Approval Gates

1. Implement และ review local code/test โดยไม่ทำ remote mutation
2. รัน quality gate และ security/non-disclosure checks
3. ขออนุมัติ Auth configuration ของ Supabase Staging
4. บันทึกค่าปัจจุบันเพื่อ rollback แล้วตั้ง Signup, SMTP, templates และ redirect allow-list ของ Staging
5. ขออนุมัติรัน initial-admin invitation/provisioning
6. ผู้ใช้ยืนยันอีเมลและตั้งรหัสผ่านเอง
7. ขออนุมัติ deploy Vercel Preview และทดสอบ flow จริง
8. สรุปผลและหยุดก่อน Part 4

## 12. Rollback

หาก Staging verification ไม่ผ่าน ให้หยุด rollout ไม่แตะ Production และดำเนินการตามลำดับ:

1. revoke/sign out session ของบัญชี Staging และตั้ง `admin_profiles.is_active = false`
2. คืนค่า Auth Site URL, redirect allow-list, email templates และ SMTP configuration จาก snapshot ก่อนเปลี่ยน
3. redeploy Preview ที่ผ่านล่าสุดหาก frontend regression
4. เก็บ audit/evidence ที่ไม่อ่อนไหวและไม่ลบข้อมูลเพื่อปกปิดข้อผิดพลาด

Part 3 ถือว่าเสร็จเมื่อ local gate, independent review และ live Staging acceptance ผ่านทั้งหมด โดยไม่มี Production effect และผู้ใช้อนุมัติก่อนทุก remote mutation
