# Production Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the tested staging/production Supabase foundation, shared database schema, environment contracts, and Vercel API health boundary without yet replacing the application’s mock repository.

**Architecture:** One migration history is applied first to a Singapore staging project and then, only after approval, to a separate Singapore production project. Browser configuration exposes only the Supabase URL and anon key; service-role access is validated only inside Vercel Functions. The existing React UI remains on the mock repository during this infrastructure plan so the database foundation can be reviewed independently.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vercel Functions, Supabase PostgreSQL/Auth/Realtime, Zod, Vitest, Supabase CLI

**Spec:** `docs/superpowers/specs/2026-08-21-production-system-design.md`

## Global Constraints

- Frontend remains React + TypeScript + Tailwind CSS and deploy target remains Vercel.
- Database must be Supabase PostgreSQL in two Singapore projects: `fa-meeting-workspace-staging` and `fa-meeting-workspace-production`.
- FA has no account login and must never receive direct anonymous table-write access.
- Service-role keys and code peppers stay server-only and never use the `VITE_` prefix.
- Three group names and the six issue fields remain unchanged.
- Store timestamps as `timestamptz`; display them in `Asia/Bangkok`.
- Production starts with the 27 August 2569 meeting and three real groups, with no sample issue text.
- Staging starts with the same meeting and groups plus at least two sample issues per group.
- Production mutation and deployment require a separate user approval after staging verification.
- This plan ends before replacing `MockMeetingRepository`; that work belongs to the next approved plan.

## File Map

- `package.json`, `package-lock.json` — add Zod, Supabase client types, Vercel Function types, and Supabase CLI.
- `tsconfig.json`, `tsconfig.api.json` — type-check browser and server code as separate TypeScript projects.
- `.env.example` — document public and server-only environment names without values.
- `.gitignore` — ignore local Supabase links, generated temporary project metadata, and environment secrets.
- `src/config/publicEnv.ts` — validate the two browser-safe variables.
- `src/config/publicEnv.test.ts` — prove missing/valid public configuration behavior.
- `api/_lib/serverEnv.ts` — validate server-only configuration without leaking values.
- `api/_lib/serverEnv.test.ts` — prove server validation and redacted errors.
- `api/_lib/http.ts` — common JSON response and request-ID helpers.
- `api/health.ts` — Vercel Function health endpoint that verifies configuration presence but exposes no secrets.
- `api/health.test.ts` — exercise the real health handler.
- `supabase/config.toml` — local Supabase configuration and ordered seed entry point.
- `supabase/migrations/202608210001_initial_production_schema.sql` — enums, tables, constraints, indexes, triggers, RLS, grants, and Realtime publication.
- `supabase/seed/staging.sql` — meeting, three groups, and six sample issues.
- `supabase/seed/production.sql` — meeting and three groups without sample issues.
- `supabase/seed.sql` — safe local default that loads staging fixtures.
- `supabase/tests/database/production_schema.test.sql` — pgTAP schema, RLS, and seed-invariant tests.
- `scripts/verify-environment.mjs` — check committed configuration and reject leaked secrets.
- `scripts/verify-environment.test.ts` — execute the verifier against clean and leaked-secret fixtures.
- `docs/runbooks/supabase-environments.md` — exact link, migration, seed, rollback, and promotion procedure.

---

### Task 1: Typed Environment Contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Create: `tsconfig.api.json`
- Modify: `.env.example`
- Modify: `.gitignore`
- Create: `src/config/publicEnv.ts`
- Create: `src/config/publicEnv.test.ts`
- Create: `api/_lib/serverEnv.ts`
- Create: `api/_lib/serverEnv.test.ts`

**Interfaces:**
- Produces: `parsePublicEnv(input: Record<string, unknown>): PublicEnv`
- Produces: `parseServerEnv(input: NodeJS.ProcessEnv): ServerEnv`
- `PublicEnv` contains `VITE_SUPABASE_URL: string` and `VITE_SUPABASE_ANON_KEY: string`.
- `ServerEnv` contains `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FA_SESSION_SIGNING_SECRET`, and `FA_CODE_PEPPER` as non-empty strings, with the first value validated as a URL.

