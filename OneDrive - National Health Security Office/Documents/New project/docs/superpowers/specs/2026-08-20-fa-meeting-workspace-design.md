# FA Meeting Workspace Design

Date: 2026-08-20  
Status: Approved design, pending written-spec review  
Target project: `fa-meeting-workspace`

## 1. Purpose

Build a Thai-language web application for three facilitators (FA) to record breakout-group meeting conclusions concurrently. Each FA selects one group from the same `/fa` entry point and records that group's issues without logging in. Administrators authenticate with Supabase Auth, monitor all three groups in near real time, manage meeting rounds, finalize or reopen groups, and export group or combined Excel and PowerPoint files.

The system must support future meeting rounds, preserve strict separation by `meeting_id` and `group_id`, remain usable during temporary network outages, and be deployable to Vercel with Supabase PostgreSQL as the database.

## 2. Fixed Constraints

- Frontend: React, TypeScript, Vite, Tailwind CSS.
- Backend and database: Supabase PostgreSQL.
- Hosting: Vercel.
- Excel export: ExcelJS.
- PowerPoint export: PptxGenJS, following `Template กลุ่ม 1-3.pptx`.
- Thai UI, UTF-8, timezone `Asia/Bangkok`.
- Desktop-first, with supported tablet and mobile layouts.
- FA uses one URL and does not log in.
- No crowd input, no FA-specific group URL, no Google Sheets, Firebase, or direct anonymous unrestricted writes.
- The three group names and the six issue fields must remain unchanged unless the user explicitly requests a change.

## 3. Reference Materials

### 3.1 Web mockup

`C:\Users\suphakorn.k\Downloads\fa_workspace_clickable_mockup.html` is a visual reference for the government-modern navy palette, cards, form proportions, statuses, Admin dashboard, preview, and export center.

The production workflow intentionally departs from the mockup in these ways:

- `/fa` first displays three large group-selection cards.
- The FA workspace has no group-switching tabs.
- The FA workspace has no Admin navigation.
- A clear “กลับไปเลือกกลุ่ม” action is present.
- Primary editing uses page content, not a modal.
- A sticky action bar contains add issue, preview, review-ready, and Final actions.

### 3.2 PowerPoint template

`C:\Users\suphakorn.k\OneDrive - National Health Security Office\Documents\Template กลุ่ม 1-3.pptx` contains six 16:9 slides: one cover and one six-column content-table slide per group. Export must preserve the template's logo, palette, typography, cover composition, and six-column information structure. Content that cannot fit legibly must continue on additional cloned content slides.

## 4. Architecture

### 4.1 System shape

The application is a React single-page application backed by Vercel Functions and Supabase:

1. React SPA renders FA, Preview, and Admin experiences.
2. Vercel Functions provide the public FA write boundary and privileged Admin/export operations.
3. Supabase provides PostgreSQL, Admin authentication, Realtime subscriptions, and Presence.
4. Browser storage provides group continuity and offline drafts.

Direct anonymous writes to application tables are prohibited. The Supabase service-role key is available only to server-side Vercel Functions.

### 4.2 Client state boundaries

- Query and server state are scoped by both `meeting_id` and `group_id`.
- Issue updates use stable `issue.id`, never array position alone.
- Query/cache keys include the active meeting and selected group.
- `sessionStorage` stores `selected_group_id` for the current browser session.
- Offline data in `localStorage` uses a versioned key containing `meeting_id`, `group_id`, and `issue_id`.
- The FA workspace never retains data from a previously selected group after navigation.

### 4.3 Autosave data flow

1. FA edits a field.
2. The UI updates optimistically.
3. A 1.5-second per-record debounce starts or resets.
4. The client sends only whitelisted changed fields plus `expected_updated_at`.
5. The Vercel Function validates the active meeting, group relationship, issue relationship, status, field list, and input size.
6. The server updates the record only when `updated_at` matches the expected value.
7. Success returns the canonical row and new `updated_at`.
8. Network failure stores a draft and retry item locally.
9. Reconnection retries queued changes in record order, independently per group and issue.

A stale version returns HTTP 409. The UI does not silently overwrite the newer database value.

## 5. Database Design

### 5.1 `meetings`

