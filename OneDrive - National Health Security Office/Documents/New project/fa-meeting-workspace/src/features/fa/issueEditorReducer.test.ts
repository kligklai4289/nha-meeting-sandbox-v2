import { describe, expect, it } from 'vitest'
import { mockGroups, mockIssuesByGroup } from '../../test/fixtures'
import { issueEditorReducer, type IssueEditorState } from './issueEditorReducer'

function createState(): IssueEditorState {
  return {
    issues: structuredClone(mockIssuesByGroup[mockGroups[0].id]),
    pendingDeleteId: null,
  }
}

describe('issueEditorReducer', () => {
  it('updates an issue by id instead of array position', () => {
    const state = createState()
    const targetId = state.issues[1].id

    const next = issueEditorReducer(state, {
      type: 'update',
      issueId: targetId,
      field: 'proposal',
      value: 'ข้อเสนอใหม่',
    })

    expect(next.issues[0].proposal).not.toBe('ข้อเสนอใหม่')
    expect(next.issues[1].proposal).toBe('ข้อเสนอใหม่')
  })

  it('renumbers sortOrder after moving an issue', () => {
    const state = createState()
    const firstId = state.issues[0].id
    const secondId = state.issues[1].id

    const next = issueEditorReducer(state, {
      type: 'moveUp',
      issueId: secondId,
    })

    expect(next.issues.map((issue) => [issue.id, issue.sortOrder])).toEqual([
      [secondId, 1],
      [firstId, 2],
    ])
  })

  it('does not delete until the requested issue is confirmed', () => {
    const state = createState()
    const targetId = state.issues[0].id
    const requested = issueEditorReducer(state, {
      type: 'requestDelete',
      issueId: targetId,
    })

    expect(requested.issues).toHaveLength(2)
    expect(requested.pendingDeleteId).toBe(targetId)

    const confirmed = issueEditorReducer(requested, { type: 'confirmDelete' })
    expect(confirmed.issues).toHaveLength(1)
    expect(confirmed.issues[0].sortOrder).toBe(1)
    expect(confirmed.pendingDeleteId).toBeNull()
  })
})
