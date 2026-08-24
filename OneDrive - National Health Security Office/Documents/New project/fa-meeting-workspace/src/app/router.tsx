import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom'
import { AdminLayout } from '../layouts/AdminLayout'
import { RequireAdminSession } from '../components/admin/RequireAdminSession'
import { PublicLayout } from '../layouts/PublicLayout'
import { NotFoundPage } from '../pages/NotFoundPage'
import { FASelectGroupPage } from '../pages/fa/FASelectGroupPage'
import { FAWorkspacePage } from '../pages/fa/FAWorkspacePage'
import { PreviewPage } from '../pages/preview/PreviewPage'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { AdminGroupDetailPage } from '../pages/admin/AdminGroupDetailPage'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { AdminForgotPasswordPage } from '../pages/admin/AdminForgotPasswordPage'
import { AdminAuthConfirmPage } from '../pages/admin/AdminAuthConfirmPage'
import { AdminUpdatePasswordPage } from '../pages/admin/AdminUpdatePasswordPage'
import { AdminMeetingDetailPage } from '../pages/admin/AdminMeetingDetailPage'
import { AdminMeetingsPage } from '../pages/admin/AdminMeetingsPage'
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage'
import { ExportCenterPage } from '../pages/admin/ExportCenterPage'

const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/fa" replace /> },
  {
    element: <PublicLayout />,
    children: [
      { path: '/fa', element: <FASelectGroupPage /> },
      { path: '/fa/workspace', element: <FAWorkspacePage /> },
      { path: '/preview', element: <PreviewPage /> },
    ],
  },
  { path: '/admin/login', element: <AdminLoginPage /> },
  { path: '/admin/forgot-password', element: <AdminForgotPasswordPage /> },
  { path: '/admin/auth/confirm', element: <AdminAuthConfirmPage /> },
  { path: '/admin/update-password', element: <AdminUpdatePasswordPage /> },
  {
    element: <RequireAdminSession />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'meetings', element: <AdminMeetingsPage /> },
          { path: 'meetings/:meetingId', element: <AdminMeetingDetailPage /> },
          { path: 'groups/:groupId', element: <AdminGroupDetailPage /> },
          { path: 'export', element: <ExportCenterPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export function createAppRouter(initialEntries?: string[]) {
  return initialEntries
    ? createMemoryRouter(routes, { initialEntries })
    : createBrowserRouter(routes)
}
