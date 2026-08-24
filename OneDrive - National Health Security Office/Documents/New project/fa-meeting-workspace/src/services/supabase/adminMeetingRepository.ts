import type { SupabaseClient } from '@supabase/supabase-js'
import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'
import type { Meeting, MeetingWithGroups } from '../../domain/meeting'
import type { MeetingRepository } from '../meetingRepository'
import type { Database, Json, Tables } from './database.types'

type MeetingRow = Tables<'meetings'>
type GroupRow = Tables<'meeting_groups'>
type IssueRow = Tables<'issues'>

export interface AdminMeetingGateway {
  getActiveMeeting(): Promise<MeetingRow | null>
  getGroups(meetingId: string): Promise<GroupRow[]>
  getGroup(groupId: string): Promise<GroupRow | null>
  getIssues(groupId: string): Promise<IssueRow[]>
  updateMeeting(meeting: Meeting): Promise<MeetingRow>
  updateGroup(group: MeetingGroup): Promise<GroupRow>
  saveGroupBundle(group: MeetingGroup, issues: Issue[]): Promise<{ group: GroupRow; issues: IssueRow[] }>
  subscribe(meetingId: string, onChange: () => void): () => void
}

function mapMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    fiscalYear: String(row.fiscal_year),
    meetingDate: row.meeting_date,
    startTime: row.starts_at.slice(0, 5),
    endTime: row.ends_at.slice(0, 5),
    location: row.location,
    isActive: row.status === 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapGroup(row: GroupRow): MeetingGroup {
  if (row.group_no < 1 || row.group_no > 3) throw new Error('ADMIN_DATA_INVALID')
  return {
    id: row.id,
    meetingId: row.meeting_id,
    groupNo: row.group_no as 1 | 2 | 3,
    groupName: row.name,
    groupDescription: row.scope,
    presenter: row.presenter,
    status: row.status,
    rowVersion: row.row_version,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    groupId: row.group_id,
    sortOrder: row.position + 1,
    topic: row.topic,
    findings: row.findings,
    proposal: row.proposal,
    actionPlan: row.action_plan,
    monitoring: row.evaluation,
    stakeholderRoles: row.stakeholder_roles,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function ensure<T>(data: T | null, error: unknown, missingCode = 'ADMIN_DATA_CONFLICT'): T {
  if (error) throw new Error('ADMIN_DATA_UNAVAILABLE')
  if (data === null) throw new Error(missingCode)
  return data
}

type RpcClient = {
  rpc(name: string, args: Record<string, Json>): Promise<{ data: unknown; error: unknown }>
}

export class SupabaseAdminMeetingGateway implements AdminMeetingGateway {
  private readonly client: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  async getActiveMeeting() {
    const { data, error } = await this.client.from('meetings').select('*').eq('status', 'active').maybeSingle()
    if (error) throw new Error('ADMIN_DATA_UNAVAILABLE')
    return data
  }

  async getGroups(meetingId: string) {
    const { data, error } = await this.client.from('meeting_groups').select('*').eq('meeting_id', meetingId).order('group_no')
    if (error) throw new Error('ADMIN_DATA_UNAVAILABLE')
    return data
  }

  async getGroup(groupId: string) {
    const { data, error } = await this.client.from('meeting_groups').select('*').eq('id', groupId).maybeSingle()
    if (error) throw new Error('ADMIN_DATA_UNAVAILABLE')
    return data
  }

  async getIssues(groupId: string) {
    const { data, error } = await this.client.from('issues').select('*').eq('group_id', groupId).is('deleted_at', null).order('position')
    if (error) throw new Error('ADMIN_DATA_UNAVAILABLE')
    return data
  }

  async updateMeeting(meeting: Meeting) {
    const { data, error } = await this.client.from('meetings').update({
      title: meeting.title,
      fiscal_year: Number(meeting.fiscalYear),
      meeting_date: meeting.meetingDate,
      starts_at: meeting.startTime,
      ends_at: meeting.endTime,
      location: meeting.location,
      status: meeting.isActive ? 'active' : 'draft',
    }).eq('id', meeting.id).eq('updated_at', meeting.updatedAt).select('*').maybeSingle()
    return ensure(data, error)
  }

  async updateGroup(group: MeetingGroup) {
    const { data, error } = await this.client.from('meeting_groups').update({
      name: group.groupName,
      scope: group.groupDescription,
      presenter: group.presenter,
      status: group.status,
      finalized_at: group.finalizedAt,
    }).eq('id', group.id).eq('row_version', group.rowVersion).select('*').maybeSingle()
    return ensure(data, error)
  }

  async saveGroupBundle(group: MeetingGroup, issues: Issue[]) {
    const rpc = this.client as unknown as RpcClient
    const { data, error } = await rpc.rpc('admin_save_group_bundle', {
      p_group_id: group.id,
      p_expected_group_version: group.rowVersion,
      p_group: {
        name: group.groupName,
        scope: group.groupDescription,
        presenter: group.presenter,
        status: group.status,
        finalizedAt: group.finalizedAt,
      },
      p_issues: issues.map((issue) => ({
        id: issue.id,
        expectedRowVersion: issue.rowVersion,
        position: issue.sortOrder - 1,
        topic: issue.topic,
        findings: issue.findings,
        proposal: issue.proposal,
        actionPlan: issue.actionPlan,
        monitoring: issue.monitoring,
        stakeholderRoles: issue.stakeholderRoles,
      })),
    })
    if (error) throw new Error('ADMIN_DATA_UNAVAILABLE')
    if (!data || typeof data !== 'object' || !('group' in data) || !('issues' in data)) {
      throw new Error('ADMIN_DATA_INVALID')
    }
    return data as { group: GroupRow; issues: IssueRow[] }
  }

  subscribe(meetingId: string, onChange: () => void) {
    const channel = this.client.channel(`admin-meeting-${meetingId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_groups', filter: `meeting_id=eq.${meetingId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues', filter: `meeting_id=eq.${meetingId}` }, onChange)
      .subscribe()
    return () => { void this.client.removeChannel(channel) }
  }
}

export class AdminMeetingRepository implements MeetingRepository {
  private readonly gateway: AdminMeetingGateway

  constructor(gateway: AdminMeetingGateway) {
    this.gateway = gateway
  }

  async getActiveMeeting(): Promise<MeetingWithGroups | null> {
    const row = await this.gateway.getActiveMeeting()
    if (!row) return null
    const groups = await this.gateway.getGroups(row.id)
    return { ...mapMeeting(row), groups: groups.map(mapGroup) }
  }

  async getGroup(groupId: string) {
    const row = await this.gateway.getGroup(groupId)
    return row ? mapGroup(row) : null
  }

  async getIssues(groupId: string) {
    return (await this.gateway.getIssues(groupId)).map(mapIssue)
  }

  async saveMeeting(meeting: Meeting) {
    return mapMeeting(await this.gateway.updateMeeting(meeting))
  }

  async saveGroup(group: MeetingGroup) {
    return mapGroup(await this.gateway.updateGroup(group))
  }

  async saveIssues(groupId: string, issues: Issue[]) {
    const group = await this.getGroup(groupId)
    if (!group) throw new Error('ADMIN_GROUP_NOT_FOUND')
    return (await this.saveGroupBundle(group, issues)).issues
  }

  async saveGroupBundle(group: MeetingGroup, issues: Issue[]) {
    const saved = await this.gateway.saveGroupBundle(group, issues)
    return { group: mapGroup(saved.group), issues: saved.issues.map(mapIssue) }
  }

  subscribe(meetingId: string, onChange: () => void) {
    return this.gateway.subscribe(meetingId, onChange)
  }

  async reset(): Promise<void> {
    throw new Error('ADMIN_RESET_UNSUPPORTED')
  }
}
