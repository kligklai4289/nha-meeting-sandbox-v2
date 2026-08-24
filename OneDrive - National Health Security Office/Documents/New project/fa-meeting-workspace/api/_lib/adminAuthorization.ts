import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/services/supabase/database.types.js'

export type ActiveAdmin = { userId: string }

export interface AdminAccessCodeGateway {
  authorize(accessToken: string): Promise<ActiveAdmin | null>
  rotate(input: { actorId: string; groupId: string; codeHash: string }): Promise<{
    rotatedAt: string
    revokedSessions: number
  }>
}

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{
    data: { rotatedAt: string; revokedSessions: number } | null
    error: { message?: string } | null
  }>
}

export class SupabaseAdminAccessCodeGateway implements AdminAccessCodeGateway {
  private readonly client: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  async authorize(accessToken: string): Promise<ActiveAdmin | null> {
    const { data: userData, error: userError } = await this.client.auth.getUser(accessToken)
    if (userError || !userData.user) return null
    const { data: profile, error: profileError } = await this.client
      .from('admin_profiles')
      .select('user_id,role,is_active')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (profileError || !profile || profile.role !== 'admin') return null
    return { userId: userData.user.id }
  }

  async rotate(input: { actorId: string; groupId: string; codeHash: string }) {
    const { data, error } = await (this.client as unknown as RpcClient).rpc(
      'admin_rotate_fa_access_code',
      {
        p_actor_id: input.actorId,
        p_group_id: input.groupId,
        p_code_hash: input.codeHash,
      },
    )
    if (error || !data) {
      if (error?.message?.includes('DUPLICATE_ACCESS_CODE')) throw new Error('DUPLICATE_ACCESS_CODE')
      throw new Error('ACCESS_CODE_ROTATION_FAILED')
    }
    return data
  }
}
