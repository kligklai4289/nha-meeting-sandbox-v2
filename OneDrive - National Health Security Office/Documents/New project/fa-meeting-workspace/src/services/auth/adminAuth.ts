export type AdminIdentity = {
  userId: string
  email: string
  displayName: string
  role: 'admin'
}

export type EmailTokenType = 'invite' | 'recovery'

export type AdminAuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'NOT_AUTHORIZED'
  | 'INVALID_TOKEN'
  | 'UNAVAILABLE'
  | 'PASSWORD_UPDATE_FAILED'

export class AdminAuthError extends Error {
  readonly name = 'AdminAuthError'
  readonly code: AdminAuthErrorCode

  constructor(code: AdminAuthErrorCode) {
    super('Admin authentication failed')
    this.code = code
  }
}

export interface AdminAuthGateway {
  restore(): Promise<AdminIdentity | null>
  restorePasswordFlow(): Promise<boolean>
  signIn(email: string, password: string): Promise<AdminIdentity>
  signOut(): Promise<void>
  requestPasswordReset(email: string, redirectTo: string): Promise<void>
  verifyEmailToken(tokenHash: string, type: EmailTokenType): Promise<void>
  updatePassword(password: string): Promise<void>
  subscribe(listener: () => void): () => void
}
