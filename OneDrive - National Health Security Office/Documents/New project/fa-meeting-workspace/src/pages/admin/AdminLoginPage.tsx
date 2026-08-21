import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  if (sessionStorage.getItem('admin:mock-session') === 'true') {
    return <Navigate to="/admin/dashboard" replace />
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password.trim()) return
    sessionStorage.setItem('admin:mock-session', 'true')
    navigate('/admin/dashboard', { replace: true })
  }
  return (
    <main className="grid min-h-screen place-items-center bg-government-navy px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <p className="text-sm font-bold text-blue-700">FA Workspace 2570</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">เข้าสู่ระบบผู้ดูแล</h1>
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">โหมดตัวอย่าง — ยังไม่เชื่อม Supabase Auth</p>
        <label className="mt-6 block text-sm font-bold text-slate-700">อีเมล<input aria-label="อีเมล" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
        <label className="mt-4 block text-sm font-bold text-slate-700">รหัสผ่าน<input aria-label="รหัสผ่าน" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
        <Button type="submit" className="mt-6 w-full" disabled={!email.trim() || !password.trim()}>เข้าสู่ระบบ</Button>
      </form>
    </main>
  )
}
