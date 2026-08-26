# Part 3 Admin Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock Admin login with invite-only Supabase email/password authentication and allow protected Admin routes only for an authenticated user with an active `admin_profiles` row on Staging.

**Architecture:** A browser-only typed Supabase client persists the Admin session and delegates authentication to Supabase Auth. An injectable `AdminAuthGateway` validates the current user against `admin_profiles` under RLS; a React provider exposes a four-state auth machine to async route guards and the Login/Recovery UI. A server-only operator script provisions the single approved initial Admin after separate remote approval, while Admin business data remains explicitly mock-backed until Part 4.

**Tech Stack:** React 19, React Router 7, TypeScript 6, Vite 8, Supabase JavaScript 2.112.3, Zod 4, Vitest 4, Testing Library, Playwright, Supabase hosted Auth, Vercel Preview

**Spec:** `docs/superpowers/specs/2026-08-22-admin-auth-design.md`

## Global Constraints

- Use only existing installed dependencies; do not install software, packages, browser-control tools, or remote-control software.
- Use `npx --no-install` for Supabase and Vercel CLI commands.
- Work against Supabase Staging and Vercel Preview only; do not read from, configure, invite into, deploy to, or mutate Production.
- Do not perform any remote Auth/SMTP/template/invitation/deployment mutation until the corresponding task reaches an explicit user approval gate.
- Browser code may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SECRET_KEY`, SMTP credentials, token hashes, access/refresh tokens, invite links, and passwords must never appear in source, fixtures, command output, screenshots, reports, or browser bundles.
- Authorization uses `admin_profiles.user_id`, `role`, and `is_active` under RLS; never use `user_metadata` or form input for authorization.
- Public signup remains disabled. Part 3 provisions only `pichailakarm@gmail.com`; inviting or disabling additional Admins is Part 4.
- Admin session persistence is handled by Supabase Auth in the browser. The HttpOnly-cookie design remains reserved for FA group sessions and is not part of this plan.
- Admin Dashboard/Meeting/Group/Export/Settings continue to use `MockMeetingRepository` and retain the visible mock-data banner until Part 4.
- The invite/recovery confirmation page must not consume a token on page load; `verifyOtp` runs only after explicit user action.
- Password UI requires at least 12 characters and matching confirmation; Staging Auth password policy must be no weaker.
- Every local implementation task follows RED → GREEN → focused regression → relevant full checks → commit.

---

### Task 1: Browser-Safe Supabase Auth Client

**Files:**
- Create: `src/services/supabase/supabaseBrowserClient.ts`
- Create: `src/services/supabase/supabaseBrowserClient.test.ts`
- Modify: `src/config/publicEnv.test.ts`

**Interfaces:**
- Consumes: `PublicEnv` and `Database`.
- Produces: `browserAuthOptions` with session persistence/refresh enabled and implicit URL token detection disabled.
- Produces: `createSupabaseBrowserClient(env: PublicEnv): SupabaseClient<Database>`.
- Security property: no server environment name or secret crosses this module boundary.

- [ ] **Step 1: Write failing browser-client option tests**

Create `src/services/supabase/supabaseBrowserClient.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { browserAuthOptions } from './supabaseBrowserClient'

describe('browserAuthOptions', () => {
  it('persists and refreshes the Admin session without consuming URL fragments', () => {
    expect(browserAuthOptions).toMatchObject({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    })
  })
})
```

Extend `publicEnv.test.ts` to assert that `SUPABASE_SECRET_KEY`, `SMTP_PASSWORD`, and `FA_SESSION_SIGNING_SECRET` are stripped even when present in the input.

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
npm run test:run -- src/services/supabase/supabaseBrowserClient.test.ts src/config/publicEnv.test.ts
```

Expected: FAIL because `supabaseBrowserClient.ts` does not exist.

- [ ] **Step 3: Implement the typed browser client**

Create:

```ts
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js'
import type { PublicEnv } from '../../config/publicEnv'
import type { Database } from './database.types'

export const browserAuthOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
} as const

export function createSupabaseBrowserClient(env: PublicEnv) {
  const options: SupabaseClientOptions<'public'> = { auth: browserAuthOptions }
  return createClient<Database>(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    options,
  )
}
```

Do not create a client at import time in this module; `AppProviders` will create the browser singleton from validated `import.meta.env` in Task 3.

- [ ] **Step 4: Verify Task 1**

