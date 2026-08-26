import { z } from 'zod'
import { json } from '../_lib/http.js'
import {
  SupabaseFaGateway,
  type FaBootstrapGateway,
  type FaSessionGateway,
} from '../_lib/faAuthorization.js'
import { createFaSessionCookie, createFaSessionToken } from '../_lib/faSession.js'
import { getRequestId } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'

const inputSchema = z.object({
  groupId: z.uuid(),
  accessCode: z.string().regex(/^\d{4}$/),
})

function clientAddress(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown'
}

type Handler = { fetch(request: Request): Promise<Response> }
type SessionGateway = FaSessionGateway & Partial<FaBootstrapGateway>

export function createFaSessionHandler(
  gateway: SessionGateway,
  signingSecret: string,
): Handler {
  return {
    async fetch(request: Request): Promise<Response> {
      const requestId = getRequestId(request)
      if (request.method !== 'POST') {
        return json(405, { status: 'error', code: 'METHOD_NOT_ALLOWED', requestId }, requestId, { allow: 'POST' })
      }

      let input: z.infer<typeof inputSchema>
      try {
        const result = inputSchema.safeParse(await request.json())
        if (!result.success) {
          return json(400, { status: 'error', code: 'INVALID_REQUEST', requestId }, requestId)
        }
        input = result.data
      } catch {
        return json(400, { status: 'error', code: 'INVALID_REQUEST', requestId }, requestId)
      }

      try {
        const claims = await gateway.exchangeAccessCode({
          ...input,
          userAgent: request.headers.get('user-agent'),
          clientAddress: clientAddress(request),
        })
        if (!claims) {
          return json(401, { status: 'error', code: 'FA_ACCESS_DENIED', requestId }, requestId)
        }
        const token = createFaSessionToken(claims, signingSecret)
        let workspace = null
        try {
          workspace = gateway.getBootstrap ? await gateway.getBootstrap(claims) : null
        } catch {
          // Session creation remains usable through the existing bootstrap fallback.
        }
        return json(200, {
          data: {
            meetingId: claims.meetingId,
            groupId: claims.groupId,
            expiresAt: claims.expiresAt,
            ...(workspace ? { workspace } : {}),
          },
          requestId,
        }, requestId, { 'set-cookie': createFaSessionCookie(token, claims.expiresAt) })
      } catch {
        return json(503, { status: 'error', code: 'FA_SESSION_UNAVAILABLE', requestId }, requestId)
      }
    },
  }
}

const handler: Handler = {
  async fetch(request: Request): Promise<Response> {
    const requestId = getRequestId(request)
    try {
      const env = parseServerEnv(process.env)
      return createFaSessionHandler(
        new SupabaseFaGateway(createSupabaseServerClient(env), env),
        env.FA_SESSION_SIGNING_SECRET,
      ).fetch(request)
    } catch {
      return json(503, { status: 'error', code: 'FA_SESSION_UNAVAILABLE', requestId }, requestId)
    }
  },
}

export default handler
