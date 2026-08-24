import { z } from 'zod'
import { createFaMutationHandler } from '../_lib/faMutationHandler.js'
import { SupabaseFaMutationGateway, type FaMutationGateway } from '../_lib/faMutations.js'
import { json } from '../_lib/http.js'
import { getRequestId } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'

const schema = z.object({
  mutationId: z.uuid(),
  expectedRowVersion: z.number().int().positive(),
}).strict()

export function createFaFinalizeHandler(gateway: FaMutationGateway, signingSecret: string, now?: () => Date) {
  return createFaMutationHandler({
    gateway, signingSecret, now, method: 'POST', kind: 'group_finalize', schema,
    payload: () => ({}),
  })
}

const handler = {
  async fetch(request: Request): Promise<Response> {
    const requestId = getRequestId(request)
    try {
      const env = parseServerEnv(process.env)
      return createFaFinalizeHandler(new SupabaseFaMutationGateway(createSupabaseServerClient(env)), env.FA_SESSION_SIGNING_SECRET).fetch(request)
    } catch {
      return json(503, { status: 'error', code: 'FA_MUTATION_UNAVAILABLE', requestId }, requestId)
    }
  },
}

export default handler