```powershell
npm run test:run -- src/services/supabase/supabaseBrowserClient.test.ts src/config/publicEnv.test.ts
npm run typecheck
npm run verify:environment
```

Expected: all commands exit 0 and no server-only value appears in output.

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/services/supabase/supabaseBrowserClient.ts src/services/supabase/supabaseBrowserClient.test.ts src/config/publicEnv.test.ts
git commit -m "feat: add the browser Supabase auth client"
```

---

### Task 2: Active-Admin Authorization Gateway

**Files:**
- Create: `src/services/auth/adminAuth.ts`
- Create: `src/services/auth/supabaseAdminAuth.ts`
- Create: `src/services/auth/supabaseAdminAuth.test.ts`
- Modify: `supabase/tests/database/production_schema.test.sql`

**Interfaces:**
- Produces: `AdminIdentity { userId: string; email: string; displayName: string; role: 'admin' }`.
- Produces: `EmailTokenType = 'invite' | 'recovery'`.
- Produces: `AdminAuthGateway` methods `restore`, `signIn`, `signOut`, `requestPasswordReset`, `verifyEmailToken`, `updatePassword`, and `subscribe`.
- Produces: `AdminAuthError` with safe codes `INVALID_CREDENTIALS`, `NOT_AUTHORIZED`, `INVALID_TOKEN`, `UNAVAILABLE`, and `PASSWORD_UPDATE_FAILED`.
- Consumes: `SupabaseClient<Database>`; raw Supabase errors never leave the adapter.

- [ ] **Step 1: Write failing authorization tests**

Define the interface in `adminAuth.ts` and create tests with an injected Supabase client double. Cover:

```ts
expect(await gateway.restore()).toEqual({
  userId: activeUser.id,
  email: 'pichailakarm@gmail.com',
  displayName: 'Pichailakarm',
  role: 'admin',
})
```

Add cases for no session returning `null`, active-profile query returning no row, inactive profile being rejected, profile query failure mapping to `UNAVAILABLE`, and raw error text containing a synthetic secret never appearing in the thrown message.

For successful `signIn`, assert the call is exactly:

```ts
client.auth.signInWithPassword({
  email: 'pichailakarm@gmail.com',
  password: 'not-retained-by-the-test',
})
```

Then assert the adapter loads the active profile. If no active profile exists, assert `client.auth.signOut()` is called before `NOT_AUTHORIZED` is returned.

- [ ] **Step 2: Run the gateway tests and verify RED**

```powershell
npm run test:run -- src/services/auth/supabaseAdminAuth.test.ts
```

Expected: FAIL because the gateway implementation does not exist.

- [ ] **Step 3: Implement safe identity and profile loading**

The adapter must use `auth.getUser()` and then query only:

```ts
const profileColumns = 'user_id,display_name,role,is_active'

client
  .from('admin_profiles')
  .select(profileColumns)
  .eq('user_id', user.id)
  .eq('is_active', true)
  .maybeSingle()
```

Return only the four `AdminIdentity` fields. Normalize the sign-in email with `trim().toLowerCase()`. Map every Supabase failure to a safe `AdminAuthError`; do not store the password on the gateway instance.

Implement subscription as:

```ts
subscribe(listener: () => void) {
  const { data } = client.auth.onAuthStateChange(() => listener())
  return () => data.subscription.unsubscribe()
}
```

Implement recovery operations with `resetPasswordForEmail`, `verifyOtp`, and `updateUser`, but defer UI flow-marker handling to Task 5.

- [ ] **Step 4: Strengthen the structural RLS test**

Change `select plan(30)` to `select plan(33)` and add:

```sql
select ok(
  has_table_privilege('authenticated', 'public.admin_profiles', 'SELECT'),
  'authenticated may select admin profiles through RLS'
);

select results_eq(
  $$
    select count(*)::bigint
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'admin_profiles'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  $$,
  array[0::bigint],
  'authenticated cannot mutate admin profiles directly'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_profiles'
      and policyname = 'active_admin_select'
      and 'authenticated' = any(roles)
  $$,
  array[1::bigint],
  'admin profile select policy targets authenticated users'
);
```

Retain the existing assertion that `private.is_active_admin()` is unavailable to `PUBLIC` and `anon`. Do not add or alter a migration unless these assertions reveal a real schema defect.

Do not add or alter a migration unless these assertions reveal a real schema defect.

- [ ] **Step 5: Verify Task 2**

```powershell
npm run test:run -- src/services/auth/supabaseAdminAuth.test.ts
npm run typecheck
npm run lint
npm run verify:environment
```

Expected: all local commands exit 0. Do not run linked database tests yet because that is a remote read/transaction gate in Task 8.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/services/auth/adminAuth.ts src/services/auth/supabaseAdminAuth.ts src/services/auth/supabaseAdminAuth.test.ts supabase/tests/database/production_schema.test.sql
git commit -m "feat: authorize active Supabase admins"
```

