# FA Meeting Workspace Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a production-shaped, clickable React application with Thai FA, Preview, and Admin routes backed by deterministic mock services, ready for Supabase and export milestones without rewriting UI components.

**Architecture:** A Vite React SPA uses route-level pages, focused feature components, a typed mock repository, and session-scoped FA group selection. UI components consume service interfaces rather than importing mock data directly, so later milestones can replace the mock repository with Vercel/Supabase implementations.

**Tech Stack:** Node.js 20.19 or newer, React, TypeScript, Vite, Tailwind CSS through `@tailwindcss/vite`, React Router, Lucide React, Vitest, React Testing Library, MSW, ESLint, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-20-fa-meeting-workspace-design.md`

## Global Constraints

- Create the project at `fa-meeting-workspace` under the current workspace.
- Frontend must be React + TypeScript + Vite and UI must use Tailwind CSS.
- UI language is Thai, encoding is UTF-8, and displayed timestamps use `Asia/Bangkok`.
- Deploy target is Vercel; do not add Firebase, Google Sheets, or FA authentication.
- `/fa` is the single FA entry; do not create group-specific URLs.
- FA workspace must not contain group-switching tabs or Admin navigation.
- Preserve the three group names and all six issue-field labels exactly as specified.
- Main data entry occurs inline on the page, never in a modal.
- Desktop is primary; tablet and mobile must remain fully usable.
- Phase 1 uses mock services only; no Supabase keys, service-role keys, direct database code, or fake production authentication.
- Run `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build` before completing every task that changes application code.

## Milestone Boundaries

This plan implements Phase 1 only: project structure, routing, responsive UI, mock interactions, and tests. Subsequent plans will cover:

1. Supabase schema, seed, FA API, autosave, offline queue, and concurrency.
2. Admin authentication, dashboard Realtime, Presence, and Admin editing.
3. Excel and PowerPoint exports, RLS hardening, end-to-end testing, and Vercel deployment preparation.

---

### Task 1: Project Scaffold and Quality Commands

**Files:**
- Create: `fa-meeting-workspace/package.json`
- Create: `fa-meeting-workspace/vite.config.ts`
- Create: `fa-meeting-workspace/tsconfig.json`
- Create: `fa-meeting-workspace/tsconfig.app.json`
- Create: `fa-meeting-workspace/tsconfig.node.json`
- Create: `fa-meeting-workspace/eslint.config.js`
- Create: `fa-meeting-workspace/index.html`
- Create: `fa-meeting-workspace/src/main.tsx`
- Create: `fa-meeting-workspace/src/app/App.tsx`
- Create: `fa-meeting-workspace/src/styles.css`
- Create: `fa-meeting-workspace/src/test/setup.ts`
- Create: `fa-meeting-workspace/src/app/App.test.tsx`
- Create: `fa-meeting-workspace/.env.example`
- Create: `fa-meeting-workspace/.gitignore`

**Interfaces:**
- Consumes: none.
- Produces: npm scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:run`; root `App` component; Tailwind utilities available in every component.

- [ ] **Step 1: Scaffold the React TypeScript application and install dependencies**

Run from the workspace root:

```powershell
npm create vite@latest fa-meeting-workspace -- --template react-ts --no-interactive
Set-Location fa-meeting-workspace
npm install
npm install react-router-dom lucide-react
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @playwright/test
```

Expected: `package.json` exists and Node is accepted by Vite. Stop and report the installed Node version if it is below 20.19.

- [ ] **Step 2: Configure Vite, Tailwind, Vitest, and scripts**

Use the Tailwind Vite plugin and test environment:

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

Add `@import "tailwindcss";` to `src/styles.css`, import it from `src/main.tsx`, and add:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

Create `src/test/setup.ts` with `import '@testing-library/jest-dom/vitest'`. Set `lang="th"` and UTF-8 metadata in `index.html`. `.env.example` contains only `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` with comments that Phase 1 does not use them.

- [ ] **Step 3: Write the failing application smoke test**

