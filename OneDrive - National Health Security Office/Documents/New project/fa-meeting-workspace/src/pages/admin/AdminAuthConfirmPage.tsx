import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/common/Button'
import type { EmailTokenType } from '../../services/auth/adminAuth'
import { useAdminAuth } from '../../services/useAdminAuth'

const safeConfirmationError = 'ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ'

function confirmationType(value: string | null): EmailTokenType | null {
  return value === 'invite' || value === 'recovery' ? value : null
}

export function AdminAuthConfirmPage() {
  const auth = useAdminAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [pending, setPending] = useState(false)
  const tokenHash = params.get('token_hash')
  const type = confirmationType(params.get('type'))
  const invalid = !tokenHash || !type
  const [error, setError] = useState(invalid ? safeConfirmationError : null)

  const confirm = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || invalid || !tokenHash || !type) return

    setPending(true)
    setError(null)
    try {
      await auth.confirmEmailToken(tokenHash, type)
      navigate('/admin/update-password', { replace: true })
    } catch {
      setError(safeConfirmationError)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-government-navy px-4 py-10">
      <form aria-label="ยืนยันการดำเนินการ" onSubmit={(event) => void confirm(event)} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <h1 className="text-2xl font-black text-slate-950">ยืนยันการดำเนินการ</h1>
        <p className="mt-2 text-sm text-slate-700">กดยืนยันเพื่อดำเนินการตั้งรหัสผ่านต่อ</p>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
        {!invalid && <Button type="submit" className="mt-6 w-full" disabled={pending}>{pending ? 'กำลังยืนยัน...' : 'ยืนยันดำเนินการ'}</Button>}
        <Link to="/admin/login" className="mt-5 block text-center text-sm font-bold text-blue-700 underline">กลับไปเข้าสู่ระบบ</Link>
      </form>
    </main>
  )
}
