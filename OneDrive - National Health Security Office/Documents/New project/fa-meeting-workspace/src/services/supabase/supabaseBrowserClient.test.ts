import { describe, expect, it } from 'vitest'
import { browserAuthOptions } from './supabaseBrowserClient'

describe('browserAuthOptions', () => {
  it('persists and refreshes the Admin session without consuming URL fragments', () => {
    expect(browserAuthOptions).toMatchObject({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    })
  })
})
