# Part 3 Admin Auth: Staging Runbook

สถานะ ณ 23 สิงหาคม 2569: เอกสารส่วน Gate ด้านล่างเป็น historical safety procedure ของ Part 3 ไม่ใช่สถานะปัจจุบัน ดูสถานะจริงใน `HANDOFF.md` ปัจจุบัน Supabase Staging Auth policy และ Vercel public deployment ดำเนินการแล้ว แต่ Custom SMTP/template และ initial Admin ยังรอ external prerequisite

เอกสารนี้ใช้กับ Supabase **Staging** เท่านั้น ห้ามนำคำสั่ง initial-admin ไปใช้กับ Supabase Production ส่วน production rollout ปัจจุบันให้ยึด `HANDOFF.md` และ `TODO.md`

ห้ามคัดลอกค่า project ref, key, SMTP credential, password, token, URL คำเชิญ หรือ user ID ลง terminal output, screenshot, issue, commit หรือรายงาน หลักฐานต้องมีเพียงชื่อ gate, เวลา, ผลผ่าน/ไม่ผ่าน และ request correlation ID ที่สคริปต์สร้างในเครื่อง

## Local quality preflight — ไม่ใช่ approval gate

1. รัน `node --version` และยืนยันว่าเป็น Node.js 22 ขึ้นไป สคริปต์ operator จะหยุดก่อนอ่าน configuration หรือสร้าง Supabase client หาก runtime ต่ำกว่านี้
2. ตรวจว่า working tree มีเฉพาะการเปลี่ยนแปลง Part 3 ที่ผ่าน review
3. รันคำสั่งต่อไปนี้ในเครื่องโดยไม่ link, deploy หรือเรียก remote API:

```powershell
npm run test:run -- scripts/invite-initial-admin.test.ts scripts/verify-environment.test.ts
npm run verify:environment
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```

4. ยืนยันว่า build wrapper ใส่ synthetic `VITE_*` canary แล้วตรวจ `dist` โดยไม่แสดงค่าที่ match และยืนยันว่า template ใช้ `RedirectTo` กับ `TokenHash`, ไม่มี external asset/tracker และไม่ consume token จนผู้ใช้กด “ยืนยันดำเนินการ” บนหน้าเว็บ
5. หากข้อใดไม่ผ่าน ให้หยุดก่อน Gate 1

## Gate 1 — Local linked-project capture

Gate นี้เป็นการบันทึก local mapping เท่านั้น แต่ต้องขอ explicit approval ของ Gate 1 ก่อน และ approval นี้ใช้แทน Gate 2–5 ไม่ได้

1. ผู้ปฏิบัติงานเปิด Supabase Dashboard ด้วยตนเอง ตรวจชื่อองค์กร ชื่อโปรเจกต์ และ environment label ว่าเป็น Staging ห้ามยืนยันจาก project ref เพียงอย่างเดียว
2. ตรวจว่า `supabase/.temp/project-ref` มาจาก project ที่ยืนยันแล้ว โดยไม่พิมพ์เนื้อหาไฟล์ลงหลักฐาน
3. หลังได้รับอนุมัติ Gate 1 เท่านั้น ให้บันทึก ref ลงไฟล์ ignored `.supabase-projects.local.json`:

```powershell
node scripts/invite-initial-admin.mjs --capture-linked-staging --target staging --confirm-linked-project-is-staging
```

สคริปต์สร้างไฟล์ใหม่แบบไม่ overwrite หาก mapping มีอยู่แล้ว ให้หยุด ตรวจ mapping เดิมด้วยตนเอง และห้ามลบหรือเขียนทับเพื่อข้ามการตรวจ เมื่อ capture เสร็จ ให้บันทึกเฉพาะ pass/fail และเวลา แล้วหยุดขอ approval Gate 2

## Gate 2 — Staging Auth configuration

Gate นี้ครอบเฉพาะ snapshot และการเปลี่ยน Auth/SMTP/template ของ Staging ต้องมี explicit approval Gate 2 แยกจาก Gate 1 และ Gate 3–5

Checklist ก่อนเปลี่ยน:

