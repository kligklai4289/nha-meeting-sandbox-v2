import { json } from './http.js'

export function getRequestId(request: Request): string {
  return request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
}

export function methodNotAllowed(requestId: string): Response {
  return json(405, {
    status: 'error',
    code: 'METHOD_NOT_ALLOWED',
    requestId,
  }, requestId, { allow: 'GET' })
}
