import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Lock, LogIn, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { Alert, Button, FormInput } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { authService } from '@/services/authService'
import { rememberMe } from '@/services/supabase'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

const SCHEMA = {
  email: [rules.required('Email is required'), rules.email()],
  password: [rules.required('Password is required'), rules.min(6, 'Password must be at least 6 characters')],
}

export default function Login() {
  useDocumentTitle('Sign in')
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState({ email: rememberMe.email, password: '' })
  const [remember, setRemember] = useState(rememberMe.enabled)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [unverified, setUnverified] = useState(false)
  useLiveValidation(SCHEMA, values, errors, setErrors)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(SCHEMA, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setFormError('')
    setUnverified(false)
    // Must be set BEFORE sign-in so the session is written to the right storage
    rememberMe.set(remember, values.email)
    try {
      await authService.signIn(values)
      toast.success('Welcome back')
      const from = location.state?.from?.pathname
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true })
    } catch (err) {
      if (/Email not confirmed/i.test(err.message)) setUnverified(true)
      setFormError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    try {
      await authService.resendVerification(values.email)
      toast.success('Verification email sent')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-900">Sign in</h1>
      <p className="mt-2 text-sm text-ink-muted">
        New to QURANDAZI? <Link to="/register" className="font-semibold text-gold-700 hover:underline">Create a free account</Link>
      </p>
      {formError && (
        <Alert tone="danger" className="mt-6">
          {formError}
          {unverified && (
            <button type="button" onClick={resend} className="ml-1 font-semibold underline">Resend verification email</button>
          )}
        </Alert>
      )}
      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        <FormInput
          label="Email"
          name="email"
          placeholder="you@example.com"
          type="email"
          icon={Mail}
          autoComplete="username email"
          required
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={errors.email}
        />
        <FormInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          type="password"
          icon={Lock}
          autoComplete="current-password"
          required
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={errors.password}
        />
        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-ivory-300 accent-gold-600"
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-semibold text-gold-700 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full" size="lg" icon={LogIn} loading={loading}>Sign in</Button>
        <p className="text-center text-xs text-ink-muted">
          {remember ? 'You’ll stay signed in on this device and your email will be remembered.' : 'You’ll be signed out when you close your browser.'}
        </p>
      </form>
    </div>
  )
}
