# Supabase Repository Part 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/fa` read the active meeting and three group summaries from Supabase Staging through a safe Vercel API while every write-capable screen remains explicitly mock-backed.

**Architecture:** A server-only typed Supabase client queries the active meeting and group metadata, maps database rows to a shared camelCase Zod contract, and exposes it at `GET /api/public/active-meeting`. A separate browser `MeetingDirectory` calls that endpoint; it does not replace the write-capable `MeetingRepository`, add anonymous table policies, or create a browser Supabase client.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vercel Functions, Supabase JavaScript 2.112.3, Zod 4, Vitest 4, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-08-22-supabase-repository-design.md`

## Global Constraints

- Use only the existing installed dependencies; do not install software or packages in this plan.
- Use `npx --no-install` for Supabase and Vercel CLI commands.
- Browser code may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; this plan does not create a browser Supabase client.
- `SUPABASE_SECRET_KEY`, `FA_SESSION_SIGNING_SECRET`, and `FA_CODE_PEPPER` remain server-only and must never appear in command output, source, tests, or Browser bundles.
- Do not add an `anon` policy or grant direct anonymous table access.
- Do not create or modify Supabase migrations, Staging rows, Production resources, Vercel Production variables, or Production deployments.
- `/fa/workspace`, `/preview`, and all Admin routes remain mock-backed and must say so clearly.
- The public endpoint returns meeting/group metadata only; it never returns issues, access codes, hashes, sessions, users, audit logs, or mutation receipts.
- Every implementation task follows RED → GREEN → full relevant test → commit.

---

### Task 1: Database Types and Row-Version Domain Contract

**Files:**
- Create: `src/services/supabase/database.types.ts`
- Modify: `src/domain/group.ts`
- Modify: `src/services/mockSeed.ts`
- Modify: `src/services/mockMeetingRepository.test.ts`
- Modify: `src/test/fixtures.ts`

**Interfaces:**
- Produces: generated `Database` type for schema `public`.
- Changes: `MeetingGroup` gains required `rowVersion: number`.
- Guarantees: all mock groups start with `rowVersion: 1`.
- Produces: `mockMeetingWithGroups` for dependency-injection tests in Task 5.

- [ ] **Step 1: Write the failing row-version test**

Add this assertion to the existing `MockMeetingRepository` read test after loading a group:

```ts
const group = await repository.getGroup('10000000-0000-4000-8000-000000000001')
expect(group).toMatchObject({
  id: '10000000-0000-4000-8000-000000000001',
  rowVersion: 1,
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run test:run -- src/services/mockMeetingRepository.test.ts
```

Expected: FAIL because mock groups do not contain `rowVersion`.

- [ ] **Step 3: Generate typed schema from the already linked Staging project**

First verify the CLI is linked to `fa-meeting-workspace-staging` and that remote migration history contains the three reviewed schema migrations. If no project is linked or the target is not Staging, stop and request approval to relink; never infer or commit a project ref.

```powershell
npx --no-install supabase migration list --linked
```

Then run this bulk generated rewrite; do not print or include data rows or secrets:

```powershell
npx --no-install supabase gen types typescript --linked --schema public | Set-Content -LiteralPath src/services/supabase/database.types.ts -Encoding utf8
```

Confirm the file defines `Database['public']['Tables']['meetings']`, `meeting_groups`, and `issues`, and contains no project URL, project ref, key, or row data.

- [ ] **Step 4: Add the domain field and mock value**

Update `MeetingGroup`:

```ts
export interface MeetingGroup {
  id: string
  meetingId: string
  groupNo: 1 | 2 | 3
  groupName: string
  groupDescription: string
  presenter: string
  status: GroupStatus
  rowVersion: number
  finalizedAt: string | null
  createdAt: string
  updatedAt: string
}
```

Set `rowVersion: 1` in every object created by `createMockSeed()`.

Export the combined fixture from `src/test/fixtures.ts`:

```ts
export const mockMeetingWithGroups = {
  ...structuredClone(mockMeeting),
  groups: structuredClone(mockGroups),
}
```

- [ ] **Step 5: Verify GREEN and type safety**

Run:

```powershell
npm run test:run -- src/services/mockMeetingRepository.test.ts
npm run typecheck
npm run verify:environment
```

Expected: focused tests, typecheck, and secret scan exit 0.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/services/supabase/database.types.ts src/domain/group.ts src/services/mockSeed.ts src/services/mockMeetingRepository.test.ts src/test/fixtures.ts
git commit -m "feat: add typed Supabase domain contracts"
```

---

### Task 2: Shared Public Contract and HTTP Meeting Directory

**Files:**
- Create: `src/services/meetingDirectory.ts`
- Create: `src/services/publicMeetingContract.ts`
- Create: `src/services/publicMeetingContract.test.ts`
- Create: `src/services/httpMeetingDirectory.ts`
- Create: `src/services/httpMeetingDirectory.test.ts`
- Create: `src/test/publicMeetingFixture.ts`

**Interfaces:**
- Produces: `MeetingDirectory.getActiveMeeting(signal?: AbortSignal): Promise<MeetingWithGroups | null>`.
- Produces: `publicMeetingSchema`, `publicMeetingResponseSchema`, and inferred `PublicMeetingResponse`.
- Produces: `MeetingDirectoryError` with safe `code`, optional `requestId`, and no response body retention.
- Produces: `HttpMeetingDirectory(endpoint?: string, fetchImpl?: typeof fetch)`; default endpoint is `/api/public/active-meeting`.

- [ ] **Step 1: Write failing public-contract tests**

Create `validPublicMeetingResponse` in `src/test/publicMeetingFixture.ts` from the typed fixture produced in Task 1:

```ts
import { mockMeetingWithGroups } from './fixtures'

export const validPublicMeetingResponse = {
  data: structuredClone(mockMeetingWithGroups),
  requestId: 'test-request-id',
}
```

Create tests that parse this fixture and reject an invalid group number:

```ts
expect(publicMeetingResponseSchema.parse(validPublicMeetingResponse)).toEqual(validPublicMeetingResponse)
expect(() => publicMeetingResponseSchema.parse({
  ...validPublicMeetingResponse,
  data: {
    ...validPublicMeetingResponse.data,
    groups: [{ ...validPublicMeetingResponse.data.groups[0], groupNo: 4 }],
  },
})).toThrow()
```

Also reject a missing field, invalid status, non-positive `rowVersion`, and non-ISO timestamps. Accept `{ data: null, requestId: string }`.

- [ ] **Step 2: Run contract tests and verify RED**

```powershell
npm run test:run -- src/services/publicMeetingContract.test.ts
```

Expected: FAIL because the schema module does not exist.

- [ ] **Step 3: Implement the shared contract and interface**

Build Zod schemas from the existing domain constraints:

```ts
export const publicMeetingSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  fiscalYear: z.string().min(1),
  meetingDate: z.iso.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().min(1),
  isActive: z.literal(true),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  groups: z.array(z.object({
    id: z.uuid(),
    meetingId: z.uuid(),
    groupNo: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    groupName: z.string().min(1),
    groupDescription: z.string(),
    presenter: z.string(),
    status: z.enum(['draft', 'review_ready', 'final']),
    rowVersion: z.number().int().positive(),
    finalizedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })).max(3),
})

export const publicMeetingResponseSchema = z.object({
  data: publicMeetingSchema.nullable(),
  requestId: z.string().min(1),
})
```

Export `PublicMeeting = z.infer<typeof publicMeetingSchema>`, `PublicMeetingResponse = z.infer<typeof publicMeetingResponseSchema>`, and the `MeetingDirectory` interface.

- [ ] **Step 4: Write failing HTTP-directory tests**

Use `vi.fn<typeof fetch>()` and cover:

```ts
const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(
  JSON.stringify(validPublicMeetingResponse),
  { status: 200, headers: { 'content-type': 'application/json' } },
))
const directory = new HttpMeetingDirectory('/api/public/active-meeting', fetchImpl)

await expect(directory.getActiveMeeting()).resolves.toEqual(validPublicMeetingResponse.data)
expect(fetchImpl).toHaveBeenCalledWith('/api/public/active-meeting', expect.objectContaining({
  method: 'GET',
  headers: { Accept: 'application/json' },
}))
```

Add cases for `data: null`, HTTP 503 with `{ code, requestId }`, invalid JSON, invalid schema, and forwarding an AbortSignal. Assert errors never contain the raw response body.

- [ ] **Step 5: Run HTTP tests and verify RED**

```powershell
npm run test:run -- src/services/httpMeetingDirectory.test.ts
```

Expected: FAIL because `HttpMeetingDirectory` does not exist.

- [ ] **Step 6: Implement the minimal HTTP directory**

The implementation performs one GET, checks `response.ok`, parses JSON once, validates with `publicMeetingResponseSchema`, and returns `.data`. Map failure to safe codes `MEETING_DIRECTORY_UNAVAILABLE` or `INVALID_MEETING_DIRECTORY_RESPONSE`; preserve native `AbortError` without retry.

- [ ] **Step 7: Verify Task 2**

```powershell
npm run test:run -- src/services/publicMeetingContract.test.ts src/services/httpMeetingDirectory.test.ts
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit Task 2**

```powershell
git add src/services/meetingDirectory.ts src/services/publicMeetingContract.ts src/services/publicMeetingContract.test.ts src/services/httpMeetingDirectory.ts src/services/httpMeetingDirectory.test.ts src/test/publicMeetingFixture.ts
git commit -m "feat: add the public meeting directory client"
```

---

### Task 3: Typed Server Supabase Gateway

**Files:**
- Create: `api/_lib/supabaseServer.ts`
- Create: `api/_lib/publicMeetingGateway.ts`
- Create: `api/_tests/publicMeetingGateway.test.ts`
- Modify: `api/_lib/serverEnv.test.ts`

**Interfaces:**
- Produces: `createSupabaseServerClient(env: ServerEnv): SupabaseClient<Database>`.
- Produces: `ActiveMeetingGateway.getActiveMeeting(): Promise<MeetingWithGroups | null>`.
- Produces: `SupabasePublicMeetingGateway(client)` and pure `mapPublicMeetingRows(meeting, groups)`.
- Consumes: generated `Database` and shared public contract from Tasks 1–2.

- [ ] **Step 1: Write failing row-mapping tests**

Provide literal `meetings.Row` and `meeting_groups.Row` fixtures with snake_case fields. Assert:

```ts
expect(mapPublicMeetingRows(meetingRow, [groupTwoRow, groupOneRow])).toMatchObject({
  id: meetingRow.id,
  fiscalYear: String(meetingRow.fiscal_year),
  meetingDate: '2026-08-27',
  startTime: '09:00',
  endTime: '16:30',
  isActive: true,
  groups: [
    { id: groupOneRow.id, groupNo: 1, rowVersion: 1 },
    { id: groupTwoRow.id, groupNo: 2, rowVersion: 1 },
  ],
})
```

Add a test that invalid data such as group number 4 is rejected by `publicMeetingSchema` before return.

- [ ] **Step 2: Run mapping tests and verify RED**

```powershell
npm run test:run -- api/_tests/publicMeetingGateway.test.ts
```

Expected: FAIL because the gateway module does not exist.

- [ ] **Step 3: Implement typed server client and pure mapping**

Create the client with:

```ts
createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
```

Do not export the parsed secret or log the configuration. Map `status === 'active'` to `isActive: true`, convert fiscal year to string, normalize Postgres time strings to `HH:mm`, sort groups by `group_no`, and validate the mapped object with the shared schema.

- [ ] **Step 4: Write failing gateway-query tests**

Inject a minimal fake client whose `.from()` records table and selected columns. Assert the gateway queries `meetings` first, returns null when no active meeting exists, queries `meeting_groups` only when a meeting exists, orders by `group_no`, and propagates a typed internal error without embedding Supabase error text.

Expected explicit selections:

```ts
const meetingColumns = 'id,title,fiscal_year,meeting_date,starts_at,ends_at,location,status,created_at,updated_at'
const groupColumns = 'id,meeting_id,group_no,name,scope,presenter,status,row_version,finalized_at,created_at,updated_at'
```

- [ ] **Step 5: Run query tests and verify RED**

```powershell
npm run test:run -- api/_tests/publicMeetingGateway.test.ts
```

Expected: the new query assertions fail until the gateway is implemented.

- [ ] **Step 6: Implement the gateway query**

Use `.eq('status', 'active').limit(1).maybeSingle()` for the meeting and `.eq('meeting_id', meeting.id).order('group_no', { ascending: true })` for groups. Throw `PublicMeetingGatewayError` with code `QUERY_FAILED` or `INVALID_DATA`, never the raw Supabase message.

- [ ] **Step 7: Verify Task 3**

```powershell
npm run test:run -- api/_tests/publicMeetingGateway.test.ts api/_lib/serverEnv.test.ts
npm run typecheck
npm run verify:environment
```

Expected: all commands exit 0 and output contains no secret value.

- [ ] **Step 8: Commit Task 3**

```powershell
git add api/_lib/supabaseServer.ts api/_lib/publicMeetingGateway.ts api/_tests/publicMeetingGateway.test.ts api/_lib/serverEnv.test.ts
git commit -m "feat: add the server Supabase meeting gateway"
```

---

### Task 4: Public Active-Meeting Vercel Endpoint

**Files:**
- Create: `api/_lib/request.ts`
- Create: `api/public/active-meeting.ts`
- Create: `api/_tests/public-active-meeting.test.ts`

**Interfaces:**
- Produces: `createActiveMeetingHandler(gateway: ActiveMeetingGateway)`.
- Produces: `GET /api/public/active-meeting` with `{ data, requestId }`.
- Returns safe 405 `METHOD_NOT_ALLOWED` or 503 `MEETING_DIRECTORY_UNAVAILABLE` responses.

- [ ] **Step 1: Write failing handler tests**

Use a gateway stub and assert the success path:

```ts
const gateway = { getActiveMeeting: vi.fn().mockResolvedValue(meeting) }
const handler = createActiveMeetingHandler(gateway)
const response = await handler.fetch(new Request(
  'https://example.test/api/public/active-meeting',
  { headers: { 'x-request-id': 'test-request-id' } },
))

expect(response.status).toBe(200)
expect(response.headers.get('cache-control')).toBe('no-store')
expect(response.headers.get('x-request-id')).toBe('test-request-id')
expect(await response.json()).toEqual({ data: meeting, requestId: 'test-request-id' })
```

Add tests for `data: null`, POST returning 405 with `Allow: GET`, and rejected gateway returning 503. Inject secret-shaped strings into the rejected error and assert they are absent from status, headers, and JSON body.

- [ ] **Step 2: Run handler tests and verify RED**

```powershell
npm run test:run -- api/_tests/public-active-meeting.test.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement request helpers and handler factory**

Reuse the existing `json()` helper. `request.ts` exports `getRequestId(request)` and `methodNotAllowed(requestId)`. The handler checks GET before creating/using a gateway and maps every internal failure to:

```json
{
  "status": "error",
  "code": "MEETING_DIRECTORY_UNAVAILABLE",
  "requestId": "test-request-id"
}
```

The default export creates the Supabase client and gateway lazily inside `fetch()` after request validation.

- [ ] **Step 4: Verify route behavior and Vercel filesystem routing**

```powershell
npm run test:run -- api/_tests/public-active-meeting.test.ts api/_tests/health.test.ts
npm run typecheck
npm run build
npx --no-install vercel build
```

Expected: both API suites pass; local and Vercel builds exit 0; `.vercel/output/functions/api/public/active-meeting.func` exists; `/api/*` is not handled by the SPA fallback.

- [ ] **Step 5: Commit Task 4**

```powershell
git add api/_lib/request.ts api/public/active-meeting.ts api/_tests/public-active-meeting.test.ts
git commit -m "feat: expose the public active meeting API"
```

---

### Task 5: Wire `/fa` to the Real Directory and Label Mock Screens

**Files:**
- Create: `src/services/meetingDirectoryContext.tsx`
- Create: `src/services/useMeetingDirectory.ts`
- Create: `src/app/AppProviders.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/pages/fa/FASelectGroupPage.tsx`
- Modify: `src/pages/fa/FASelectGroupPage.test.tsx`
- Modify: `src/pages/fa/FAWorkspacePage.tsx`
- Modify: `src/pages/fa/FAWorkspacePage.test.tsx`
- Modify: `src/test/renderApp.tsx`
- Modify: `src/test/renderWorkspace.tsx`

**Interfaces:**
- Produces: `MeetingDirectoryProvider` and `useMeetingDirectory()`.
- Production App injects one `HttpMeetingDirectory` instance.
- Tests inject a deterministic `MeetingDirectory` independently from `MeetingRepository`.
- `/fa/workspace` visibly states that it is still mock-backed.

- [ ] **Step 1: Write failing provider/page tests**

Add a stub directory:

```ts
const directory: MeetingDirectory = {
  getActiveMeeting: vi.fn().mockResolvedValue(structuredClone(mockMeetingWithGroups)),
}
```

Update `renderAppAt(path, repository, directory)` to wrap both providers. Test that `/fa` renders the directory fixture even when the injected `MeetingRepository` has different data. This proves there is no hybrid repository or silent mock fallback.

Add tests for:

- loading while the directory promise is pending
- `data: null` empty state
- rejection followed by successful “ลองอีกครั้ง”
- storing the selected real group UUID
- aborting the prior request during cleanup/retry

- [ ] **Step 2: Run page tests and verify RED**

```powershell
npm run test:run -- src/pages/fa/FASelectGroupPage.test.tsx
```

Expected: FAIL because `MeetingDirectoryProvider` and the new render signature do not exist.

- [ ] **Step 3: Implement explicit dependency injection**

Use a null-default context that throws a clear developer error outside a provider:

```ts
const MeetingDirectoryContext = createContext<MeetingDirectory | null>(null)

export function useMeetingDirectory(): MeetingDirectory {
  const directory = useContext(MeetingDirectoryContext)
  if (!directory) throw new Error('MeetingDirectoryProvider is required')
  return directory
}
```

Create the production singleton once at module scope:

```ts
const meetingDirectory = new HttpMeetingDirectory('/api/public/active-meeting')
```

Wrap `RouterProvider` with `AppProviders`. Keep the existing mock `MeetingRepository` behavior unchanged for routes outside `/fa`.

- [ ] **Step 4: Replace the page read and support cancellation**

`FASelectGroupPage` uses `useMeetingDirectory()`. Each effect creates `AbortController`, passes `.signal`, and aborts on cleanup. Ignore AbortError; map other failures to the existing safe Thai error state. Retry increments the existing reload key and creates a new controller.

- [ ] **Step 5: Write the failing transition-banner test**

In `FAWorkspacePage.test.tsx`:

```ts
expect(await screen.findByText(
  'ข้อมูลในหน้านี้ยังเป็นข้อมูลทดลองและยังไม่บันทึกลงระบบจริง',
)).toBeVisible()
```

- [ ] **Step 6: Run the banner test and verify RED**

```powershell
npm run test:run -- src/pages/fa/FAWorkspacePage.test.tsx
```

Expected: FAIL because the explicit transition banner is absent.

- [ ] **Step 7: Add the transition banner without changing workspace behavior**

Render an accessible `role="status"` banner immediately before `FAHeader`. Do not alter `useMockAutosave`, issue editing, final simulation, or localStorage/sessionStorage behavior.

- [ ] **Step 8: Verify Task 5**

```powershell
npm run test:run -- src/pages/fa/FASelectGroupPage.test.tsx src/pages/fa/FAWorkspacePage.test.tsx src/app/router.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit Task 5**

```powershell
git add src/services/meetingDirectoryContext.tsx src/services/useMeetingDirectory.ts src/app/AppProviders.tsx src/app/App.tsx src/pages/fa/FASelectGroupPage.tsx src/pages/fa/FASelectGroupPage.test.tsx src/pages/fa/FAWorkspacePage.tsx src/pages/fa/FAWorkspacePage.test.tsx src/test/renderApp.tsx src/test/renderWorkspace.tsx
git commit -m "feat: load the FA meeting directory from the API"
```

---

### Task 6: E2E Fixtures, Full Verification, and Preview Rollout

**Files:**
- Create: `e2e/support/mockMeetingDirectory.ts`
- Modify: `e2e/fa-workspace.spec.ts`
- Modify: `README.md`
- Create: `docs/part-2-verification.md`

**Interfaces:**
- Local Playwright intercepts only `GET **/api/public/active-meeting` with a deterministic fixture; production application code has no E2E flag or mock branch.
- Verification record contains commands, counts, deployment ID/URL, response shape, and limitations, but no key, token, hash, cookie, project ref, or row content beyond approved meeting/group metadata.

- [ ] **Step 1: Write the failing E2E route-fixture helper test through Playwright usage**

Create:

```ts
import type { Page } from '@playwright/test'

const createdAt = '2026-08-20T02:00:00.000Z'
const meetingId = '00000000-0000-4000-8000-000000000001'
const groups = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    groupNo: 1 as const,
    groupName: 'บริหารกองทุน เหมาจ่าย',
    groupDescription: 'IP กับโรคค่าใช้จ่ายสูง / OP กับปฐมภูมิ หน่วยนวัตกรรม / โรคมุ่งเน้นมีผลกระทบ จิตเวช ไต สมอง หัวใจ / Audit',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    groupNo: 2 as const,
    groupName: 'กองทุนท้องถิ่น การจัดการส่งเสริม ป้องกัน ฟื้นฟู',
    groupDescription: 'การบริหารกองทุนท้องถิ่นและการทำงานด้านส่งเสริม ป้องกัน และฟื้นฟู',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    groupNo: 3 as const,
    groupName: 'งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)',
    groupDescription: 'การคุ้มครองสิทธิและการวิเคราะห์สาเหตุเพื่อป้องกันปัญหาเกิดซ้ำ',
  },
].map((group) => ({
  ...group,
  meetingId,
  presenter: '',
  status: 'draft' as const,
  rowVersion: 1,
  finalizedAt: null,
  createdAt,
  updatedAt: createdAt,
}))

