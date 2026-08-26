import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import { Loading } from '../../components/common/Loading'
import { useAdminAuth } from '../../services/useAdminAuth'
import { AdminAuthError } from '../../services/auth/adminAuth'

const invalidFlowMessage = 'กรุณายืนยันลิงก์จากอีเมลก่อนตั้งรหัสผ่านใหม่'
const updateFailureMessage = 'ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองใหม่อีกครั้ง'

export function AdminUpdatePasswordPage() {
  const auth = useAdminAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const flowReady = auth.passwordFlow.status === 'ready'

  const clearPasswords = () => {
    setPassword('')
    setConfirmation('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || !flowReady) return

    if (password.length < 12) {
      clearPasswords()
      setError('รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร')
      return
    }
    if (password !== confirmation) {
      clearPasswords()
      setError('การยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    setPending(true)
    setError(null)
    try {
      await auth.updatePassword(password)
      clearPasswords()
      navigate('/admin/dashboard', { replace: true })
    } catch (caughtError) {
      clearPasswords()
      setError(
        caughtError instanceof AdminAuthError && caughtError.code === 'NOT_AUTHORIZED'
          ? 'ไม่สามารถดำเนินการต่อได้เนื่องจากไม่มีสิทธิ์ผู้ดูแล'
          : updateFailureMessage,
      )
    } finally {
      setPending(false)
    }
  }

  if (auth.passwordFlow.status === 'checking') {
    return (
      <main className="grid min-h-screen place-items-center bg-government-navy px-4 py-10">
        <Loading label="กำลังตรวจสอบสิทธิ์สำหรับการตั้งรหัสผ่าน" />
      </main>
    )
  }

  if (!flowReady && error) {
    return (
      <main className="grid min-h-screen place-items-center bg-government-navy px-4 py-10">
        <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl sm:p-9">
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>
          <Link to="/admin/login" className="mt-5 block text-sm font-bold text-blue-700 underline">กลับไปเข้าสู่ระบบ</Link>
        </section>
      </main>
    )
  }

  if (!flowReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-government-navy px-4 py-10">
        <section className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl sm:p-9">
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{invalidFlowMessage}</p>
          <Link to="/admin/login" className="mt-5 block text-sm font-bold text-blue-700 underline">กลับไปเข้าสู่ระบบ</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-government-navy px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <h1 className="text-2xl font-black text-slate-950">ตั้งรหัสผ่านใหม่</h1>
        <label className="mt-6 block text-sm font-bold text-slate-700">
          รหัสผ่านใหม่
          <input aria-label="รหัสผ่านใหม่" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
        </label>
        <label className="mt-4 block text-sm font-bold text-slate-700">
          ยืนยันรหัสผ่านใหม่
          <input aria-label="ยืนยันรหัสผ่านใหม่" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3" />
        </label>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={pending}>{pending ? 'กำลังบันทึกรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}</Button>
      </form>
    </main>
  )
}
