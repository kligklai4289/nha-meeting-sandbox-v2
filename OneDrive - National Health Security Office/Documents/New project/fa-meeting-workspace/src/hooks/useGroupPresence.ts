import { useEffect, useMemo, useState } from 'react'

export interface PresenceChannel {
  on(type: 'presence', filter: { event: 'sync' }, callback: () => void): PresenceChannel
  subscribe(callback: (status: string) => void): PresenceChannel
  track(payload: Record<string, unknown>): Promise<unknown>
  untrack(): Promise<unknown>
  presenceState(): Record<string, unknown[]>
}

export interface PresenceClient {
  channel(name: string, options: { config: { presence: { key: string } } }): PresenceChannel
  removeChannel(channel: PresenceChannel): Promise<unknown>
}

type PresenceInput = {
  client: PresenceClient
  meetingId: string
  groupId: string
  enabled?: boolean
}

export function useGroupPresence({ client, meetingId, groupId, enabled = true }: PresenceInput) {
  const [count, setCount] = useState(1)
  const presenceKey = useMemo(() => crypto.randomUUID(), [])

  useEffect(() => {
    if (!enabled) return
    const channel = client.channel(`fa-presence:${meetingId}:${groupId}`, {
      config: { presence: { key: presenceKey } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const nextCount = Object.values(channel.presenceState())
          .reduce((total, entries) => total + entries.length, 0)
        setCount(Math.max(1, nextCount))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ joinedAt: new Date().toISOString() })
        }
      })

    return () => {
      void channel.untrack()
      void client.removeChannel(channel)
    }
  }, [client, enabled, groupId, meetingId, presenceKey])

  return { count, hasConcurrentEditor: count > 1 }
}