```tsx
// src/app/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('shows the Thai application name', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'ระบบบันทึกผลการประชุมกลุ่มย่อย' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run the smoke test and verify it fails**

Run: `npm run test:run -- src/app/App.test.tsx`  
Expected: FAIL because `src/app/App.tsx` does not export the required heading.

- [ ] **Step 5: Implement the minimal branded App shell**

```tsx
// src/app/App.tsx
export function App() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <h1 className="text-2xl font-bold">ระบบบันทึกผลการประชุมกลุ่มย่อย</h1>
    </main>
  )
}
```

- [ ] **Step 6: Run quality commands**

Run: `npm run typecheck`  
Expected: PASS.

Run: `npm run lint`  
Expected: PASS.

Run: `npm run test:run`  
Expected: one passing smoke test.

Run: `npm run build`  
Expected: Vite production build completes.

- [ ] **Step 7: Commit**

```powershell
git add fa-meeting-workspace
git commit -m "chore: scaffold FA meeting workspace"
```

---

### Task 2: Domain Types, Thai Copy, and Mock Repository

**Files:**
- Create: `fa-meeting-workspace/src/domain/meeting.ts`
- Create: `fa-meeting-workspace/src/domain/group.ts`
- Create: `fa-meeting-workspace/src/domain/issue.ts`
- Create: `fa-meeting-workspace/src/domain/status.ts`
- Create: `fa-meeting-workspace/src/content/thai.ts`
- Create: `fa-meeting-workspace/src/services/meetingRepository.ts`
- Create: `fa-meeting-workspace/src/services/mockSeed.ts`
- Create: `fa-meeting-workspace/src/services/mockMeetingRepository.ts`
- Create: `fa-meeting-workspace/src/services/mockMeetingRepository.test.ts`
- Create: `fa-meeting-workspace/src/services/repositoryContext.tsx`
- Create: `fa-meeting-workspace/src/test/fixtures.ts`

**Interfaces:**
- Consumes: Vitest setup from Task 1.
- Produces: `Meeting`, `MeetingGroup`, `Issue`, `GroupStatus`; `MeetingRepository`; `MockMeetingRepository`; `useMeetingRepository()`; cloned fixtures `mockMeeting`, `mockGroups`, and `mockIssuesByGroup`.

- [ ] **Step 1: Define expected repository behavior in a failing test**

```ts
it('returns the active meeting with exactly three fixed groups', async () => {
  const repository = new MockMeetingRepository()
  const meeting = await repository.getActiveMeeting()
  expect(meeting?.fiscalYear).toBe('2570')
  expect(meeting?.groups.map((group) => group.groupNo)).toEqual([1, 2, 3])
  expect(meeting?.groups[2].groupName).toBe('งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)')
})
```

- [ ] **Step 2: Run the repository test and verify it fails**

Run: `npm run test:run -- src/services/mockMeetingRepository.test.ts`  
Expected: FAIL because the repository and domain types do not exist.

- [ ] **Step 3: Define exact domain types and repository contract**

```ts
export type GroupStatus = 'draft' | 'review_ready' | 'final'

export interface Issue {
  id: string
  groupId: string
  sortOrder: number
  topic: string
  findings: string
  proposal: string
  actionPlan: string
  monitoring: string
  stakeholderRoles: string
  updatedAt: string
}

export interface MeetingRepository {
  getActiveMeeting(): Promise<MeetingWithGroups | null>
  getGroup(groupId: string): Promise<MeetingGroup | null>
  getIssues(groupId: string): Promise<Issue[]>
  saveGroup(group: MeetingGroup): Promise<MeetingGroup>
  saveIssues(groupId: string, issues: Issue[]): Promise<Issue[]>
}
```

Define `Meeting`, `MeetingGroup`, and `MeetingWithGroups` with camelCase application properties matching the approved schema. Define the six labels once in `thai.ts` and import them everywhere.

- [ ] **Step 4: Implement deterministic seed data and mock repository copies**

Use fixed UUID-shaped IDs, the approved meeting data, all three exact names/descriptions, and two sample issues per group in `mockSeed.ts`. Every repository read and write must return `structuredClone(...)` results so tests and pages cannot mutate shared seed objects accidentally. `src/test/fixtures.ts` exports fresh cloned fixtures from a `createMockSeed()` function; tests never import mutable repository internals.

- [ ] **Step 5: Run repository and full quality checks**

Run: `npm run test:run -- src/services/mockMeetingRepository.test.ts`  
Expected: PASS.

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

- [ ] **Step 6: Commit**

```powershell
git add fa-meeting-workspace/src/domain fa-meeting-workspace/src/content fa-meeting-workspace/src/services
git commit -m "feat: add meeting domain and mock repository"
```

---

### Task 3: Shared UI Primitives and Status Semantics

**Files:**
- Create: `fa-meeting-workspace/src/components/common/Button.tsx`
- Create: `fa-meeting-workspace/src/components/common/ConfirmDialog.tsx`
- Create: `fa-meeting-workspace/src/components/common/StatusBadge.tsx`
- Create: `fa-meeting-workspace/src/components/common/Loading.tsx`
- Create: `fa-meeting-workspace/src/components/common/EmptyState.tsx`
- Create: `fa-meeting-workspace/src/components/common/StatusBadge.test.tsx`
- Create: `fa-meeting-workspace/src/utils/cn.ts`
- Create: `fa-meeting-workspace/src/utils/dateTime.ts`
- Create: `fa-meeting-workspace/src/utils/dateTime.test.ts`

**Interfaces:**
- Consumes: `GroupStatus` from Task 2.
- Produces: reusable `Button`, `ConfirmDialog`, `StatusBadge`, `Loading`, `EmptyState`; `formatBangkokTime(iso: string): string`.

- [ ] **Step 1: Write failing tests for status copy and Bangkok time**

```tsx
it.each([
  ['draft', 'กำลังบันทึก'],
  ['review_ready', 'พร้อมตรวจสอบ'],
  ['final', 'Final แล้ว'],
] as const)('renders %s status in Thai', (status, label) => {
  render(<StatusBadge status={status} />)
  expect(screen.getByText(label)).toBeInTheDocument()
})
```

```ts
it('formats an ISO timestamp in Asia/Bangkok', () => {
  expect(formatBangkokTime('2026-08-20T03:42:18.000Z')).toBe('10:42:18')
})
```

- [ ] **Step 2: Run focused tests and verify failures**

Run: `npm run test:run -- src/components/common/StatusBadge.test.tsx src/utils/dateTime.test.ts`  
Expected: FAIL because components and formatter do not exist.

- [ ] **Step 3: Implement primitives with accessible contracts**

`Button` supports `primary`, `secondary`, `success`, `danger`, and `ghost` variants and forwards native button props. `ConfirmDialog` uses the native `<dialog>` element, has a visible title, cancel button, destructive/confirm button, Escape support, and focus return. `StatusBadge` maps the three statuses to fixed Thai labels and colors. `formatBangkokTime` uses `Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })`.

- [ ] **Step 4: Run focused and global checks**

Run: `npm run test:run -- src/components/common/StatusBadge.test.tsx src/utils/dateTime.test.ts`  
Expected: PASS.

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add fa-meeting-workspace/src/components/common fa-meeting-workspace/src/utils
git commit -m "feat: add shared UI primitives"
```

