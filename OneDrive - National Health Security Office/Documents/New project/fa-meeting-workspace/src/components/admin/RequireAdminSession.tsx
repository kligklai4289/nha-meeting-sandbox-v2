import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loading } from '../common/Loading'
import { Button } from '../common/Button'
import { useAdminAuth } from '../../services/useAdminAuth'

export function RequireAdminSession() {
  const state = useAdminAuth()
  const location = useLocation()

  if (state.restoreFailure) {
    return (
      <main
        role="alert"
        aria-label="ไม่สามารถตรวจสอบสิทธิ์ผู้ดูแลได้"
        className="p-6 text-slate-800"
      >
        <p>ไม่สามารถตรวจสอบสิทธิ์ผู้ดูแลได้</p>
        <Button className="mt-4" onClick={() => void state.retry()}>ลองใหม่</Button>
      </main>
    )
  }
  if (state.signOutFailure) {
    return (
      <main
        role="alert"
        aria-label="ไม่สามารถออกจากระบบได้"
        className="p-6 text-slate-800"
      >
        <p>ไม่สามารถออกจากระบบได้ กรุณาลองใหม่อีกครั้ง</p>
        <Button
          className="mt-4"
          disabled={state.signOutPending}
          onClick={() => void state.retrySignOut()}
        >
          {state.signOutPending ? 'กำลังออกจากระบบ...' : 'ลองออกจากระบบอีกครั้ง'}
        </Button>
      </main>
    )
  }
  if (state.status === 'loading') {
    return <Loading label="กำลังตรวจสอบสิทธิ์ผู้ดูแล" />
  }
  if (state.status !== 'active-admin') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