- [ ] **Step 1: Add the public environment failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { parsePublicEnv } from './publicEnv'

describe('parsePublicEnv', () => {
  it('accepts only the browser-safe Supabase settings', () => {
    expect(parsePublicEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })).toEqual({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })
  })

  it('rejects a missing anon key', () => {
    expect(() => parsePublicEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
    })).toThrow('Invalid public environment configuration')
  })
})
```

- [ ] **Step 2: Run the public environment test and verify RED**

Run: `npm test -- src/config/publicEnv.test.ts --run`  
Expected: FAIL because `src/config/publicEnv.ts` does not exist.

- [ ] **Step 3: Install dependencies and implement the public parser**

Run: `npm install zod @supabase/supabase-js`  
Run: `npm install --save-dev @vercel/node supabase`

```ts
import { z } from 'zod'

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
}).strip()

export type PublicEnv = z.infer<typeof publicEnvSchema>

export function parsePublicEnv(input: Record<string, unknown>): PublicEnv {
  const result = publicEnvSchema.safeParse(input)
  if (!result.success) throw new Error('Invalid public environment configuration')
  return result.data
}
```

- [ ] **Step 4: Run the public environment test and verify GREEN**

Run: `npm test -- src/config/publicEnv.test.ts --run`  
Expected: 2 tests PASS.

- [ ] **Step 5: Add the server environment failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { parseServerEnv } from './serverEnv'

const valid = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-value',
  FA_SESSION_SIGNING_SECRET: 'a'.repeat(32),
  FA_CODE_PEPPER: 'b'.repeat(32),
}

describe('parseServerEnv', () => {
  it('accepts complete server-only configuration', () => {
    expect(parseServerEnv(valid).SUPABASE_URL).toBe('https://example.supabase.co')
  })

  it('reports missing names without exposing supplied secret values', () => {
    expect(() => parseServerEnv({ ...valid, FA_CODE_PEPPER: '' }))
      .toThrow('Invalid server environment configuration: FA_CODE_PEPPER')
    try { parseServerEnv({ ...valid, FA_CODE_PEPPER: '' }) } catch (error) {
      expect(String(error)).not.toContain('service-role-value')
    }
  })
})
```

- [ ] **Step 6: Run the server environment test and verify RED**

Run: `npm test -- api/_lib/serverEnv.test.ts --run`  
Expected: FAIL because `api/_lib/serverEnv.ts` does not exist or the `api` tree is not included in Vitest.

- [ ] **Step 7: Implement the server parser and server TypeScript project**

```ts
import { z } from 'zod'

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FA_SESSION_SIGNING_SECRET: z.string().min(32),
  FA_CODE_PEPPER: z.string().min(32),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function parseServerEnv(input: NodeJS.ProcessEnv): ServerEnv {
  const result = serverEnvSchema.safeParse(input)
  if (result.success) return result.data
  const names = result.error.issues.map((issue) => issue.path.join('.')).sort().join(', ')
  throw new Error(`Invalid server environment configuration: ${names}`)
}
```

Create `tsconfig.api.json` with `ES2023`, `moduleResolution: Bundler`, `noEmit: true`, strict unused checks, Node/Vercel types, and `include: ["api", "vite.config.ts"]`. Add it as a project reference in `tsconfig.json`.

- [ ] **Step 8: Document and ignore environment files**

`.env.example` must list the six names with empty values, separating Browser-safe and Vercel-server-only variables. `.gitignore` must continue ignoring `.env.local` and `.env.*.local`, and additionally ignore `.supabase-projects.local.json` and `.supabase/` generated link/cache metadata while retaining committed `supabase/` source files.

- [ ] **Step 9: Verify Task 1**

