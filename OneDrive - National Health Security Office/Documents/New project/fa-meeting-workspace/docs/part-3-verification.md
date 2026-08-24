# Part 3 Admin Auth — Local Verification Record

Date: 22 August 2026 (Asia/Bangkok)  
Status: archived Part 3 local record. For current remote/deployment status, use `HANDOFF.md` and `TODO.md`.

## Scope and safety boundary

This record covers local commands only. No local linked-project capture, Staging Auth/SMTP/template configuration, invitation/profile mutation, linked migration/RLS transaction, Preview deployment/live request, or Production action was performed. The Admin business-data experience remains mock-backed until Part 4.

## Fresh local quality gate

| Command | Exit code | Observed result |
| --- | ---: | --- |
| `npm run verify:environment` | 0 | Environment verification passed. |
| `npm run typecheck` | 0 | TypeScript project build completed without diagnostics. |
| `npm run lint` | 0 | Oxlint completed without diagnostics. |
| `npm run test:run` | 0 | 31 test files passed; 251 tests passed; duration 61.13 s. |
| `npm run build` | 0 | Vite production build completed through the mandatory synthetic-canary/post-build safety scan. |
| `npm run test:e2e` | 0 | Playwright selected 48 tests: 47 passed, 1 skipped; duration 26.2 s. |
| `git diff --check` | 0 | No whitespace errors. |
| `git status --short` | 0 | Only the expected Part 3 code/config/tests and the three Task 8 documentation files were present. |

The browser suite ran the same canary-scanned production build before starting its local Vite server at `127.0.0.1:4173`, plus the synthetic `auth-e2e.invalid` fixture origin. Its catch-all route aborts every other external browser request; the suite includes a passing assertion for that denial behavior. No real Supabase project, SMTP service, or deployment endpoint was contacted.

## Production-build assets

The `npm run build` gate emitted the following files (uncompressed bytes):

| Asset | Bytes |
| --- | ---: |
| `dist/index.html` | 540 |
| `dist/favicon.svg` | 9,522 |
| `dist/icons.svg` | 5,031 |
| `dist/assets/index-LKPj2_wx.css` | 28,614 |
| `dist/assets/index-B7jUqxsL.js` | 635,955 |

## Deferred minor items

- The production JavaScript bundle exceeds Vite's 500 kB advisory chunk threshold. This is a non-blocking performance follow-up; it did not prevent the local build or E2E suite.
- The local Playwright workers emit a `NO_COLOR`/`FORCE_COLOR` environment warning. It is test-runner output only and did not affect results.
- Git may warn that LF files will be normalized to CRLF in this Windows worktree. Treat this as an accepted deferred repository normalization item; review `git diff --check` and content diffs before commit so line-ending conversion never hides substantive changes.

## Approval gates — not performed

1. **Local linked-project capture:** pending explicit approval. No linked-ref capture, ignored mapping write, or dry-run occurred.
2. **Staging Auth configuration:** pending explicit approval. No Staging snapshot, Site URL origin, exact `/admin/auth/confirm` Redirect URL, SMTP, or template read/write occurred.
3. **Initial Admin invitation/profile mutation:** pending explicit approval. No operator execution, Auth invitation, profile activation, or audit mutation occurred.
4. **Linked migration/RLS transaction:** pending explicit approval. No linked migration-list request, linked pgTAP/RLS transaction, CLI remote call, or database mutation occurred.
5. **Preview deployment/live acceptance:** pending explicit approval. No deployment, Preview inspection, or remote HTTP request occurred. Acceptance must separately confirm `Cache-Control: no-store` and the SPA shell on `/admin/login`, `/admin/forgot-password`, `/admin/auth/confirm`, and `/admin/update-password`.

These five approvals are independent and may not be combined. For Gate 2, Site URL is an approved origin while Supabase Redirect URLs are exact full URLs ending `/admin/auth/confirm`; `INITIAL_ADMIN_REDIRECT_ORIGINS` remains an origin-only local operator guard, not a Dashboard Redirect URL list.

Production remains untouched. Rollback has not been needed because no remote state changed.
