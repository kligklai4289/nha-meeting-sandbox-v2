import { expect, test } from '@playwright/test'
import {
  type AdminAuthFixture,
  installAdminAuthFixture,
  observedPaths,
} from './support/mockAdminAuth'

function expectNoUnexpectedExternalRequests(auth: AdminAuthFixture) {
  expect(auth.unexpectedExternalRequests).toEqual([])
}

function validatedProtectedPaths(auth: AdminAuthFixture) {
  return auth.validatedProtectedRequests.map((request) => `${request.method} ${request.path}`)
}

function expectLiveAdminDataAfterAuthorization(auth: AdminAuthFixture, authorizationRequestCount: number) {
  const paths = observedPaths(auth)
  const dataPaths = paths.slice(authorizationRequestCount)
  expect(dataPaths[0]).toMatch(/^GET \/rest\/v1\/meetings\?/)
  expect(dataPaths[1]).toMatch(/^GET \/rest\/v1\/meeting_groups\?/)
  expect(dataPaths.filter((path) => path.startsWith('GET /rest/v1/issues?'))).toHaveLength(3)
  expect(validatedProtectedPaths(auth)).toEqual(
    paths.filter((path) => path !== 'POST /auth/v1/token?grant_type=password'),
  )
}

async function seedPersistedSession(
  page: Parameters<typeof installAdminAuthFixture>[0],
  session: Awaited<ReturnType<typeof installAdminAuthFixture>>['persistedSession'],
) {
  await page.addInitScript((savedSession) => {
    localStorage.setItem('sb-auth-e2e-auth-token', JSON.stringify(savedSession))
  }, session)
}

test('anonymous dashboard navigation redirects without rendering protected content', async ({ page }) => {
  const auth = await installAdminAuthFixture(page)

  await page.goto('/admin/dashboard')

  expect(auth.validatedProtectedRequests).toEqual([])
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).not.toBeVisible()
  expect(observedPaths(auth)).toEqual([])
  expectNoUnexpectedExternalRequests(auth)
})

test('fixture blocks browser requests outside the local E2E allow-list', async ({ page }) => {
  const auth = await installAdminAuthFixture(page)
  await page.goto('/admin/login')

  await page.evaluate(async () => {
    try {
      await fetch('https://outside-e2e.invalid/blocked-path?ignored=query')
    } catch {
      // The fixture deliberately aborts unapproved browser requests.
    }
  })

  expect(observedPaths(auth)).toEqual([])
  expect(auth.unexpectedExternalRequests).toEqual([{ method: 'GET', path: '/blocked-path' }])
})

test('fixture rejects protected and public requests without the synthetic apikey', async ({ page }) => {
  const auth = await installAdminAuthFixture(page, { initialSession: true })
  await page.goto('/admin/login')
  auth.clearRequests()

  const statuses = await page.evaluate(async () => {
    try {
      const protectedStatus = (await fetch('https://auth-e2e.invalid/auth/v1/user')).status
      const publicStatus = (await fetch('https://auth-e2e.invalid/auth/v1/recover', { method: 'POST' })).status
      return [protectedStatus, publicStatus]
    } catch {
      return [0, 0]
    }
  })

  expect(statuses).toEqual([401, 401])
  expect(observedPaths(auth)).toEqual(['GET /auth/v1/user', 'POST /auth/v1/recover'])
  expect(auth.validatedProtectedRequests).toEqual([])
  expectNoUnexpectedExternalRequests(auth)
})

test('active login queries auth and profile before rendering the dashboard', async ({ page }) => {
  const auth = await installAdminAuthFixture(page)
  await page.goto('/admin/login')
  auth.clearRequests()

  await page.getByLabel('อีเมล').fill('ADMIN@EXAMPLE.TEST')
  await page.getByLabel('รหัสผ่าน').fill('correct-password')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()

  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
  expect(observedPaths(auth).slice(0, 5)).toEqual([
    'POST /auth/v1/token?grant_type=password',
    'GET /auth/v1/user',
    'GET /auth/v1/user',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
  ])
  expectLiveAdminDataAfterAuthorization(auth, 5)
  expectNoUnexpectedExternalRequests(auth)
})

test('an inactive profile is signed out and denied before dashboard renders', async ({ page }) => {
  const auth = await installAdminAuthFixture(page, { initialSession: true, profile: 'inactive' })
  await seedPersistedSession(page, auth.persistedSession)

  await page.goto('/admin/dashboard')

  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).not.toBeVisible()
  expect(observedPaths(auth)).toEqual([
    'GET /auth/v1/user',
    'GET /auth/v1/user',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'POST /auth/v1/logout?scope=global',
  ])
  expect(validatedProtectedPaths(auth)).toEqual([
    'GET /auth/v1/user',
    'GET /auth/v1/user',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'POST /auth/v1/logout?scope=global',
  ])
  expectNoUnexpectedExternalRequests(auth)
})

