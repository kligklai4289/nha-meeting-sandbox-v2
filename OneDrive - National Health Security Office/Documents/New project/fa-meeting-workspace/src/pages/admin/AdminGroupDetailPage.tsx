import { useEffect, useReducer, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { StatusBadge } from '../../components/common/StatusBadge'
import { GroupInfo } from '../../components/fa/GroupInfo'
import { IssueList } from '../../components/fa/IssueList'
import type { MeetingGroup } from '../../domain/group'
import type { Issue } from '../../domain/issue'
import { issueEditorReducer } from '../../features/fa/issueEditorReducer'
import { useMeetingRepository } from '../../services/useMeetingRepository'

type EditableField = keyof Pick<Issue, 'topic' | 'findings' | 'proposal' | 'actionPlan' | 'monitoring' | 'stakeholderRoles'>

export function AdminGroupDetailPage() {
  const { groupId } = useParams()
  const repository = useMeetingRepository()
  const [group, setGroup] = useState<MeetingGroup | null>()
  const [saved, setSaved] = useState(false)
  const [editor, dispatch] = useReducer(issueEditorReducer, { issues: [], pendingDeleteId: null })

  useEffect(() => {
    if (!groupId) return
    Promise.all([repository.getGroup(groupId), repository.getIssues(groupId)]).then(([loadedGroup, issues]) => {
      setGroup(loadedGroup)
      dispatch({ type: 'replaceAll', issues })
    })
  }, [groupId, repository])

  if (group === null) return <Navigate to="/admin/dashboard" replace />
  if (!group) return <main className="p-8">กำลังโหลดข้อมูลกลุ่ม...</main>
  const saveAll = async () => {
    const now = new Date().toISOString()
    const savedGroup = await repository.saveGroup({ ...group, updatedAt: now })
    await repository.saveIssues(group.id, editor.issues)
    setGroup(savedGroup)
    setSaved(true)
  }
  const reopen = async () => {
    const reopened = await repository.saveGroup({ ...group, status: 'draft', finalizedAt: null, updatedAt: new Date().toISOString() })
    setGroup(reopened)
  }
  return (
    <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/admin/dashboard" className="text-sm font-bold text-blue-700 hover:underline">← กลับ Dashboard</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-black text-slate-950">กลุ่ม {group.groupNo} {group.groupName}</h1><div className="mt-2"><StatusBadge status={group.status} /></div></div>{group.status === 'final' && <Button variant="secondary" onClick={reopen}>เปิดกลับเป็นฉบับร่าง</Button>}</div>
      <div className="mt-6"><GroupInfo group={group} issueCount={editor.issues.length} onChange={(next) => { setSaved(false); setGroup(next) }} /></div>
      <div className="mt-6"><IssueList issues={editor.issues} onUpdate={(issueId, field: EditableField, value) => { setSaved(false); dispatch({ type: 'update', issueId, field, value }) }} onMoveUp={(issueId) => dispatch({ type: 'moveUp', issueId })} onMoveDown={(issueId) => dispatch({ type: 'moveDown', issueId })} onDelete={(issueId) => dispatch({ type: 'requestDelete', issueId })} /></div>
      <div className="sticky bottom-3 mt-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl"><Button onClick={() => dispatch({ type: 'add', groupId: group.id })}>เพิ่มประเด็น</Button><Button variant="success" onClick={saveAll}>บันทึกการแก้ไข</Button>{saved && <span className="self-center text-sm font-bold text-emerald-700">บันทึกแล้ว</span>}</div>
      <ConfirmDialog open={Boolean(editor.pendingDeleteId)} title="ยืนยันการลบประเด็น" confirmLabel="ลบประเด็น" destructive onCancel={() => dispatch({ type: 'cancelDelete' })} onConfirm={() => dispatch({ type: 'confirmDelete' })}>ข้อมูลประเด็นนี้จะถูกนำออกจากแบบฟอร์ม</ConfirmDialog>
    </main>
  )
}
