import { afterEach, describe, expect, it, vi } from 'vitest'
import health from '../health.js'

const serverEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test-value',
  FA_SESSION_SIGNING_SECRET: 'a'.repeat(32),
  FA_CODE_PEPPER: 'b'.repeat(32),
}

function configureServerEnv() {
  for (const [name, value] of Object.entries(serverEnv)) {
    vi.stubEnv(name, value)
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/health', () => {
  it('returns a no-store configured response with the request ID', async () => {
    configureServerEnv()

    const response = await health.fetch(new Request('https://example.test/api/health', {
      headers: { 'x-request-id': 'test-request-id' },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('x-request-id')).toBe('test-request-id')
    expect(await response.json()).toEqual({
      status: 'ok',
      environment: 'configured',
      requestId: 'test-request-id',
    })
  })

  it('returns a safe 503 response without exposing supplied secrets', async () => {
    configureServerEnv()
    vi.stubEnv('FA_CODE_PEPPER', '')

    const response = await health.fetch(new Request('https://example.test/api/health', {
      headers: { 'x-request-id': 'test-request-id' },
    }))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({
      status: 'error',
      code: 'SERVER_NOT_CONFIGURED',
      requestId: 'test-request-id',
    })
    expect(JSON.stringify(body)).not.toContain(serverEnv.SUPABASE_SECRET_KEY)
    expect(JSON.stringify(body)).not.toContain(serverEnv.FA_SESSION_SIGNING_SECRET)
  })

  it('rejects non-GET methods before processing the health check', async () => {
    configureServerEnv()

    const response = await health.fetch(new Request('https://example.test/api/health', {
      method: 'POST',
      headers: { 'x-request-id': 'test-request-id' },
    }))

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET')
    expect(await response.json()).toEqual({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      requestId: 'test-request-id',
    })
  })
})