---

### Task 3: Auth Provider and Async Admin Route Guard

**Files:**
- Create: `src/services/auth/adminAuthContext.tsx`
- Create: `src/services/auth/adminAuthContext.test.tsx`
- Create: `src/services/useAdminAuth.ts`
- Create: `src/test/fakeAdminAuth.ts`
- Modify: `src/components/admin/RequireAdminSession.tsx`
- Modify: `src/app/AppProviders.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/test/renderApp.tsx`
- Modify: `src/app/router.test.tsx`

**Interfaces:**
- Produces: `AdminAuthState = loading | anonymous | active-admin | unauthorized`.
- Produces: `AdminAuthProvider`, `useAdminAuth()`, and actions `signIn`, `signOut`, `requestPasswordReset`, `confirmEmailToken`, `updatePassword`.
- Production `AppProviders` injects one `SupabaseAdminAuth` instance.
- Tests inject `FakeAdminAuth` without any production mock fallback or sessionStorage auth flag.

- [ ] **Step 1: Write failing provider concurrency tests**

Test initial loading, anonymous restore, active restore, and unauthorized errors. Add a stale-result test:

```ts
const firstRestore = deferred<AdminIdentity | null>()
gateway.restore.mockReturnValueOnce(firstRestore.promise)
renderHook(() => useAdminAuth(), { wrapper })

await act(() => gateway.emitAuthChange())
gateway.restore.mockResolvedValueOnce(null)
await waitFor(() => expect(result.current.status).toBe('anonymous'))

firstRestore.resolve(activeIdentity)
await act(async () => firstRestore.promise)
expect(result.current.status).toBe('anonymous')
```

This proves an older restore cannot overwrite a newer logout/auth event.

- [ ] **Step 2: Run provider tests and verify RED**

```powershell
npm run test:run -- src/services/auth/adminAuthContext.test.tsx
```

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Implement the four-state provider**

Use a monotonically increasing request revision held in `useRef`. Every restore/auth event captures a revision and may update state only when it is still current. Cleanup increments the revision and unsubscribes.

The state shape must be discriminated:

```ts
export type AdminAuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'unauthorized' }
  | { status: 'active-admin'; identity: AdminIdentity }
```

Provider actions call the gateway and then set/refresh state. They expose only safe error codes to pages.

- [ ] **Step 4: Write failing route-guard tests**

Update `renderAppAt` to accept a fourth `AdminAuthGateway` argument. Default it to an active deterministic fake so existing Admin business-page tests retain their intended focus.

Add tests that:

- loading renders an accessible `กำลังตรวจสอบสิทธิ์ผู้ดูแล` status and not `Admin Dashboard`.
- anonymous redirects to `/admin/login`.
- unauthorized redirects to `/admin/login` without rendering `AdminLayout`.
- setting `sessionStorage['admin:mock-session'] = 'true'` does not grant access.
- active Admin reaches `/admin/dashboard` and retains the mock-data banner.

- [ ] **Step 5: Replace the synchronous mock guard**

`RequireAdminSession` must use `useAdminAuth()` and `useLocation()`:

```tsx
if (state.status === 'loading') {
  return <Loading label="กำลังตรวจสอบสิทธิ์ผู้ดูแล" />
}
if (state.status !== 'active-admin') {
  return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
}
return <Outlet />
```

Delete every production read/write of `admin:mock-session`.

- [ ] **Step 6: Wire the production provider**

In `AppProviders`, validate `import.meta.env` with `parsePublicEnv`, create the browser client and `SupabaseAdminAuth` once at module scope, and wrap children with both `MeetingDirectoryProvider` and `AdminAuthProvider`. Do not initialize any user-specific server client.

- [ ] **Step 7: Verify Task 3**

