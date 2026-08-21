import { BarChart3, CalendarDays, FileDown, Settings } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '../utils/cn'

const links = [
  { to: '/admin/dashboard', label: 'Admin Dashboard', icon: BarChart3 },
  { to: '/admin/meetings', label: 'รอบประชุม', icon: CalendarDays },
  { to: '/admin/export', label: 'Export Center', icon: FileDown },
  { to: '/admin/settings', label: 'ตั้งค่า', icon: Settings },
]

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#f6f8fc] lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="bg-government-navy px-4 py-5 text-white lg:min-h-screen">
        <div className="mb-5 px-3">
          <p className="text-lg font-bold">FA Workspace 2570</p>
          <p className="text-xs text-blue-100">สำหรับผู้ดูแลระบบ</p>
        </div>
        <nav aria-label="เมนูผู้ดูแล" className="flex gap-2 overflow-x-auto lg:flex-col">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-blue-100 transition hover:bg-white/10 hover:text-white',
                  isActive && 'bg-white/15 text-white',
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <Outlet />
    </div>
  )
}