test('a missing profile is signed out and denied before dashboard renders', async ({ page }) => {
  const auth = await installAdminAuthFixture(page, { initialSession: true, profile: 'missing' })
  await seedPersistedSession(page, auth.persistedSession)

  await page.goto('/admin/dashboard')

  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).not.toBeVisible()
  expect(observedPaths(auth)).toEqual([
    'GET /auth/v1/user',
    'GET /auth/v1/user',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'POST /auth/v1/logout?scope=global',
  ])
  expect(validatedProtectedPaths(auth)).toEqual([
    'GET /auth/v1/user',
    'GET /auth/v1/user',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'POST /auth/v1/logout?scope=global',
  ])
  expectNoUnexpectedExternalRequests(auth)
})

test('a persisted session with a wrong bearer cannot restore dashboard access', async ({ page }) => {
  const auth = await installAdminAuthFixture(page, { initialSession: true })
  await seedPersistedSession(page, { ...auth.persistedSession, access_token: 'wrong-e2e-bearer' })

  await page.goto('/admin/dashboard')

  expect(auth.validatedProtectedRequests).toEqual([])
  await expect(page.getByRole('alert', { name: 'ไม่สามารถตรวจสอบสิทธิ์ผู้ดูแลได้' })).toBeVisible()
  expect(observedPaths(auth)).toEqual([
    'GET /auth/v1/user',
    'GET /auth/v1/user',
  ])
  expectNoUnexpectedExternalRequests(auth)
})

test('a persisted active session restores dashboard access after reload', async ({ page }) => {
  const auth = await installAdminAuthFixture(page, { initialSession: true })
  await seedPersistedSession(page, auth.persistedSession)

  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
  auth.clearRequests()

  await page.reload()

  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
  expect(observedPaths(auth).slice(0, 4)).toEqual([
    'GET /auth/v1/user',
    'GET /auth/v1/user',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
  ])
  expectLiveAdminDataAfterAuthorization(auth, 4)
  expectNoUnexpectedExternalRequests(auth)
})

test('logout posts to Supabase and returns to login', async ({ page }) => {
  const auth = await installAdminAuthFixture(page, { initialSession: true })
  await seedPersistedSession(page, auth.persistedSession)
  await page.goto('/admin/dashboard')
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
  auth.clearRequests()

  await page.getByRole('button', { name: 'ออกจากระบบ' }).click()

  await expect(page).toHaveURL(/\/admin\/login$/)
  expect(observedPaths(auth)).toEqual(['POST /auth/v1/logout?scope=global'])
  expect(validatedProtectedPaths(auth)).toEqual(['POST /auth/v1/logout?scope=global'])
  expectNoUnexpectedExternalRequests(auth)
})

test('forgot password posts the configured confirm redirect and keeps a generic result', async ({ page }) => {
  const auth = await installAdminAuthFixture(page)
  await page.goto('/admin/forgot-password')
  auth.clearRequests()

  await page.getByLabel('อีเมล').fill('ADMIN@EXAMPLE.TEST')
  await page.getByRole('button', { name: 'ส่งวิธีตั้งรหัสผ่านใหม่' }).click()

  await expect(page.getByRole('status')).toContainText('หากอีเมลนี้มีสิทธิ์ผู้ดูแล')
  expect(observedPaths(auth)).toEqual([
    'POST /auth/v1/recover?redirect_to=http%3A%2F%2F127.0.0.1%3A4173%2Fadmin%2Fauth%2Fconfirm',
  ])
  expect(validatedProtectedPaths(auth)).toEqual([])
  expect(auth.recoveryRedirects).toEqual(['http://127.0.0.1:4173/admin/auth/confirm'])
  expectNoUnexpectedExternalRequests(auth)
})

test('confirm waits for an explicit click before verifying then updates the password', async ({ page }) => {
  const auth = await installAdminAuthFixture(page)
  await page.goto('/admin/auth/confirm?token_hash=e2e-token&type=recovery')

  await expect(page.getByRole('heading', { name: 'ยืนยันการดำเนินการ' })).toBeVisible()
  expect(observedPaths(auth)).toEqual([])
  expectNoUnexpectedExternalRequests(auth)

  await page.getByRole('button', { name: 'ยืนยันดำเนินการ' }).click()
  await expect(page.getByRole('heading', { name: 'ตั้งรหัสผ่านใหม่' })).toBeVisible()
  expect(observedPaths(auth)).toEqual([
    'POST /auth/v1/verify',
    'GET /auth/v1/user',
  ])
  expect(validatedProtectedPaths(auth)).toEqual(['GET /auth/v1/user'])
  expectNoUnexpectedExternalRequests(auth)
  auth.clearRequests()

  await page.getByLabel('รหัสผ่านใหม่', { exact: true }).fill('a-safe-password')
  await page.getByLabel('ยืนยันรหัสผ่านใหม่').fill('a-safe-password')
  await page.getByRole('button', { name: 'บันทึกรหัสผ่านใหม่' }).click()

  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
  expect(observedPaths(auth).slice(0, 3)).toEqual([
    'PUT /auth/v1/user',
    'GET /auth/v1/user',
    'GET /rest/v1/admin_profiles?select=user_id%2Cdisplay_name%2Crole%2Cis_active&user_id=eq.e2e-user-001&is_active=eq.true',
  ])
  expectLiveAdminDataAfterAuthorization(auth, 3)
  expectNoUnexpectedExternalRequests(auth)
})
