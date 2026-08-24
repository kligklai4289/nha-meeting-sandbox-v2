import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/services/supabase/database.types.js'
import type { MeetingGroup } from '../../src/domain/group.js'
import type { Issue } from '../../src/domain/issue.js'
import type { Meeting } from '../../src/domain/meeting.js'

export type ExportSnapshot = { meeting: Meeting; groups: Array<MeetingGroup & { issues: Issue[] }> }
export type ExportRequest = { scope: 'group' | 'all'; groupId?: string; draft: boolean }

export interface ExportGateway {
  authorize(token: string): Promise<string | null>
  load(actorId: string, request: ExportRequest): Promise<ExportSnapshot | null>
  audit(actorId: string, format: 'excel' | 'powerpoint', request: ExportRequest, snapshot: ExportSnapshot): Promise<void>
}

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>
}

type RawExportSnapshot = {
  meeting: Database['public']['Tables']['meetings']['Row']
  groups: Array<Database['public']['Tables']['meeting_groups']['Row'] & {
    issues: Database['public']['Tables']['issues']['Row'][]
  }>
}

function isRawExportSnapshot(value: unknown): value is RawExportSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RawExportSnapshot>
  return Boolean(candidate.meeting && Array.isArray(candidate.groups))
}

export class SupabaseExportGateway implements ExportGateway {
  private readonly client: SupabaseClient<Database>
  constructor(client: SupabaseClient<Database>) { this.client = client }

  async authorize(token: string) {
    const { data, error } = await this.client.auth.getUser(token)
    if (error || !data.user) return null
    const { data: profile, error: profileError } = await this.client.from('admin_profiles')
      .select('user_id,role,is_active').eq('user_id', data.user.id).eq('is_active', true).maybeSingle()
    return !profileError && profile?.role === 'admin' ? data.user.id : null
  }

  async load(actorId: string, request: ExportRequest): Promise<ExportSnapshot | null> {
    const { data, error } = await (this.client as unknown as RpcClient).rpc('admin_export_snapshot', {
      p_actor_id: actorId,
      p_scope: request.scope,
      p_group_id: request.groupId ?? null,
    })
    if (error || !isRawExportSnapshot(data) || data.groups.length === 0) return null
    const meeting = data.meeting
    return {
      meeting: {
        id: meeting.id,
        title: meeting.title,
        fiscalYear: String(meeting.fiscal_year),
        meetingDate: meeting.meeting_date,
        startTime: meeting.starts_at.slice(0, 5),
        endTime: meeting.ends_at.slice(0, 5),
        location: meeting.location,
        isActive: meeting.status === 'active',
        createdAt: meeting.created_at,
        updatedAt: meeting.updated_at,
      },
      groups: data.groups.map((group) => ({
        id: group.id, meetingId: group.meeting_id, groupNo: group.group_no as 1 | 2 | 3,
        groupName: group.name, groupDescription: group.scope, presenter: group.presenter,
        status: group.status, rowVersion: group.row_version, finalizedAt: group.finalized_at,
        createdAt: group.created_at, updatedAt: group.updated_at,
        issues: group.issues.map((issue) => ({
          id: issue.id, groupId: issue.group_id, sortOrder: issue.position + 1,
          topic: issue.topic, findings: issue.findings, proposal: issue.proposal,
          actionPlan: issue.action_plan, monitoring: issue.evaluation,
          stakeholderRoles: issue.stakeholder_roles, rowVersion: issue.row_version,
          createdAt: issue.created_at, updatedAt: issue.updated_at,
        })),
      })),
    }
  }

  async audit(actorId: string, format: 'excel' | 'powerpoint', request: ExportRequest, snapshot: ExportSnapshot) {
    const { error } = await this.client.from('audit_logs').insert({
      actor_type: 'admin', actor_id: actorId, action: `admin_export_${format}`,
      target_table: 'meetings', target_id: snapshot.meeting.id, meeting_id: snapshot.meeting.id,
      group_id: request.scope === 'group' ? request.groupId ?? null : null,
      after_data: { scope: request.scope, draft: request.draft, groupCount: snapshot.groups.length },
    })
    if (error) throw new Error('EXPORT_AUDIT_FAILED')
  }
}

export function parseExportRequest(url: URL): ExportRequest | null {
  const scope = url.searchParams.get('scope')
  const groupId = url.searchParams.get('groupId') ?? undefined
  if (scope !== 'group' && scope !== 'all') return null
  if (scope === 'group' && !groupId) return null
  return { scope, groupId, draft: url.searchParams.get('draft') === 'true' }
}
