import { z } from 'zod'
import { createFaMutationHandler } from '../_lib/faMutationHandler.js'
import { SupabaseFaMutationGateway, type FaMutationGateway } from '../_lib/faMutations.js'
import { json } from '../_lib/http.js'
import { getRequestId } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'

const schema = z.object({
  mutationId: z.uuid(),
  expectedRowVersion: z.literal(0),
  items: z.array(z.object({
    id: z.uuid(),
    expectedRowVersion: z.number().int().positive(),
    position: z.number().int().min(0),
    topic: z.string().max(20_000),
    findings: z.string().max(20_000),
    proposal: z.string().max(20_000),
    actionPlan: z.string().max(20_000),
    monitoring: z.string().max(20_000),
    stakeholderRoles: z.string().max(20_000),
  }).strict()).min(1).max(200),
}).strict().superRefine((value, context) => {
  if (new Set(value.items.map((item) => item.id)).size !== value.items.length) {
    context.addIssue({ code: 'custom', message: 'duplicate issue id' })
  }
  const positions = value.items.map((item) => item.position).sort((a, b) => a - b)
  if (positions.some((position, index) => position !== index)) {
    context.addIssue({ code: 'custom', message: 'positions must be contiguous' })
  }
})

export function createFaReorderIssuesHandler(
  gateway: FaMutationGateway,
  signingSecret: string,
  now?: () => Date,
) {
  return createFaMutationHandler({
    gateway, signingSecret, now,
    method: 'POST',
    kind: 'issues_reorder',
    schema,
    payload: ({ items }) => ({ items }),
  })
}

const handler = {
  async fetch(request: Request): Promise<Response> {
    const requestId = getRequestId(request)
    try {
      const env = parseServerEnv(process.env)
      return createFaReorderIssuesHandler(
        new SupabaseFaMutationGateway(createSupabaseServerClient(env)),
        env.FA_SESSION_SIGNING_SECRET,
      ).fetch(request)
    } catch {
      return json(503, { status: 'error', code: 'FA_MUTATION_UNAVAILABLE', requestId }, requestId)
    }
  },
}

export default handler
