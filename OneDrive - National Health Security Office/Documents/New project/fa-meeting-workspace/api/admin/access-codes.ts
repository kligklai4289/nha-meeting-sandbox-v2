import { z } from 'zod'
import { SupabaseAdminAccessCodeGateway, type AdminAccessCodeGateway } from '../_lib/adminAuthorization.js'
import { hashFaAccessCode } from '../_lib/faSession.js'
import { json } from '../_lib/http.js'
import { getRequestId } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'

const inputSchema = z.object({ groupId: z.uuid(), accessCode: z.string().regex(/^\d{4}$/) })

function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization') ?? ''
  const match = /^Bearer ([^\s]+)$/.exec(value)
  return match?.[1] ?? null
}

type Handler = { fetch(request: Request): Promise<Response> }

export function createAdminAccessCodeHandler(
  gateway: AdminAccessCodeGateway,
  pepper: string,
): Handler {
  return {
    async fetch(request) {
      const requestId = getRequestId(request)
      if (request.method !== 'POST') {
        return json(405, { status: 'error', code: 'METHOD_NOT_ALLOWED', requestId }, requestId, { allow: 'POST' })
      }
      const token = bearerToken(request)
      if (!token) return json(401, { status: 'error', code: 'ADMIN_UNAUTHENTICATED', requestId }, requestId)

      let admin
      try {
        admin = await gateway.authorize(token)
      } catch {
        console.error(JSON.stringify({ event: 'admin_access_code_authorization_failed', requestId }))
        return json(503, { status: 'error', code: 'ADMIN_AUTH_UNAVAILABLE', requestId }, requestId)
      }
      if (!admin) return json(403, { status: 'error', code: 'ADMIN_FORBIDDEN', requestId }, requestId)

      let input: z.infer<typeof inputSchema>
      try {
        const parsed = inputSchema.safeParse(await request.json())
        if (!parsed.success) return json(400, { status: 'error', code: 'INVALID_REQUEST', requestId }, requestId)
        input = parsed.data
      } catch {
        return json(400, { status: 'error', code: 'INVALID_REQUEST', requestId }, requestId)
      }

      try {
        const result = await gateway.rotate({
          actorId: admin.userId,
          groupId: input.groupId,
          codeHash: hashFaAccessCode(input.accessCode, pepper),
        })
        return json(201, {
          data: { groupId: input.groupId, ...result },
          requestId,
        }, requestId)
      } catch (error) {
        if (error instanceof Error && error.message === 'DUPLICATE_ACCESS_CODE') {
          return json(409, { status: 'error', code: 'DUPLICATE_ACCESS_CODE', requestId }, requestId)
        }
        console.error(JSON.stringify({ event: 'admin_access_code_rotation_failed', requestId }))
        return json(503, { status: 'error', code: 'ACCESS_CODE_ROTATION_FAILED', requestId }, requestId)
      }
    },
  }
}

const handler: Handler = {
  async fetch(request) {
    const requestId = getRequestId(request)
    try {
      const env = parseServerEnv(process.env)
      return createAdminAccessCodeHandler(
        new SupabaseAdminAccessCodeGateway(createSupabaseServerClient(env)),
        env.FA_CODE_PEPPER,
      ).fetch(request)
    } catch {
      return json(503, { status: 'error', code: 'ACCESS_CODE_ROTATION_FAILED', requestId }, requestId)
    }
  },
}

export default handler