- `id uuid primary key default gen_random_uuid()`
- `title text not null`
- `fiscal_year text not null`
- `meeting_date date not null`
- `start_time time`
- `end_time time`
- `location text`
- `is_active boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Only one active meeting is permitted at a time for the initial release. Activation is performed transactionally by Admin.

### 5.2 `groups`

- `id uuid primary key default gen_random_uuid()`
- `meeting_id uuid not null references meetings(id) on delete cascade`
- `group_no integer not null check (group_no between 1 and 3)`
- `group_name text not null`
- `group_description text not null default ''`
- `presenter text not null default ''`
- `status text not null default 'draft' check (status in ('draft','review_ready','final'))`
- `finalized_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique constraint on `(meeting_id, group_no)`

### 5.3 `issues`

- `id uuid primary key default gen_random_uuid()`
- `group_id uuid not null references groups(id) on delete cascade`
- `sort_order integer not null check (sort_order > 0)`
- `topic text not null default ''`
- `findings text not null default ''`
- `proposal text not null default ''`
- `action_plan text not null default ''`
- `monitoring text not null default ''`
- `stakeholder_roles text not null default ''`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique constraint on `(group_id, sort_order)`

Issue reordering runs in a database transaction and temporarily uses collision-free sort values before assigning the final sequence.

### 5.4 `admin_profiles`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `role text not null default 'admin' check (role in ('admin'))`
- `display_name text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### 5.5 `audit_logs`

- `id uuid primary key default gen_random_uuid()`
- `meeting_id uuid references meetings(id) on delete set null`
- `group_id uuid references groups(id) on delete set null`
- `actor_user_id uuid references auth.users(id) on delete set null`
- `action text not null`
- `payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Finalization, reopening, deletion, meeting activation, and Admin edits are audited.

### 5.6 Presence

Editing presence uses Supabase Realtime Presence channels keyed by group. Presence is ephemeral and is not treated as a lock. A persistent `fa_sessions` table is not required for the initial implementation unless operational testing shows that Presence alone is insufficient.

### 5.7 Indexes and triggers

- Index `groups(meeting_id)`.
- Index `groups(meeting_id, status)`.
- Index `groups(updated_at desc)`.
- Index `issues(group_id)`.
- Index `issues(group_id, sort_order)`.
- Index `issues(updated_at desc)`.
- Index `audit_logs(meeting_id, created_at desc)`.
- Index `audit_logs(group_id, created_at desc)`.
- A shared trigger updates `updated_at` before row updates.

## 6. Security Model

### 6.1 Public FA access

- Anonymous clients may read only the active meeting, its three groups, and associated issues needed by the FA UI.
- Anonymous clients cannot directly insert, update, or delete application rows.
- Public writes use `/api/fa/*` Vercel Functions.
- The API checks active meeting status, parent-child identifiers, Final status, allowed fields, value type, maximum field size, and expected row version.
- Public endpoints receive rate limiting and structured request logging without storing meeting content in logs.
- Final groups reject ordinary FA changes. The user must deliberately confirm Final, and reopening requires Admin.

### 6.2 Admin access

- Admin signs in with Supabase Auth.
- `admin_profiles` determines authorization; possession of an authenticated session alone is insufficient.
- RLS grants Admin access through authenticated policies.
- Server routes verify the session and Admin role again for destructive or privileged actions.
- `SUPABASE_SERVICE_ROLE_KEY` is never exposed in Vite variables or browser bundles.

## 7. Routes and Workflows

### 7.1 Public routes

- `/` redirects to `/fa`.
- `/fa` displays the active meeting and three group cards.
- `/fa/workspace` reads the selected group from session storage, validates it against the active meeting, and otherwise returns to `/fa`.
- `/preview` displays slide-like pages for the selected group with Previous and Next navigation.

### 7.2 Admin routes

- `/admin/login`
- `/admin/dashboard`
- `/admin/meetings`
- `/admin/meetings/:meetingId`
- `/admin/groups/:groupId`
- `/admin/export`
- `/admin/settings`

Protected routes preserve the intended URL while redirecting an expired session to Login.

### 7.3 FA workflow

1. Open `/fa`.
2. Select one of three group cards.
3. Enter the workspace within two clicks of opening the system.
4. Enter presenter and issue information.
5. Add, edit, delete, or reorder issues.
6. Review a slide-like preview.
7. Move from Draft to Review Ready.
8. Confirm Final in a dialog naming the group.
9. After Final, the workspace is read-only until Admin reopens the group.

