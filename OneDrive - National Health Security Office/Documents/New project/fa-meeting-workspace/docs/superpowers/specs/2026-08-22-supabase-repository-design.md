# Supabase Repository Design — Part 2

วันที่: 22 สิงหาคม 2569
สถานะ: รอตรวจทานเอกสารฉบับเขียน
เอกสารหลัก: `docs/superpowers/specs/2026-08-21-production-system-design.md`

## 1. เป้าหมาย

สร้างขอบเขตการอ่านข้อมูล Supabase จริงที่ทดสอบได้สำหรับ Vercel Server และหน้าเลือกกลุ่ม โดยยังไม่รวม FA access code, FA session, issue write, autosave, offline queue, Admin Auth, Realtime หรือ Export ซึ่งเป็นงานส่วนถัดไป

เมื่อจบส่วนนี้ Vercel Preview ต้องอ่านรอบประชุม active และรายชื่อสามกลุ่มจาก Supabase Staging ผ่าน Vercel API ได้จริง หน้า `/fa` ต้องแสดง loading, empty, error/retry และข้อมูลจริงตามผล API ส่วน `/fa/workspace`, `/preview` และทุกหน้า Admin ยังคงใช้ mock repository พร้อมข้อความระบุว่าเป็นข้อมูลทดลอง ห้าม fallback จาก API จริงกลับไป mock แบบเงียบ เพราะจะทำให้ความขัดข้องถูกมองไม่เห็น

## 2. แนวทางที่เลือก

ใช้ Server-mediated public directory:

1. Browser เรียก `GET /api/public/active-meeting` เท่านั้น
2. Vercel Function ใช้ `SUPABASE_URL` และ `SUPABASE_SECRET_KEY` เพื่ออ่าน `meetings` และ `meeting_groups`
3. Function map ชื่อคอลัมน์ `snake_case` เป็น DTO `camelCase`, validate ผลลัพธ์ และส่งเฉพาะข้อมูลที่หน้าเลือกกลุ่มต้องใช้
4. Browser validate response ซ้ำก่อนคืนข้อมูลที่มีโครงสร้างเดียวกับ domain model
5. หน้า `/fa` ใช้ `MeetingDirectory` แยกจาก `MeetingRepository` เดิม

ไม่ใช้ direct anonymous table read และไม่เพิ่ม policy สำหรับ `anon` จึงรักษาหลักการที่ข้อมูลตารางเปิดให้เฉพาะ active Admin หรือ Vercel Server เท่านั้น ไม่สร้าง hybrid repository ที่ผสม read จริงกับ write mock ใน object เดียว เพราะผู้เรียกจะไม่สามารถทราบได้ว่าข้อมูลใดมาจาก environment ใด

## 3. ขอบเขตไฟล์และความรับผิดชอบ

### Shared contracts

- `src/services/supabase/database.types.ts` — TypeScript types ที่ generate จาก schema ของ Staging และ commit ได้โดยไม่มีข้อมูลหรือ secret
- `src/services/meetingDirectory.ts` — interface อ่าน active meeting เพียงอย่างเดียว
- `src/services/publicMeetingContract.ts` — Zod schema และ DTO สำหรับ response ของ public API ใช้ร่วมกันระหว่าง Browser และ Server

Interface หลัก:

```ts
export interface MeetingDirectory {
  getActiveMeeting(signal?: AbortSignal): Promise<MeetingWithGroups | null>
}

export interface PublicMeetingResponse {
  data: MeetingWithGroups | null
  requestId: string
}
```

`MeetingWithGroups` และ `MeetingGroup` เดิมยังเป็น domain model ของ UI แต่ต้องเพิ่ม `rowVersion: number` ให้ `MeetingGroup` เพื่อรองรับ optimistic concurrency ในส่วนที่ 3 โดย mock seed และ tests ต้องกำหนดค่าเริ่มต้นที่สอดคล้องกัน การเพิ่ม field นี้เป็นการเปลี่ยน domain contract เท่านั้น ยังไม่มี write behavior

### Vercel Server

- `api/_lib/supabaseServer.ts` — สร้าง typed Supabase client จาก `parseServerEnv`; ปิด browser-style session persistence, auto refresh และ URL session detection
- `api/_lib/publicMeetingGateway.ts` — query เฉพาะคอลัมน์ที่อนุญาตและ map database rows เป็น public DTO
- `api/_lib/request.ts` — request ID, GET-only handling และ safe JSON error mapping ที่ใช้ซ้ำได้ โดยไม่ย้ายหรือเปลี่ยน health endpoint เกินความจำเป็น
- `api/public/active-meeting.ts` — default Web handler สำหรับ public read endpoint
- `api/public/active-meeting.test.ts` — handler tests ด้วย gateway stub ไม่เรียก network จริง

