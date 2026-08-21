import { Navigate, Outlet } from 'react-router-dom'

export function RequireAdminSession() {
  return sessionStorage.getItem('admin:mock-session') === 'true'
    ? <Outlet />
    : <Navigate to="/admin/login" replace />
}