```powershell
npm run test:run -- src/services/auth/adminAuthContext.test.tsx src/app/router.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands exit 0 and the mock session key no longer authorizes a route.

- [ ] **Step 8: Commit Task 3**

```powershell
git add src/services/auth/adminAuthContext.tsx src/services/auth/adminAuthContext.test.tsx src/services/useAdminAuth.ts src/test/fakeAdminAuth.ts src/components/admin/RequireAdminSession.tsx src/app/AppProviders.tsx src/app/router.tsx src/test/renderApp.tsx src/app/router.test.tsx
git commit -m "feat: protect admin routes with Supabase auth"
```

---

### Task 4: Admin Login and Logout UI

**Files:**
- Modify: `src/pages/admin/AdminLoginPage.tsx`
- Modify: `src/layouts/AdminLayout.tsx`
- Modify: `src/pages/admin/AdminDashboardPage.test.tsx`
- Modify: `src/app/router.test.tsx`

**Interfaces:**
- Login consumes `useAdminAuth().signIn(email, password)`.
- `AdminLayout` consumes active identity and exposes Logout.
- Login errors use one generic Thai message; raw provider text is never rendered.
- The post-login `from` path is accepted only when it begins with `/admin/` and is not an Auth flow route.

- [ ] **Step 1: Rewrite the old mock-login test to verify RED**

Replace the sessionStorage test with an injected anonymous fake:

```ts
const auth = createFakeAdminAuth({ status: 'anonymous' })
renderAppAt('/admin/login', repository, directory, auth)
await user.type(screen.getByLabelText('อีเมล'), ' PICHAILAKARM@GMAIL.COM ')
await user.type(screen.getByLabelText('รหัสผ่าน'), 'correct-password')
await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))

expect(auth.signIn).toHaveBeenCalledWith(
  'pichailakarm@gmail.com',
  'correct-password',
)
```

Add RED tests for disabled/working submit state, generic invalid-credential message, double-submit prevention, active Admin redirect away from Login, safe internal `from` navigation, and external `from` rejection.

- [ ] **Step 2: Run Login tests and verify RED**

```powershell
npm run test:run -- src/pages/admin/AdminDashboardPage.test.tsx src/app/router.test.tsx
```

Expected: FAIL because Login still writes the mock session.

- [ ] **Step 3: Implement real Login behavior**

Remove the mock-mode Auth notice. Keep the separate Admin data banner after Login because business data is still mock-backed. Use local controlled fields, clear the password immediately after every completed submit, and map all gateway codes to:

```text
ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบอีเมล รหัสผ่าน และสิทธิ์ผู้ดูแล
```

The button label becomes `กำลังเข้าสู่ระบบ...` while pending and remains disabled.

- [ ] **Step 4: Write and run failing Logout tests**

Assert the Admin layout displays the active email and a `ออกจากระบบ` button. Clicking it must call `auth.signOut()`, navigate with replace to `/admin/login`, and make protected content disappear.

```powershell
npm run test:run -- src/app/router.test.tsx
```

Expected: FAIL because Logout is absent.

- [ ] **Step 5: Implement Logout in the shared layout**

Add an accessible button to `AdminLayout`. Disable it while sign out is pending; do not remove the existing return-to-FA link or mock-data banner.

- [ ] **Step 6: Verify Task 4**

```powershell
npm run test:run -- src/pages/admin/AdminDashboardPage.test.tsx src/app/router.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 4**

```powershell
git add src/pages/admin/AdminLoginPage.tsx src/layouts/AdminLayout.tsx src/pages/admin/AdminDashboardPage.test.tsx src/app/router.test.tsx
git commit -m "feat: add admin login and logout"
```

---

### Task 5: Invite Confirmation and Password Recovery

**Files:**
- Create: `src/pages/admin/AdminForgotPasswordPage.tsx`
- Create: `src/pages/admin/AdminAuthConfirmPage.tsx`
- Create: `src/pages/admin/AdminUpdatePasswordPage.tsx`
- Create: `src/pages/admin/AdminAuthFlow.test.tsx`
- Modify: `src/pages/admin/AdminLoginPage.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/services/auth/adminAuthContext.tsx`

**Interfaces:**
- Adds routes `/admin/forgot-password`, `/admin/auth/confirm`, and `/admin/update-password`.
- Forgot password always shows the same completion text after a completed Supabase request.
- Confirmation accepts only `token_hash` plus `type=invite|recovery` and never verifies on mount.
- A non-secret sessionStorage marker `admin:password-flow` may contain only `invite` or `recovery`; it is not authorization and is cleared after password update/logout.
- Password must be at least 12 characters and match its confirmation field.

