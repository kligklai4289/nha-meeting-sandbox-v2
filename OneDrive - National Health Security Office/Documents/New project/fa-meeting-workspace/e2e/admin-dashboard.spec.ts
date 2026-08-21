import { expect, test } from '@playwright/test'

test('mock Admin login reaches all three groups and opens group detail', async ({ page }) => {
  await page.goto('/admin/login')
  await expect(page.getByText('โหมดตัวอย่าง — ยังไม่เชื่อม Supabase Auth')).toBeVisible()
  await page.getByLabel('อีเมล').fill('admin@example.org')
  await page.getByLabel('รหัสผ่าน').fill('demo')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
  const openLinks = page.getByRole('link', { name: 'เปิดดู' })
  await expect(openLinks).toHaveCount(3)
  await openLinks.nth(1).click()
  await expect(page.getByRole('heading', { name: /กลุ่ม 2 กองทุนท้องถิ่น/ })).toBeVisible()
})

test('Admin table stays inside the document width', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('admin:mock-session', 'true'))
  await page.goto('/admin/dashboard')
  await expect(page.getByRole('columnheader', { name: 'จัดการ' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})
