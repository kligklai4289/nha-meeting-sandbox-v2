import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { describe, expect, it } from 'vitest'
import { AdminAuthError, type AdminIdentity } from './adminAuth'
import { AdminAuthProvider } from './adminAuthContext'
import { useAdminAuth } from '../useAdminAuth'
import { FakeAdminAuth, activeAdminIdentity } from '../../test/fakeAdminAuth'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function createWrapper(gateway: FakeAdminAuth) {
  return function AdminAuthTestProvider({ children }: PropsWithChildren) {
    return <AdminAuthProvider gateway={gateway}>{children}</AdminAuthProvider>
  }
}

describe('AdminAuthProvider', () => {
  it('keeps the app loading while the initial authorization restore is pending', () => {
    const gateway = new FakeAdminAuth()
    gateway.restore.mockReturnValue(deferred<AdminIdentity | null>().promise)

    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    expect(result.current.status).toBe('loading')
  })

  it('becomes anonymous when the initial restore finds no session', async () => {
    const gateway = new FakeAdminAuth(null)
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await waitFor(() => expect(result.current.status).toBe('anonymous'))
  })

  it('exposes the active identity after a successful restore', async () => {
    const gateway = new FakeAdminAuth(activeAdminIdentity)
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await waitFor(() => expect(result.current.status).toBe('active-admin'))
    expect(result.current).toMatchObject({ identity: activeAdminIdentity })
  })

  it('fails closed and signs out when restoration reports an unauthorized identity', async () => {
    const gateway = new FakeAdminAuth()
    gateway.restore.mockRejectedValue(new AdminAuthError('NOT_AUTHORIZED'))
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await waitFor(() => expect(result.current.status).toBe('unauthorized'))
    expect(gateway.signOut).toHaveBeenCalledTimes(1)
  })

  it('does not let an older restore overwrite a newer anonymous auth event', async () => {
    const firstRestore = deferred<AdminIdentity | null>()
    const gateway = new FakeAdminAuth()
    gateway.restore.mockReturnValueOnce(firstRestore.promise)
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    gateway.restore.mockResolvedValueOnce(null)
    await act(async () => gateway.emitAuthChange())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    firstRestore.resolve(activeAdminIdentity)
    await act(async () => firstRestore.promise)
    expect(result.current.status).toBe('anonymous')
  })

  it('does not sign out when an older unauthorized restore completes after a newer auth event', async () => {
    const firstRestore = deferred<AdminIdentity | null>()
    const gateway = new FakeAdminAuth()
    gateway.restore.mockReturnValueOnce(firstRestore.promise)
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    gateway.restore.mockResolvedValueOnce(null)
    await act(async () => gateway.emitAuthChange())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    firstRestore.reject(new AdminAuthError('NOT_AUTHORIZED'))
    await act(async () => firstRestore.promise.catch(() => undefined))

    expect(gateway.signOut).not.toHaveBeenCalled()
    expect(result.current.status).toBe('anonymous')
  })

  it('does not sign out after unmounting while an unauthorized restore is pending', async () => {
    const firstRestore = deferred<AdminIdentity | null>()
    const gateway = new FakeAdminAuth()
    gateway.restore.mockReturnValue(firstRestore.promise)
    const { unmount } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await waitFor(() => expect(gateway.restore).toHaveBeenCalledTimes(1))
    unmount()
    firstRestore.reject(new AdminAuthError('NOT_AUTHORIZED'))
    await act(async () => firstRestore.promise.catch(() => undefined))

    expect(gateway.signOut).not.toHaveBeenCalled()
  })

  it('keeps a newer identity when unauthorized cleanup emits an auth change', async () => {
    const gateway = new FakeAdminAuth()
    gateway.restore
      .mockRejectedValueOnce(new AdminAuthError('NOT_AUTHORIZED'))
      .mockResolvedValueOnce(activeAdminIdentity)
    gateway.signOut.mockImplementation(async () => gateway.emitAuthChange())
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await waitFor(() => expect(result.current.status).toBe('active-admin'))

    expect(result.current).toMatchObject({ identity: activeAdminIdentity })
  })

  it('settles anonymous when sign-in fails after cancelling a pending restore', async () => {
    const pendingRestore = deferred<AdminIdentity | null>()
    const gateway = new FakeAdminAuth()
    gateway.restore.mockReturnValue(pendingRestore.promise)
    gateway.signIn.mockRejectedValue(new AdminAuthError('INVALID_CREDENTIALS'))
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await waitFor(() => expect(gateway.restore).toHaveBeenCalledTimes(1))
    let signInError: unknown
    await act(async () => {
      try {
        await result.current.signIn('admin@example.org', 'wrong-password')
      } catch (error) {
        signInError = error
      }
    })

    expect(signInError).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(result.current.status).toBe('anonymous')
  })

  it('fails closed when sign-out fails after cancelling a pending restore', async () => {
    const pendingRestore = deferred<AdminIdentity | null>()
    const gateway = new FakeAdminAuth()
    gateway.restore.mockReturnValue(pendingRestore.promise)
    gateway.signOut.mockRejectedValue(new AdminAuthError('UNAVAILABLE'))
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await waitFor(() => expect(gateway.restore).toHaveBeenCalledTimes(1))
    let signOutError: unknown
    await act(async () => {
      try {
        await result.current.signOut()
      } catch (error) {
        signOutError = error
      }
    })

    expect(signOutError).toMatchObject({ code: 'UNAVAILABLE' })
    expect(result.current.status).toBe('unauthorized')
  })

  it('exposes a safe restore outage and can retry into an active state', async () => {
    const gateway = new FakeAdminAuth()
    gateway.restore
      .mockRejectedValueOnce(new Error('raw restore diagnostic'))
      .mockResolvedValueOnce(activeAdminIdentity)
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await waitFor(() => expect(result.current.restoreFailure).toBe('UNAVAILABLE'))
    expect(result.current.status).toBe('loading')

    await act(async () => result.current.retry())

    expect(result.current).toMatchObject({
      status: 'active-admin',
      identity: activeAdminIdentity,
      restoreFailure: null,
    })
  })

  it('signs in by exposing only the identity returned by the gateway', async () => {
    const gateway = new FakeAdminAuth(null)
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    await act(async () => result.current.signIn('admin@example.org', 'password'))

    expect(result.current).toMatchObject({
      status: 'active-admin',
      identity: activeAdminIdentity,
    })
  })

  it('returns to anonymous after signing out', async () => {
    const gateway = new FakeAdminAuth(activeAdminIdentity)
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })
    await waitFor(() => expect(result.current.status).toBe('active-admin'))

    await act(async () => result.current.signOut())

    expect(result.current.status).toBe('anonymous')
  })

  it('delegates explicit email-token confirmation to the gateway', async () => {
    const gateway = new FakeAdminAuth(null)
    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper(gateway),
    })

    await act(async () => result.current.confirmEmailToken('email-token', 'invite'))

    expect(gateway.verifyEmailToken).toHaveBeenCalledWith('email-token', 'invite')
  })
})
