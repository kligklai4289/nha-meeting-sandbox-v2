import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGroupPresence, type PresenceClient, type PresenceChannel } from './useGroupPresence'

class FakeChannel implements PresenceChannel {
  sync: (() => void) | null = null
  state: Record<string, unknown[]> = {}
  on(_type: 'presence', _filter: { event: 'sync' }, callback: () => void) { this.sync = callback; return this }
  subscribe(callback: (status: string) => void) { callback('SUBSCRIBED'); return this }
  track = vi.fn().mockResolvedValue('ok')
  untrack = vi.fn().mockResolvedValue('ok')
  presenceState() { return this.state }
}

describe('useGroupPresence', () => {
  it('warns when two FA sessions are present and cleans up its channel', async () => {
    const channel = new FakeChannel()
    const client: PresenceClient = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn().mockResolvedValue('ok'),
    }
    const { result, unmount } = renderHook(() => useGroupPresence({
      client,
      meetingId: '00000000-0000-4000-8000-000000000001',
      groupId: '10000000-0000-4000-8000-000000000001',
    }))

    await waitFor(() => expect(channel.track).toHaveBeenCalledTimes(1))
    act(() => {
      channel.state = { browserA: [{}], browserB: [{}] }
      channel.sync?.()
    })
    expect(result.current).toEqual({ count: 2, hasConcurrentEditor: true })

    unmount()
    expect(channel.untrack).toHaveBeenCalledTimes(1)
    expect(client.removeChannel).toHaveBeenCalledWith(channel)
  })
})
