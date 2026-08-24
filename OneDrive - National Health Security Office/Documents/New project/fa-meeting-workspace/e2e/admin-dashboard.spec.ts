import { expect, test } from '@playwright/test'
import { installAdminAuthFixture, observedPaths } from './support/mockAdminAuth'

test('Admin login reaches all three groups and opens group detail', async ({ page }) => {
  const auth = await installAdminAuthFixture(page)
  await page.goto('/admin/login')
  auth.clearRequests()
  await page.getByLabel('อีเมล').fill('admin@example.test')
  await page.getByLabel('รหัสผ่าน').fill('correct-password')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
  const openLinks = page.getByRole('link', { name: 'เปิดดู' })
  await expect(openLinks).toHaveCount(3)
  await openLinks.nth(1).click()
  await expect(page.getByRole('heading', { name: /กลุ่ม 2 กองทุนท้องถิ่น/ })).toBeVisible()
  expect(observedPaths(auth)).toEqual(expect.arrayContaining([
    'POST /auth/v1/token?grant_type=password',
    'GET /auth/v1/user',
  ]))
  expect(auth.validatedProtectedRequests.some(({ path }) => path.startsWith('/rest/v1/meetings?'))).toBe(true)
  expect(auth.validatedProtectedRequests.some(({ path }) => path.startsWith('/rest/v1/meeting_groups?'))).toBe(true)
  expect(auth.validatedProtectedRequests.some(({ path }) => path.startsWith('/rest/v1/issues?'))).toBe(true)
  expect(auth.unexpectedExternalRequests).toEqual([])
})

test('Admin table stays inside the document width', async ({ page }) => {
  const auth = await installAdminAuthFixture(page, { initialSession: true })
  await page.addInitScript((session) => {
    localStorage.setItem('sb-auth-e2e-auth-token', JSON.stringify(session))
  }, auth.persistedSession)
  await page.goto('/admin/dashboard')
  await expect(page.getByRole('columnheader', { name: 'จัดการ' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
  expect(observedPaths(auth)).toEqual(expect.arrayContaining([
    'GET /auth/v1/user',
  ]))
  expect(auth.validatedProtectedRequests.some(({ path }) => path.startsWith('/rest/v1/meetings?'))).toBe(true)
  expect(auth.unexpectedExternalRequests).toEqual([])
})
