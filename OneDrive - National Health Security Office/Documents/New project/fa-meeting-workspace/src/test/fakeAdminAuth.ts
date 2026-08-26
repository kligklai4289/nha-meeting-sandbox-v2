import { vi } from 'vitest'
import type {
  AdminAuthGateway,
  AdminIdentity,
} from '../services/auth/adminAuth'

export const activeAdminIdentity: AdminIdentity = {
  userId: '2c866ec1-9a8c-4e54-98f6-1f9c02f7a33d',
  email: 'admin@example.org',
  displayName: 'Admin Example',
  role: 'admin',
}

export class FakeAdminAuth implements AdminAuthGateway {
  readonly restore = vi.fn<AdminAuthGateway['restore']>()
  readonly restorePasswordFlow = vi.fn<AdminAuthGateway['restorePasswordFlow']>()
  readonly signIn = vi.fn<AdminAuthGateway['signIn']>()
  readonly signOut = vi.fn<AdminAuthGateway['signOut']>()
  readonly requestPasswordReset = vi.fn<AdminAuthGateway['requestPasswordReset']>()
  readonly verifyEmailToken = vi.fn<AdminAuthGateway['verifyEmailToken']>()
  readonly updatePassword = vi.fn<AdminAuthGateway['updatePassword']>()
  readonly subscribe = vi.fn<AdminAuthGateway['subscribe']>()

  private listener: (() => void) | undefined

  constructor(identity: AdminIdentity | null = activeAdminIdentity) {
    this.restore.mockResolvedValue(identity)
    this.restorePasswordFlow.mockResolvedValue(true)
    this.signIn.mockResolvedValue(identity ?? activeAdminIdentity)
    this.signOut.mockResolvedValue()
    this.requestPasswordReset.mockResolvedValue()
    this.verifyEmailToken.mockResolvedValue()
    this.updatePassword.mockResolvedValue()
    this.subscribe.mockImplementation((listener) => {
      this.listener = listener
      return () => {
        if (this.listener === listener) {
          this.listener = undefined
        }
      }
    })
  }

  emitAuthChange(): void {
    this.listener?.()
  }
}
