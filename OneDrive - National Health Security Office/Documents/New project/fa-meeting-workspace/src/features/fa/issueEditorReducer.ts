import type { Issue } from '../../domain/issue'

export interface IssueEditorState {
  issues: Issue[]
  pendingDeleteId: string | null
}

export type IssueEditorAction =
  | { type: 'update'; issueId: string; field: 'topic' | 'findings' | 'proposal' | 'actionPlan' | 'monitoring' | 'stakeholderRoles'; value: string }
  | { type: 'add'; groupId: string }
  | { type: 'moveUp'; issueId: string }
  | { type: 'moveDown'; issueId: string }
  | { type: 'requestDelete'; issueId: string }
  | { type: 'confirmDelete' }
  | { type: 'cancelDelete' }
  | { type: 'replaceAll'; issues: Issue[] }

function normalize(issues: Issue[]): Issue[] {
  return issues.map((issue, index) => ({ ...issue, sortOrder: index + 1 }))
}

export function issueEditorReducer(
  state: IssueEditorState,
  action: IssueEditorAction,
): IssueEditorState {
  switch (action.type) {
    case 'update':
      return {
        ...state,
        issues: state.issues.map((issue) =>
          issue.id === action.issueId
            ? { ...issue, [action.field]: action.value, updatedAt: new Date().toISOString() }
            : issue,
        ),
      }
    case 'add': {
      const now = new Date().toISOString()
      const issue: Issue = {
        id: crypto.randomUUID(),
        groupId: action.groupId,
        sortOrder: state.issues.length + 1,
        topic: '',
        findings: '',
        proposal: '',
        actionPlan: '',
        monitoring: '',
        stakeholderRoles: '',
        createdAt: now,
        updatedAt: now,
      }
      return { ...state, issues: [...state.issues, issue] }
    }
    case 'moveUp': {
      const index = state.issues.findIndex((issue) => issue.id === action.issueId)
      if (index <= 0) return state
      const issues = [...state.issues]
      ;[issues[index - 1], issues[index]] = [issues[index], issues[index - 1]]
      return { ...state, issues: normalize(issues) }
    }
    case 'moveDown': {
      const index = state.issues.findIndex((issue) => issue.id === action.issueId)
      if (index < 0 || index >= state.issues.length - 1) return state
      const issues = [...state.issues]
      ;[issues[index], issues[index + 1]] = [issues[index + 1], issues[index]]
      return { ...state, issues: normalize(issues) }
    }
    case 'requestDelete':
      return { ...state, pendingDeleteId: action.issueId }
    case 'confirmDelete':
      if (!state.pendingDeleteId) return state
      return {
        issues: normalize(
          state.issues.filter((issue) => issue.id !== state.pendingDeleteId),
        ),
        pendingDeleteId: null,
      }
    case 'cancelDelete':
      return { ...state, pendingDeleteId: null }
    case 'replaceAll':
      return { issues: normalize(action.issues), pendingDeleteId: null }
  }
}
