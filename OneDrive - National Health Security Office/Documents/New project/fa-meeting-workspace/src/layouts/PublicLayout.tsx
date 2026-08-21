import { ShieldCheck } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid size-11 place-items-center rounded-xl bg-government-navy text-sm font-black text-white">
            FA
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950 sm:text-xl">
              ระบบบันทึกผลการประชุมกลุ่มย่อย
            </h1>
            <p className="text-xs text-slate-500">สำนักงานหลักประกันสุขภาพแห่งชาติ</p>
          </div>
          <Link
            to="/admin/login"
            className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
          >
            <ShieldCheck aria-hidden="true" size={18} />
            เข้าสู่ Admin
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
