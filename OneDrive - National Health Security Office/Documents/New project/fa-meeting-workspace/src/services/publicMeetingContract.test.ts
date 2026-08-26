import { describe, expect, it } from 'vitest'
import { validPublicMeetingResponse } from '../test/publicMeetingFixture'
import { publicMeetingResponseSchema } from './publicMeetingContract'

describe('publicMeetingResponseSchema', () => {
  it('accepts a complete active public meeting response', () => {
    expect(publicMeetingResponseSchema.parse(validPublicMeetingResponse)).toEqual(
      validPublicMeetingResponse,
    )
  })

  it('rejects a group outside the three permitted group numbers', () => {
    expect(() =>
      publicMeetingResponseSchema.parse({
        ...validPublicMeetingResponse,
        data: {
          ...validPublicMeetingResponse.data,
          groups: [{ ...validPublicMeetingResponse.data.groups[0], groupNo: 4 }],
        },
      }),
    ).toThrow()
  })

  it('rejects a public meeting response with a missing required field', () => {
    const { title: _title, ...meetingWithoutTitle } = validPublicMeetingResponse.data

    expect(() =>
      publicMeetingResponseSchema.parse({
        ...validPublicMeetingResponse,
        data: meetingWithoutTitle,
      }),
    ).toThrow()
  })

  it('rejects a group with a status outside the public statuses', () => {
    expect(() =>
      publicMeetingResponseSchema.parse({
        ...validPublicMeetingResponse,
        data: {
          ...validPublicMeetingResponse.data,
          groups: [
            { ...validPublicMeetingResponse.data.groups[0], status: 'published' },
          ],
        },
      }),
    ).toThrow()
  })

  it('rejects a group with a non-positive row version', () => {
    expect(() =>
      publicMeetingResponseSchema.parse({
        ...validPublicMeetingResponse,
        data: {
          ...validPublicMeetingResponse.data,
          groups: [{ ...validPublicMeetingResponse.data.groups[0], rowVersion: 0 }],
        },
      }),
    ).toThrow()
  })

  it('rejects a public meeting response with a non-ISO timestamp', () => {
    expect(() =>
      publicMeetingResponseSchema.parse({
        ...validPublicMeetingResponse,
        data: {
          ...validPublicMeetingResponse.data,
          createdAt: 'August 20, 2026',
        },
      }),
    ).toThrow()
  })

  it('accepts a response with no active public meeting', () => {
    expect(
      publicMeetingResponseSchema.parse({ data: null, requestId: 'empty-request-id' }),
    ).toEqual({ data: null, requestId: 'empty-request-id' })
  })
})