Run: `npm test -- src/config/publicEnv.test.ts api/_lib/serverEnv.test.ts --run`  
Run: `npm run typecheck`  
Run: `npm run lint`  
Expected: all commands exit 0; 4 focused tests pass.

- [ ] **Step 10: Commit Task 1**

```powershell
git add package.json package-lock.json tsconfig.json tsconfig.api.json .env.example .gitignore src/config/publicEnv.ts src/config/publicEnv.test.ts api/_lib/serverEnv.ts api/_lib/serverEnv.test.ts
git commit -m "feat: define production environment contracts"
```

---

### Task 2: Initial Supabase Production Schema

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608210001_initial_production_schema.sql`
- Create: `supabase/tests/database/production_schema.test.sql`

**Interfaces:**
- Produces tables: `public.meetings`, `public.meeting_groups`, `public.issues`, `public.fa_access_codes`, `public.fa_sessions`, `public.admin_profiles`, `public.audit_logs`, `public.mutation_receipts`.
- Produces enums: `public.meeting_status`, `public.group_status`, `public.admin_role`, `public.actor_type`.
- Produces trigger function: `public.set_updated_at_and_version()`.
- Produces authorization helper: `public.is_active_admin()` using `security definer`, `stable`, and fixed `search_path`.

- [ ] **Step 1: Initialize local Supabase files**

Run: `npx supabase init`  
Expected: `supabase/config.toml` exists. Set the local project ID to `fa-meeting-workspace`, enable API/Auth/Realtime, and set `sql_paths = ["./seed.sql"]` for local seeds.

- [ ] **Step 2: Write the failing pgTAP contract**

The test must begin with `begin; select plan(30);` and assert literals for:

```sql
select has_table('public', 'meetings');
select has_table('public', 'meeting_groups');
select has_table('public', 'issues');
select has_table('public', 'fa_access_codes');
select has_table('public', 'fa_sessions');
select has_table('public', 'admin_profiles');
select has_table('public', 'audit_logs');
select has_table('public', 'mutation_receipts');
select col_type_is('public', 'issues', 'row_version', 'integer');
select col_is_unique('public', 'mutation_receipts', 'mutation_id');
select policies_are('public', 'issues', array['active_admin_select', 'active_admin_insert', 'active_admin_update', 'active_admin_delete']);
select finish(); rollback;
```

Complete the 30 assertions with primary keys, required foreign keys, six issue text columns, group uniqueness, RLS enabled on all eight tables, anon write grants absent, and the required four Admin policies on mutable business tables.

- [ ] **Step 3: Run the database test and verify RED**

Run: `npx supabase start`  
Run: `npx supabase test db supabase/tests/database/production_schema.test.sql`  
Expected: FAIL because the production tables do not exist.

- [ ] **Step 4: Implement enums, extensions, and tables**

The migration must:

```sql
create extension if not exists pgcrypto;
create type public.meeting_status as enum ('draft', 'active', 'closed');
create type public.group_status as enum ('draft', 'review_ready', 'final');
create type public.admin_role as enum ('admin');
create type public.actor_type as enum ('fa', 'admin', 'system');
```

Create all eight tables with UUID defaults from `gen_random_uuid()`, `created_at`/`updated_at timestamptz not null default now()`, required meeting/group foreign keys with explicit delete behavior, `row_version integer not null default 1 check (row_version > 0)`, and six `text not null default ''` issue fields named `topic`, `findings`, `proposal`, `action_plan`, `evaluation`, `stakeholder_roles`. Use `deleted_at timestamptz` for issue soft deletion and `position integer not null check (position >= 0)`.

Enforce one active meeting with:

```sql
create unique index one_active_meeting
on public.meetings ((status))
where status = 'active';
```

Enforce `(meeting_id, group_no)` uniqueness and `(meeting_id, group_id, position)` uniqueness for non-deleted issues.

- [ ] **Step 5: Implement versioning, indexes, and safe authorization helper**

`set_updated_at_and_version()` sets `updated_at = now()` and increments `row_version` only when an existing row changes. Apply it to `meetings`, `meeting_groups`, and `issues`. Add indexes for active meeting lookup, groups by meeting, active issues by group/position, active access code by group, live FA sessions by group, and audit logs by meeting/time.

Implement `is_active_admin()` as a `stable security definer` SQL function with `set search_path = ''` and an explicit `public.admin_profiles.user_id = auth.uid()` / `is_active = true` predicate. Revoke function execution from `public` and `anon`; grant it to `authenticated`.

- [ ] **Step 6: Enable RLS, revoke anonymous writes, and add Admin policies**

Enable RLS on all eight tables. Revoke `insert, update, delete, truncate, references, trigger` from `anon` for every table. Grant authenticated table operations only where policies also enforce `is_active_admin()`.

For `meetings`, `meeting_groups`, and `issues`, create explicit select/insert/update/delete policies named `active_admin_select`, `active_admin_insert`, `active_admin_update`, and `active_admin_delete`. `fa_access_codes` and `fa_sessions` allow active Admin reads but keep mutations server-only. `audit_logs` is append-only from the Server and allows active Admin reads only. `admin_profiles` allows active Admin reads, but invitation/disable mutations remain server-only. `mutation_receipts` remains server-only with no Browser policy.

Add `meeting_groups` and `issues` to the Supabase Realtime publication after checking they are not already members.

- [ ] **Step 7: Run the database contract and verify GREEN**

Run: `npx supabase db reset --local --no-seed`  
Run: `npx supabase test db supabase/tests/database/production_schema.test.sql`  
Expected: 30 assertions pass and transaction rolls back.

- [ ] **Step 8: Commit Task 2**

```powershell
git add supabase/config.toml supabase/migrations/202608210001_initial_production_schema.sql supabase/tests/database/production_schema.test.sql
git commit -m "feat: add the production Supabase schema"
```

---

### Task 3: Deterministic Staging and Production Seeds

**Files:**
- Create: `supabase/seed.sql`
- Create: `supabase/seed/staging.sql`
- Create: `supabase/seed/production.sql`
- Create: `supabase/tests/database/seed_invariants.test.sql`

**Interfaces:**
- Produces stable meeting UUID `00000000-0000-4000-8000-000000000001`.
- Produces stable group UUIDs `10000000-0000-4000-8000-000000000001` through `...0003`.
- Production produces zero issue rows; staging produces exactly two non-deleted issue rows per group.
- Neither seed stores plaintext FA access codes or an Admin password.

- [ ] **Step 1: Write the failing seed-invariant test**

```sql
begin;
select plan(8);
select is((select count(*) from public.meetings where status = 'active'), 1::bigint, 'one active meeting');
select is((select title from public.meetings where id = '00000000-0000-4000-8000-000000000001'), 'แผนการดำเนินงาน ทิศทางการทำงานร่วมกันของอนุกรรมการ ปีงบประมาณ 2570', 'meeting title');
select is((select meeting_date::text from public.meetings where id = '00000000-0000-4000-8000-000000000001'), '2026-08-27', 'meeting date');
select is((select count(*) from public.meeting_groups), 3::bigint, 'three groups');
select is((select count(*) from public.issues where deleted_at is null), 6::bigint, 'six staging issues');
select is((select count(distinct group_id) from public.issues where deleted_at is null), 3::bigint, 'all groups have samples');
select is((select count(*) from public.fa_access_codes), 0::bigint, 'codes are provisioned securely after seed');
select is((select count(*) from auth.users), 0::bigint, 'admin is invited outside SQL seed');
select finish(); rollback;
```

- [ ] **Step 2: Run the seed test and verify RED**

Run: `npx supabase db reset --local`  
Run: `npx supabase test db supabase/tests/database/seed_invariants.test.sql`  
Expected: FAIL because the approved meeting/groups/issues are absent.

- [ ] **Step 3: Implement production and staging seeds**

Both seed files use stable UUID literals and `insert ... on conflict ... do update` so reapplication is deterministic. The meeting date is `2026-08-27`, time values represent `09:00`–`16:30`, fiscal year is `2570`, and location is `โรงแรมกรุงศรีริเวอร์ จังหวัดพระนครศรีอยุธยา`.

Both files insert the exact approved names:

1. `บริหารกองทุน เหมาจ่าย`
2. `กองทุนท้องถิ่น การจัดการส่งเสริม ป้องกัน ฟื้นฟู`
3. `งานคุ้มครองสิทธิ ม.57, ม.59, การป้องกันเกิดซ้ำ (RCA)`

`production.sql` stops after meeting/groups. `staging.sql` includes the same base rows and six literal Thai sample issues (two per group) using all six text fields. `seed.sql` includes staging via a psql `\ir seed/staging.sql` directive for local development only.

- [ ] **Step 4: Run seed tests and verify GREEN**

Run: `npx supabase db reset --local`  
Run: `npx supabase test db supabase/tests/database/seed_invariants.test.sql`  
Expected: 8 assertions pass.

- [ ] **Step 5: Prove the production seed contains no sample issues**

Run a clean local reset without seed, apply `supabase/seed/production.sql`, then run:

```sql
select case when count(*) = 0 then 'PASS' else 'FAIL' end as production_has_no_sample_issues
from public.issues;
```

Expected: `PASS`.

- [ ] **Step 6: Commit Task 3**

```powershell
git add supabase/seed.sql supabase/seed/staging.sql supabase/seed/production.sql supabase/tests/database/seed_invariants.test.sql
git commit -m "feat: add isolated database seeds"
```

---

### Task 4: Vercel API Health Boundary

**Files:**
- Create: `api/_lib/http.ts`
- Create: `api/health.ts`
- Create: `api/health.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Produces: `json(status: number, body: unknown, requestId: string): Response`
- Produces: default Vercel handler `(request: VercelRequest, response: VercelResponse) => void` at `/api/health`.
- Response body is exactly `{ status: 'ok', environment: 'configured', requestId: string }` when configuration is valid.
- Configuration errors return 503 with `{ status: 'error', code: 'SERVER_NOT_CONFIGURED', requestId: string }` and no secret values.

