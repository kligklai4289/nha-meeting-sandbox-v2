import type { Page, Route } from '@playwright/test'
import { createMockSeed } from '../../src/services/mockSeed'

const authOrigin = 'https://auth-e2e.invalid'
const publishableKey = 'sb_publishable_test_e2e'
const accessToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJlMmUtdXNlci0wMDEiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUudGVzdCIsImV4cCI6NDEwMjQ0NDgwMH0.e2e'

const user = {
  id: 'e2e-user-001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'admin@example.test',
  email_confirmed_at: '2026-08-22T00:00:00.000Z',
  confirmed_at: '2026-08-22T00:00:00.000Z',
  last_sign_in_at: '2026-08-22T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2026-08-22T00:00:00.000Z',
  updated_at: '2026-08-22T00:00:00.000Z',
  is_anonymous: false,
}

const session = {
  access_token: accessToken,
  refresh_token: 'e2e-refresh-token',
  token_type: 'bearer',
  expires_in: 3_600,
  expires_at: 4_102_444_800,
  user,
}

const seed = createMockSeed()
const meetingRow = {
  id: seed.meeting.id,
  title: seed.meeting.title,
  fiscal_year: Number(seed.meeting.fiscalYear),
  meeting_date: seed.meeting.meetingDate,
  starts_at: seed.meeting.startTime,
  ends_at: seed.meeting.endTime,
  location: seed.meeting.location,
  status: 'active',
  row_version: 1,
  created_at: seed.meeting.createdAt,
  updated_at: seed.meeting.updatedAt,
}
const groupRows = seed.groups.map((group) => ({
  id: group.id,
  meeting_id: group.meetingId,
  group_no: group.groupNo,
  name: group.groupName,
  scope: group.groupDescription,
  presenter: group.presenter,
  status: group.status,
  row_version: group.rowVersion,
  finalized_at: group.finalizedAt,
  created_at: group.createdAt,
  updated_at: group.updatedAt,
}))
const issueRows = seed.issues.map((issue) => ({
  id: issue.id,
  meeting_id: seed.meeting.id,
  group_id: issue.groupId,
  position: issue.sortOrder - 1,
  topic: issue.topic,
  findings: issue.findings,
  proposal: issue.proposal,
  action_plan: issue.actionPlan,
  evaluation: issue.monitoring,
  stakeholder_roles: issue.stakeholderRoles,
  row_version: issue.rowVersion,
  deleted_at: null,
  created_at: issue.createdAt,
  updated_at: issue.updatedAt,
}))

export type AdminAuthScenario = {
  initialSession?: boolean
  profile?: 'active' | 'inactive' | 'missing'
}

type ObservedRequest = {
  method: string
  path: string
}

export type AdminAuthFixture = {
  requests: ObservedRequest[]
  validatedProtectedRequests: ObservedRequest[]
  unexpectedExternalRequests: ObservedRequest[]
  recoveryRedirects: string[]
  persistedSession: typeof session
  clearRequests(): void
}

function profileFor(scenario: AdminAuthScenario) {
  if (scenario.profile === 'inactive' || scenario.profile === 'missing') return []

  return [{
    user_id: user.id,
    display_name: 'E2E Administrator',
    role: 'admin',
    is_active: true,
  }]
}

function unauthorized(route: Route) {
  return route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Auth session missing!' }),
  })
}

function hasExpectedPublishableKey(route: Route) {
  return route.request().headers().apikey === publishableKey
}

function hasExpectedSessionBearer(route: Route) {
  return route.request().headers().authorization === `Bearer ${accessToken}`
}

function isAllowedApplicationOrigin(url: URL) {
  return url.origin === 'http://127.0.0.1:4173'
}

