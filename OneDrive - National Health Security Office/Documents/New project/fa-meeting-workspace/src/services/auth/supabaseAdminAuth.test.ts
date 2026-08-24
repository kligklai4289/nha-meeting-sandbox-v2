import { AuthSessionMissingError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { AdminAuthError } from './adminAuth'
import { SupabaseAdminAuth } from './supabaseAdminAuth'

const activeUser = {
  id: '7d592f0f-1299-4259-a4e3-87f1bf796eb7',
  email: 'pichailakarm@gmail.com',
}

type ProfileResponse = {
  data: {
    user_id: string
    display_name: string
    role: 'admin'
    is_active: boolean
  } | null
  error: unknown
}

function createClientDouble(options: {
  user?: typeof activeUser | null
  getUserError?: unknown
  profile?: ProfileResponse
  signInError?: unknown
  signOutError?: unknown
  signOutRejection?: unknown
  resetError?: unknown
  verifyError?: unknown
  updateError?: unknown
} = {}) {
  const profile = options.profile ?? {
    data: {
      user_id: activeUser.id,
      display_name: 'Pichailakarm',
      role: 'admin' as const,
      is_active: true,
    },
    error: null,
  }
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(profile),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)

  const events: string[] = []
  const unsubscribe = vi.fn()
  let authStateListener: (() => void) | undefined
  const client = {
    from: vi.fn().mockReturnValue(query),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === undefined ? activeUser : options.user },
        error: options.getUserError ?? null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: activeUser, session: {} },
        error: options.signInError ?? null,
      }),
      signOut: vi.fn().mockImplementation(async () => {
        events.push('signOut')
        if (options.signOutRejection) {
          throw options.signOutRejection
        }
        return { error: options.signOutError ?? null }
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        data: {},
        error: options.resetError ?? null,
      }),
      verifyOtp: vi.fn().mockResolvedValue({
        data: { user: activeUser, session: {} },
        error: options.verifyError ?? null,
      }),
      updateUser: vi.fn().mockResolvedValue({
        data: { user: activeUser },
        error: options.updateError ?? null,
      }),
      onAuthStateChange: vi.fn((listener: () => void) => {
        authStateListener = listener
        return { data: { subscription: { unsubscribe } } }
      }),
    },
  }

  return {
    client,
    events,
    query,
    unsubscribe,
    emitAuthStateChange: () => authStateListener?.(),
  }
}

function rejectedError(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the gateway operation to reject')
    },
    (error: unknown) => error,
  )
}

function expectSafeAuthError(
  error: unknown,
  code: AdminAuthError['code'],
): void {
  expect(error).toBeInstanceOf(AdminAuthError)
  expect(error).toMatchObject({ code })
}

