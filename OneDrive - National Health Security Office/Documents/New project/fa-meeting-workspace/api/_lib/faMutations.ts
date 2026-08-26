import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Json } from '../../src/services/supabase/database.types.js'
import type { FaSessionClaims } from './faSession.js'

export type FaMutationKind =
  | 'issue_upsert'
  | 'issue_delete'
  | 'group_update'
  | 'group_finalize'
  | 'issues_reorder'

export interface FaMutation {
  claims: FaSessionClaims
  kind: FaMutationKind
  mutationId: string
  targetId: string | null
  expectedRowVersion: number
  payload: Record<string, unknown>
}

export type FaMutationErrorCode =
  | 'FA_SESSION_INVALID'
  | 'MEETING_INACTIVE'
  | 'GROUP_FINALIZED'
  | 'VERSION_CONFLICT'
  | 'TARGET_NOT_FOUND'
  | 'INVALID_MUTATION'

export type FaMutationResult =
  | { ok: true; data: Record<string, unknown>; replayed: boolean }
  | { ok: false; code: FaMutationErrorCode }

export interface FaMutationGateway {
  apply(mutation: FaMutation): Promise<FaMutationResult>
}

const resultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: z.record(z.string(), z.unknown()),
    replayed: z.boolean().default(false),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum([
      'FA_SESSION_INVALID', 'MEETING_INACTIVE', 'GROUP_FINALIZED',
      'VERSION_CONFLICT', 'TARGET_NOT_FOUND', 'INVALID_MUTATION',
    ]),
  }),
])

type RpcClient = {
  rpc(name: string, args: Record<string, Json>): Promise<{ data: unknown; error: unknown }>
}

export class SupabaseFaMutationGateway implements FaMutationGateway {
  private readonly rpcClient: RpcClient

  constructor(client: SupabaseClient<Database>) {
    this.rpcClient = client as unknown as RpcClient
  }

  async apply(mutation: FaMutation): Promise<FaMutationResult> {
    const rpcName = mutation.kind === 'issues_reorder' ? 'fa_reorder_issues' : 'fa_apply_mutation'
    const args: Record<string, Json> = mutation.kind === 'issues_reorder' ? {
      p_session_id: mutation.claims.sessionId,
      p_meeting_id: mutation.claims.meetingId,
      p_group_id: mutation.claims.groupId,
      p_mutation_id: mutation.mutationId,
      p_items: mutation.payload.items as Json,
    } : {
      p_session_id: mutation.claims.sessionId,
      p_meeting_id: mutation.claims.meetingId,
      p_group_id: mutation.claims.groupId,
      p_mutation_id: mutation.mutationId,
      p_kind: mutation.kind,
      p_target_id: mutation.targetId,
      p_expected_row_version: mutation.expectedRowVersion,
      p_payload: mutation.payload as Json,
    }
    const { data, error } = await this.rpcClient.rpc(rpcName, args)
    if (error) throw new Error('FA_MUTATION_QUERY_FAILED')
    const result = resultSchema.safeParse(data)
    if (!result.success) throw new Error('FA_MUTATION_INVALID_RESULT')
    return result.data
  }
}

export function mutationErrorStatus(code: FaMutationErrorCode): number {
  if (code === 'FA_SESSION_INVALID') return 401
  if (code === 'VERSION_CONFLICT') return 409
  if (code === 'MEETING_INACTIVE') return 409
  if (code === 'GROUP_FINALIZED') return 423
  if (code === 'TARGET_NOT_FOUND') return 404
  return 400
}
