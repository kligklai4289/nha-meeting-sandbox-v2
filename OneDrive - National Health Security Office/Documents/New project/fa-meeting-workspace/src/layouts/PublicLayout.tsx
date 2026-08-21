import { Outlet } from 'react-router-dom'

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
        </div>
      </header>
      <Outlet />
    </div>
  )
}