- [ ] **Step 1: Write the failing health-handler tests**

Use real request/response test doubles that capture HTTP status, headers, and JSON body. Assert:

```ts
expect(result.statusCode).toBe(200)
expect(result.headers['cache-control']).toBe('no-store')
expect(result.body).toEqual({
  status: 'ok',
  environment: 'configured',
  requestId: 'test-request-id',
})
```

For missing server configuration assert status 503, code `SERVER_NOT_CONFIGURED`, and `JSON.stringify(body)` does not contain any supplied service-role value.

- [ ] **Step 2: Run the handler test and verify RED**

Run: `npm test -- api/health.test.ts --run`  
Expected: FAIL because `api/health.ts` does not exist.

- [ ] **Step 3: Implement HTTP helpers and health handler**

The handler accepts GET only, takes `x-request-id` when present or uses `crypto.randomUUID()`, sets `Cache-Control: no-store` and `Content-Type: application/json; charset=utf-8`, parses `process.env` with `parseServerEnv`, and maps validation failure to the safe 503 body. Other methods return 405 with `Allow: GET`.

- [ ] **Step 4: Keep API routes outside the SPA rewrite**

Update `vercel.json` so the SPA fallback does not intercept `/api/*`. Use a filesystem-first route configuration or an API-excluding rewrite supported by `vercel build`, then keep all non-API browser routes falling back to `/index.html`.

