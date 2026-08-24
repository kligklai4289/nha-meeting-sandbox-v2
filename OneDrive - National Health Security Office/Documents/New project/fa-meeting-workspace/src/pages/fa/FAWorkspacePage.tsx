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
import { useFaAutosave } from '../../hooks/useFaAutosave'
import { useGroupPresence, type PresenceClient } from '../../hooks/useGroupPresence'
import { useFaRepository } from '../../services/useFaRepository'
import { createOfflineQueue } from '../../services/offline/createOfflineQueue'
import { processOfflineMutation } from '../../services/offline/faOfflineSync'
import type { FaAutosaveState } from '../../hooks/useFaAutosave'
import { browserSupabaseClient } from '../../services/supabase/browserClientInstance'

const initialEditorState: IssueEditorState = {
  issues: [],
  pendingDeleteId: null,
}

type EditableField = keyof Pick<
  Issue,
  'topic' | 'findings' | 'proposal' | 'actionPlan' | 'monitoring' | 'stakeholderRoles'
>

export function FAWorkspacePage() {
  const repository = useFaRepository()
  const navigate = useNavigate()
  const { selectedGroupId, clearGroup } = useSelectedGroup()
  const [group, setGroup] = useState<MeetingGroup | null>()
  const [editor, dispatch] = useReducer(issueEditorReducer, initialEditorState)
  const [error, setError] = useState<Error | null>(null)
  const [finalDialogOpen, setFinalDialogOpen] = useState(false)
  const [queue] = useState(createOfflineQueue)
  const [replayState, setReplayState] = useState<FaAutosaveState | null>(null)
  const acceptSavedGroup = useCallback((saved: MeetingGroup, submitted: MeetingGroup) => {
    setGroup((current) => {
      if (!current) return current
      if (current.presenter === submitted.presenter && current.status === submitted.status) return saved
      return { ...current, rowVersion: saved.rowVersion, updatedAt: saved.updatedAt }
    })
  }, [])
  const acceptSavedIssue = useCallback((saved: Issue, submitted: Issue) => {
    dispatch({ type: 'acceptSaved', saved, submittedUpdatedAt: submitted.updatedAt })
  }, [])

  const autosave = useFaAutosave({
    group,
    issues: editor.issues,
    delayMs: 1500,
    repository,
    queue,
    onGroupSaved: acceptSavedGroup,
    onIssueSaved: acceptSavedIssue,
  })
  const activeGroupId = group?.id
  const presence = useGroupPresence({
    client: browserSupabaseClient as unknown as PresenceClient,
    meetingId: group?.meetingId ?? '',
    groupId: group?.id ?? '',
    enabled: Boolean(group),
  })

  useEffect(() => {
    if (!selectedGroupId) return
    let active = true
    repository.bootstrap()
      .then(({ group: loadedGroup, issues }) => {
        if (!active) return
        if (loadedGroup.id !== selectedGroupId) {
          clearGroup()
          return
        }
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

  useEffect(() => {
    if (!activeGroupId) return
    let active = true
    const replay = async () => {
      const result = await queue.flush(
        (mutation) => processOfflineMutation(repository, mutation),
        activeGroupId,
      )
      if (!active) return
      if (result.conflicts.length > 0) setReplayState('conflict')
      else if (result.pending > 0) setReplayState('unsynced')
      else setReplayState(null)

      if (result.completed > 0) {
        const refreshed = await repository.bootstrap()
        if (!active) return
        setGroup(refreshed.group)
        dispatch({ type: 'replaceAll', issues: refreshed.issues })
      }
    }
    void replay().catch(() => {
      if (active) setReplayState('unsynced')
    })
    window.addEventListener('online', replay)
    return () => {
      active = false
      window.removeEventListener('online', replay)
    }
  }, [activeGroupId, queue, repository])

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
  const saveState = replayState ?? autosave.state

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8">
      {presence.hasConcurrentEditor ? (
        <div role="alert" className="mb-4 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-950">
          พบผู้ใช้งานกลุ่มนี้พร้อมกัน {presence.count} หน้าจอ กรุณาประสานกันก่อนแก้ไขรายการเดียวกัน
        </div>
      ) : null}
      {saveState === 'unsynced' ? (
        <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          บันทึกฉบับร่างไว้ในอุปกรณ์แล้ว ระบบจะ Sync เมื่อกลับมาออนไลน์
        </div>
      ) : null}
      {saveState === 'conflict' ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
          พบข้อมูลรายการเดียวกันถูกแก้ไขจากที่อื่น กรุณาโหลดหน้าใหม่เพื่อตรวจสอบก่อนแก้ไขต่อ
        </div>
      ) : null}
      <FAHeader group={group} onBack={clearGroup} autoSaveState={saveState} savedAt={autosave.savedAt} />
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
          reorderDisabled={editor.issues.some((issue) => issue.rowVersion === 0)}
        />
      </div>
      <FAActionBar
        onAdd={() => dispatch({ type: 'add', groupId: group.id })}
        onPreview={() => navigate('/preview')}
        onReviewReady={() => setGroup({ ...group, status: group.status === 'review_ready' ? 'draft' : 'review_ready' })}
        onFinal={() => setFinalDialogOpen(true)}
        disabled={group.status === 'final'}
        reviewReady={group.status === 'review_ready'}
        finalDisabled={saveState !== 'idle' && saveState !== 'saved'}
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
          void repository.finalize(group)
            .then((saved) => setGroup(saved))
            .catch((reason: unknown) => setError(reason instanceof Error ? reason : new Error('Final ไม่สำเร็จ')))
            .finally(() => setFinalDialogOpen(false))
        }}
      />
    </main>
  )
}
