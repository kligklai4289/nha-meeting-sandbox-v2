import { z } from 'zod'
import type { FaRepository } from '../faRepository'
import { faGroupSchema, faIssueSchema } from '../faContracts'
import type { OfflineMutation } from './offlineQueue'

const offlineIssueSchema = faIssueSchema.extend({ rowVersion: z.number().int().nonnegative() })

function parsePayload<T>(result: z.ZodSafeParseResult<T>): T {
  if (!result.success) throw new Error('INVALID_OFFLINE_MUTATION')
  return result.data
}

export async function processOfflineMutation(
  repository: FaRepository,
  mutation: OfflineMutation,
): Promise<void> {
  if (mutation.kind === 'issue_upsert') {
    const payload = parsePayload(z.object({ issue: offlineIssueSchema }).safeParse(mutation.payload))
    await repository.upsertIssue(payload.issue, mutation.id)
    return
  }
  if (mutation.kind === 'issue_delete') {
    const payload = parsePayload(z.object({ issue: faIssueSchema }).safeParse(mutation.payload))
    await repository.deleteIssue(payload.issue, mutation.id)
    return
  }
  if (mutation.kind === 'group_update') {
    const payload = parsePayload(z.object({ group: faGroupSchema }).safeParse(mutation.payload))
    await repository.saveGroup(payload.group, mutation.id)
    return
  }
  if (mutation.kind === 'group_finalize') {
    const payload = parsePayload(z.object({ group: faGroupSchema }).safeParse(mutation.payload))
    await repository.finalize(payload.group, mutation.id)
    return
  }
  if (mutation.kind === 'issues_reorder') {
    const payload = parsePayload(z.object({ issues: z.array(faIssueSchema).min(1).max(200) }).safeParse(mutation.payload))
    await repository.reorderIssues(payload.issues, mutation.id)
    return
  }
  throw new Error('INVALID_OFFLINE_MUTATION')
}
