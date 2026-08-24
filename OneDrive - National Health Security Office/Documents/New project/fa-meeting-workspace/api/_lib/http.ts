export function json(
  status: number,
  body: unknown,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-request-id': requestId,
      ...extraHeaders,
    },
  })
}