### 7.4 Admin workflow

Admin can create and edit meeting rounds, activate or close a round, inspect all groups, edit group details and issues, reorder issues, Final or reopen groups, delete data after confirmation, manage the fixed group/template configuration, and export individual or combined deliverables.

## 8. User Interface Design

### 8.1 Visual language

- Professional government-modern style.
- Navy primary navigation, blue actions, restrained green/amber/red statuses.
- White cards, generous whitespace, clear Thai typography, visible focus states.
- Desktop is primary; tablet collapses two-column issue fields to one column; mobile uses a compact top navigation and single-column forms.

### 8.2 FA workspace

- Header: back to group selection, active meeting, group name, autosave status.
- Group information: group description, presenter, status, issue count, last-saved time.
- Issues: one card per issue with all six fixed fields.
- Card controls: reorder and delete with confirmation.
- Sticky action bar: add issue, preview, mark review-ready, confirm Final.
- Main editing never occurs in a modal.
- Textareas are large enough for long Thai meeting notes and can expand vertically.

### 8.3 Status and conflict communication

- `กำลังบันทึก...`
- `✓ บันทึกแล้ว HH:mm:ss`
- `ยังไม่ได้ Sync`
- `มี Session อื่นกำลังแก้ไขกลุ่มนี้`
- Version conflict banner with actions to load the latest server copy or retain the local text for manual reconciliation.

### 8.4 Admin dashboard

KPI cards show three groups, total issues, finalized groups, and latest save time. A realtime table shows group, presenter, issue count, latest save, status, and management action. Supabase Realtime invalidates or updates only affected group/query data.

## 9. Component and Module Structure

```text
fa-meeting-workspace/
├─ api/
│  ├─ fa/
│  ├─ admin/
│  └─ _shared/
├─ src/
│  ├─ components/
│  │  ├─ common/
│  │  ├─ fa/
│  │  ├─ admin/
│  │  └─ preview/
│  ├─ pages/
│  ├─ hooks/
│  ├─ services/
│  ├─ stores/
│  ├─ types/
│  ├─ utils/
│  └─ test/
├─ supabase/
│  ├─ migrations/
│  └─ seed.sql
├─ public/
├─ docs/
└─ vercel.json
```

Key components include `GroupSelector`, `FAHeader`, `GroupInfo`, `IssueCard`, `IssueList`, `AutoSaveStatus`, `FAActionBar`, `FinalConfirmDialog`, `SlidePreview`, `PreviewNavigation`, `AdminLayout`, `StatCard`, `GroupStatusTable`, `MeetingForm`, and `ExportCard`.

Services include Supabase client creation, meeting/group/issue services, FA API client, Admin API client, Excel export, and PowerPoint export. Hooks include meeting, selected group, issues, autosave, offline sync, Presence, and realtime group status.

## 10. Offline and Concurrency Behavior

- Debounce occurs independently per record, so editing one issue does not delay another group's save.
- Offline drafts include schema version, base `updated_at`, changed fields, and local timestamp.
- Reconnection retries oldest changes first within one record but may process unrelated records concurrently with a small bounded limit.
- Successful server responses replace the optimistic version with the canonical version.
- HTTP 409 items stop automatic overwrite and require reconciliation.
- Browser tabs announce group presence but never take a mandatory lock.
- A second session in the same group receives a visible warning; both sessions remain usable.

## 11. Finalization Rules

Allowed FA transitions are `draft → review_ready → final`. Returning from `review_ready` to `draft` is allowed before Final. Final requires a confirmation dialog. Final writes `finalized_at` and audits the action. Ordinary FA endpoints reject changes to a Final group. Admin can reopen a group, which clears `finalized_at`, changes status to `draft`, and records an audit event.

## 12. Preview and Export

### 12.1 Preview

Preview is a dedicated `/preview` route for reliable navigation and responsive behavior. It renders one cover and one or more issue pages resembling the PowerPoint template. Previous and Next controls show the current page position.

### 12.2 Excel

ExcelJS generates UTF-8-compatible `.xlsx` files.

Individual group workbooks contain:

- `Final Summary`: order, topic, findings, proposal, action plan, monitoring, stakeholder roles.
- `Group Info`: meeting title, fiscal year, group, presenter, status, issue count, export date in Asia/Bangkok.

