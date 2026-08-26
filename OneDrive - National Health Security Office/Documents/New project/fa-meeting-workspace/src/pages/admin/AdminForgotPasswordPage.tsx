import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { useAdminAuth } from '../../services/useAdminAuth'

const completionMessage = 'หากอีเมลนี้มีสิทธิ์ผู้ดูแล ระบบจะส่งวิธีตั้งรหัสผ่านใหม่ให้ทางอีเมล'

export function AdminForgotPasswordPage() {
  const auth = useAdminAuth()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [completed, setCompleted] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || !email.trim()) return

    setPending(true)
    try {
      await auth.requestPasswordReset(
        email.trim().toLowerCase(),
        `${window.location.origin}/admin/auth/confirm`,
      )
    } catch {
      // The completion text deliberately remains identical for every request outcome.
    } finally {
      setPending(false)
      setCompleted(true)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-government-navy px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <h1 className="text-2xl font-black text-slate-950">ลืมรหัสผ่าน</h1>
        <p className="mt-2 text-sm text-slate-700">กรอกอีเมลผู้ดูแลเพื่อขอวิธีตั้งรหัสผ่านใหม่</p>
        <label className="mt-6 block text-sm font-bold text-slate-700">
          อีเมล
          <input aria-label="อีเมล" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
        </label>
        {completed && <p role="status" className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">{completionMessage}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={pending || !email.trim()}>{pending ? 'กำลังส่ง...' : 'ส่งวิธีตั้งรหัสผ่านใหม่'}</Button>
        <Link to="/admin/login" className="mt-5 block text-center text-sm font-bold text-blue-700 underline">กลับไปเข้าสู่ระบบ</Link>
      </form>
    </main>
  )
}