- [ ] **Step 1: Write failing Forgot password tests**

Cover normalized email, pending state, and generic completion for both resolved and safe failure cases:

```text
หากอีเมลนี้มีสิทธิ์ผู้ดูแล ระบบจะส่งวิธีตั้งรหัสผ่านใหม่ให้ทางอีเมล
```

Assert the UI never displays whether the account exists.

- [ ] **Step 2: Write scanner-safety RED tests**

Render `/admin/auth/confirm?token_hash=test-token&type=invite` and assert `confirmEmailToken` has not been called. Click `ยืนยันดำเนินการ`, then assert:

```ts
expect(auth.confirmEmailToken).toHaveBeenCalledWith('test-token', 'invite')
```

Add cases for `recovery`, missing token, unknown type, expired/invalid token, and raw token not appearing in rendered errors.

- [ ] **Step 3: Write password-update RED tests**

Cover no flow marker, fewer than 12 characters, mismatch, pending state, successful update, and safe failure. On success assert the marker is cleared and active Admin goes to Dashboard.

- [ ] **Step 4: Run Auth-flow tests and verify RED**

```powershell
npm run test:run -- src/pages/admin/AdminAuthFlow.test.tsx
```

Expected: FAIL because the pages/routes do not exist.

- [ ] **Step 5: Implement the three pages and routes**

Use semantic forms, `aria-live` or `role="status"` for completion, `role="alert"` for user-correctable failures, and links back to Login. Build redirect URLs from `window.location.origin` plus `/admin/auth/confirm`; never accept an origin/path from query parameters.

Do not render `token_hash`, Supabase raw errors, or password contents. Clear password fields after completion/failure.

- [ ] **Step 6: Verify Task 5**

```powershell
npm run test:run -- src/pages/admin/AdminAuthFlow.test.tsx src/pages/admin/AdminDashboardPage.test.tsx src/app/router.test.tsx
npm run typecheck
npm run lint
npm run verify:environment
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit Task 5**

```powershell
git add src/pages/admin/AdminForgotPasswordPage.tsx src/pages/admin/AdminAuthConfirmPage.tsx src/pages/admin/AdminUpdatePasswordPage.tsx src/pages/admin/AdminAuthFlow.test.tsx src/pages/admin/AdminLoginPage.tsx src/app/router.tsx src/services/auth/adminAuthContext.tsx
git commit -m "feat: add admin password recovery"
```

---

### Task 6: Browser-Level Auth Contract Verification

**Files:**
- Create: `e2e/support/mockAdminAuth.ts`
- Create: `e2e/admin-auth.spec.ts`
- Modify: `e2e/admin-dashboard.spec.ts`
- Modify: `scripts/run-e2e.mjs`

**Interfaces:**
- Local E2E builds with a synthetic browser-safe Supabase URL/key supplied only to the Vite child process.
- Playwright intercepts the Supabase Auth/User/Profile HTTP contracts; production code contains no E2E flag, fake gateway, or sessionStorage authorization branch.
- The fixture returns an observer so every test proves which Auth and profile requests occurred.

- [ ] **Step 1: Make existing Admin E2E fail against the removed mock session**

Remove `sessionStorage.setItem('admin:mock-session', 'true')` from Admin E2E setup and run:

```powershell
npm run test:e2e -- e2e/admin-dashboard.spec.ts --project=desktop
```

Expected: FAIL at `/admin/login`, proving the old shortcut is gone.

- [ ] **Step 2: Add test-only browser-safe build environment**

When `run-e2e.mjs` spawns Vite build, extend only the child environment:

```js
env: {
  ...process.env,
  VITE_SUPABASE_URL: 'https://auth-e2e.invalid',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_e2e',
}
```

The script must continue to build current source before Preview and fail fast on build error.

- [ ] **Step 3: Implement the Playwright Supabase fixture**

`installAdminAuthFixture(page, scenario)` intercepts:

- `POST https://auth-e2e.invalid/auth/v1/token?grant_type=password`
- `GET https://auth-e2e.invalid/auth/v1/user`
- `GET https://auth-e2e.invalid/rest/v1/admin_profiles*`
- `POST https://auth-e2e.invalid/auth/v1/logout*`
- recovery and OTP verification calls used by the implemented client

