import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import {
  AdminAuthError,
  type AdminAuthGateway,
} from './adminAuth'
import {
  AdminAuthContext,
  type AdminAuthActions,
  type AdminAuthContextValue,
  type AdminAuthState,
  type PasswordFlowState,
} from './adminAuthContextValue'

export type { AdminAuthContextValue, AdminAuthState } from './adminAuthContextValue'

interface AdminAuthProviderProps extends PropsWithChildren {
  gateway: AdminAuthGateway
}

const passwordFlowStorageKey = 'admin:password-flow'

function readPasswordFlowMarker(): import('./adminAuth').EmailTokenType | null {
  const marker = sessionStorage.getItem(passwordFlowStorageKey)
  return marker === 'invite' || marker === 'recovery' ? marker : null
}

function asSafeAuthError(error: unknown): AdminAuthError {
  return error instanceof AdminAuthError ? error : new AdminAuthError('UNAVAILABLE')
}

export function AdminAuthProvider({ gateway, children }: AdminAuthProviderProps) {
  const [state, setState] = useState<AdminAuthState>({ status: 'loading' })
  const [restoreFailure, setRestoreFailure] = useState<'UNAVAILABLE' | null>(null)
  const [signOutFailure, setSignOutFailure] = useState<'UNAVAILABLE' | null>(null)
  const [signOutPending, setSignOutPending] = useState(false)
  const [passwordFlow, setPasswordFlow] = useState<PasswordFlowState>(() => {
    const marker = readPasswordFlowMarker()
    return marker ? { status: 'checking', type: marker } : { status: 'idle' }
  })
  const passwordFlowRef = useRef<import('./adminAuth').EmailTokenType | null>(
    passwordFlow.status === 'idle' ? null : passwordFlow.type,
  )
  const revision = useRef(0)
  const signOutLocked = useRef(false)

  const clearPasswordFlow = useCallback(() => {
    passwordFlowRef.current = null
    sessionStorage.removeItem(passwordFlowStorageKey)
    setPasswordFlow({ status: 'idle' })
  }, [])

  const beginPasswordFlow = useCallback((type: import('./adminAuth').EmailTokenType) => {
    const requestRevision = ++revision.current
    passwordFlowRef.current = type
    setPasswordFlow({ status: 'checking', type })
    setRestoreFailure(null)
    setState({ status: 'anonymous' })
    return requestRevision
  }, [])

  const establishPasswordFlow = useCallback(async (
    type: import('./adminAuth').EmailTokenType,
    requestRevision: number,
  ) => {
    try {
      const isReady = await gateway.restorePasswordFlow()
      if (requestRevision !== revision.current || passwordFlowRef.current !== type) return
      if (!isReady) {
        clearPasswordFlow()
        throw new AdminAuthError('INVALID_TOKEN')
      }
      sessionStorage.setItem(passwordFlowStorageKey, type)
      setPasswordFlow({ status: 'ready', type })
      setState({ status: 'anonymous' })
    } catch (error) {
      if (requestRevision === revision.current && passwordFlowRef.current === type) {
        clearPasswordFlow()
        setState({ status: 'anonymous' })
      }
      throw asSafeAuthError(error)
    }
  }, [clearPasswordFlow, gateway])

  const restoreAuthorization = useCallback(async (showLoading = true) => {
    if (signOutLocked.current || passwordFlowRef.current) return
    const requestRevision = ++revision.current
    setRestoreFailure(null)
    if (showLoading) {
      setState({ status: 'loading' })
    }

    try {
      const identity = await gateway.restore()
      if (requestRevision !== revision.current) return
      setState(identity ? { status: 'active-admin', identity } : { status: 'anonymous' })
    } catch (error) {
      const safeError = asSafeAuthError(error)
      if (requestRevision !== revision.current) return
      if (safeError.code === 'NOT_AUTHORIZED') {
        const cleanupRevision = ++revision.current
        clearPasswordFlow()
        try {
          await gateway.signOut()
        } catch {
          // The route remains closed even if cleanup cannot reach Supabase.
        }
        if (cleanupRevision !== revision.current) return
        setState({ status: 'unauthorized' })
        return
      }
      if (safeError.code === 'UNAVAILABLE') {
        setRestoreFailure('UNAVAILABLE')
      } else {
        setState({ status: 'unauthorized' })
      }
    }
  }, [clearPasswordFlow, gateway])

  const signOutAuthorization = useCallback(async () => {
    const requestRevision = ++revision.current
    signOutLocked.current = true
    clearPasswordFlow()
    setSignOutPending(true)
    try {
      await gateway.signOut()
      if (requestRevision === revision.current) {
        signOutLocked.current = false
        setRestoreFailure(null)
        setSignOutFailure(null)
        setSignOutPending(false)
        setState({ status: 'anonymous' })
      }
    } catch (error) {
      const safeError = asSafeAuthError(error)
      if (requestRevision === revision.current) {
        signOutLocked.current = true
        setRestoreFailure(null)
        setSignOutFailure('UNAVAILABLE')
        setSignOutPending(false)
        setState({ status: 'unauthorized' })
      }
      throw safeError
    }
  }, [clearPasswordFlow, gateway])

  useEffect(() => {
    let mounted = true
    const currentRevision = revision
    const unsubscribe = gateway.subscribe(() => {
      if (!passwordFlowRef.current) {
        void restoreAuthorization()
      }
    })
    void Promise.resolve().then(() => {
      if (mounted) {
        const flowType = passwordFlowRef.current
        if (flowType) {
          const requestRevision = beginPasswordFlow(flowType)
          return establishPasswordFlow(flowType, requestRevision).catch(() => undefined)
        }
        return restoreAuthorization(false)
      }
    })
    return () => {
      mounted = false
      ++currentRevision.current
      unsubscribe()
    }
  }, [beginPasswordFlow, establishPasswordFlow, gateway, restoreAuthorization])

  const actions = useMemo<AdminAuthActions>(() => ({
    async signIn(email, password) {
      const requestRevision = ++revision.current
      signOutLocked.current = false
      clearPasswordFlow()
      setSignOutFailure(null)
      setSignOutPending(false)
      try {
        const identity = await gateway.signIn(email, password)
        if (requestRevision === revision.current) {
          setRestoreFailure(null)
          setState({ status: 'active-admin', identity })
        }
      } catch (error) {
        const safeError = asSafeAuthError(error)
        if (requestRevision === revision.current) {
          setRestoreFailure(null)
          setState({ status: 'anonymous' })
        }
        throw safeError
      }
    },
    signOut: signOutAuthorization,
    async requestPasswordReset(email, redirectTo) {
      try {
        await gateway.requestPasswordReset(email, redirectTo)
      } catch (error) {
        throw asSafeAuthError(error)
      }
    },
    async confirmEmailToken(tokenHash, type) {
      const requestRevision = beginPasswordFlow(type)
      try {
        await gateway.verifyEmailToken(tokenHash, type)
        await establishPasswordFlow(type, requestRevision)
      } catch (error) {
        if (requestRevision === revision.current) {
          clearPasswordFlow()
        }
        throw asSafeAuthError(error)
      }
    },
    async updatePassword(password) {
      if (passwordFlowRef.current === null || passwordFlow.status !== 'ready') {
        throw new AdminAuthError('NOT_AUTHORIZED')
      }
      try {
        await gateway.updatePassword(password)
      } catch (error) {
        throw asSafeAuthError(error)
      }
      clearPasswordFlow()
      const requestRevision = ++revision.current
      try {
        const identity = await gateway.restore()
        if (requestRevision !== revision.current) {
          throw new AdminAuthError('UNAVAILABLE')
        }
        if (!identity) {
          throw new AdminAuthError('NOT_AUTHORIZED')
        }
        signOutLocked.current = false
        setRestoreFailure(null)
        setState({ status: 'active-admin', identity })
      } catch (error) {
        const safeError = asSafeAuthError(error)
        if (requestRevision !== revision.current) throw safeError
        signOutLocked.current = true
        clearPasswordFlow()
        try {
          await gateway.signOut()
        } catch {
          // The route remains closed even if cleanup cannot reach Supabase.
        }
        if (requestRevision === revision.current) {
          if (safeError.code === 'NOT_AUTHORIZED') {
            setState({ status: 'unauthorized' })
          } else {
            setRestoreFailure('UNAVAILABLE')
            setState({ status: 'unauthorized' })
          }
        }
        throw safeError
      }
    },
    retry() {
      return restoreAuthorization()
    },
    async retrySignOut() {
      try {
        await signOutAuthorization()
      } catch {
        // The guarded failure panel remains available for another retry.
      }
    },
  }), [beginPasswordFlow, clearPasswordFlow, establishPasswordFlow, gateway, passwordFlow.status, restoreAuthorization, signOutAuthorization])

  const value = useMemo<AdminAuthContextValue>(
    () => ({ ...state, ...actions, passwordFlow, restoreFailure, signOutFailure, signOutPending }) as AdminAuthContextValue,
    [actions, passwordFlow, restoreFailure, signOutFailure, signOutPending, state],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