---

### Task 4: Routing, Public Shell, and Admin Shell

**Files:**
- Modify: `fa-meeting-workspace/src/app/App.tsx`
- Create: `fa-meeting-workspace/src/app/router.tsx`
- Create: `fa-meeting-workspace/src/layouts/PublicLayout.tsx`
- Create: `fa-meeting-workspace/src/layouts/AdminLayout.tsx`
- Create: `fa-meeting-workspace/src/pages/NotFoundPage.tsx`
- Create: `fa-meeting-workspace/src/app/router.test.tsx`
- Create: `fa-meeting-workspace/src/test/renderApp.tsx`

**Interfaces:**
- Consumes: repository context and shared Button.
- Produces: route tree for `/`, `/fa`, `/fa/workspace`, `/preview`, and all approved Admin routes; `PublicLayout`; `AdminLayout`; `renderAppAt(path, repository?)` returning the in-memory router.

- [ ] **Step 1: Write failing route tests**

```tsx
it('redirects the root route to the FA selector', async () => {
  renderAppAt('/')
  expect(await screen.findByRole('heading', { name: 'เลือกกลุ่มสำหรับบันทึกผลการประชุม' })).toBeInTheDocument()
})

it('keeps Admin navigation out of the FA workspace', async () => {
  renderAppAt('/fa/workspace')
  expect(screen.queryByRole('link', { name: 'Admin Dashboard' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the route test and verify it fails**

Run: `npm run test:run -- src/app/router.test.tsx`  
Expected: FAIL because the route tree and pages are absent.

- [ ] **Step 3: Implement the route tree and layout boundaries**

Use `createBrowserRouter` in production and `createMemoryRouter` through a `createAppRouter(initialEntries?)` factory for tests. `/` returns `<Navigate to="/fa" replace />`. Public pages use a compact NHSO-styled header. Admin pages alone use navy sidebar navigation. Add temporary semantic page headings for routes not yet implemented so every route renders without a blank screen.

Create the shared render helper with this exact contract:

```tsx
export function renderAppAt(path: string, repository: MeetingRepository = new MockMeetingRepository()) {
  const router = createAppRouter([path])
  render(
    <RepositoryProvider repository={repository}>
      <RouterProvider router={router} />
    </RepositoryProvider>,
  )
  return router
}
```

- [ ] **Step 4: Run route and global checks**

Run: `npm run test:run -- src/app/router.test.tsx`  
Expected: PASS.

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add fa-meeting-workspace/src/app fa-meeting-workspace/src/layouts fa-meeting-workspace/src/pages/NotFoundPage.tsx
git commit -m "feat: add application routes and layouts"
```

---

### Task 5: FA Group Selector and Session Continuity

**Files:**
- Create: `fa-meeting-workspace/src/pages/fa/FASelectGroupPage.tsx`
- Create: `fa-meeting-workspace/src/components/fa/GroupSelector.tsx`
- Create: `fa-meeting-workspace/src/hooks/useSelectedGroup.ts`
- Create: `fa-meeting-workspace/src/hooks/useSelectedGroup.test.tsx`
- Create: `fa-meeting-workspace/src/pages/fa/FASelectGroupPage.test.tsx`
- Modify: `fa-meeting-workspace/src/app/router.tsx`