Return structurally valid synthetic JWT/session/user/profile responses and record method/path only. Never use a real token, key, project URL, email message, or Staging request.

- [ ] **Step 4: Add login/guard/logout E2E**

Prove:

- anonymous navigation to `/admin/dashboard` redirects to Login without showing protected content.
- email/password Login calls the token endpoint, current-user endpoint, and active-profile query, then shows Dashboard.
- Logout calls the logout endpoint and returns to Login.
- missing/inactive profile never renders Dashboard.
- refresh with the intercepted persisted session restores access.

Every active flow must assert the exact observed requests; UI-only assertions are insufficient.

- [ ] **Step 5: Add recovery UI E2E without email delivery**

Prove Forgot password sends the configured redirect path and confirm page does not call OTP verification before `ยืนยันดำเนินการ`. Email delivery itself is reserved for live acceptance in Task 8.

- [ ] **Step 6: Verify Task 6**

```powershell
npm run test:e2e -- e2e/admin-auth.spec.ts e2e/admin-dashboard.spec.ts --project=desktop
npm run test:e2e
npm run typecheck
npm run lint
git diff --check
```

Expected: focused and full E2E pass after rebuilding current source; no request reaches a real Supabase project.

- [ ] **Step 7: Commit Task 6**

```powershell
git add e2e/support/mockAdminAuth.ts e2e/admin-auth.spec.ts e2e/admin-dashboard.spec.ts scripts/run-e2e.mjs
git commit -m "test: verify browser admin authentication"
```

---

### Task 7: Initial Admin Provisioning and Staging Runbook

**Files:**
- Create: `scripts/lib/initialAdminProvisioning.mjs`
- Create: `scripts/invite-initial-admin.mjs`
- Create: `scripts/invite-initial-admin.test.ts`
- Create: `supabase/templates/admin-invite.html`
- Create: `supabase/templates/admin-recovery.html`
- Create: `docs/part-3-auth-runbook.md`
- Modify: `scripts/verify-environment.mjs`
- Modify: `scripts/verify-environment.test.ts`
- Modify: `README.md`

**Interfaces:**
- Operator CLI supports `--capture-linked-staging`, `--dry-run`, and `--execute` modes.
- Target email is the constant `pichailakarm@gmail.com`; the CLI does not accept arbitrary email input in Part 3.
- The ignored local mapping records the confirmed linked Staging ref; execution refuses URL/ref mismatch or a missing confirmation.
- Provisioning is idempotent: absent user is invited once, existing user is not reinvited, and the active profile is upserted safely.
- Templates link to the approved scanner-safe confirm route using `TokenHash` and explicit `invite`/`recovery` types.

- [ ] **Step 1: Write failing pure provisioning tests**

Inject Auth Admin and database ports. Cover:

- dry-run performs zero mutation.
- absent user calls `inviteUserByEmail('pichailakarm@gmail.com', { redirectTo })` once then upserts `admin_profiles`.
- retry with existing user skips invitation and repairs/activates the profile.
- already-active user/profile is a no-op.
- URL/ref mismatch aborts before Auth or database calls.
- output excludes synthetic secret, token, invite link, password, user UUID, and project ref.

- [ ] **Step 2: Run provisioning tests and verify RED**

```powershell
npm run test:run -- scripts/invite-initial-admin.test.ts
```

Expected: FAIL because the provisioning modules do not exist.

- [ ] **Step 3: Implement the guarded operator CLI**

The executable imports `createClient` from the existing Supabase package, loads server values from the process environment, and reads `supabase/.temp/project-ref` plus the ignored `.supabase-projects.local.json` mapping. `--capture-linked-staging` stores the currently linked ref locally only after the operator has independently confirmed the project name.

`--execute` requires all of:

- linked ref equals captured Staging ref.
- `SUPABASE_URL` hostname ref equals the same value.
- `SUPABASE_SECRET_KEY` passes the existing server-env validation.
- redirect origin/path is present in a local environment value and ends with `/admin/auth/confirm`.
- explicit `--target staging` argument.

The command prints only `dry-run ready`, `invitation requested`, `profile activated`, or `already provisioned` plus a request correlation ID generated locally.

- [ ] **Step 4: Add scanner-safe checked-in templates**

