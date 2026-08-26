import type { Issue } from '../domain/issue'
import type { MeetingGroup } from '../domain/group'
import type { FaRepository } from './faRepository'
import {
  type FaBootstrapData,
  faBootstrapResponseSchema,
  faDeleteMutationResponseSchema,
  faGroupMutationResponseSchema,
  faIssueMutationResponseSchema,
  faReorderMutationResponseSchema,
  faSessionResponseSchema,
} from './faContracts'

export type FaRepositoryErrorCode =
  | 'FA_ACCESS_DENIED'
  | 'FA_SESSION_INVALID'
  | 'VERSION_CONFLICT'
  | 'GROUP_FINALIZED'
  | 'MEETING_INACTIVE'
  | 'NETWORK_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'

export class FaRepositoryError extends Error {
  readonly code: FaRepositoryErrorCode
  readonly retryable: boolean

  constructor(code: FaRepositoryErrorCode, retryable = false) {
    super(code)
    this.name = 'FaRepositoryError'
    this.code = code
    this.retryable = retryable
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function mutationBody(issue: Issue, mutationId: string): Record<string, unknown> {
  return {
    mutationId,
    issueId: issue.id,
    expectedRowVersion: issue.rowVersion,
    position: issue.sortOrder - 1,
    topic: issue.topic,
    findings: issue.findings,
    proposal: issue.proposal,
    actionPlan: issue.actionPlan,
    monitoring: issue.monitoring,
    stakeholderRoles: issue.stakeholderRoles,
  }
}

export class HttpFaRepository implements FaRepository {
  private readonly fetcher: Fetcher
  private readonly createMutationId: () => string
  private bootstrapCache: FaBootstrapData | null = null

  constructor(
    fetcher: Fetcher = (input, init) => globalThis.fetch(input, init),
    createMutationId: () => string = () => crypto.randomUUID(),
  ) {
    this.fetcher = fetcher
    this.createMutationId = createMutationId
  }

  private async send(path: string, init: RequestInit): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetcher(path, { ...init, credentials: 'include' })
    } catch {
      throw new FaRepositoryError('NETWORK_UNAVAILABLE', true)
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new FaRepositoryError('SERVICE_UNAVAILABLE', response.status >= 500)
    }
    if (response.ok) return body

    const code = typeof body === 'object' && body !== null && 'code' in body
      ? String(body.code)
      : 'SERVICE_UNAVAILABLE'
    const knownCodes: FaRepositoryErrorCode[] = [
      'FA_ACCESS_DENIED', 'FA_SESSION_INVALID', 'VERSION_CONFLICT',
      'GROUP_FINALIZED', 'MEETING_INACTIVE', 'SERVICE_UNAVAILABLE',
    ]
    const safeCode = knownCodes.includes(code as FaRepositoryErrorCode)
      ? code as FaRepositoryErrorCode
      : 'SERVICE_UNAVAILABLE'
    throw new FaRepositoryError(safeCode, response.status >= 500)
  }

  async createSession(groupId: string, accessCode: string) {
    this.bootstrapCache = null
    const body = await this.send('/api/fa/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ groupId, accessCode }),
    })
    const { workspace, ...session } = faSessionResponseSchema.parse(body).data
    this.bootstrapCache = workspace ?? null
    return session
  }

  async upsertIssue(issue: Issue, mutationId = this.createMutationId()): Promise<Issue> {
    const body = await this.send('/api/fa/issues', {
      method: issue.rowVersion === 0 ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mutationBody(issue, mutationId)),
    })
    return faIssueMutationResponseSchema.parse(body).data
  }

  async deleteIssue(issue: Issue, mutationId = this.createMutationId()): Promise<void> {
    const body = await this.send(`/api/fa/issues/${encodeURIComponent(issue.id)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mutationId,
        expectedRowVersion: issue.rowVersion,
      }),
    })
    faDeleteMutationResponseSchema.parse(body)
  }

  async reorderIssues(issues: Issue[], mutationId = this.createMutationId()): Promise<Issue[]> {
    const body = await this.send('/api/fa/reorder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mutationId,
        expectedRowVersion: 0,
        items: issues.map((issue) => ({
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
      }),
    })
    return faReorderMutationResponseSchema.parse(body).data.issues
  }

  async bootstrap() {
    if (this.bootstrapCache) {
      const cached = this.bootstrapCache
      this.bootstrapCache = null
      return cached
    }
    const body = await this.send('/api/fa/bootstrap', { method: 'GET' })
    return faBootstrapResponseSchema.parse(body).data
  }

  async saveGroup(group: MeetingGroup, mutationId = this.createMutationId()): Promise<MeetingGroup> {
    const body = await this.send('/api/fa/group', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mutationId,
        expectedRowVersion: group.rowVersion,
        presenter: group.presenter,
        status: group.status,
      }),
    })
    const saved = faGroupMutationResponseSchema.parse(body).data
    return { ...group, ...saved }
  }

  async finalize(group: MeetingGroup, mutationId = this.createMutationId()): Promise<MeetingGroup> {
    const body = await this.send('/api/fa/finalize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mutationId,
        expectedRowVersion: group.rowVersion,
      }),
    })
    const saved = faGroupMutationResponseSchema.parse(body).data
    return { ...group, ...saved }
  }
}
