import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { Alert, Button, FormInput } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { authService } from '@/services/authService'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

export default function ForgotPassword() {
  useDocumentTitle('Forgot password')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate({ email: [rules.required(), rules.email()] }, { email })
    if (errs.email) return setError(errs.email)
    setLoading(true)
    setError('')
    try {
      await authService.sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <Link to="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-navy-900">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy-900">Reset your password</h1>
      {sent ? (
        <Alert tone="success" icon={MailCheck} title="Check your inbox" className="mt-6">
          If an account exists for <strong>{email}</strong>, you’ll receive a link to reset your password shortly.
        </Alert>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-muted">Enter your account email and we’ll send you a secure reset link.</p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-5">
            <FormInput
              label="Email"
              placeholder="Enter your account email"
              type="email"
              icon={Mail}
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(validate({ email: [rules.required('Email is required'), rules.email()] }, { email: e.target.value }).email || '')
              }}
              error={error}
            />
            <Button type="submit" className="w-full" size="lg" loading={loading}>Send reset link</Button>
          </form>
        </>
      )}
    </div>
  )
}
