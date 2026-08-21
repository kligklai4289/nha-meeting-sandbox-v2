import { describe, expect, it } from 'vitest'
import { mockGroups, mockIssuesByGroup } from '../../test/fixtures'
import { buildPreviewSlides } from './buildPreviewSlides'

describe('buildPreviewSlides', () => {
  it('builds one cover followed by one slide per issue in sort order', () => {
    const group = mockGroups[0]
    const [issue1, issue2] = mockIssuesByGroup[group.id]

    const slides = buildPreviewSlides(group, [issue2, issue1])

    expect(slides.map((slide) => [slide.kind, slide.issueId])).toEqual([
      ['cover', undefined],
      ['issue', issue1.id],
      ['issue', issue2.id],
    ])
  })
})
