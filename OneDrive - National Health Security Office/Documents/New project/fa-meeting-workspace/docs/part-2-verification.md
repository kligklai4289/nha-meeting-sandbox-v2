# Part 2 verification: Supabase meeting directory

วันที่ตรวจ: 22 สิงหาคม 2026 (Asia/Bangkok)

ขอบเขต Part 2 ทำให้ `/fa` อ่าน meeting/group metadata แบบ read-only ผ่าน public Vercel API และ Supabase Staging บน Preview ขณะที่ Workspace, Admin และ Preview ยังคง mock-backed ไม่มีการสร้าง เปลี่ยนแปลง หรือ deploy ระบบ Production

เอกสารนี้ไม่บันทึก secret, token, hash, cookie, Supabase project ref หรือข้อมูลแถวที่ไม่ได้รับอนุมัติ

## Local quality gate

รัน fresh quality gate ครบทุกคำสั่งตามลำดับหลังแก้ regression แล้ว:

```powershell
npm run verify:environment
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
git diff --check
```

ผลวันที่ 22 สิงหาคม 2026:

| คำสั่ง | Exit | หลักฐาน |
| --- | ---: | --- |
| `npm run verify:environment` | 0 | Environment verification passed |
| `npm run typecheck` | 0 | TypeScript build mode ไม่มี diagnostic |
| `npm run lint` | 0 | oxlint ไม่มี error หรือ warning |
| `npm run test:run` | 0 | 24/24 test files ผ่าน, 84/84 tests ผ่าน |
| `npm run build` | 0 | Vite 8.2.2 แปลง 1,943 modules และ build สำเร็จ |
| `npm run test:e2e` | 0 | build current source ก่อน Preview แล้วรัน 15 tests: 14 ผ่าน, 1 skip ตามเงื่อนไข desktop |
| `git diff --check` | 0 | ไม่พบ whitespace error; มีเพียง LF→CRLF working-copy notices |

Playwright แยกตาม project: desktop 4 ผ่าน/1 skip, tablet 5 ผ่าน, mobile 5 ผ่าน

Built assets จาก fresh build:

| Asset | ขนาด | Gzip |
| --- | ---: | ---: |
| `dist/index.html` | 0.54 kB | 0.36 kB |
| `dist/assets/index-Upt3azG8.css` | 28.27 kB | 6.07 kB |
| `dist/assets/index-B1I2tOuq.js` | 409.37 kB | 122.33 kB |

ก่อนรอบที่ผ่าน `verify:environment` พบ synthetic test fixture ซึ่งใช้ prefix ไม่ตรง allow-list และ exit 1; เปลี่ยนเฉพาะ dummy prefix สองค่าเป็นรูปแบบ `test` ที่ verifier อนุญาต โดยคง non-disclosure assertions ทั้งหมด แล้วตรวจ RED→GREEN จน exit 0 ก่อน restart quality gate เต็มชุด

## Vercel build

ได้รับอนุมัติ Preview อย่างชัดเจนแล้วจึง deploy ไปยังโปรเจกต์เดิม `fa-meeting-workspace-trial` โดยไม่ relink และไม่ใช้ `--prod`

- Deployment URL: `https://fa-meeting-workspace-trial-fdmvn3w5b-suphakorn-s-projects.vercel.app`
- Deployment ID: `dpl_C1VENVqGQCHRTPmvNbqfvz3EqHhE`
- Target: Preview
- Status: Ready
- Created: 22 สิงหาคม 2026 เวลา 12:52:45 (GMT+07:00)
- Remote build มี Vercel Functions `api/health` และ `api/public/active-meeting`

Deployment ใช้ตัวแปร Preview เดิม 6 ตัว ไม่มีการแก้ environment variables, Deployment Protection หรือ Production

## Staging API contract

ตรวจผ่าน `vercel curl` ซึ่งใช้งานผ่าน Deployment Protection โดยไม่ปิด protection ผลจริงคือ:

- `/api/health` ตอบ HTTP 200, `status: ok` และ environment configured
- `/api/public/active-meeting` ตอบ HTTP 200, วันที่ประชุม `2026-08-27`, และ 3 กลุ่มเรียง `groupNo` 1, 2, 3
- Programmatic recursive scan ไม่พบ key ชื่อ `issues`, `code_hash`, `session_hash`, `api_key`, `token`, `secret` หรือ `password`
- `/fa` ตอบ HTTP 200 และ HTML มีชื่อแอปภาษาไทย
- การตรวจ schema/migration และ RLS policy ระบุว่า anonymous client ไม่มีสิทธิ์อ่านตารางโดยตรง; รอบนี้ไม่ได้ยิง anonymous direct-table probe ไปยัง Staging ส่วน live browser contract ตรวจผ่าน public API เท่านั้น

คำขอทั้งหมดเป็น read-only ผ่าน Preview API ไปยัง Supabase Staging ไม่มี Supabase data change และไม่มี Production request

## Route verification

