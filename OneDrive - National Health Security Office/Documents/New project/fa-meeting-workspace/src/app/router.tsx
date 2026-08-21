import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom'
import { AdminLayout } from '../layouts/AdminLayout'
import { PublicLayout } from '../layouts/PublicLayout'
import { NotFoundPage } from '../pages/NotFoundPage'
import { FASelectGroupPage } from '../pages/fa/FASelectGroupPage'
import { FAWorkspacePage } from '../pages/fa/FAWorkspacePage'
import { PreviewPage } from '../pages/preview/PreviewPage'

function routePage(title: string) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
    </main>
  )
}

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
  { path: '/admin/login', element: routePage('เข้าสู่ระบบผู้ดูแล') },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: routePage('Admin Dashboard') },
      { path: 'meetings', element: routePage('จัดการรอบประชุม') },
      { path: 'meetings/:meetingId', element: routePage('รายละเอียดรอบประชุม') },
      { path: 'groups/:groupId', element: routePage('รายละเอียดกลุ่ม') },
      { path: 'export', element: routePage('Export Center') },
      { path: 'settings', element: routePage('ตั้งค่าระบบ') },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export function createAppRouter(initialEntries?: string[]) {
  return initialEntries
    ? createMemoryRouter(routes, { initialEntries })
    : createBrowserRouter(routes)
}
