import type { Page } from '@playwright/test'
import { e2eGroups, e2eMeeting } from './mockMeetingDirectory'

interface ObservedRequest {
  method: string
  path: string
  body?: Record<string, unknown>
}

export async function installFaApiFixture(page: Page) {
  const requests: ObservedRequest[] = []
  const createdAt = '2026-08-20T02:00:00.000Z'
  const issue = {
    id: '20000000-0000-4000-8000-000000000001',
    groupId: e2eGroups[0].id,
    sortOrder: 1,
    topic: 'ประเด็นทดสอบ',
    findings: 'ข้อค้นพบทดสอบ',
    proposal: 'ข้อเสนอทดสอบ',
    actionPlan: '',
    monitoring: '',
    stakeholderRoles: '',
    rowVersion: 1,
    createdAt,
    updatedAt: createdAt,
  }

  await page.route('**/api/fa/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const rawBody = request.postData()
    const body = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : null
    requests.push({ method: request.method(), path: url.pathname, ...(body ? { body } : {}) })

    if (url.pathname === '/api/fa/session' && request.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { meetingId: e2eMeeting.id, groupId: e2eGroups[0].id, expiresAt: '2026-08-27T13:00:00.000Z' },
          requestId: 'e2e-fa-session',
        }),
      })
    }
    if (url.pathname === '/api/fa/bootstrap' && request.method() === 'GET') {
      const { groups: _groups, ...meeting } = e2eMeeting
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { meeting, group: e2eGroups[0], issues: [issue] }, requestId: 'e2e-fa-bootstrap' }),
      })
    }
    if (url.pathname === '/api/fa/issues' && (request.method() === 'PATCH' || request.method() === 'POST')) {
      const saved = {
        ...issue,
        ...body,
        id: body?.issueId,
        groupId: issue.groupId,
        sortOrder: Number(body?.position) + 1,
        rowVersion: Number(body?.expectedRowVersion) + 1,
        createdAt,
        updatedAt: '2026-08-20T02:01:00.000Z',
      }
      delete (saved as Record<string, unknown>).mutationId
      delete (saved as Record<string, unknown>).issueId
      delete (saved as Record<string, unknown>).expectedRowVersion
      delete (saved as Record<string, unknown>).position
      return route.fulfill({
        status: request.method() === 'POST' ? 201 : 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: saved, replayed: false, requestId: 'e2e-fa-save' }),
      })
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'UNHANDLED_E2E_ROUTE' }) })
  })

  return { requests }
}
