import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { useAdminAuth } from '../../services/useAdminAuth'

const genericLoginError = 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบอีเมล รหัสผ่าน และสิทธิ์ผู้ดูแล'

const authFlowPaths = [
  '/admin/login',
  '/admin/forgot-password',
  '/admin/auth/confirm',
  '/admin/update-password',
]

function safeAdminDestination(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/admin/')) {
    return '/admin/dashboard'
  }

  const pathname = from.split(/[?#]/, 1)[0]
  if (authFlowPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return '/admin/dashboard'
  }

  return from
}

export function AdminLoginPage() {
  const auth = useAdminAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const destination = safeAdminDestination(
    (location.state as { from?: unknown } | null)?.from,
  )

  if (auth.status === 'active-admin') {
    return <Navigate to={destination} replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || !email.trim() || !password.trim()) return

    setPending(true)
    setError(null)
    try {
      await auth.signIn(email.trim().toLowerCase(), password)
    } catch {
      setError(genericLoginError)
    } finally {
      setPassword('')
      setPending(false)
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-government-navy px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <p className="text-sm font-bold text-blue-700">FA Workspace 2570</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">เข้าสู่ระบบผู้ดูแล</h1>
        <label className="mt-6 block text-sm font-bold text-slate-700">อีเมล<input aria-label="อีเมล" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
        <label className="mt-4 block text-sm font-bold text-slate-700">รหัสผ่าน<input aria-label="รหัสผ่าน" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={pending || !email.trim() || !password.trim()}>{pending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</Button>
        <Link to="/admin/forgot-password" className="mt-5 block text-center text-sm font-bold text-blue-700 underline">ลืมรหัสผ่าน</Link>
      </form>
    </main>
  )
}