Invite template link:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">ยืนยันคำเชิญผู้ดูแลระบบ</a>
```

Recovery template link:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">ตั้งรหัสผ่านใหม่</a>
```

Both templates explain that opening the page does not complete the action until the user presses the confirmation button. Do not include marketing tracking or external assets.

- [ ] **Step 5: Extend the environment verifier**

Add template/script scanning and tests that reject committed SMTP passwords, Confirmation URLs containing concrete token hashes, and arbitrary initial-admin email values. Permit only synthetic `test`/`local` secret fixtures already covered by the verifier.

- [ ] **Step 6: Write the operational runbook**

Document exact Staging-only checks for signup disabled, minimum password length 12, custom SMTP sender/settings, template application, Preview/localhost redirect allow-list, snapshot/rollback, operator dry-run/execute, user-assisted email confirmation, safe evidence, and Production prohibition. Do not put actual SMTP values, project ref, key, token, or invite URL in the document.

- [ ] **Step 7: Verify Task 7 locally**

```powershell
npm run test:run -- scripts/invite-initial-admin.test.ts scripts/verify-environment.test.ts
npm run verify:environment
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit 0; do not run `--capture-linked-staging` or `--execute` yet.

- [ ] **Step 8: Commit Task 7**

```powershell
git add scripts/lib/initialAdminProvisioning.mjs scripts/invite-initial-admin.mjs scripts/invite-initial-admin.test.ts supabase/templates/admin-invite.html supabase/templates/admin-recovery.html docs/part-3-auth-runbook.md scripts/verify-environment.mjs scripts/verify-environment.test.ts README.md
git commit -m "ops: add initial admin provisioning"
```

---

### Task 8: Full Verification, Staging Auth Rollout, and Preview Acceptance

**Files:**
- Create: `docs/part-3-verification.md`
- Modify: `docs/part-3-auth-runbook.md`
- Modify: `README.md`

**Interfaces:**
- Verification evidence contains commands, counts, deployment ID/URL, non-sensitive Auth outcomes, limitations, and rollback status.
- Evidence never contains SMTP credentials, key, token/hash, invite/reset URL, password, user UUID, project ref, cookie, or raw Auth response.
- Remote work occurs in three explicit gates: Staging configuration, initial invitation/profile activation, and Preview deployment.

- [ ] **Step 1: Run the complete local quality gate from a clean current build**

```powershell
npm run verify:environment
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: every command exits 0 and the worktree contains only the planned verification-document changes. Record exact Vitest/E2E counts and built asset sizes.

- [ ] **Step 2: Run an independent whole-task review**

Review the Part 3 commit range against the spec and this plan. Fix every Critical/Important finding using one scoped fix wave and one scoped re-review. Deferred Minor findings must be listed explicitly in the verification record.

- [ ] **Step 3: Request explicit approval for Staging Auth configuration**

Present the exact effects before mutation:

- snapshot existing Staging Auth Site URL, redirect allow-list, signup/password policy, SMTP metadata, and email templates without exposing credential values.
- disable public signup.
- require password length at least 12.
- set only the approved Preview and localhost callback URLs.
- set Custom SMTP and the two checked-in templates on Staging.
- leave Production untouched.

Wait for explicit approval. If approval is absent, stop with local implementation complete and do not configure Staging.

- [ ] **Step 4: Apply and verify Staging Auth configuration**

The user performs the configuration in the Supabase Staging Dashboard while following `docs/part-3-auth-runbook.md`; the agent does not request the SMTP password in chat or control a credential-entry screen. After the user confirms completion, read back only non-sensitive settings available through the authenticated Supabase tooling and verify signup disabled, password minimum 12, the scoped redirect allow-list, SMTP enabled state, and the two template content hashes. If any item cannot be read without exposing a credential, record it as user-verified rather than copying the value.

If the organization uses Microsoft Safe Links or email tracking, keep tracking disabled and retain the explicit confirmation button flow.

- [ ] **Step 5: Request explicit approval for invitation/profile mutation**

Show the operator dry-run result and state that execution will invite only `pichailakarm@gmail.com`, create/activate one Staging `admin_profiles` row, and create one redacted system audit record only when provisioning changes state. Wait for explicit approval.

- [ ] **Step 6: Provision the initial Admin and perform user-assisted acceptance**

After approval:

