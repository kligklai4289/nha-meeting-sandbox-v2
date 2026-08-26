import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
      <div>
        <p className="text-sm font-bold text-blue-700">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">ไม่พบหน้าที่ต้องการ</h1>
        <Link className="mt-5 inline-block font-bold text-blue-700 underline" to="/fa">
          กลับหน้าเลือกกลุ่ม
        </Link>
      </div>
    </main>
  )
}
