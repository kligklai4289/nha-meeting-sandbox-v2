import { createHmac, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/services/supabase/database.types.js'
import type { ServerEnv } from './serverEnv.js'
import {
  hashFaAccessCode,
  safelyMatchesHash,
  type FaSessionClaims,
} from './faSession.js'

export interface FaSessionGateway {
  exchangeAccessCode(input: {
    groupId: string
    accessCode: string
    userAgent: string | null
    clientAddress: string
  }): Promise<FaSessionClaims | null>
}

export interface FaBootstrapData {
  meeting: Record<string, unknown>
  group: Record<string, unknown>
  issues: Array<Record<string, unknown>>
}

export interface FaBootstrapGateway {
  getBootstrap(claims: FaSessionClaims): Promise<FaBootstrapData | null>
}

export class SupabaseFaGateway implements FaSessionGateway, FaBootstrapGateway {
  private readonly client: SupabaseClient<Database>
  private readonly env: ServerEnv
  private readonly now: () => Date

  constructor(
    client: SupabaseClient<Database>,
    env: ServerEnv,
    now: () => Date = () => new Date(),
  ) {
    this.client = client
    this.env = env
    this.now = now
  }

  async exchangeAccessCode(input: {
    groupId: string
    accessCode: string
    userAgent: string | null
    clientAddress: string
  }): Promise<FaSessionClaims | null> {
    const ipHash = createHmac('sha256', this.env.FA_SESSION_SIGNING_SECRET)
      .update(input.clientAddress, 'utf8')
      .digest('hex')
    const rpc = this.client as unknown as {
      rpc(name: string, args: Record<string, string>): Promise<{ data: unknown; error: unknown }>
    }
    const { data: claim, error: claimError } = await rpc.rpc('fa_claim_access_attempt', {
      p_group_id: input.groupId,
      p_ip_hash: ipHash,
    })
    if (claimError || !claim || typeof claim !== 'object' || !('allowed' in claim) || claim.allowed !== true) return null

    const { data: group, error: groupError } = await this.client
      .from('meeting_groups')
      .select('id,meeting_id')
      .eq('id', input.groupId)
      .maybeSingle()
    if (groupError || !group) return null

    const { data: meeting, error: meetingError } = await this.client
      .from('meetings')
      .select('id,status')
      .eq('id', group.meeting_id)
      .eq('status', 'active')
      .maybeSingle()
    if (meetingError || !meeting) return null

    const { data: access, error: accessError } = await this.client
      .from('fa_access_codes')
      .select('code_hash,expires_at')
      .eq('meeting_id', meeting.id)
      .eq('group_id', group.id)
      .eq('is_active', true)
      .maybeSingle()
    if (accessError || !access) return null
    if (access.expires_at && Date.parse(access.expires_at) <= this.now().getTime()) return null

    const submittedHash = hashFaAccessCode(input.accessCode, this.env.FA_CODE_PEPPER)
    if (!safelyMatchesHash(submittedHash, access.code_hash)) return null

    const { error: clearError } = await rpc.rpc('fa_clear_access_attempts', {
      p_group_id: input.groupId,
      p_ip_hash: ipHash,
    })
    if (clearError) return null

    const sessionId = randomUUID()
    const expiresAt = new Date(this.now().getTime() + 12 * 60 * 60 * 1000).toISOString()
    const sessionHash = createHmac('sha256', this.env.FA_SESSION_SIGNING_SECRET)
      .update(sessionId, 'utf8')
      .digest('hex')
    const { error: insertError } = await this.client.from('fa_sessions').insert({
      id: sessionId,
      meeting_id: meeting.id,
      group_id: group.id,
      session_hash: sessionHash,
      expires_at: expiresAt,
      user_agent: input.userAgent?.slice(0, 500) ?? null,
    })
    if (insertError) return null

    return { sessionId, meetingId: meeting.id, groupId: group.id, expiresAt }
  }

  async getBootstrap(claims: FaSessionClaims): Promise<FaBootstrapData | null> {
    const { data: session, error: sessionError } = await this.client
      .from('fa_sessions')
      .select('id,meeting_id,group_id,expires_at,revoked_at')
      .eq('id', claims.sessionId)
      .maybeSingle()
    if (sessionError || !session || session.revoked_at) return null
    if (session.meeting_id !== claims.meetingId || session.group_id !== claims.groupId) return null
    if (Date.parse(session.expires_at) <= this.now().getTime()) return null

    const [
      { data: meeting, error: meetingError },
      { data: group, error: groupError },
      { data: issues, error: issueError },
    ] = await Promise.all([
      this.client
        .from('meetings')
        .select('id,title,fiscal_year,meeting_date,starts_at,ends_at,location,status,created_at,updated_at')
        .eq('id', claims.meetingId)
        .eq('status', 'active')
        .maybeSingle(),
      this.client
        .from('meeting_groups')
        .select('id,meeting_id,group_no,name,scope,presenter,status,row_version,finalized_at,created_at,updated_at')
        .eq('id', claims.groupId)
        .eq('meeting_id', claims.meetingId)
        .maybeSingle(),
      this.client
        .from('issues')
        .select('id,group_id,position,topic,findings,proposal,action_plan,evaluation,stakeholder_roles,row_version,created_at,updated_at')
        .eq('meeting_id', claims.meetingId)
        .eq('group_id', claims.groupId)
        .is('deleted_at', null)
        .order('position', { ascending: true }),
    ])
    if (meetingError || !meeting) return null
    if (groupError || !group) return null
    if (issueError || !issues) return null

    return {
      meeting: {
        id: meeting.id,
        title: meeting.title,
        fiscalYear: String(meeting.fiscal_year),
        meetingDate: meeting.meeting_date,
        startTime: meeting.starts_at.slice(0, 5),
        endTime: meeting.ends_at.slice(0, 5),
        location: meeting.location,
        status: 'active',
        isActive: true,
        createdAt: meeting.created_at,
        updatedAt: meeting.updated_at,
      },
      group: {
        id: group.id,
        meetingId: group.meeting_id,
        groupNo: group.group_no,
        groupName: group.name,
        groupDescription: group.scope,
        presenter: group.presenter,
        status: group.status,
        rowVersion: group.row_version,
        finalizedAt: group.finalized_at,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
      },
      issues: issues.map((issue) => ({
        id: issue.id,
        groupId: issue.group_id,
        sortOrder: issue.position + 1,
        topic: issue.topic,
        findings: issue.findings,
        proposal: issue.proposal,
        actionPlan: issue.action_plan,
        monitoring: issue.evaluation,
        stakeholderRoles: issue.stakeholder_roles,
        rowVersion: issue.row_version,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
      })),
    }
  }
}
