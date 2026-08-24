import { json } from '../_lib/http.js'
import { SupabaseFaGateway, type FaBootstrapGateway } from '../_lib/faAuthorization.js'
import { getFaSessionCookie, verifyFaSessionToken } from '../_lib/faSession.js'
import { getRequestId } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'

type Handler = { fetch(request: Request): Promise<Response> }

export function createFaBootstrapHandler(
  gateway: FaBootstrapGateway,
  signingSecret: string,
  now: () => Date = () => new Date(),
): Handler {
  return {
    async fetch(request: Request): Promise<Response> {
      const requestId = getRequestId(request)
      if (request.method !== 'GET') {
        return json(405, { status: 'error', code: 'METHOD_NOT_ALLOWED', requestId }, requestId, { allow: 'GET' })
      }
      const token = getFaSessionCookie(request)
      const claims = token ? verifyFaSessionToken(token, signingSecret, now()) : null
      if (!claims) {
        return json(401, { status: 'error', code: 'FA_SESSION_INVALID', requestId }, requestId)
      }

      try {
        const data = await gateway.getBootstrap(claims)
        if (!data) {
          return json(401, { status: 'error', code: 'FA_SESSION_INVALID', requestId }, requestId)
        }
        return json(200, { data, requestId }, requestId)
      } catch {
        return json(503, { status: 'error', code: 'FA_DATA_UNAVAILABLE', requestId }, requestId)
      }
    },
  }
}

const handler: Handler = {
  async fetch(request: Request): Promise<Response> {
    const requestId = getRequestId(request)
    try {
      const env = parseServerEnv(process.env)
      return createFaBootstrapHandler(
        new SupabaseFaGateway(createSupabaseServerClient(env), env),
        env.FA_SESSION_SIGNING_SECRET,
      ).fetch(request)
    } catch {
      return json(503, { status: 'error', code: 'FA_DATA_UNAVAILABLE', requestId }, requestId)
    }
  },
}

export default handler
