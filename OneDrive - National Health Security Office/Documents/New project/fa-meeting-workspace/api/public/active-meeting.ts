import { json } from '../_lib/http.js'
import {
  type ActiveMeetingGateway,
  SupabasePublicMeetingGateway,
} from '../_lib/publicMeetingGateway.js'
import { getRequestId, methodNotAllowed } from '../_lib/request.js'
import { parseServerEnv } from '../_lib/serverEnv.js'
import { createSupabaseServerClient } from '../_lib/supabaseServer.js'

type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}

type ActiveMeetingHandler = {
  fetch(request: Request): Promise<Response>
}

async function getActiveMeetingResponse(
  gateway: ActiveMeetingGateway,
  requestId: string,
): Promise<Response> {
  try {
    const data = await gateway.getActiveMeeting()
    return json(200, { data, requestId }, requestId)
  } catch {
    return json(503, {
      status: 'error',
      code: 'MEETING_DIRECTORY_UNAVAILABLE',
      requestId,
    }, requestId)
  }
}

export function createActiveMeetingHandler(
  gateway: ActiveMeetingGateway,
): ActiveMeetingHandler {
  return {
    async fetch(request: Request): Promise<Response> {
      const requestId = getRequestId(request)

      if (request.method !== 'GET') {
        return methodNotAllowed(requestId)
      }

      return getActiveMeetingResponse(gateway, requestId)
    },
  }
}

const activeMeeting: ActiveMeetingHandler = {
  async fetch(request: Request): Promise<Response> {
    const requestId = getRequestId(request)

    if (request.method !== 'GET') {
      return methodNotAllowed(requestId)
    }

    try {
      const runtimeEnv = (globalThis as RuntimeGlobal).process?.env ?? {}
      const client = createSupabaseServerClient(parseServerEnv(runtimeEnv))
      const gateway = new SupabasePublicMeetingGateway(client)
      return getActiveMeetingResponse(gateway, requestId)
    } catch {
      return json(503, {
        status: 'error',
        code: 'MEETING_DIRECTORY_UNAVAILABLE',
        requestId,
      }, requestId)
    }
  },
}

export default activeMeeting