```powershell
node scripts/invite-initial-admin.mjs --capture-linked-staging --target staging
node --env-file=.env.local scripts/invite-initial-admin.mjs --target staging --dry-run
node --env-file=.env.local scripts/invite-initial-admin.mjs --target staging --execute
```

The user opens the received email, presses the in-app confirmation button, chooses a password of at least 12 characters, and confirms successful Login/Logout. Then request one real Forgot-password email and verify the same scanner-safe flow. Never ask the user to paste the password or email token into chat.

- [ ] **Step 7: Verify linked RLS in a read/rollback-safe test transaction**

After confirming the CLI is still linked to Staging and receiving approval for the linked test request:

```powershell
npx --no-install supabase migration list --linked
npx --no-install supabase test db --linked supabase/tests/database
```

Expected: migrations match the reviewed three-version history; pgTAP passes; no persistent test row remains. Verify active Admin reads permitted metadata while anonymous and an inactive characterization identity are denied. Do not modify Production or seed files.

- [ ] **Step 8: Request explicit approval and deploy Preview only**

Present the current commit range, quality-gate evidence, Staging Auth verification, and these effects: upload current source to existing `fa-meeting-workspace-trial`, reuse the existing Preview variables, and issue Auth/API requests to Staging. Wait for explicit approval; never use `--prod` or disable Deployment Protection.

- [ ] **Step 9: Verify the protected Preview flows**

After approval:

```powershell
$deployOutput = npx --no-install vercel deploy --yes
$deploymentUrl = [regex]::Match(($deployOutput | Out-String), 'https://[a-z0-9-]+\.vercel\.app').Value
if (-not $deploymentUrl) { throw 'Preview deployment URL was not returned.' }
npx --no-install vercel inspect $deploymentUrl
npx --no-install vercel curl /api/health --deployment $deploymentUrl -- --include
npx --no-install vercel curl /admin/login --deployment $deploymentUrl -- --include
```

Use the in-app browser only if no new software installation is required and the user is present for email/password actions. Verify:

- target is Preview and status Ready.
- `/api/health` and `/admin/login` return HTTP 200.
- unauthenticated `/admin/dashboard` redirects client-side to Login without protected-content flash.
- approved Admin can Login, reload, Logout, request recovery, confirm, and update password.
- missing/inactive profile is denied.
- Admin business pages still show the mock-data banner.
- browser bundle/network/log contains no server secret, SMTP credential, password, token/hash, or raw Auth error.

- [ ] **Step 10: Finalize evidence and commit Task 8**

Update verification/runbook/README with redacted observed evidence, then run:

```powershell
npm run verify:environment
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run test:e2e
git diff --check
git add docs/part-3-verification.md docs/part-3-auth-runbook.md README.md
git commit -m "docs: verify Part 3 admin authentication"
```

- [ ] **Step 11: Stop at the Part 4 approval gate**

Report that Supabase Admin Auth is real on Staging/Preview while Admin business data remains mock-backed. Request explicit approval before implementing FA access codes, HttpOnly FA sessions, real issue CRUD/autosave, offline queue, concurrency/Final, Admin real repository, Realtime, Presence, or additional Admin management.

---

## Plan Self-Review Record

- Spec coverage: Login, Logout, restore, active-profile authorization, Invite, Forgot password, scanner-safe confirmation, Update password, SMTP/templates, initial provisioning, RLS checks, rollback, and Preview acceptance map to Tasks 1–8.
- Scope boundary: no FA access code/session, issue mutation, autosave, offline queue, concurrency, Final, Realtime, Presence, export, additional Admin management, Production configuration, or Production deployment is included.
- Interface consistency: `AdminIdentity`, `EmailTokenType`, `AdminAuthGateway`, `AdminAuthState`, `AdminAuthProvider`, and `useAdminAuth` retain the same names and responsibilities across tasks.
- Auth security: browser receives only publishable configuration; authorization uses active profile under RLS; no `user_metadata`; raw Auth errors and all sensitive values stay out of UI/evidence.
- Test isolation: Vitest injects the gateway; Playwright intercepts the actual Supabase HTTP contract; production contains no E2E flag or mock session fallback.
- Remote safety: Staging configuration, invitation/profile activation, linked RLS tests, and Preview deployment each stop at a separate explicit approval gate; Production remains untouched.
- Current compatibility: Node 24 and TypeScript 6 satisfy current Supabase library floors; the 2026 self-hosted Auth URL change is not relevant to the hosted Staging project.
