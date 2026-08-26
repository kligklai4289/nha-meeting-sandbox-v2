import { describe, expect, it } from 'vitest'
import { parseServerEnv } from './serverEnv'
import { createSupabaseServerClient } from './supabaseServer'

const valid = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test-value',
  FA_SESSION_SIGNING_SECRET: 'a'.repeat(32),
  FA_CODE_PEPPER: 'b'.repeat(32),
}

describe('parseServerEnv', () => {
  it('accepts complete server-only configuration', () => {
    expect(parseServerEnv(valid).SUPABASE_URL).toBe('https://example.supabase.co')
  })

  it('reports missing names without exposing supplied secret values', () => {
    expect(() => parseServerEnv({ ...valid, FA_CODE_PEPPER: '' }))
      .toThrow('Invalid server environment configuration: FA_CODE_PEPPER')

    try {
      parseServerEnv({ ...valid, FA_CODE_PEPPER: '' })
    } catch (error) {
      expect(String(error)).not.toContain('sb_secret_test-value')
    }
  })

  it('rejects a legacy service-role key', () => {
    expect(() => parseServerEnv({
      ...valid,
      SUPABASE_SECRET_KEY: 'legacy-service-role-key',
    })).toThrow('Invalid server environment configuration: SUPABASE_SECRET_KEY')
  })
})

describe('createSupabaseServerClient', () => {
  it('disables browser-oriented session handling for the server client', () => {
    const client = createSupabaseServerClient(parseServerEnv(valid))
    const auth = client.auth as unknown as {
      persistSession: boolean
      autoRefreshToken: boolean
      detectSessionInUrl: boolean
    }

    expect(auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })
  })
})