Handler factory:

```ts
export interface ActiveMeetingGateway {
  getActiveMeeting(): Promise<MeetingWithGroups | null>
}

export function createActiveMeetingHandler(
  gateway: ActiveMeetingGateway,
): { fetch(request: Request): Promise<Response> }
```

Production default สร้าง Supabase gateway แบบ lazy ภายใน request เพื่อให้ module import ใน test ไม่ต้องมี secrets ส่วน test inject gateway ที่กำหนดผลลัพธ์ได้

Query ต้อง:

- เลือก meeting ที่ `status = 'active'` ไม่เกินหนึ่งรายการ
- เลือก groups ของ meeting นั้นเรียง `group_no` จาก 1 ถึง 3
- เลือกเฉพาะคอลัมน์ที่ contract ระบุ ห้ามใช้ `select('*')`
- ไม่อ่าน `issues`, `fa_access_codes`, `fa_sessions`, `admin_profiles`, `audit_logs` หรือ `mutation_receipts`

### Browser

- `src/services/httpMeetingDirectory.ts` — เรียก relative URL `/api/public/active-meeting`, ส่ง `Accept: application/json`, รองรับ AbortSignal, validate status/content และไม่ retry อัตโนมัติ
- `src/services/meetingDirectoryContext.tsx` — provider/hook ที่บังคับให้ runtime ระบุ dependency ชัดเจน
- `src/app/AppProviders.tsx` — production ใช้ `HttpMeetingDirectory`; mock `MeetingRepository` เดิมยังใช้กับ workspace/admin ระหว่างช่วงเปลี่ยนผ่าน
- `src/pages/fa/FASelectGroupPage.tsx` — เปลี่ยนจาก `useMeetingRepository()` เป็น `useMeetingDirectory()` และ abort request เมื่อ unmount/reload
- `src/test/renderApp.tsx` — inject ทั้ง `MeetingDirectory` และ `MeetingRepository` เพื่อให้ tests ไม่มี network

Browser Supabase client ที่ใช้ publishable key จะยังไม่ถูกสร้างในส่วนนี้ เพราะหน้าเลือกกลุ่มไม่ควรอ่านตารางโดยตรง และ Auth/Realtime ยังไม่อยู่ใน scope การสร้าง client ที่ยังไม่มี consumer เพิ่มพื้นผิวความปลอดภัยโดยไม่ให้ประโยชน์

## 4. API Contract

### Success with active meeting

```json
{
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "title": "แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570",
    "fiscalYear": "2570",
    "meetingDate": "2026-08-27",
    "startTime": "09:00",
    "endTime": "16:30",
    "location": "โรงแรมกรุงศรีริเวอร์ จังหวัดพระนครศรีอยุธยา",
    "isActive": true,
    "createdAt": "ISO-8601 timestamptz",
    "updatedAt": "ISO-8601 timestamptz",
    "groups": [
      {
        "id": "UUID",
        "meetingId": "UUID",
        "groupNo": 1,
        "groupName": "ชื่อกลุ่ม",
        "groupDescription": "ขอบเขตกลุ่ม",
        "presenter": "",
        "status": "draft",
        "rowVersion": 1,
        "finalizedAt": null,
        "createdAt": "ISO-8601 timestamptz",
        "updatedAt": "ISO-8601 timestamptz"
      }
    ]
  },
  "requestId": "UUID-or-forwarded-request-id"
}
```

เมื่อไม่มี active meeting ตอบ HTTP 200 และ `data: null` เพื่อให้ UI แสดง empty state ได้โดยไม่ถือเป็น server error

Error contract:

- method อื่นนอกจาก GET: HTTP 405, `METHOD_NOT_ALLOWED`, header `Allow: GET`
- database/query/validation failure: HTTP 503, `MEETING_DIRECTORY_UNAVAILABLE`
- ทุก response ใช้ `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8` และ `X-Request-Id`
- error body มีเฉพาะ `status`, `code`, `requestId`; ห้ามส่ง SQL, Supabase error, stack, URL, key หรือ row data

## 5. UI และสถานะช่วงเปลี่ยนผ่าน

