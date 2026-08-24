import { expect, test } from '@playwright/test'
import { installMeetingDirectoryFixture } from './support/mockMeetingDirectory'
import { installFaApiFixture } from './support/mockFaApi'

const expectedMeetingDirectoryRequest = {
  method: 'GET',
  url: 'http://127.0.0.1:4173/api/public/active-meeting',
}

async function enterGroupOne(page: Parameters<typeof installFaApiFixture>[0]) {
  await page.getByRole('button', { name: /เลือกกลุ่ม 1/ }).click()
  await page.locator('#group-access-code').fill('35b15503')
  const sessionRequest = page.waitForRequest((request) => request.url().includes('/api/fa/'))
  await page.getByRole('button', { name: 'เข้าสู่ Workspace' }).click()
  const request = await sessionRequest
  expect(new URL(request.url()).pathname).toBe('/api/fa/session')
}

test('FA exchanges a group code and reaches a writable session workspace', async ({ page }) => {
  const meetingDirectory = await installMeetingDirectoryFixture(page)
  const faApi = await installFaApiFixture(page)
  await page.goto('/fa')
  await enterGroupOne(page)
  await expect(page).toHaveURL(/\/fa\/workspace$/)
  await expect(page.getByLabel('ประเด็น', { exact: true }).first()).toBeEditable()
  await expect(page.getByRole('tab', { name: 'กลุ่ม 2' })).toHaveCount(0)
  expect(meetingDirectory.requests).toEqual([expectedMeetingDirectoryRequest])
  expect(faApi.requests.map((request) => request.path)).toContain('/api/fa/session')
  expect(faApi.requests.map((request) => request.path)).toContain('/api/fa/bootstrap')
  expect(await page.evaluate(() => localStorage.getItem('fa-access-code'))).toBeNull()
})

test('workspace has no horizontal document overflow', async ({ page }) => {
  const meetingDirectory = await installMeetingDirectoryFixture(page)
  await installFaApiFixture(page)
  await page.goto('/fa')
  await enterGroupOne(page)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
  expect(meetingDirectory.requests).toEqual([expectedMeetingDirectoryRequest])
})

test('tablet and mobile stack issue detail fields in one column', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop')
  const meetingDirectory = await installMeetingDirectoryFixture(page)
  await installFaApiFixture(page)
  await page.goto('/fa')
  await enterGroupOne(page)
  const findings = await page.getByLabel('ข้อค้นพบ / ปัญหา / ข้อจำกัด').first().boundingBox()
  const proposal = await page.getByLabel('ข้อเสนอ').first().boundingBox()
  expect(findings).not.toBeNull()
  expect(proposal).not.toBeNull()
  expect(Math.abs((findings?.x ?? 0) - (proposal?.x ?? 0))).toBeLessThan(2)
  expect(proposal?.y ?? 0).toBeGreaterThan((findings?.y ?? 0) + (findings?.height ?? 0))
  expect(meetingDirectory.requests).toEqual([expectedMeetingDirectoryRequest])
})

test('FA edits are autosaved through the live mutation contract', async ({ page }) => {
  await installMeetingDirectoryFixture(page)
  const faApi = await installFaApiFixture(page)
  await page.goto('/fa')
  await enterGroupOne(page)

  await page.getByLabel('ประเด็น', { exact: true }).first().fill('ประเด็นที่แก้ไขแล้ว')
  await expect.poll(() => faApi.requests.filter((request) => request.path === '/api/fa/issues').length, { timeout: 5_000 }).toBe(1)
  await expect(page.getByText(/บันทึกแล้ว/)).toBeVisible()
})
