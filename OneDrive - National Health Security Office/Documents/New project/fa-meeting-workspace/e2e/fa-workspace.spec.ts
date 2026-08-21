import { expect, test } from '@playwright/test'

test('FA reaches a writable issue within two clicks', async ({ page }) => {
  await page.goto('/fa')
  await page.getByRole('button', { name: /เลือกกลุ่ม 1/ }).click()
  await expect(page).toHaveURL(/\/fa\/workspace$/)
  await expect(page.getByLabel('ประเด็น', { exact: true }).first()).toBeEditable()
  await expect(page.getByRole('tab', { name: 'กลุ่ม 2' })).toHaveCount(0)
})

test('workspace has no horizontal document overflow', async ({ page }) => {
  await page.goto('/fa')
  await page.getByRole('button', { name: /เลือกกลุ่ม 1/ }).click()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('tablet and mobile stack issue detail fields in one column', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop')
  await page.goto('/fa')
  await page.getByRole('button', { name: /เลือกกลุ่ม 1/ }).click()
  const findings = await page.getByLabel('ข้อค้นพบ / ปัญหา / ข้อจำกัด').first().boundingBox()
  const proposal = await page.getByLabel('ข้อเสนอ').first().boundingBox()
  expect(findings).not.toBeNull()
  expect(proposal).not.toBeNull()
  expect(Math.abs((findings?.x ?? 0) - (proposal?.x ?? 0))).toBeLessThan(2)
  expect(proposal?.y ?? 0).toBeGreaterThan((findings?.y ?? 0) + (findings?.height ?? 0))
})
