import type { z } from 'zod'
import { json } from './http.js'
import {
  mutationErrorStatus,
  type FaMutationGateway,
  type FaMutationKind,
} from './faMutations.js'
import { getFaSessionCookie, verifyFaSessionToken } from './faSession.js'
import { getRequestId } from './request.js'

interface MutationBody {
  mutationId: string
  expectedRowVersion: number
  issueId?: string
  [key: string]: unknown
}

export function createFaMutationHandler<T extends MutationBody>(options: {
  gateway: FaMutationGateway
  signingSecret: string
  method: 'POST' | 'PATCH' | 'DELETE'
  kind: FaMutationKind
  schema: z.ZodType<T>
  targetId?: (body: T, request: Request) => string | null
  payload: (body: T) => Record<string, unknown>
  now?: () => Date
}): { fetch(request: Request): Promise<Response> } {
  return {
    async fetch(request: Request): Promise<Response> {
      const requestId = getRequestId(request)
      if (request.method !== options.method) {
        return json(405, { status: 'error', code: 'METHOD_NOT_ALLOWED', requestId }, requestId, { allow: options.method })
      }
      const origin = request.headers.get('origin')
      if (origin !== new URL(request.url).origin) {
        return json(403, { status: 'error', code: 'ORIGIN_DENIED', requestId }, requestId)
      }
      const declaredLength = Number(request.headers.get('content-length') ?? '0')
      if (Number.isFinite(declaredLength) && declaredLength > 65_536) {
        return json(413, { status: 'error', code: 'PAYLOAD_TOO_LARGE', requestId }, requestId)
      }
      const token = getFaSessionCookie(request)
      const claims = token
        ? verifyFaSessionToken(token, options.signingSecret, (options.now ?? (() => new Date()))())
        : null
      if (!claims) {
        return json(401, { status: 'error', code: 'FA_SESSION_INVALID', requestId }, requestId)
      }

      let body: T
      try {
        const rawBody = await request.text()
        if (new TextEncoder().encode(rawBody).byteLength > 65_536) {
          return json(413, { status: 'error', code: 'PAYLOAD_TOO_LARGE', requestId }, requestId)
        }
        const parsed = options.schema.safeParse(JSON.parse(rawBody))
        if (!parsed.success) {
          return json(400, { status: 'error', code: 'INVALID_REQUEST', requestId }, requestId)
        }
        body = parsed.data
      } catch {
        return json(400, { status: 'error', code: 'INVALID_REQUEST', requestId }, requestId)
      }

      try {
        const result = await options.gateway.apply({
          claims,
          kind: options.kind,
          mutationId: body.mutationId,
          targetId: options.targetId?.(body, request) ?? null,
          expectedRowVersion: body.expectedRowVersion,
          payload: options.payload(body),
        })
        if (!result.ok) {
          return json(mutationErrorStatus(result.code), {
            status: 'error', code: result.code, requestId,
          }, requestId)
        }
        const successStatus = options.kind === 'issue_upsert'
          && body.expectedRowVersion === 0
          && !result.replayed
          ? 201
          : 200
        return json(successStatus, { data: result.data, replayed: result.replayed, requestId }, requestId)
      } catch {
        return json(503, { status: 'error', code: 'FA_MUTATION_UNAVAILABLE', requestId }, requestId)
      }
    },
  }
}