- Dashboard ยังแสดง project เดียวกับ Gate 1 และระบุ Staging
- Public email signup ปิดอยู่
- minimum password length อย่างน้อย 12 ตัวอักษร
- **Site URL** เป็น approved application **origin** เท่านั้น เช่น `https://<approved-preview-host>` โดยไม่มี path, query, fragment, credential หรือ wildcard
- **Supabase Redirect URLs** เป็นรายการ exact full URL แยกต่อ origin และทุกรายการต้องลงท้าย `/admin/auth/confirm` เช่น `https://<approved-preview-host>/admin/auth/confirm` หรือ `http://127.0.0.1:<port>/admin/auth/confirm`; ห้ามใส่เพียง origin, wildcard, query, fragment หรือ path อื่น
- Custom SMTP sender name/address, host, port และ TLS mode ตรงกับข้อมูลที่เจ้าของระบบยืนยัน
- SMTP username/password นำเข้าผ่านหน้า configuration หรือ secret store เท่านั้น ไม่ผ่าน repository หรือ command line ที่ถูกบันทึก

`INITIAL_ADMIN_REDIRECT_ORIGINS` **ไม่ใช่** Supabase Redirect URLs เป็น operator guard แบบ origin-only ที่สคริปต์ใช้ exact-match origin ของ `INITIAL_ADMIN_REDIRECT_TO` เท่านั้น แต่ละค่าจึงต้องไม่มี path/query/fragment ส่วน `INITIAL_ADMIN_REDIRECT_TO` เป็น exact full URL ที่ลงท้าย `/admin/auth/confirm` และต้องมี origin อยู่ใน guard นี้

Snapshot ก่อนเปลี่ยนต้องบันทึกเฉพาะสถานะ signup, password policy, Site URL origin, รายการ Redirect URLs แบบ redacted, template revision และสถานะ SMTP แบบ redacted ห้ามบันทึก credential

หลังได้รับอนุมัติ Gate 2 ให้ใช้เนื้อหาจาก `supabase/templates/admin-invite.html` และ `supabase/templates/admin-recovery.html` กับ Staging แล้วส่ง test email ตามวิธีของผู้ให้บริการโดยไม่บันทึกลิงก์หรือส่วนหัวที่มีข้อมูลลับ ตรวจว่า email scanner เปิดหน้าลิงก์ได้แต่คำเชิญ/recovery ยังไม่ถูก consume จนผู้ใช้กดปุ่มยืนยัน บันทึกผลแล้วหยุดขอ approval Gate 3

## Gate 3 — Initial Admin invitation/profile mutation

Gate นี้เป็น remote Auth/database mutation และต้องมี explicit approval Gate 3 ของตนเอง ห้ามอาศัย approval การตั้งค่า Auth หรือ linked transaction

ตั้งค่าจาก secret manager/local ignored file โดยไม่ echo ค่า:

- server environment contract ทั้งหมดที่ plain-JavaScript `parseOperatorEnvironment` ตรวจ รวม Supabase URL และ secret key ของ Staging
- `INITIAL_ADMIN_REDIRECT_TO` เป็น exact approved Preview/localhost URL ที่ลงท้าย `/admin/auth/confirm`
- `INITIAL_ADMIN_REDIRECT_ORIGINS` เป็น comma-separated **origin-only operator guard** โดย origin ของ `INITIAL_ADMIN_REDIRECT_TO` ต้องตรงกับหนึ่งรายการแบบ exact match

ยืนยันว่า Supabase URL มีรูปแบบ exact `https://<linked-staging-ref>.supabase.co` เท่านั้น ไม่มี port, path, query หรือ fragment สคริปต์ไม่รับ origin จาก query parameter และจำกัดเป้าหมายเป็น `pichailakarm@gmail.com` โดยไม่รับอีเมลหรือรหัสผ่านจาก argument

หลังได้รับ approval Gate 3 ให้รัน dry-run ก่อน ซึ่งต้องไม่มี Auth/database call:

```powershell
node scripts/invite-initial-admin.mjs --dry-run --target staging --confirm-linked-project-is-staging
```

หากได้เฉพาะ `dry-run ready` และ request correlation ID จึงรัน mutation ใน approval เดิมของ Gate 3:

```powershell
node scripts/invite-initial-admin.mjs --execute --target staging --confirm-linked-project-is-staging
```

พฤติกรรมที่คาดหวัง:

- ผู้ใช้ยังไม่มี: ขอ invite หนึ่งครั้ง จากนั้น upsert active Admin profile
- ผู้ใช้มีอยู่แล้ว: ไม่ส่ง invite ซ้ำ และซ่อม/เปิด profile ให้ active
- user และ active Admin profile มีอยู่แล้ว: ไม่แก้ข้อมูล
- ใช้ system audit action และ target user เดิมเป็น idempotency key เชิงตรรกะ หาก profile active แล้วแต่ audit หาย สคริปต์จะซ่อม audit; หาก audit มีอยู่แล้วจะไม่เพิ่มซ้ำ
- audit record เก็บ `target_id` ภายในฐานข้อมูลเพื่อให้ตรวจและซ่อมซ้ำได้ แต่ไม่มีอีเมล ลิงก์ token credential หรือรหัสผ่าน และห้ามนำ `target_id` ออกมาใน terminal/หลักฐาน

