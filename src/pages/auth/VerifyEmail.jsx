import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { authService } from '@/services/authService'
import { getErrorMessage } from '@/utils/errors'

export default function VerifyEmail() {
  useDocumentTitle('Verify your email')
  const [params] = useSearchParams()
  const email = params.get('email') || ''
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!cooldown) return undefined
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const resend = async () => {
    setLoading(true)
    try {
      await authService.resendVerification(email)
      toast.success('Verification email sent')
      setCooldown(60)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
        <MailCheck className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-navy-900">Verify your email</h1>
      <p className="mt-3 text-sm leading-6 text-ink-muted">
        We’ve sent a verification link to {email ? <strong className="text-navy-900">{email}</strong> : 'your email address'}. Open it to activate your account.
      </p>
      {email && (
        <Button variant="outline" className="mt-8" onClick={resend} loading={loading} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </Button>
      )}
      <div className="mt-4">
        <Button to="/login" variant="ghost">Back to sign in</Button>
      </div>
    </div>
  )
}
