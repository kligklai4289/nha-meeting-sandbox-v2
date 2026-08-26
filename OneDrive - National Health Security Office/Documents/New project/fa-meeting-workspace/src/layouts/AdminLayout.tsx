import { ArrowLeft, BarChart3, CalendarDays, FileDown, Settings } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { useAdminAuth } from '../services/useAdminAuth'
import { cn } from '../utils/cn'

const links = [
  { to: '/admin/dashboard', label: 'Admin Dashboard', icon: BarChart3 },
  { to: '/admin/meetings', label: 'รอบประชุม', icon: CalendarDays },
  { to: '/admin/export', label: 'Export Center', icon: FileDown },
  { to: '/admin/settings', label: 'ตั้งค่า', icon: Settings },
]

export function AdminLayout() {
  const auth = useAdminAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const email = auth.status === 'active-admin' ? auth.identity.email : ''

  const signOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await auth.signOut()
      navigate('/admin/login', { replace: true })
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="bg-government-navy px-4 py-5 text-white lg:min-h-screen">
        <div className="mb-5 px-3">
          <p className="text-lg font-bold">FA Workspace 2570</p>
          <p className="text-xs text-blue-100">สำหรับผู้ดูแลระบบ</p>
          <p className="mt-3 text-sm font-semibold text-blue-100">{email}</p>
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
        <Link
          to="/fa"
          className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-blue-300/40 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          กลับไปหน้าบันทึกข้อมูล
        </Link>
        <Button
          variant="secondary"
          className="mt-3 w-full"
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          ออกจากระบบ
        </Button>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
