import { useCallback, useEffect, useReducer, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { EmptyState } from '../../components/common/EmptyState'
import { Loading } from '../../components/common/Loading'
import { FAActionBar } from '../../components/fa/FAActionBar'
import { FinalConfirmDialog } from '../../components/fa/FinalConfirmDialog'
import { FAHeader } from '../../components/fa/FAHeader'
import { GroupInfo } from '../../components/fa/GroupInfo'
import { IssueList } from '../../components/fa/IssueList'
import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'
import {
  issueEditorReducer,
  type IssueEditorState,
} from '../../features/fa/issueEditorReducer'
import { useSelectedGroup } from '../../hooks/useSelectedGroup'
import { useMockAutosave } from '../../hooks/useMockAutosave'
import { useMeetingRepository } from '../../services/useMeetingRepository'

const initialEditorState: IssueEditorState = {
  issues: [],
  pendingDeleteId: null,
}

type EditableField = keyof Pick<
  Issue,
  'topic' | 'findings' | 'proposal' | 'actionPlan' | 'monitoring' | 'stakeholderRoles'
>

export function FAWorkspacePage() {
  const repository = useMeetingRepository()
  const navigate = useNavigate()
  const { selectedGroupId, clearGroup } = useSelectedGroup()
  const [group, setGroup] = useState<MeetingGroup | null>()
  const [editor, dispatch] = useReducer(issueEditorReducer, initialEditorState)
  const [error, setError] = useState<Error | null>(null)
  const [finalDialogOpen, setFinalDialogOpen] = useState(false)
  const saveGroup = useCallback(
    (nextGroup: MeetingGroup) => repository.saveGroup(nextGroup),
    [repository],
  )
  const saveIssues = useCallback(
    (groupId: string, issues: Issue[]) => repository.saveIssues(groupId, issues),
    [repository],
  )

  const autosave = useMockAutosave({
    group,
    issues: editor.issues,
    delayMs: 1500,
    saveGroup,
    saveIssues,
  })

  useEffect(() => {
    if (!selectedGroupId) return
    let active = true
    Promise.all([
      repository.getGroup(selectedGroupId),
      repository.getIssues(selectedGroupId),
    ])
      .then(([loadedGroup, issues]) => {
        if (!active) return
        if (!loadedGroup) clearGroup()
        setGroup(loadedGroup)
        dispatch({ type: 'replaceAll', issues })
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason : new Error('โหลดข้อมูลไม่สำเร็จ'))
      })
    return () => {
      active = false
    }
  }, [clearGroup, repository, selectedGroupId])

  if (!selectedGroupId) return <Navigate to="/fa" replace />

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <EmptyState
          title="ไม่สามารถเปิด Workspace ได้"
          description="ข้อมูลที่เลือกอาจไม่พร้อมใช้งาน กรุณากลับไปเลือกกลุ่มอีกครั้ง"
        />
      </main>
    )
  }

  if (group === undefined) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Loading label="กำลังเตรียม FA Workspace..." />
      </main>
    )
  }

  if (group === null) {
    return <Navigate to="/fa" replace />
  }

  const pendingIssue = editor.issues.find(
    (issue) => issue.id === editor.pendingDeleteId,
  )

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <FAHeader group={group} onBack={clearGroup} autoSaveState={autosave.state} savedAt={autosave.savedAt} />
      <div className="mt-5">
        <GroupInfo group={group} issueCount={editor.issues.length} onChange={setGroup} disabled={group.status === 'final'} />
      </div>
      <div className="mt-5">
        <IssueList
          issues={editor.issues}
          onUpdate={(issueId, field: EditableField, value) =>
            dispatch({ type: 'update', issueId, field, value })
          }
          onMoveUp={(issueId) => dispatch({ type: 'moveUp', issueId })}
          onMoveDown={(issueId) => dispatch({ type: 'moveDown', issueId })}
          onDelete={(issueId) => dispatch({ type: 'requestDelete', issueId })}
          disabled={group.status === 'final'}
        />
      </div>
      <FAActionBar
        onAdd={() => dispatch({ type: 'add', groupId: group.id })}
        onPreview={() => navigate('/preview')}
        onReviewReady={() => setGroup({ ...group, status: group.status === 'review_ready' ? 'draft' : 'review_ready' })}
        onFinal={() => setFinalDialogOpen(true)}
        disabled={group.status === 'final'}
        reviewReady={group.status === 'review_ready'}
      />
      <ConfirmDialog
        open={Boolean(editor.pendingDeleteId)}
        title="ยืนยันการลบประเด็น"
        confirmLabel="ลบประเด็น"
        destructive
        onCancel={() => dispatch({ type: 'cancelDelete' })}
        onConfirm={() => dispatch({ type: 'confirmDelete' })}
      >
        ต้องการลบประเด็นที่ {pendingIssue?.sortOrder ?? '-'} หรือไม่? ข้อมูลที่กรอกไว้ในประเด็นนี้จะถูกนำออกจากแบบฟอร์ม
      </ConfirmDialog>
      <FinalConfirmDialog
        groupNo={group.groupNo}
        open={finalDialogOpen}
        onCancel={() => setFinalDialogOpen(false)}
        onConfirm={() => {
          const now = new Date().toISOString()
          setGroup({ ...group, status: 'final', finalizedAt: now, updatedAt: now })
          setFinalDialogOpen(false)
        }}
      />
    </main>
  )
}