หลักฐานเก็บได้เฉพาะสถานะ `invitation requested`, `profile activated` หรือ `already provisioned` พร้อม request correlation ID ห้ามเก็บ raw response เมื่อเสร็จให้หยุดขอ approval Gate 4

## Gate 4 — Linked migration/RLS transaction

Gate นี้เป็น remote linked read/test transaction และต้องมี explicit approval Gate 4 แยกจากการ invitation/profile mutation ห้าม push migration, seed, reset หรือทำ persistent database mutation ใน gate นี้

หลังยืนยัน Dashboard และ local mapping ว่ายังเป็น Staging และได้รับ approval Gate 4 เท่านั้น:

```powershell
npx --no-install supabase migration list --linked
npx --no-install supabase test db --linked supabase/tests/database
```

ต้องยืนยันว่า migration history ตรงกับไฟล์ที่ review แล้ว และ pgTAP/RLS transaction ผ่านพร้อม rollback ไม่มี persistent row จาก test หากพบ migration ที่ยังไม่ apply, target ไม่ตรง, transaction ไม่ rollback หรือ test ไม่ผ่าน ให้หยุด ห้ามรัน `db push` หรือแก้ remote ภายใต้ approval นี้ บันทึกเฉพาะ pass/fail และเวลา แล้วหยุดขอ approval Gate 5

## Gate 5 — Preview deployment/live acceptance

Gate นี้ครอบเฉพาะ Vercel Preview deployment และ live acceptance บน Preview ที่อนุมัติ ต้องมี explicit approval Gate 5 แยกจาก Gate 1–4 ห้าม deploy/promote ไป Production

หลังได้รับ approval Gate 5:

1. Deploy เฉพาะ Preview และยืนยันว่า host ตรงกับ Site URL origin/Redirect URLs ที่อนุมัติใน Gate 2
2. ผู้รับเปิดอีเมลเอง ห้าม forward หรือบันทึกลิงก์ ยืนยันว่า landing page ไม่ verify ตอนโหลด จากนั้นผู้รับกด “ยืนยันดำเนินการ” และตั้งรหัสผ่านเองอย่างน้อย 12 ตัวอักษร
3. ทดสอบ Login, protected Admin route, refresh restoration, Logout, Forgot password และ recovery confirmation; ยืนยันว่า anonymous/inactive Admin เข้า protected route ไม่ได้ และ Admin business data ยังมี mock-backed banner จนถึง Part 4
4. ตรวจ response header แบบ exact บน URL ที่ไม่มี token ทั้งสี่รายการ:

```powershell
$previewOrigin = 'https://<approved-preview-host>'
$authPaths = @(
  '/admin/login',
  '/admin/forgot-password',
  '/admin/auth/confirm',
  '/admin/update-password'
)
foreach ($path in $authPaths) {
  $response = Invoke-WebRequest -Uri "$previewOrigin$path" -Method Get
  if ($response.Headers['Cache-Control'] -ne 'no-store') {
    throw "Preview acceptance failed: Cache-Control"
  }
  if ($response.Content -notmatch '<div id="root"></div>') {
    throw "Preview acceptance failed: SPA fallback"
  }
}
```

5. ยืนยันว่า static asset ยังเข้าผ่าน filesystem route และ deep links ทั้งสี่ตอบ SPA shell พร้อม `Cache-Control: no-store`

บันทึก pass/fail และเวลาโดยปกปิด address bar, network payload และ email content ที่อาจมี token แล้วหยุด ห้าม promote alias หรือ deploy Production

## Rollback

หากข้อใดไม่ผ่าน ให้หยุด rollout และอย่าแก้ Production:

1. Gate 2: คืน signup, password policy, Site URL, Redirect URLs, templates และ SMTP configuration จาก snapshot
2. Gate 3: revoke/sign out session ของบัญชี Staging และตั้ง profile เป็น inactive ตาม approval rollback แยก
3. Gate 4: test transaction ต้อง rollback เอง; หากพบ persistent change ให้หยุดและขอแผนกู้คืน ห้าม reset remote
4. Gate 5: กลับไป Preview deployment ล่าสุดที่ผ่าน โดยต้องมี approval rollback แยก
5. เก็บ redacted audit/evidence ตามจริง ห้ามลบ record เพื่อปกปิดเหตุการณ์ และ rotate credential ทันทีหากสงสัยว่าค่าลับถูกเปิดเผย