**Interfaces:**
- Consumes: `MeetingRepository.getActiveMeeting()` and `MeetingGroup`.
- Produces: `SELECTED_GROUP_KEY = 'fa:selected-group-id'`; `useSelectedGroup()` returning `{ selectedGroupId, selectGroup, clearGroup }`; navigation from `/fa` to `/fa/workspace`.

- [ ] **Step 1: Write failing selector tests**

```tsx
it('shows three large cards and stores the selected group in sessionStorage', async () => {
  const router = renderAppAt('/fa')
  const cards = await screen.findAllByRole('button', { name: /เลือกกลุ่ม/ })
  expect(cards).toHaveLength(3)
  await userEvent.click(cards[0])
  expect(sessionStorage.getItem('fa:selected-group-id')).toBe('10000000-0000-4000-8000-000000000001')
  expect(router.state.location.pathname).toBe('/fa/workspace')
})
```

- [ ] **Step 2: Run focused tests and verify failures**

Run: `npm run test:run -- src/hooks/useSelectedGroup.test.tsx src/pages/fa/FASelectGroupPage.test.tsx`  
Expected: FAIL because selector behavior is absent.

- [ ] **Step 3: Implement selector cards and session hook**

Load the active meeting through the repository context. Render meeting title/date/location and three keyboard-accessible group cards. Each card shows `กลุ่ม N`, exact name, and description. Selecting a card stores only the group UUID and navigates. Show Loading, no-active-meeting EmptyState, and a retry button on repository error.

- [ ] **Step 4: Run focused and global checks**

Run: `npm run test:run -- src/hooks/useSelectedGroup.test.tsx src/pages/fa/FASelectGroupPage.test.tsx`  
Expected: PASS.

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add fa-meeting-workspace/src/pages/fa fa-meeting-workspace/src/components/fa fa-meeting-workspace/src/hooks fa-meeting-workspace/src/app/router.tsx
git commit -m "feat: add FA group selection"
```

---

### Task 6: FA Workspace Issue Editing

**Files:**
- Create: `fa-meeting-workspace/src/pages/fa/FAWorkspacePage.tsx`
- Create: `fa-meeting-workspace/src/components/fa/FAHeader.tsx`
- Create: `fa-meeting-workspace/src/components/fa/GroupInfo.tsx`
- Create: `fa-meeting-workspace/src/components/fa/IssueList.tsx`
- Create: `fa-meeting-workspace/src/components/fa/IssueCard.tsx`
- Create: `fa-meeting-workspace/src/components/fa/FAActionBar.tsx`
- Create: `fa-meeting-workspace/src/features/fa/issueEditorReducer.ts`
- Create: `fa-meeting-workspace/src/features/fa/issueEditorReducer.test.ts`
- Create: `fa-meeting-workspace/src/pages/fa/FAWorkspacePage.test.tsx`
- Create: `fa-meeting-workspace/src/test/renderWorkspace.tsx`
- Modify: `fa-meeting-workspace/src/app/router.tsx`

**Interfaces:**
- Consumes: selected group ID, repository group/issues methods, common ConfirmDialog.
- Produces: `issueEditorReducer(state, action)` with `add`, `update`, `requestDelete`, `confirmDelete`, `moveUp`, `moveDown`, and `replaceAll`; complete inline FA workspace; `renderWorkspaceWithSelectedGroup(groupId?)` test helper.

- [ ] **Step 1: Write reducer tests for stable ID behavior**

```ts
it('updates an issue by id instead of array position', () => {
  const next = issueEditorReducer(twoIssues, {
    type: 'update',
    issueId: twoIssues[1].id,
    field: 'proposal',
    value: 'ข้อเสนอใหม่',
  })
  expect(next[0].proposal).not.toBe('ข้อเสนอใหม่')
  expect(next[1].proposal).toBe('ข้อเสนอใหม่')
})

it('renumbers sortOrder after moving an issue', () => {
  const next = issueEditorReducer(twoIssues, { type: 'moveUp', issueId: twoIssues[1].id })
  expect(next.map((issue) => [issue.id, issue.sortOrder])).toEqual([
    [twoIssues[1].id, 1],
    [twoIssues[0].id, 2],
  ])
})
```

- [ ] **Step 2: Run reducer tests and verify failures**

Run: `npm run test:run -- src/features/fa/issueEditorReducer.test.ts`  
Expected: FAIL because the reducer is absent.

- [ ] **Step 3: Implement the pure reducer**

Generate new mock issue IDs with `crypto.randomUUID()`. Always find rows by `issue.id`. After add, delete, or move, normalize `sortOrder` to one-based consecutive values without changing IDs.

- [ ] **Step 4: Write failing workspace interaction tests**

Create the helper used by workspace and Final tests:

```tsx
export function renderWorkspaceWithSelectedGroup(
  groupId = '10000000-0000-4000-8000-000000000001',
) {
  sessionStorage.setItem(SELECTED_GROUP_KEY, groupId)
  return renderAppAt('/fa/workspace')
}
```

```tsx
it('has no group switcher and returns to group selection through a clear action', async () => {
  renderWorkspaceWithSelectedGroup()
  expect(await screen.findByText('กลุ่ม 1 บริหารกองทุน เหมาจ่าย')).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'กลุ่ม 2' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'กลับไปเลือกกลุ่ม' })).toHaveAttribute('href', '/fa')
})