const e2eMeeting = {
  id: meetingId,
  title: 'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570',
  fiscalYear: '2570',
  meetingDate: '2026-08-27',
  startTime: '09:00',
  endTime: '16:30',
  location: 'โรงแรมกรุงศรีริเวอร์ จังหวัดพระนครศรีอยุธยา',
  isActive: true as const,
  createdAt,
  updatedAt: createdAt,
  groups,
}

export async function installMeetingDirectoryFixture(page: Page) {
  await page.route('**/api/public/active-meeting', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: e2eMeeting,
        requestId: 'e2e-request-id',
      }),
    })
  })
}
```

Use an E2E-local literal fixture in this file; do not import Vitest setup or production mock repository code into the browser bundle. Call the helper before every `/fa` navigation in `fa-workspace.spec.ts`.

- [ ] **Step 2: Run FA E2E and verify RED before installing the route**

Run the existing FA E2E once before the helper is wired:

```powershell
npm run test:e2e -- e2e/fa-workspace.spec.ts --project=desktop
```

Expected: FAIL because Vite Preview has no Vercel Function at `/api/public/active-meeting`.

- [ ] **Step 3: Wire the Playwright route and verify GREEN**

```powershell
npm run test:e2e -- e2e/fa-workspace.spec.ts --project=desktop
```

Expected: desktop FA E2E passes while exercising the real `HttpMeetingDirectory` client against the intercepted HTTP contract.

- [ ] **Step 4: Update operational documentation**

README must state:

- `/fa` reads active meeting/group metadata from the Vercel API and Supabase Staging in Preview.
- Workspace/Admin/Preview remain mock-backed until Parts 3–4.
- The public endpoint is read-only and anonymous table access remains denied.
- No Production system has been created or changed.

Create `docs/part-2-verification.md` with sections for local quality gate, Vercel build, Staging API contract, route verification, known limitations, and rollback.

- [ ] **Step 5: Run the complete local quality gate**

Run fresh commands:

```powershell
npm run verify:environment
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
git diff --check
```

Expected: every command exits 0. Record exact test file/test counts, E2E project counts, and built asset sizes in `docs/part-2-verification.md`.

- [ ] **Step 6: Inspect the deployment diff and request explicit Preview approval**

Show the user the commits in Tasks 1–5, the fresh quality-gate evidence, and these remote effects: upload the current branch to `fa-meeting-workspace-trial`, reuse the existing six Preview variables, and issue read-only requests to Supabase Staging. Wait for explicit approval immediately before the remote deploy.

- [ ] **Step 7: Deploy Preview only and verify the live contract**

After approval:

```powershell
$deployOutput = npx --no-install vercel deploy --yes
$deploymentUrl = [regex]::Match(($deployOutput | Out-String), 'https://[a-z0-9-]+\.vercel\.app').Value
if (-not $deploymentUrl) { throw 'Preview deployment URL was not returned.' }
npx --no-install vercel inspect $deploymentUrl
npx --no-install vercel curl /api/health --deployment $deploymentUrl -- --include
npx --no-install vercel curl /api/public/active-meeting --deployment $deploymentUrl -- --include
npx --no-install vercel curl /fa --deployment $deploymentUrl -- --include
```

`$deploymentUrl` exists only in the current PowerShell process and is never committed to source. Expected:

- deployment target is Preview and status is Ready
- health returns HTTP 200 and `status: ok`
- active-meeting returns HTTP 200, date `2026-08-27`, and exactly three groups ordered 1–3
- JSON contains no keys named `issues`, `code_hash`, `session_hash`, `api_key`, `token`, `secret`, or `password`
- `/fa` returns HTTP 200 through Deployment Protection

If the in-app browser is logged into Vercel, visually confirm `/fa` renders the three real group cards with no console errors. If authentication blocks visual inspection, record that limitation and do not disable Deployment Protection.

- [ ] **Step 8: Finalize evidence and commit Task 6**

Update the verification document with the actual Preview deployment ID/URL and observed counts, then run:

```powershell
npm run verify:environment
git diff --check
git add e2e/support/mockMeetingDirectory.ts e2e/fa-workspace.spec.ts README.md docs/part-2-verification.md
git commit -m "docs: verify the Supabase meeting directory"
```

- [ ] **Step 9: Stop at the Part 3 approval gate**

Report that `/fa` is real-read-only while workspace/admin remain mock-backed. Request explicit approval before designing or implementing FA access codes, HttpOnly sessions, issue CRUD, autosave, IndexedDB offline queue, optimistic concurrency, Final, or Realtime Presence.

---

## Plan Self-Review Record

- Spec coverage: shared contracts, server client, exact read query, safe endpoint, independent browser directory, transition banner, tests, Preview-only rollout, and rollback are mapped to Tasks 1–6.
- Scope boundaries: no table write, access code, cookie, Admin Auth, Realtime, offline queue, export, migration, Production environment, or Production deployment is included.
- Type consistency: `MeetingDirectory`, `PublicMeetingResponse`, `MeetingWithGroups`, `MeetingGroup.rowVersion`, `ActiveMeetingGateway`, and `createActiveMeetingHandler` retain the same names and shapes across tasks.
- Test isolation: Vitest injects interfaces; Playwright intercepts the HTTP contract; production code contains no E2E/mock feature flag and never silently falls back to localStorage.
- Secret safety: generated types and evidence contain no project ref or credentials; all CLI commands use existing installations through `npx --no-install`.
