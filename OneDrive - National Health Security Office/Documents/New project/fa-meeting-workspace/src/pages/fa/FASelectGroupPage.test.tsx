import { act, cleanup, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SELECTED_GROUP_KEY } from '../../hooks/useSelectedGroup'
import type { MeetingDirectory } from '../../services/meetingDirectory'
import { MockMeetingRepository } from '../../services/mockMeetingRepository'
import { createMockSeed } from '../../services/mockSeed'
import { mockMeetingWithGroups } from '../../test/fixtures'
import { renderAppAt } from '../../test/renderApp'
import { useMeetingDirectory } from '../../services/useMeetingDirectory'
import { FakeFaRepository } from '../../test/fakeFaRepository'

const directoryMeeting = structuredClone(mockMeetingWithGroups)
directoryMeeting.title = 'รอบประชุมจาก API จริง'
directoryMeeting.groups[0].id = '20000000-0000-4000-8000-000000000001'

function createDirectory(
  getActiveMeeting: MeetingDirectory['getActiveMeeting'] = () =>
    Promise.resolve(structuredClone(directoryMeeting)),
): MeetingDirectory {
  return { getActiveMeeting }
}

describe('FASelectGroupPage', () => {
  beforeEach(() => sessionStorage.clear())

  it('requires an explicit meeting directory provider', () => {
    expect(() => renderHook(() => useMeetingDirectory())).toThrow(
      'MeetingDirectoryProvider is required',
    )
  })

  it('renders directory data independently from the mock repository', async () => {
    const repositorySeed = createMockSeed()
    repositorySeed.meeting.title = 'ข้อมูลจาก repository ที่ไม่ควรแสดง'

    renderAppAt(
      '/fa',
      new MockMeetingRepository(repositorySeed),
      createDirectory(),
    )

    expect(await screen.findByText('รอบประชุมจาก API จริง')).toBeVisible()
    expect(
      screen.queryByText('ข้อมูลจาก repository ที่ไม่ควรแสดง'),
    ).not.toBeInTheDocument()
  })

  it('shows loading while the directory request is pending', () => {
    const pendingDirectory = createDirectory(() => new Promise(() => undefined))

    renderAppAt('/fa', new MockMeetingRepository(), pendingDirectory)

    expect(
      screen.getByText('กำลังโหลดรอบประชุมที่เปิดใช้งาน...'),
    ).toBeVisible()
  })

  it('shows an empty state when there is no active meeting', async () => {
    const emptyDirectory = createDirectory(() => Promise.resolve(null))

    renderAppAt('/fa', new MockMeetingRepository(), emptyDirectory)

    expect(
      await screen.findByRole('heading', {
        name: 'ยังไม่มีรอบประชุมที่เปิดใช้งาน',
      }),
    ).toBeVisible()
  })

  it('retries a failed directory request with a new controller', async () => {
    const user = userEvent.setup()
    const signals: AbortSignal[] = []
    const directory = createDirectory(
      vi
        .fn<MeetingDirectory['getActiveMeeting']>()
        .mockImplementationOnce((signal) => {
          if (signal) signals.push(signal)
          return Promise.reject(new Error('temporary failure'))
        })
        .mockImplementationOnce((signal) => {
          if (signal) signals.push(signal)
          return Promise.resolve(structuredClone(directoryMeeting))
        }),
    )
    renderAppAt('/fa', new MockMeetingRepository(), directory)

    expect(
      await screen.findByRole('heading', {
        name: 'ไม่สามารถโหลดรอบประชุมได้',
      }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }))

    expect(await screen.findByText('รอบประชุมจาก API จริง')).toBeVisible()
    expect(signals).toHaveLength(2)
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  it('aborts the active directory request during cleanup', async () => {
    let requestSignal: AbortSignal | undefined
    const directory = createDirectory((signal) => {
      requestSignal = signal
      return new Promise(() => undefined)
    })
    renderAppAt('/fa', new MockMeetingRepository(), directory)
    await waitFor(() => expect(requestSignal).toBeDefined())

    cleanup()

    expect(requestSignal?.aborted).toBe(true)
  })

  it('ignores AbortError without showing the failure state', async () => {
    let rejectRequest!: (reason?: unknown) => void
    const directory = createDirectory(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject
        }),
    )
    renderAppAt('/fa', new MockMeetingRepository(), directory)

    expect(
      screen.getByText('กำลังโหลดรอบประชุมที่เปิดใช้งาน...'),
    ).toBeVisible()

    await act(async () => {
      rejectRequest(new DOMException('Aborted', 'AbortError'))
      await Promise.resolve()
    })

    expect(
      screen.getByText('กำลังโหลดรอบประชุมที่เปิดใช้งาน...'),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'ไม่สามารถโหลดรอบประชุมได้',
      }),
    ).not.toBeInTheDocument()
  })

  it('requires the group access code before storing the UUID and opening the workspace', async () => {
    const user = userEvent.setup()
    const repository = new MockMeetingRepository()
    const faRepository = new FakeFaRepository()
    const createSession = vi.spyOn(faRepository, 'createSession')
    const router = renderAppAt(
      '/fa',
      repository,
      createDirectory(),
      undefined,
      faRepository,
    )

    const cards = await screen.findAllByRole('button', { name: /เลือกกลุ่ม/ })
    expect(cards).toHaveLength(3)

    await user.click(cards[0])

    expect(screen.getByRole('dialog', { name: 'รหัสเข้ากลุ่ม 1' })).toBeVisible()
    expect(sessionStorage.getItem(SELECTED_GROUP_KEY)).toBeNull()
    expect(router.state.location.pathname).toBe('/fa')

    await user.type(screen.getByLabelText('รหัสเข้ากลุ่ม'), '3515')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ Workspace' }))

    expect(sessionStorage.getItem(SELECTED_GROUP_KEY)).toBe(
      '20000000-0000-4000-8000-000000000001',
    )
    expect(createSession).toHaveBeenCalledWith(
      '20000000-0000-4000-8000-000000000001',
      '3515',
    )
    expect(router.state.location.pathname).toBe('/fa/workspace')
    expect(sessionStorage.getItem('fa-access-code')).toBeNull()
    expect(localStorage.getItem('fa-access-code')).toBeNull()
  })
})