export async function installAdminAuthFixture(
  page: Page,
  scenario: AdminAuthScenario = {},
): Promise<AdminAuthFixture> {
  const requests: ObservedRequest[] = []
  const validatedProtectedRequests: ObservedRequest[] = []
  const unexpectedExternalRequests: ObservedRequest[] = []
  const recoveryRedirects: string[] = []
  let authenticated = Boolean(scenario.initialSession)

  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (isAllowedApplicationOrigin(url)) {
      await route.continue()
      return
    }
    if (url.origin === authOrigin) {
      await route.fallback()
      return
    }
    unexpectedExternalRequests.push({ method: request.method(), path: url.pathname })
    await route.abort('blockedbyclient')
  })

  await page.route(`${authOrigin}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = `${url.pathname}${url.search}`
    requests.push({ method: request.method(), path })

    if (request.method() === 'POST' && path === '/auth/v1/token?grant_type=password') {
      if (!hasExpectedPublishableKey(route)) {
        await unauthorized(route)
        return
      }
      authenticated = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) })
      return
    }

    if (request.method() === 'GET' && path === '/auth/v1/user') {
      if (!authenticated || !hasExpectedPublishableKey(route) || !hasExpectedSessionBearer(route)) {
        await unauthorized(route)
        return
      }
      validatedProtectedRequests.push({ method: request.method(), path })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
      return
    }

    if (request.method() === 'GET' && url.pathname === '/rest/v1/admin_profiles') {
      if (!authenticated || !hasExpectedPublishableKey(route) || !hasExpectedSessionBearer(route)) {
        await unauthorized(route)
        return
      }
      validatedProtectedRequests.push({ method: request.method(), path })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profileFor(scenario)) })
      return
    }

    if (request.method() === 'GET' && url.pathname.startsWith('/rest/v1/')) {
      if (!authenticated || !hasExpectedPublishableKey(route) || !hasExpectedSessionBearer(route)) {
        await unauthorized(route)
        return
      }
      validatedProtectedRequests.push({ method: request.method(), path })
      if (url.pathname === '/rest/v1/meetings') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(meetingRow) })
        return
      }
      if (url.pathname === '/rest/v1/meeting_groups') {
        const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '')
        const body = idFilter ? groupRows.find((group) => group.id === idFilter) ?? null : groupRows
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
        return
      }
      if (url.pathname === '/rest/v1/issues') {
        const groupId = url.searchParams.get('group_id')?.replace(/^eq\./, '')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(issueRows.filter((issue) => !groupId || issue.group_id === groupId)),
        })
        return
      }
    }

    if (request.method() === 'POST' && url.pathname === '/auth/v1/logout') {
      if (!authenticated || !hasExpectedPublishableKey(route) || !hasExpectedSessionBearer(route)) {
        await unauthorized(route)
        return
      }
      validatedProtectedRequests.push({ method: request.method(), path })
      authenticated = false
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      return
    }

    if (request.method() === 'POST' && url.pathname === '/auth/v1/recover') {
      if (!hasExpectedPublishableKey(route)) {
        await unauthorized(route)
        return
      }
      recoveryRedirects.push(url.searchParams.get('redirect_to') ?? '')
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      return
    }

    if (request.method() === 'POST' && url.pathname === '/auth/v1/verify') {
      if (!hasExpectedPublishableKey(route)) {
        await unauthorized(route)
        return
      }
      authenticated = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) })
      return
    }

    if (request.method() === 'PUT' && url.pathname === '/auth/v1/user') {
      if (!authenticated || !hasExpectedPublishableKey(route) || !hasExpectedSessionBearer(route)) {
        await unauthorized(route)
        return
      }
      validatedProtectedRequests.push({ method: request.method(), path })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
      return
    }

    await route.abort('failed')
  })

  return {
    requests,
    validatedProtectedRequests,
    unexpectedExternalRequests,
    recoveryRedirects,
    persistedSession: session,
    clearRequests() {
      requests.length = 0
      validatedProtectedRequests.length = 0
    },
  }
}

export function observedPaths(fixture: AdminAuthFixture): string[] {
  return fixture.requests.map((request) => `${request.method} ${request.path}`)
}
