import {
  isAuthSessionMissingError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import {
  AdminAuthError,
  type AdminAuthGateway,
  type AdminIdentity,
  type EmailTokenType,
} from './adminAuth'
import type { Database } from '../supabase/database.types'

const profileColumns = 'user_id,display_name,role,is_active'

export class SupabaseAdminAuth implements AdminAuthGateway {
  private readonly client: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  async restore(): Promise<AdminIdentity | null> {
    return this.loadActiveIdentity()
  }

  async restorePasswordFlow(): Promise<boolean> {
    let userResult: Awaited<ReturnType<typeof this.client.auth.getUser>>
    try {
      userResult = await this.client.auth.getUser()
    } catch {
      throw new AdminAuthError('UNAVAILABLE')
    }

    if (!userResult.data.user && isAuthSessionMissingError(userResult.error)) {
      return false
    }
    if (userResult.error) {
      throw new AdminAuthError('UNAVAILABLE')
    }
    return Boolean(userResult.data.user)
  }

  async signIn(email: string, password: string): Promise<AdminIdentity> {
    let result: Awaited<ReturnType<typeof this.client.auth.signInWithPassword>>
    try {
      result = await this.client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
    } catch {
      throw new AdminAuthError('INVALID_CREDENTIALS')
    }

    if (result.error) {
      throw new AdminAuthError('INVALID_CREDENTIALS')
    }

    try {
      const identity = await this.loadActiveIdentity()
      if (identity) {
        return identity
      }
    } catch (error) {
      if (!(error instanceof AdminAuthError) || error.code !== 'NOT_AUTHORIZED') {
        throw error
      }
    }

    await this.signOutAfterAuthorizationFailure()
    throw new AdminAuthError('NOT_AUTHORIZED')
  }

  async signOut(): Promise<void> {
    let result: Awaited<ReturnType<typeof this.client.auth.signOut>>
    try {
      result = await this.client.auth.signOut()
    } catch {
      throw new AdminAuthError('UNAVAILABLE')
    }

    if (result.error) {
      throw new AdminAuthError('UNAVAILABLE')
    }
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    let result: Awaited<ReturnType<typeof this.client.auth.resetPasswordForEmail>>
    try {
      result = await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      })
    } catch {
      throw new AdminAuthError('UNAVAILABLE')
    }

    if (result.error) {
      throw new AdminAuthError('UNAVAILABLE')
    }
  }

  async verifyEmailToken(tokenHash: string, type: EmailTokenType): Promise<void> {
    if (type !== 'invite' && type !== 'recovery') {
      throw new AdminAuthError('INVALID_TOKEN')
    }

    let result: Awaited<ReturnType<typeof this.client.auth.verifyOtp>>
    try {
      result = await this.client.auth.verifyOtp({ token_hash: tokenHash, type })
    } catch {
      throw new AdminAuthError('INVALID_TOKEN')
    }

    if (result.error) {
      throw new AdminAuthError('INVALID_TOKEN')
    }
  }

  async updatePassword(password: string): Promise<void> {
    let result: Awaited<ReturnType<typeof this.client.auth.updateUser>>
    try {
      result = await this.client.auth.updateUser({ password })
    } catch {
      throw new AdminAuthError('PASSWORD_UPDATE_FAILED')
    }

    if (result.error) {
      throw new AdminAuthError('PASSWORD_UPDATE_FAILED')
    }
  }

  subscribe(listener: () => void): () => void {
    const { data } = this.client.auth.onAuthStateChange(() => listener())
    return () => data.subscription.unsubscribe()
  }

  private async loadActiveIdentity(): Promise<AdminIdentity | null> {
    let userResult: Awaited<ReturnType<typeof this.client.auth.getUser>>
    try {
      userResult = await this.client.auth.getUser()
    } catch {
      throw new AdminAuthError('UNAVAILABLE')
    }

    if (!userResult.data.user && isAuthSessionMissingError(userResult.error)) {
      return null
    }

    if (userResult.error) {
      throw new AdminAuthError('UNAVAILABLE')
    }

    const user = userResult.data.user
    if (!user) {
      return null
    }

    let profileResult: Awaited<
      ReturnType<
        ReturnType<
          ReturnType<ReturnType<typeof this.client.from>['select']>['eq']
        >['eq']
      >['maybeSingle']
    >
    try {
      profileResult = await this.client
        .from('admin_profiles')
        .select(profileColumns)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
    } catch {
      throw new AdminAuthError('UNAVAILABLE')
    }

    if (profileResult.error) {
      throw new AdminAuthError('UNAVAILABLE')
    }

    const profile = profileResult.data
    if (
      !profile ||
      profile.user_id !== user.id ||
      !profile.is_active ||
      profile.role !== 'admin' ||
      !user.email
    ) {
      throw new AdminAuthError('NOT_AUTHORIZED')
    }

    return {
      userId: user.id,
      email: user.email,
      displayName: profile.display_name,
      role: 'admin',
    }
  }

  private async signOutAfterAuthorizationFailure(): Promise<void> {
    let result: Awaited<ReturnType<typeof this.client.auth.signOut>>
    try {
      result = await this.client.auth.signOut()
    } catch {
      throw new AdminAuthError('UNAVAILABLE')
    }

    if (result.error) {
      throw new AdminAuthError('UNAVAILABLE')
    }
  }
}