- [ ] **Step 5: Verify handler and Vercel build**

Run: `npm test -- api/health.test.ts --run`  
Run: `npm run typecheck`  
Run: `vercel build` with local non-secret test values supplied only to the process environment  
Expected: handler tests pass, TypeScript exits 0, Vercel output contains the SPA and `/api/health` Function.

- [ ] **Step 6: Commit Task 4**

```powershell
git add api/_lib/http.ts api/health.ts api/health.test.ts vercel.json
git commit -m "feat: add the Vercel API health boundary"
```

---

### Task 5: Environment Verification and Operations Runbook

**Files:**
- Create: `scripts/verify-environment.mjs`
- Create: `scripts/verify-environment.test.ts`
- Create: `docs/runbooks/supabase-environments.md`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces npm script `verify:environment`.
- `verify-environment.mjs` exits 0 only when committed files contain no service-role/JWT/FA secret values, both seed variants exist, the migration exists, and `.env.example` contains all six expected names.

- [ ] **Step 1: Write the executable verification fixture test**

Create temporary fixture directories in the test, run the script through Node, and assert a clean fixture exits 0 while a fixture containing `SUPABASE_SERVICE_ROLE_KEY=eyJ...` exits non-zero with `Potential server secret found`. The assertion must inspect process exit/output, not source text.

