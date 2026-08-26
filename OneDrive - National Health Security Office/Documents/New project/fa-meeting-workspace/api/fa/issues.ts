import { z } from 'zod'
import { createFaMutationHandler } from '../_lib/faMutationHandler.js'
import { SupabaseFaMutationGateway, type FaMutationGateway } from '../_lib/faMutations.js'
import { json } from '../_lib/http.js'
import { getRequestId } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'

const schema = z.object({
  mutationId: z.uuid(),
  issueId: z.uuid(),
  expectedRowVersion: z.number().int().min(0),
  position: z.number().int().min(0),
  topic: z.string().max(20_000),
  findings: z.string().max(20_000),
  proposal: z.string().max(20_000),
  actionPlan: z.string().max(20_000),
  monitoring: z.string().max(20_000),
  stakeholderRoles: z.string().max(20_000),
}).strict()

export function createFaIssuesHandler(
  gateway: FaMutationGateway,
  signingSecret: string,
  now?: () => Date,
) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method !== 'POST' && request.method !== 'PATCH') {
        const requestId = getRequestId(request)
        return json(405, { status: 'error', code: 'METHOD_NOT_ALLOWED', requestId }, requestId, { allow: 'POST, PATCH' })
      }
      return createFaMutationHandler({
        gateway, signingSecret, now,
        method: request.method,
        kind: 'issue_upsert',
        schema,
        targetId: (body) => body.issueId,
        payload: ({ position, topic, findings, proposal, actionPlan, monitoring, stakeholderRoles }) => ({
          position, topic, findings, proposal, actionPlan, monitoring, stakeholderRoles,
        }),
      }).fetch(request)
    },
  }
}

const handler = {
  async fetch(request: Request): Promise<Response> {
    const requestId = getRequestId(request)
    try {
      const env = parseServerEnv(process.env)
      return createFaIssuesHandler(
        new SupabaseFaMutationGateway(createSupabaseServerClient(env)),
        env.FA_SESSION_SIGNING_SECRET,
      ).fetch(request)
    } catch {
      return json(503, { status: 'error', code: 'FA_MUTATION_UNAVAILABLE', requestId }, requestId)
    }
  },
}

export default handler
