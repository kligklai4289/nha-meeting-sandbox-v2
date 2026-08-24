# TODO — FA Meeting Workspace

อัปเดต: 24 สิงหาคม 2569
รายละเอียด: [HANDOFF.md](HANDOFF.md)

## เสร็จแล้ว

- [x] FA live session, autosave, Offline Draft, conflict/replay, reorder และ Final เฉพาะกลุ่ม
- [x] Admin live Dashboard/Meeting/Group CRUD, RLS, Realtime และ Reopen audit
- [x] Presence และ Admin rotate group code
- [x] Excel/PowerPoint export จริงตาม template, draft watermark/confirmation และ audit
- [x] Apply Supabase Staging migrations ครบถึง atomic export snapshot
- [x] Deploy Vercel public alias และ smoke test `/api/health`, active meeting, `/fa`, `/admin/login`
- [x] ลบ duplicate Vercel environment entries และตั้ง Sensitive env ผ่าน API โดยไม่เปิดเผย secret
- [x] ตั้ง Supabase Staging Auth: invite-only, password >=12 แบบ complex, secure password change, exact Site URL/redirect
- [x] Environment verification, typecheck, lint, build ผ่าน
- [x] focused initial-admin operator test 64/64 ผ่าน
- [x] README/HANDOFF/TODO อัปเดตตาม source/Git/remote state
- [x] Admin กำหนดรหัสกลุ่มเป็นตัวเลข 4 หลักเอง; ห้ามซ้ำข้ามกลุ่ม; เก็บเฉพาะ HMAC
- [x] ป้องกันเดารหัส: อนุญาต 5 ครั้ง แล้วล็อก 15 นาที; รหัสถูกล้างตัวนับ; เปลี่ยนรหัส revoke Session เดิม
- [x] แก้ PptxGenJS บน Vercel ให้ใช้ CommonJS build และยืนยัน Export PowerPoint production สำเร็จ

## ติด external prerequisite — ต้องให้ผู้ใช้เลือก

- [x] ตั้ง Gmail Custom SMTP ใน Supabase โดยเจ้าของกรอก credential เอง
- [x] Enable `supabase/templates/admin-invite.html` และ `admin-recovery.html`
- [x] ส่งคำเชิญ `pichailakarm@gmail.com` และสร้าง active Admin profile
- [x] ผู้รับตั้งรหัสผ่านเองและเข้าใช้งาน Admin ได้
- [x] ทดสอบ Login, Logout, Forgot password และ recovery จากอีเมลจริง
- [ ] ให้ Admin หมุนรหัสกลุ่มทั้ง 3 แล้วส่งรหัสผ่านช่องทางปลอดภัย

## No-cost single-project deployment

- [x] เจ้าของระบบยืนยันไม่ให้เกิดค่าใช้จ่ายและไม่สร้าง Supabase project เพิ่ม
- [x] ใช้ Supabase project ปัจจุบันกับ Vercel public alias แบบโปรเจกต์เดียว
- [x] ตั้ง Gmail Custom SMTP ฟรีด้วย App Password ที่เจ้าของกรอกเอง
- [ ] ขอการยืนยันแยกก่อนลบ sample issues และเปลี่ยนข้อมูลเป็นชุดใช้งานจริง
- [ ] สำรองข้อมูลก่อน cleanup เพราะ Free plan ไม่มี downloadable managed backup
- [ ] หมุน group codes หลัง Admin พร้อม

## Acceptance ที่เหลือหลัง Admin พร้อม

- [ ] FA code → edit/autosave → offline/reconnect → Final
- [ ] Admin เห็นข้อมูล Realtime → Reopen → หมุน code
- [x] Export Excel และ PowerPoint รวมทุกกลุ่มบน Production สำเร็จ
- [x] Forgot/reset password ผ่าน email จริง
- [ ] ตรวจ desktop/tablet/mobile และ accessibility/loading/error states
- [ ] ตรวจ remote logs ว่าไม่มี token/code/secret

## Quality gates ก่อน commit/ส่งมอบสุดท้าย

- [x] `npm run test:run` — 47 files / 320 tests ผ่าน
- [x] `npm run test:e2e` — 50 ผ่าน / 1 skip / 0 failures
- [x] `npx vercel build --yes` — function compilation ผ่าน
- [x] `npm audit` ตรวจแล้ว; บันทึก 4 transitive advisories ที่ upstream ยังไม่มี fix
- [x] `git diff --check`
- [x] ตรวจ `git status`, `git diff`, `git log` ก่อน commit rollout/docs แบบเจาะจง

## Known issues / risks

- หลังเปลี่ยน `FA_CODE_PEPPER` รหัสกลุ่มเดิมใช้ไม่ได้จน Admin หมุนรหัสใหม่
- รหัสกลุ่มจริงทั้ง 3 ยังไม่ได้กำหนดหลังเปลี่ยนเป็นระบบ 4 หลัก ต้องให้ Admin ตั้งเองจากหน้า Settings
- bundle ~653 kB minified มี size advisory แต่ build/deploy ผ่าน
- transitive audit advisories: `image-size` ผ่าน PptxGenJS และ `uuid` ผ่าน ExcelJS; ไม่มี upstream fix ปัจจุบัน
- ห้ามติดตั้ง remote-control software, rewrite ระบบ, reset worktree หรือแตะ Supabase project อื่น
