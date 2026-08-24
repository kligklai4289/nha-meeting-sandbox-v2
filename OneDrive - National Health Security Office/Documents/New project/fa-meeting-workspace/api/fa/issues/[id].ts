import { z } from 'zod'
import { createFaMutationHandler } from '../../_lib/faMutationHandler.js'
import { SupabaseFaMutationGateway, type FaMutationGateway } from '../../_lib/faMutations.js'
import { json } from '../../_lib/http.js'
import { getRequestId } from '../../_lib/request.js'
import { parseServerEnv } from '../../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../../_lib/supabaseServer.js'

const bodySchema = z.object({
  mutationId: z.uuid(),
  expectedRowVersion: z.number().int().positive(),
}).strict()

function issueIdFromRequest(request: Request): string | null {
  const candidate = new URL(request.url).pathname.split('/').filter(Boolean).at(-1)
  const parsed = z.uuid().safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function createFaDeleteIssueHandler(gateway: FaMutationGateway, signingSecret: string, now?: () => Date) {
  return {
    async fetch(request: Request): Promise<Response> {
      const requestId = getRequestId(request)
      if (!issueIdFromRequest(request)) {
        return json(400, { status: 'error', code: 'INVALID_REQUEST', requestId }, requestId)
      }
      return createFaMutationHandler({
        gateway, signingSecret, now, method: 'DELETE', kind: 'issue_delete', schema: bodySchema,
        targetId: (_body, targetRequest) => issueIdFromRequest(targetRequest),
        payload: () => ({}),
      }).fetch(request)
    },
  }
}

const handler = {
  async fetch(request: Request): Promise<Response> {
    const requestId = getRequestId(request)
    try {
      const env = parseServerEnv(process.env)
      return createFaDeleteIssueHandler(new SupabaseFaMutationGateway(createSupabaseServerClient(env)), env.FA_SESSION_SIGNING_SECRET).fetch(request)
    } catch {
      return json(503, { status: 'error', code: 'FA_MUTATION_UNAVAILABLE', requestId }, requestId)
    }
  },
}

export default handler
