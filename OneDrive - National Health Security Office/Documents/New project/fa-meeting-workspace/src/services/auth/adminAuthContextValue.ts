import { createContext } from 'react'
import type { AdminIdentity, EmailTokenType } from './adminAuth'

export type AdminAuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'unauthorized' }
  | { status: 'active-admin'; identity: AdminIdentity }

export type PasswordFlowState =
  | { status: 'idle' }
  | { status: 'checking'; type: EmailTokenType }
  | { status: 'ready'; type: EmailTokenType }

export type AdminAuthActions = {
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  requestPasswordReset(email: string, redirectTo: string): Promise<void>
  confirmEmailToken(tokenHash: string, type: EmailTokenType): Promise<void>
  updatePassword(password: string): Promise<void>
  retry(): Promise<void>
  retrySignOut(): Promise<void>
}

export type AdminAuthContextValue = AdminAuthState & AdminAuthActions & {
  passwordFlow: PasswordFlowState
  restoreFailure: 'UNAVAILABLE' | null
  signOutFailure: 'UNAVAILABLE' | null
  signOutPending: boolean
}

export const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)
