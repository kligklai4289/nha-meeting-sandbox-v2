import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'

export type RotatedAccessCode = {
  groupId: string
  rotatedAt: string
  revokedSessions: number
}

export class AdminAccessCodeError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class AdminAccessCodeService {
  private readonly client: SupabaseClient<Database>
  private readonly fetcher: Fetcher

  constructor(
    client: SupabaseClient<Database>,
    fetcher: Fetcher = (input, init) => globalThis.fetch(input, init),
  ) {
    this.client = client
    this.fetcher = fetcher
  }

  async rotate(groupId: string, accessCode: string): Promise<RotatedAccessCode> {
    const { data, error } = await this.client.auth.getSession()
    if (error || !data.session?.access_token) throw new Error('ADMIN_UNAUTHENTICATED')
    const response = await this.fetcher('/api/admin/access-codes', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${data.session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ groupId, accessCode }),
    })
    const body = await response.json() as { data?: RotatedAccessCode; code?: string }
    if (!response.ok) throw new AdminAccessCodeError(body.code ?? 'ACCESS_CODE_ROTATION_FAILED')
    if (!body.data || body.data.groupId !== groupId) throw new Error('ACCESS_CODE_ROTATION_FAILED')
    return body.data
  }
}