describe('SupabaseAdminAuth', () => {
  it('restores a safe identity only after the active admin profile is loaded under RLS', async () => {
    const { client, query } = createClientDouble()
    const gateway = new SupabaseAdminAuth(client as never)

    await expect(gateway.restore()).resolves.toEqual({
      userId: activeUser.id,
      email: 'pichailakarm@gmail.com',
      displayName: 'Pichailakarm',
      role: 'admin',
    })
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith('admin_profiles')
    expect(query.select).toHaveBeenCalledWith('user_id,display_name,role,is_active')
    expect(query.eq).toHaveBeenNthCalledWith(1, 'user_id', activeUser.id)
    expect(query.eq).toHaveBeenNthCalledWith(2, 'is_active', true)
    expect(query.maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('returns null when no authenticated user session exists', async () => {
    const { client } = createClientDouble({ user: null })
    const gateway = new SupabaseAdminAuth(client as never)

    await expect(gateway.restore()).resolves.toBeNull()
    expect(client.from).not.toHaveBeenCalled()
  })

  it('returns null for the Supabase SDK logged-out response with AuthSessionMissingError', async () => {
    const { client } = createClientDouble({
      user: null,
      getUserError: new AuthSessionMissingError(),
    })
    const gateway = new SupabaseAdminAuth(client as never)

    await expect(gateway.restore()).resolves.toBeNull()
    expect(client.from).not.toHaveBeenCalled()
  })

  it('checks password-flow session readiness without loading an admin profile', async () => {
    const { client } = createClientDouble({
      profile: { data: null, error: null },
    })
    const gateway = new SupabaseAdminAuth(client as never)

    await expect(gateway.restorePasswordFlow()).resolves.toBe(true)
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('maps a different logged-out getUser error to safe unavailable instead of anonymous', async () => {
    const diagnostic = 'get-user failure synthetic-secret-5c2f04'
    const { client } = createClientDouble({
      user: null,
      getUserError: new Error(diagnostic),
    })
    const gateway = new SupabaseAdminAuth(client as never)

    const error = await rejectedError(gateway.restore())

    expectSafeAuthError(error, 'UNAVAILABLE')
    expect((error as Error).message).not.toContain(diagnostic)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('rejects a session with no active admin profile', async () => {
    const { client } = createClientDouble({
      profile: { data: null, error: null },
    })
    const gateway = new SupabaseAdminAuth(client as never)

    expectSafeAuthError(await rejectedError(gateway.restore()), 'NOT_AUTHORIZED')
  })

  it('rejects an inactive profile even if a malformed response bypasses the active filter', async () => {
    const { client } = createClientDouble({
      profile: {
        data: {
          user_id: activeUser.id,
          display_name: 'Pichailakarm',
          role: 'admin',
          is_active: false,
        },
        error: null,
      },
    })
    const gateway = new SupabaseAdminAuth(client as never)

    expectSafeAuthError(await rejectedError(gateway.restore()), 'NOT_AUTHORIZED')
  })

  it('maps an unavailable profile query to a safe error without exposing its raw diagnostic', async () => {
    const diagnostic = 'database rejected request with synthetic-secret-6bca26'
    const { client } = createClientDouble({
      profile: { data: null, error: new Error(diagnostic) },
    })
    const gateway = new SupabaseAdminAuth(client as never)

    const error = await rejectedError(gateway.restore())

    expectSafeAuthError(error, 'UNAVAILABLE')
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).not.toContain(diagnostic)
    expect(JSON.stringify(error)).not.toContain(diagnostic)
  })

  it('normalizes credentials and authorizes the signed-in user against the active profile', async () => {
    const { client, query } = createClientDouble()
    const gateway = new SupabaseAdminAuth(client as never)

    await expect(
      gateway.signIn(' PICHAILAKARM@GMAIL.COM ', 'not-retained-by-the-test'),
    ).resolves.toEqual({
      userId: activeUser.id,
      email: 'pichailakarm@gmail.com',
      displayName: 'Pichailakarm',
      role: 'admin',
    })

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'pichailakarm@gmail.com',
      password: 'not-retained-by-the-test',
    })
    expect(query.maybeSingle).toHaveBeenCalledTimes(1)
  })

  it('signs out before rejecting a successful sign-in without an active profile', async () => {
    const { client, events } = createClientDouble({
      profile: { data: null, error: null },
    })
    const gateway = new SupabaseAdminAuth(client as never)

    expectSafeAuthError(
      await rejectedError(gateway.signIn('pichailakarm@gmail.com', 'password')),
      'NOT_AUTHORIZED',
    )
    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['signOut'])
  })

  it('fails closed with a safe unavailable error when unauthorized sign-in cleanup returns an error', async () => {
    const diagnostic = 'cleanup returned synthetic-secret-19b27f'
    const { client } = createClientDouble({
      profile: { data: null, error: null },
      signOutError: new Error(diagnostic),
    })
    const gateway = new SupabaseAdminAuth(client as never)

    const error = await rejectedError(gateway.signIn('pichailakarm@gmail.com', 'password'))

    expectSafeAuthError(error, 'UNAVAILABLE')
    expect((error as Error).message).not.toContain(diagnostic)
    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('fails closed with a safe unavailable error when unauthorized sign-in cleanup rejects', async () => {
    const diagnostic = 'cleanup rejected synthetic-secret-50f54c'
    const { client } = createClientDouble({
      profile: { data: null, error: null },
      signOutRejection: new Error(diagnostic),
    })
    const gateway = new SupabaseAdminAuth(client as never)

    const error = await rejectedError(gateway.signIn('pichailakarm@gmail.com', 'password'))

    expectSafeAuthError(error, 'UNAVAILABLE')
    expect((error as Error).message).not.toContain(diagnostic)
    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('maps invalid sign-in credentials to the safe invalid-credentials code', async () => {
    const { client } = createClientDouble({ signInError: new Error('raw auth diagnostic') })
    const gateway = new SupabaseAdminAuth(client as never)

    expectSafeAuthError(
      await rejectedError(gateway.signIn('pichailakarm@gmail.com', 'password')),
      'INVALID_CREDENTIALS',
    )
  })

  it('maps sign-out failures to a safe unavailable error', async () => {
    const { client } = createClientDouble({ signOutError: new Error('raw auth diagnostic') })
    const gateway = new SupabaseAdminAuth(client as never)

    expectSafeAuthError(await rejectedError(gateway.signOut()), 'UNAVAILABLE')
  })

  it('normalizes recovery email and forwards only the supplied safe redirect URL', async () => {
    const { client } = createClientDouble()
    const gateway = new SupabaseAdminAuth(client as never)

    await expect(
      gateway.requestPasswordReset(' PICHAILAKARM@GMAIL.COM ', 'https://preview.example/admin/auth/confirm'),
    ).resolves.toBeUndefined()
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('pichailakarm@gmail.com', {
      redirectTo: 'https://preview.example/admin/auth/confirm',
    })
  })

  it('maps email-token failures to the safe invalid-token code', async () => {
    const { client } = createClientDouble({ verifyError: new Error('raw token diagnostic') })
    const gateway = new SupabaseAdminAuth(client as never)

    expectSafeAuthError(
      await rejectedError(gateway.verifyEmailToken('token-hash', 'invite')),
      'INVALID_TOKEN',
    )
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'token-hash', type: 'invite' })
  })

  it('maps password-update failures to a safe password-update error', async () => {
    const { client } = createClientDouble({ updateError: new Error('raw password diagnostic') })
    const gateway = new SupabaseAdminAuth(client as never)

    expectSafeAuthError(
      await rejectedError(gateway.updatePassword('a-new-password-at-least-12')),
      'PASSWORD_UPDATE_FAILED',
    )
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: 'a-new-password-at-least-12',
    })
  })

  it('notifies subscribers about auth changes and unsubscribes on cleanup', () => {
    const { client, emitAuthStateChange, unsubscribe } = createClientDouble()
    const gateway = new SupabaseAdminAuth(client as never)
    const listener = vi.fn()

    const stop = gateway.subscribe(listener)
    emitAuthStateChange()
    stop()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