it('adds an issue and deletes only after confirmation', async () => {
  renderWorkspaceWithSelectedGroup()
  const initial = await screen.findAllByRole('group', { name: /ประเด็นที่/ })
  await userEvent.click(screen.getByRole('button', { name: 'เพิ่มประเด็น' }))
  expect(screen.getAllByRole('group', { name: /ประเด็นที่/ })).toHaveLength(initial.length + 1)
  await userEvent.click(screen.getAllByRole('button', { name: 'ลบประเด็น' })[0])
  expect(screen.getByRole('dialog', { name: 'ยืนยันการลบประเด็น' })).toBeVisible()
})
```

- [ ] **Step 5: Implement the complete inline workspace**

Render presenter, status, issue count, and last-saved time in GroupInfo. Each IssueCard renders the exact six labels and controlled input/textarea values. Add accessible move-up/move-down/delete controls. Put add, preview, review-ready, and Final controls in a sticky bottom action bar. If no group is selected or the group is stale, clear session selection and navigate to `/fa`.

- [ ] **Step 6: Run focused and global checks**

Run: `npm run test:run -- src/features/fa/issueEditorReducer.test.ts src/pages/fa/FAWorkspacePage.test.tsx`  
Expected: PASS.

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

- [ ] **Step 7: Commit**

```powershell
git add fa-meeting-workspace/src/pages/fa fa-meeting-workspace/src/components/fa fa-meeting-workspace/src/features/fa fa-meeting-workspace/src/app/router.tsx
git commit -m "feat: add FA issue workspace"
```

---

### Task 7: Simulated Autosave and Final Workflow

**Files:**
- Create: `fa-meeting-workspace/src/hooks/useMockAutosave.ts`
- Create: `fa-meeting-workspace/src/hooks/useMockAutosave.test.tsx`
- Create: `fa-meeting-workspace/src/components/fa/AutoSaveStatus.tsx`
- Create: `fa-meeting-workspace/src/components/fa/FinalConfirmDialog.tsx`
- Modify: `fa-meeting-workspace/src/pages/fa/FAWorkspacePage.tsx`
- Modify: `fa-meeting-workspace/src/components/fa/FAActionBar.tsx`
- Modify: `fa-meeting-workspace/src/services/mockMeetingRepository.ts`

**Interfaces:**
- Consumes: repository save methods and edited group/issues.
- Produces: `useMockAutosave({ group, issues, delayMs, saveGroup, saveIssues })` returning `{ state: 'idle' | 'saving' | 'saved' | 'error', savedAt: string | null, error: Error | null }`; status transitions and read-only Final workspace.

- [ ] **Step 1: Write the failing debounce test with fake timers**

```tsx
it('saves once 1500 ms after the last edit', async () => {
  vi.useFakeTimers()
  const saveGroup = vi.fn().mockResolvedValue(group)
  const { rerender } = renderHook((props) => useMockAutosave(props), {
    initialProps: { group, issues, delayMs: 1500, saveGroup, saveIssues },
  })
  rerender({ group: { ...group, presenter: 'ก' }, issues, delayMs: 1500, saveGroup, saveIssues })
  rerender({ group: { ...group, presenter: 'กข' }, issues, delayMs: 1500, saveGroup, saveIssues })
  await vi.advanceTimersByTimeAsync(1499)
  expect(saveGroup).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(saveGroup).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the autosave test and verify it fails**

Run: `npm run test:run -- src/hooks/useMockAutosave.test.tsx`  
Expected: FAIL because the hook is absent.

- [ ] **Step 3: Implement simulated autosave without offline persistence**

Use one debounced save cycle per workspace, abort stale timers during rerender/unmount, and ignore the initial load. Show `กำลังบันทึก...`, `✓ บันทึกแล้ว HH:mm:ss`, or `ยังไม่ได้ Sync`. This milestone simulates the UI state only; the next milestone replaces it with per-record API writes and an offline queue.

- [ ] **Step 4: Write failing Final workflow tests**

```tsx
it('names the group in the Final confirmation and locks fields after confirmation', async () => {
  renderWorkspaceWithSelectedGroup()
  await userEvent.click(await screen.findByRole('button', { name: 'ยืนยัน Final' }))
  expect(screen.getByText('ยืนยัน Final กลุ่ม 1 หรือไม่?')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยัน Final กลุ่ม 1' }))
  expect(screen.getByLabelText('ผู้นำเสนอ')).toBeDisabled()
})
```

- [ ] **Step 5: Implement status transitions and Final lock**

Allow `draft → review_ready → final`, and `review_ready → draft`. Final requires `FinalConfirmDialog`; all primary fields and issue controls become disabled after confirmation. Mock Admin pages may reopen the group in Task 9.

- [ ] **Step 6: Run focused and global checks**

Run: `npm run test:run -- src/hooks/useMockAutosave.test.tsx src/pages/fa/FAWorkspacePage.test.tsx`  
Expected: PASS.

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

- [ ] **Step 7: Commit**

```powershell
git add fa-meeting-workspace/src/hooks/useMockAutosave* fa-meeting-workspace/src/components/fa fa-meeting-workspace/src/pages/fa/FAWorkspacePage.tsx fa-meeting-workspace/src/services/mockMeetingRepository.ts
git commit -m "feat: add simulated autosave and final workflow"
```

---

### Task 8: Slide Preview

**Files:**
- Create: `fa-meeting-workspace/src/pages/preview/PreviewPage.tsx`
- Create: `fa-meeting-workspace/src/components/preview/SlidePreview.tsx`
- Create: `fa-meeting-workspace/src/components/preview/PreviewNavigation.tsx`
- Create: `fa-meeting-workspace/src/features/preview/buildPreviewSlides.ts`
- Create: `fa-meeting-workspace/src/features/preview/buildPreviewSlides.test.ts`
- Create: `fa-meeting-workspace/src/pages/preview/PreviewPage.test.tsx`
- Modify: `fa-meeting-workspace/src/app/router.tsx`

**Interfaces:**
- Consumes: selected group, meeting, and issues.
- Produces: `PreviewSlide = { kind: 'cover' | 'issue'; issueId?: string; index: number }`; `buildPreviewSlides(group, issues): PreviewSlide[]`; navigable 16:9 preview.

- [ ] **Step 1: Write failing slide construction tests**

```ts
it('builds one cover followed by one slide per issue in sort order', () => {
  const slides = buildPreviewSlides(group, [issue2, issue1])
  expect(slides.map((slide) => [slide.kind, slide.issueId])).toEqual([
    ['cover', undefined],
    ['issue', issue1.id],
    ['issue', issue2.id],
  ])
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm run test:run -- src/features/preview/buildPreviewSlides.test.ts`  
Expected: FAIL because the builder is absent.

- [ ] **Step 3: Implement preview builder and UI**

Render the NHSO-blue cover hierarchy and a six-field issue composition derived from the supplied PowerPoint template. The preview uses CSS `aspect-ratio: 16 / 9`, does not claim to perform final text pagination, and includes Previous/Next buttons, keyboard ArrowLeft/ArrowRight support, and `หน้า X / Y`.

- [ ] **Step 4: Write and pass navigation tests**

Verify the cover is first, Previous is disabled on page one, Next advances to the first issue, the six labels are visible, and Next is disabled on the final page.

Run: `npm run test:run -- src/features/preview/buildPreviewSlides.test.ts src/pages/preview/PreviewPage.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Run global checks and commit**

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

```powershell
git add fa-meeting-workspace/src/pages/preview fa-meeting-workspace/src/components/preview fa-meeting-workspace/src/features/preview fa-meeting-workspace/src/app/router.tsx
git commit -m "feat: add slide preview"
```

---

### Task 9: Clickable Admin Dashboard, Meetings, and Group Detail

**Files:**
- Create: `fa-meeting-workspace/src/pages/admin/AdminLoginPage.tsx`
- Create: `fa-meeting-workspace/src/pages/admin/AdminDashboardPage.tsx`
- Create: `fa-meeting-workspace/src/pages/admin/AdminMeetingsPage.tsx`
- Create: `fa-meeting-workspace/src/pages/admin/AdminMeetingDetailPage.tsx`
- Create: `fa-meeting-workspace/src/pages/admin/AdminGroupDetailPage.tsx`
- Create: `fa-meeting-workspace/src/components/admin/StatCard.tsx`
- Create: `fa-meeting-workspace/src/components/admin/GroupStatusTable.tsx`
- Create: `fa-meeting-workspace/src/components/admin/MeetingForm.tsx`
- Create: `fa-meeting-workspace/src/features/admin/buildDashboardStats.ts`
- Create: `fa-meeting-workspace/src/features/admin/buildDashboardStats.test.ts`
- Create: `fa-meeting-workspace/src/pages/admin/AdminDashboardPage.test.tsx`
- Modify: `fa-meeting-workspace/src/app/router.tsx`

**Interfaces:**
- Consumes: mock repository and status primitives.
- Produces: `buildDashboardStats(groups: MeetingGroup[], issuesByGroup: Record<string, Issue[]>)` returning `{ totalGroups: number, totalIssues: number, finalizedGroups: number, latestSavedAt: string | null }`; clickable Admin routes; mock reopen action.

- [ ] **Step 1: Write failing dashboard-stat tests**

```ts
it('calculates KPI values across all three groups', () => {
  expect(buildDashboardStats(groups, issuesByGroup)).toEqual({
    totalGroups: 3,
    totalIssues: 6,
    finalizedGroups: 1,
    latestSavedAt: '2026-08-20T03:43:00.000Z',
  })
})
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `npm run test:run -- src/features/admin/buildDashboardStats.test.ts`  
Expected: FAIL because the stats builder is absent.

- [ ] **Step 3: Implement Admin pages with explicit mock-auth labeling**

The Login page accepts any non-empty email/password only in Phase 1 and visibly states `โหมดตัวอย่าง — ยังไม่เชื่อม Supabase Auth`. Store `admin:mock-session=true` in session storage. Protected Admin routes redirect to Login when absent. Dashboard renders four KPI cards and the exact table columns: กลุ่ม, ผู้นำเสนอ, จำนวนประเด็น, บันทึกล่าสุด, สถานะ, จัดการ. Group detail supports mock edits, add/delete/reorder, status change, Final, and Admin reopen. Meetings pages render the current round and a working edit form backed by the mock repository.

- [ ] **Step 4: Write and pass Admin workflow tests**

Verify mock Login redirects to Dashboard, Dashboard shows three groups, เปิดดู navigates to the correct group detail, and Admin reopen changes a Final group to Draft.

Use a local helper that makes the mock-auth state explicit:

```tsx
function renderAdminAt(path: string) {
  sessionStorage.setItem('admin:mock-session', 'true')
  return renderAppAt(path)
}
```

Run: `npm run test:run -- src/features/admin/buildDashboardStats.test.ts src/pages/admin/AdminDashboardPage.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Run global checks and commit**

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

```powershell
git add fa-meeting-workspace/src/pages/admin fa-meeting-workspace/src/components/admin fa-meeting-workspace/src/features/admin fa-meeting-workspace/src/app/router.tsx
git commit -m "feat: add clickable Admin workspace"
```

---

### Task 10: Export Center and Settings Mock Flows

**Files:**
- Create: `fa-meeting-workspace/src/pages/admin/ExportCenterPage.tsx`
- Create: `fa-meeting-workspace/src/pages/admin/AdminSettingsPage.tsx`
- Create: `fa-meeting-workspace/src/components/admin/ExportCard.tsx`
- Create: `fa-meeting-workspace/src/components/admin/DraftExportDialog.tsx`
- Create: `fa-meeting-workspace/src/pages/admin/ExportCenterPage.test.tsx`
- Modify: `fa-meeting-workspace/src/app/router.tsx`

**Interfaces:**
- Consumes: meeting/groups/issues and ConfirmDialog.
- Produces: individual and combined export buttons with deterministic mock-download feedback; Draft PowerPoint warning.

- [ ] **Step 1: Write failing export-center tests**

Define the two fixtures before the tests:

```tsx
function renderExportCenter() {
  sessionStorage.setItem('admin:mock-session', 'true')
  return renderAppAt('/admin/export')
}

function renderExportCenterWithDraftGroup() {
  return renderExportCenter()
}
```

```tsx
it('shows three group cards and combined export actions', async () => {
  renderExportCenter()
  expect(await screen.findAllByRole('heading', { name: /กลุ่ม [123]/ })).toHaveLength(3)
  expect(screen.getByRole('button', { name: 'Export Excel รวม 3 กลุ่ม' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Export PowerPoint รวม 3 กลุ่ม' })).toBeEnabled()
})

it('warns before a Draft PowerPoint export', async () => {
  renderExportCenterWithDraftGroup()
  await userEvent.click(await screen.findByRole('button', { name: 'Export PowerPoint กลุ่ม 1' }))
  expect(screen.getByRole('dialog', { name: 'กลุ่มนี้ยังไม่ Final' })).toBeVisible()
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/pages/admin/ExportCenterPage.test.tsx`  
Expected: FAIL because Export Center is absent.

- [ ] **Step 3: Implement mock export and settings interactions**

Render status, issue count, Excel, and PowerPoint actions for each group, followed by combined actions. Clicking Excel shows `ตัวอย่าง: จะสร้างไฟล์ Excel ใน Phase Export`; clicking PowerPoint for a non-Final group requires a dialog with `ยกเลิก` and `Export Draft`. Settings edits the current meeting's title, fiscal year, date, time, location, and active state through the mock repository.

- [ ] **Step 4: Run focused and global checks**

Run: `npm run test:run -- src/pages/admin/ExportCenterPage.test.tsx`  
Expected: PASS.

Run these commands separately:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four commands PASS.

- [ ] **Step 5: Commit**

```powershell
git add fa-meeting-workspace/src/pages/admin fa-meeting-workspace/src/components/admin fa-meeting-workspace/src/app/router.tsx
git commit -m "feat: add export and settings mock flows"
```

---

### Task 11: Responsive and Accessibility Verification

**Files:**
- Create: `fa-meeting-workspace/playwright.config.ts`
- Create: `fa-meeting-workspace/e2e/fa-workspace.spec.ts`
- Create: `fa-meeting-workspace/e2e/admin-dashboard.spec.ts`
- Modify: `fa-meeting-workspace/package.json`
- Modify: `fa-meeting-workspace/src/styles.css`
- Modify: responsive classes in FA/Admin components identified by browser checks.

**Interfaces:**
- Consumes: all Phase 1 routes and interactions.
- Produces: `npm run test:e2e`; automated desktop/tablet/mobile smoke coverage.

- [ ] **Step 1: Add failing Playwright journeys**

```ts
test('FA reaches a writable issue within two clicks', async ({ page }) => {
  await page.goto('/fa')
  await page.getByRole('button', { name: /เลือกกลุ่ม 1/ }).click()
  await expect(page).toHaveURL(/\/fa\/workspace$/)
  await expect(page.getByLabel('ประเด็น').first()).toBeEditable()
})

test('mobile workspace has no horizontal document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/fa')
  await page.getByRole('button', { name: /เลือกกลุ่ม 1/ }).click()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})
```

Configure projects at 1440×1000, 900×1100, and 390×844 using installed Chromium. Add `"test:e2e": "playwright test"`.

- [ ] **Step 2: Start the app and run E2E tests to expose layout failures**

Run: `npm run build` then `npm run test:e2e`  
Expected before polish: at least one mobile/tablet assertion or interaction may fail; record the exact failure in the task notes.

- [ ] **Step 3: Fix responsive and accessibility issues found by the journeys**

Required acceptance checks:

- FA cards remain at least 44px high and keyboard reachable.
- Tablet and mobile use one-column issue fields.
- Admin tables scroll inside their container without widening the document.
- Sticky FA actions do not cover the final textarea.
- Every input has a programmatic Thai label.
- Dialogs have accessible names and visible focus.
- Status is communicated with text, not color alone.

- [ ] **Step 4: Run the complete quality gate**

Run: `npm run typecheck`  
Expected: PASS.

Run: `npm run lint`  
Expected: PASS.

Run: `npm run test:run`  
Expected: PASS.

Run: `npm run build`  
Expected: PASS.

Run: `npm run test:e2e`  
Expected: PASS in all three viewport projects.

- [ ] **Step 5: Commit**

```powershell
git add fa-meeting-workspace
git commit -m "test: verify responsive application flows"
```

---

### Task 12: Phase 1 Documentation and Final Evidence

**Files:**
- Create: `fa-meeting-workspace/README.md`
- Create: `fa-meeting-workspace/docs/phase-1-verification.md`
- Modify: `fa-meeting-workspace/.env.example`

**Interfaces:**
- Consumes: verified Phase 1 application.
- Produces: exact local-run instructions, route inventory, mock limitations, quality evidence, and handoff requirements for the Supabase milestone.

- [ ] **Step 1: Write README content**

Document:

- Purpose and Phase 1 status.
- Node.js 20.19+ requirement.
- `npm install`, `npm run dev`, `npm run test:run`, `npm run test:e2e`, and `npm run build`.
- All public and Admin routes.
- Statement that Admin auth, persistence, Realtime, exports, and service keys are mocked/not active in Phase 1.
- The next milestone's required Supabase variables without real values.

- [ ] **Step 2: Run final commands and record exact outputs**

Run each command separately and record command, exit code, test count, and build result in `docs/phase-1-verification.md`:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
```

Do not write “passed” without the observed exit code and summary.

- [ ] **Step 3: Verify clean source status for the project folder**

Run: `git status --short -- fa-meeting-workspace`  
Expected: only README and verification files are uncommitted before the documentation commit.

- [ ] **Step 4: Commit**

```powershell
git add fa-meeting-workspace/README.md fa-meeting-workspace/docs/phase-1-verification.md fa-meeting-workspace/.env.example
git commit -m "docs: complete FA workspace foundation handoff"
```

- [ ] **Step 5: Phase 1 completion check**

Confirm that `/fa` reaches editable fields within two clicks, all approved routes render, no FA group-switching tabs exist, all six labels are exact, mock limitations are visible, and every final quality command has current passing evidence. Only then mark Phase 1 complete and begin the Supabase/autosave implementation plan.
