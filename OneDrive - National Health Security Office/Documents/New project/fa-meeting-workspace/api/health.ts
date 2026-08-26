import { json } from './_lib/http.js'
import { parseServerEnv } from './_lib/serverEnv.js'

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}

function getRequestId(request: Request): string {
  return request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
}

const health = {
  fetch(request: Request): Response {
    const requestId = getRequestId(request)

    if (request.method !== 'GET') {
      return json(405, {
        status: 'error',
        code: 'METHOD_NOT_ALLOWED',
        requestId,
      }, requestId, { allow: 'GET' })
    }

    try {
      const runtimeEnv = (globalThis as RuntimeGlobal).process?.env ?? {}
      parseServerEnv(runtimeEnv)
    } catch {
      return json(503, {
        status: 'error',
        code: 'SERVER_NOT_CONFIGURED',
        requestId,
      }, requestId)
    }

    return json(200, {
      status: 'ok',
      environment: 'configured',
      requestId,
    }, requestId)
  },
}

export default health