- [ ] **Step 2: Run the verification test and verify RED**

Run: `npm test -- scripts/verify-environment.test.ts --run`  
Expected: FAIL because the executable script does not exist.

- [ ] **Step 3: Implement the verification script**

The script accepts `--root <absolute-path>` for fixtures, recursively scans committed-source extensions while skipping `.git`, `.vercel`, `node_modules`, `dist`, output, and local environment files, and checks exact required file paths/names. It prints only filenames and rule names, never matched secret text.

- [ ] **Step 4: Document exact environment operations**

The runbook must specify:

1. Link to Staging, run `supabase db push --dry-run`, review, run `supabase db push`, apply `staging.sql`, and run pgTAP remotely.
2. Capture `supabase db dump --linked --schema public` before every remote migration.
3. Stop and request user approval before linking or mutating Production.
4. Link to Production, repeat dry run, backup, push, apply `production.sql`, invite `pichailakarm@gmail.com`, and verify zero sample issues.
5. Never copy Staging data into Production and never commit local project refs or secrets.
6. Roll back application deployment first; use a forward SQL migration for database correction instead of destructive reset.

Update README with the new infrastructure commands while retaining the statement that the UI remains mock-backed until the next approved plan.

- [ ] **Step 5: Verify Task 5**

Run: `npm test -- scripts/verify-environment.test.ts --run`  
Run: `npm run verify:environment`  
Expected: both exit 0 and no secret values appear in output.

- [ ] **Step 6: Commit Task 5**

```powershell
git add scripts/verify-environment.mjs scripts/verify-environment.test.ts docs/runbooks/supabase-environments.md package.json package-lock.json README.md
git commit -m "docs: add production environment runbook"
```

---

### Task 6: Create and Verify the Staging Supabase Project

**Remote changes:**
- Create Supabase project `fa-meeting-workspace-staging` in Singapore.
- Apply the reviewed migration and staging seed.
- Invite no Production users and create no Production project in this task.
- Configure Vercel Preview variables only.

**Interfaces:**
- Produces a Staging project reference stored only in local ignored metadata.
- Produces Preview environment values for all six required names.
- Produces an operational `/api/health` Preview endpoint.

- [ ] **Step 1: Request explicit approval for remote Staging creation**

State the project name, region, organization, and that project creation may consume Supabase quota. Do not create it until approval is received.

- [ ] **Step 2: Create Staging and record identifiers safely**

Create the project through the connected Supabase account. Store project reference and API URL in ignored local metadata; store generated database credentials only in the platform secret store. Do not print service-role keys into chat, logs, or committed files.

- [ ] **Step 3: Apply and test Staging**

Link the CLI to Staging, run migration dry-run, review output, push migrations, apply `supabase/seed/staging.sql`, and execute both pgTAP suites. Verify one active meeting, three groups, six active sample issues, and no plaintext access-code row.

- [ ] **Step 4: Generate Staging-only server secrets**