Playwright ติดตั้ง route เฉพาะ `GET **/api/public/active-meeting` ใน test process และตอบ deterministic meeting/group fixture ผ่าน HTTP contract เดียวกับ `HttpMeetingDirectory` ไม่มี E2E flag หรือ mock branch ใน production application code

หลัง review `npm run test:e2e` จะ build current source ด้วย Vite ก่อนเริ่ม Preview ทุกครั้ง และหยุดทันทีหาก build exit ไม่เป็น 0 แต่ละ `/fa` test ตรวจ observer ที่ route boundary ว่าพบ request เพียงหนึ่งรายการซึ่งต้องเป็น same-origin `GET /api/public/active-meeting` เท่านั้น จึงไม่สามารถผ่านจาก stale mock UI โดยไม่มี HTTP request ได้

หลักฐาน TDD:

- Precondition: การรันครั้งแรกพบ stale `dist` เวลา 11:40 ซึ่งเก่ากว่า commit ที่เปลี่ยน `/fa` เป็น HTTP เวลา 12:03 จึงผ่านแบบไม่ถูกต้อง 2 tests/1 skip; rebuild ก่อนใช้เป็นหลักฐาน TDD
- RED ที่ถูกต้องหลัง fresh build และก่อน wiring route: desktop FA E2E exit 1; 2 failed, 1 skipped เพราะ Vite Preview ไม่มี Vercel Function และไม่พบปุ่มเลือกกลุ่ม
- RED หลัง wiring route: desktop FA E2E ยัง exit 1; 2 failed, 1 skipped เพราะ browser-native `fetch` ถูกเรียกด้วย receiver ของ `HttpMeetingDirectory` และ reject ก่อนส่ง network request
- Hypothesis test: เมื่อใช้ test-only arrow wrapper ซึ่งตัด receiver ออก request เดิมถูกส่งถึง `page.route` และ test ผ่าน จึงยืนยัน failing boundary; diagnostic นี้ถูกลบออกทั้งหมด
- Focused unit RED: 1 file; 1 failed/8 passed โดย fetch double จำลอง native `Illegal invocation` เมื่อ receiver ไม่ใช่ global object
- แก้ production เพียงจุดเดียวโดย bind default fetch กับ global receiver; focused unit GREEN exit 0, 1 file/9 tests passed
- GREEN หลัง wiring route และ rebuild: desktop FA E2E exit 0; 2 passed, 1 skipped
- Review-fix runner RED: `npm run test:e2e -- --list` แสดง 15 tests แต่ timestamp ของ `dist/index.html` ไม่เปลี่ยนและ focused assertion exit 1
- Review-fix runner GREEN: คำสั่งเดียวกัน build 1,943 modules ก่อน Preview, refresh `dist/index.html`, แสดง 15 tests และ focused assertion exit 0
- Review-fix observer RED: UI flow สำเร็จแต่ desktop FA E2E exit 1 ด้วย 2 failed/1 skipped เพราะ recorder ว่าง แสดงว่า assertion จับกรณี route ไม่ถูก hit ได้จริง
- Review-fix observer GREEN: หลังบันทึก method/URL ที่ route boundary desktop FA E2E exit 0 ด้วย 2 passed/1 skipped และแต่ละ test พบ same-origin GET เพียงหนึ่งครั้ง
- Full E2E GREEN: exit 0; desktop 4 ผ่าน/1 skip, tablet 5 ผ่าน, mobile 5 ผ่าน รวม 14 ผ่าน/1 skip

Live route verification ผ่านตาม HTTP status และ response shape ด้านบน โดยไม่บันทึก row content เกิน meeting/group metadata ที่อนุมัติ

## Known limitations

- Workspace, Admin และ Preview ยังใช้ mock repository; ยังไม่มี Supabase write path
- Admin Auth, access code, HttpOnly session, issue CRUD, autosave จริง, IndexedDB offline queue, optimistic concurrency, Final และ Realtime Presence อยู่นอกขอบเขต Part 2
- Local Vite Preview ไม่มี Vercel Function จึงใช้ Playwright route fixture สำหรับ `/fa` E2E เท่านั้น
- ข้อสรุปเรื่อง anonymous direct-table denial มาจาก schema/migration และ RLS policy review ไม่ใช่ live anonymous Staging probe
- Deployment Protection ยังคงเปิดอยู่และ CLI verification ผ่าน protection ได้ แต่รอบนี้ไม่ได้บันทึก visual browser inspection หรือ browser console evidence
- Production ยังไม่ถูกสร้าง เปลี่ยนแปลง หรือ deploy

## Rollback

หาก Preview verification ไม่ผ่าน ให้หยุด rollout และไม่ promote ไป Production จากนั้น rollback เฉพาะ Preview โดยคืน branch ไปยัง commit ก่อน Part 2 หรือ redeploy Preview ที่ผ่านล่าสุด ตรวจว่า 6 Preview variables เดิมยังไม่เปลี่ยน และไม่แก้ Supabase Staging schema/data นอกแผน การ rollback นี้ไม่กระทบ Production เพราะ Part 2 ไม่มี Production effect