Combined export adds a `กลุ่ม` column. Headers are bold, frozen, filtered, wrapped, bordered, and sized for Thai content.

### 12.3 PowerPoint

PptxGenJS generates 16:9 files from the supplied template assets and geometry. Each group contains a cover and issue slides. Combined export orders Groups 1, 2, and 3. Long content is split into continuation slides labeled, for example, `ประเด็นที่ 2 (1/2)` and `ประเด็นที่ 2 (2/2)`. The exporter does not shrink text below the template's legible body size to force content onto one slide.

Exporting a non-Final group requires an Admin warning confirmation and clearly labels the output as Draft.

## 13. Seed Data

Seed one active meeting:

- Title: แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570
- Fiscal year: 2570
- Date: 27 August 2026 (27 สิงหาคม 2569)
- Time: 09:00–16:30 Asia/Bangkok
- Location: โรงแรมกรุงศรีริเวอร์ จังหวัดพระนครศรีอยุธยา

Groups:

1. บริหารกองทุน เหมาจ่าย
2. กองทุนท้องถิ่น การจัดการส่งเสริม ป้องกัน ฟื้นฟู
3. งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)

Each group receives at least two clearly marked sample issues.

## 14. Error Handling

- Network or Supabase outage: retain edits locally and show unsynced status.
- Validation error: mark the relevant field without discarding other form state.
- Optimistic concurrency conflict: show non-destructive reconciliation controls.
- No active meeting: FA sees a clear closed/unavailable state; Admin receives a management link.
- Deleted or stale selected group: clear the session selection and return to group selection.
- Expired Admin session: redirect to Login and restore the intended route after authentication.
- Export failure: preserve the current screen and show an actionable retry message.
- Incomplete Draft export: warn before generating.

## 15. Testing and Quality Gates

Tools:

- Vitest and React Testing Library for components, hooks, and services.
- MSW for API, latency, offline, and conflict simulations.
- Playwright for browser workflows and responsive verification.
- SQL/RLS tests for access boundaries and optimistic concurrency.

Critical tests:

- FA selects a group, adds/edits/deletes/reorders issues, autosaves, previews, and finalizes.
- Groups 1 and 2 save concurrently; Groups 2 and 3 save concurrently; all three save concurrently without overwrites.
- Same-record stale update returns 409.
- Offline draft survives reload and syncs after reconnection.
- Admin logs in, sees realtime status, opens a group, edits, reopens Final, and exports.
- Excel has correct Thai text, sheets, columns, formatting, and combined group column.
- PowerPoint preserves Thai text, template structure, slide order, continuation behavior, and avoids overflow.

Every phase must pass:

1. TypeScript check.
2. Lint.
3. Unit/integration tests relevant to that phase.
4. Production build.

Browser and export verification are added when their phases exist.

## 16. Implementation Phases

1. Project structure, UI, and routing.
2. Supabase schema and seed.
3. FA group selector and workspace.
4. Autosave and offline draft queue.
5. Admin authentication.
6. Admin dashboard and Realtime/Presence.
7. Excel export.
8. PowerPoint template export.
9. Security hardening and RLS verification.
10. End-to-end testing, responsive polish, and Vercel deployment preparation.

Phase 1 provides a clickable local UI using mock data. Later phases replace mock services behind stable service interfaces rather than rewriting UI components.

## 17. Environment Variables

Browser-visible:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional server configuration:

- `APP_TIMEZONE=Asia/Bangkok`
- rate-limit provider variables if a persistent limiter is added before production.

## 18. Acceptance Criteria

The release is acceptable when:

- Three FAs can use the same `/fa` entry point and work in different groups concurrently.
- No group's state, autosave, offline draft, or database update overwrites another group.
- FA can add unlimited issues with the fixed six-field template.
- Admin sees near-real-time progress for all groups and can manage Final state.
- Individual and combined Excel and PowerPoint exports work with Thai text.
- Multiple meeting rounds remain separated.
- Anonymous clients cannot freely update or delete application records.
- The application builds successfully and is ready for Vercel environment configuration.

## 19. Explicit Non-Goals for Initial Release

- Crowd input from general participants.
- FA accounts or authentication.
- Mandatory group locks.
- Separate FA URLs for each group.
- General-purpose template designer beyond the fixed six fields and permitted Admin labels.
- Native mobile applications.

