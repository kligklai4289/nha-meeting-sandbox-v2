import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AdminAccessCodeService } from './adminAccessCodeService'
import type { Database } from './supabase/database.types'

const groupId = '10000000-0000-4000-8000-000000000001'

function authenticatedClient() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'valid-admin-token' } },
        error: null,
      }),
    },
  } as unknown as SupabaseClient<Database>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminAccessCodeService', () => {
  it('calls the default browser fetch with the global receiver', async () => {
    const globalFetch = vi.fn(function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      expect(this).toBe(globalThis)
      expect(input).toBe('/api/admin/access-codes')
      expect(init?.method).toBe('POST')
      return Promise.resolve(new Response(JSON.stringify({
        data: { groupId, rotatedAt: '2026-08-24T02:00:00.000Z', revokedSessions: 0 },
      }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }))
    })
    vi.stubGlobal('fetch', globalFetch)

    const result = await new AdminAccessCodeService(authenticatedClient()).rotate(groupId, '4826')

    expect(result).toEqual({
      groupId,
      rotatedAt: '2026-08-24T02:00:00.000Z',
      revokedSessions: 0,
    })
    expect(globalFetch).toHaveBeenCalledOnce()
  })
})
