import { describe, expect, it } from 'vitest'
import { parsePublicEnv } from './publicEnv'

describe('parsePublicEnv', () => {
  it('returns only browser-safe Supabase settings', () => {
    expect(parsePublicEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      SUPABASE_SECRET_KEY: 'sb_secret_test-must-not-cross-the-boundary',
      SMTP_PASSWORD: 'test-smtp-password-must-not-cross-the-boundary',
      FA_SESSION_SIGNING_SECRET: 'test-signing-secret-must-not-cross-the-boundary',
    })).toEqual({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    })
  })

  it('rejects a missing publishable key', () => {
    expect(() => parsePublicEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
    })).toThrow('Invalid public environment configuration')
  })

  it('rejects a legacy anon key in place of a publishable key', () => {
    expect(() => parsePublicEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'legacy-anon-key',
    })).toThrow('Invalid public environment configuration')
  })
})