Generate independent random values of at least 32 bytes for `FA_SESSION_SIGNING_SECRET` and `FA_CODE_PEPPER`. Store them directly in Vercel Preview secrets. Never reuse these values in Production.

- [ ] **Step 5: Configure and deploy Vercel Preview**

Set Preview `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FA_SESSION_SIGNING_SECRET`, and `FA_CODE_PEPPER`; deploy Preview; call `/api/health` and assert HTTP 200 with `status: ok` and no secret-shaped fields.

- [ ] **Step 6: Run the complete local quality gate**

Run: `npm run verify:environment`  
Run: `npm run typecheck`  
Run: `npm run lint`  
Run: `npm run test:run`  
Run: `npm run build`  
Run: `npm run test:e2e`  
Expected: all exit 0. Record exact counts and build sizes in `docs/phase-1-verification.md` or a new infrastructure verification record.

- [ ] **Step 7: Commit verification evidence and push**

```powershell
git add docs README.md
git commit -m "docs: verify the staging infrastructure"
git push
```

- [ ] **Step 8: Stop at the Production approval gate**

Report Staging project status, database test counts, Preview health result, and remaining limitations. Request explicit approval before Task 7.

---

### Task 7: Create and Verify the Production Supabase Project

**Remote changes:**
- Create Supabase project `fa-meeting-workspace-production` in Singapore.
- Apply only reviewed migrations and `production.sql`.
- Invite `pichailakarm@gmail.com` as the first Admin through the server-side invitation flow or Supabase Auth administrative operation.
- Configure Vercel Production variables, but do not promote the mock-backed UI as the final real system.

**Interfaces:**
- Produces isolated Production project and Production environment secrets.
- Production has one active meeting, three groups, zero sample issues, and one invited Admin.

- [ ] **Step 1: Request explicit Production approval**

Present Staging verification evidence and the exact Production mutations. Proceed only after the user replies with approval.

- [ ] **Step 2: Create Production and apply reviewed schema**

Create in Singapore, store identifiers/secrets only in platform/local ignored stores, link CLI, perform migration dry-run, capture a pre-change schema dump, push migration, and apply `supabase/seed/production.sql`.

- [ ] **Step 3: Verify Production invariants before invitation**

Assert exactly one active meeting dated `2026-08-27`, exactly three approved groups, zero active issues, zero access-code rows, Anonymous write attempts fail, and no Staging project reference appears in Production environment configuration.

- [ ] **Step 4: Invite the first Admin securely**

Invite `pichailakarm@gmail.com` so the recipient sets the password through email. Insert/activate the matching `admin_profiles` row without storing a password. Verify the invited identity can become an active Admin and an anonymous identity cannot read Admin data.

- [ ] **Step 5: Configure Production secrets without promoting application behavior**

Set a separate set of six Production environment values in Vercel. Run a protected Production health/deployment check only after confirming the current UI is still mock-backed and labeling it accordingly. Do not announce the system as production-ready until the later repository, FA, Admin, export, and security plans are complete.

- [ ] **Step 6: Record and commit Production infrastructure evidence**

Document project status, migration identity, seed invariant results, RLS evidence, invitation status, environment separation, and recovery procedure without secret values. Commit and push the evidence.

- [ ] **Step 7: Stop before the Supabase Repository plan**

Summarize Infrastructure completion and request approval to design/execute Part 2. Do not replace `MockMeetingRepository` in this plan.

---

## Plan Self-Review Record

- Spec coverage for Infrastructure: two projects, shared migrations, schema, isolated seeds, environment separation, API foundation, Admin invitation, staging-first verification, and Production approval gate are each mapped to a task.
- Scope intentionally deferred: FA access-code exchange, repository replacement, Offline Draft, Realtime Presence, Admin management UI, exports, and final security audit remain separate approved plans.
- Type contracts are consistent: browser uses `PublicEnv`; Vercel Functions use `ServerEnv`; neither parser returns unspecified keys.
- Secret handling is consistent: values are never committed, logged, placed in `VITE_*`, or copied between environments.