หน้า `/fa` ใช้ข้อมูลจริงทั้งหมดจาก public API การเลือกกลุ่มยังเก็บเฉพาะ group UUID ใน `sessionStorage` ตามเดิม

ก่อนส่วนที่ 3 หน้า `/fa/workspace` ต้องแสดง banner ชัดเจนว่า “ข้อมูลในหน้านี้ยังเป็นข้อมูลทดลองและยังไม่บันทึกลงระบบจริง” ส่วนหน้า `/fa` ไม่แสดงคำว่า mock เพราะข้อมูลรอบ/กลุ่มมาจาก Staging จริงแล้ว หน้า Admin และ Preview ยังคงข้อความข้อจำกัดเดิม

หาก API ล้มเหลว UI แสดงข้อความทั่วไปและปุ่ม “ลองอีกครั้ง” การกด retry สร้าง request ใหม่และล้าง error เดิม ไม่มี silent retry loop และไม่มี fallback ไป localStorage

## 6. Security และข้อมูล

- `parseServerEnv` และการใช้ `SUPABASE_SECRET_KEY` อยู่เฉพาะไฟล์ใต้ `api/`; boundary test ป้องกัน client import และ environment verifier เดิมป้องกันการ commit ค่าจริง
- Browser bundle ไม่มี secret key, FA secrets, database URL แบบ server-only หรือ Supabase error details
- ไม่มี migration, grant หรือ RLS policy ใหม่ในส่วนนี้
- endpoint เป็น read-only และไม่ใช้ cookie จึงไม่มี CSRF mutation surface
- response จำกัดเฉพาะ active meeting และสาม group metadata ไม่ส่ง issues หรือข้อมูล authentication
- request ID ใช้สำหรับ correlation เท่านั้น ไม่บรรจุข้อมูลผู้ใช้
- server client ไม่ persist session และไม่ log request configuration

## 7. Testing และ Acceptance

ใช้ TDD และทดสอบแยก boundary:

1. Contract tests ปฏิเสธ DTO ที่ field หาย, group number นอก 1–3, status ไม่ถูกต้อง หรือ timestamp ไม่ใช่ ISO string
2. Mapping tests ยืนยัน `snake_case` database rows ถูกแปลงเป็น domain `camelCase` และเรียงกลุ่ม 1–3
3. Handler tests ครอบคลุม active meeting, `data: null`, query failure, validation failure และ 405 โดยยืนยันว่า error ไม่มี secret-shaped text
4. HTTP directory tests ครอบคลุม 200, null, non-JSON, invalid DTO, 503 และ AbortError
5. Page tests ครอบคลุม loading, data จาก injected directory, empty, error/retry, selection และ transition banner ใน workspace
6. `vercel build` ต้องสร้าง `/api/public/active-meeting` แยกจาก SPA fallback
7. Staging contract check เรียก endpoint จริงและยืนยัน meeting วันที่ `2026-08-27`, groups 3 รายการเรียง 1–3 โดย response ไม่มี `issues`, hash, token หรือ secret fields
8. Quality gate: `npm run verify:environment`, typecheck, lint, tests ทั้งหมด, build และ E2E

## 8. สิ่งที่ไม่ทำในส่วนนี้

- ไม่สร้างหรือหมุน FA access code
- ไม่ออก FA session/cookie
- ไม่อ่านหรือแก้ issues ผ่าน API จริง
- ไม่ทำ autosave, offline queue, conflict handling, final หรือ presence
- ไม่ทำ Admin login, Admin repository หรือ Realtime subscription
- ไม่ติดตั้ง ExcelJS/PptxGenJS และไม่ทำ Export
- ไม่เปลี่ยน Supabase Production หรือ Vercel Production
- ไม่ลบ mock repository เพราะยังใช้กับ tests และหน้าที่อยู่นอก scope

## 9. Rollout และ Approval Gate

Deploy เฉพาะ Vercel Preview ที่เชื่อม Staging หลัง local quality gate ผ่าน ตรวจ `/api/public/active-meeting` และ `/fa` แล้วบันทึกหลักฐานโดยไม่รวม secret หากผิดพลาด rollback Preview deployment ได้ทันทีเพราะไม่มี database mutation

เมื่อส่วนนี้ผ่าน ให้หยุดและรายงานผลก่อนขออนุมัติส่วนที่ 3: FA access code, HttpOnly session, issue CRUD, autosave, IndexedDB queue, optimistic concurrency และ Final workflow
