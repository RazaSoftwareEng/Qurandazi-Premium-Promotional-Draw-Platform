import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, Phone, User, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { Alert, Button, FormInput } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { authService } from '@/services/authService'
import { passwordStrength, rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'
import { AppDownloadLink } from '@/components/layout/AppDownloadPrompt'
import { isInApp, isIOS } from '@/utils/app'

const SCHEMA = {
  full_name: [rules.required('Enter your full name'), rules.min(2), rules.max(60), rules.personName()],
  email: [rules.required(), rules.email()],
  phone: [rules.required('Enter your phone number'), rules.mobilePK()],
  password: [rules.required(), rules.password()],
  confirm: [rules.required('Confirm your password'), rules.matches('password', 'Passwords do not match')],
  accept: [(v) => (v ? null : 'You must accept the Terms and Privacy Policy')],
}

export default function Register() {
  useDocumentTitle('Create account')
  const navigate = useNavigate()
  const [values, setValues] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '', accept: false })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const strength = passwordStrength(values.password)
  useLiveValidation(SCHEMA, values, errors, setErrors)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(SCHEMA, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    setFormError('')
    try {
      if (!(await authService.isPhoneAvailable(values.phone.trim()))) {
        setErrors((er) => ({ ...er, phone: 'This phone number is already registered. Use another number or sign in.' }))
        return
      }
      const res = await authService.signUp(values)
      // No email verification: the account is ready immediately. End the
      // auto-created session so the member signs in explicitly.
      if (res?.session) await authService.signOut().catch(() => {})
      toast.success('Account created. Please sign in to continue.')
      navigate('/login', { replace: true, state: { registeredEmail: values.email.trim().toLowerCase() } })
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-900">Create your account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Already a member? <Link to="/login" className="font-semibold text-gold-700 hover:underline">Sign in</Link>
      </p>
      {!isIOS() && !isInApp() && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold-500/30 bg-gold-100/40 px-4 py-3 text-sm text-navy-900">
          <span>Prefer your phone? Sign up in our Android app.</span>
          <AppDownloadLink className="text-gold-700 hover:underline">Download app</AppDownloadLink>
        </div>
      )}
      {formError && <Alert tone="danger" className="mt-6">{formError}</Alert>}
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <FormInput label="Full name" maxLength={60} placeholder="e.g. Ahmed Khan" icon={User} autoComplete="name" value={values.full_name} onChange={set('full_name')} error={errors.full_name} required />
        <FormInput label="Email" placeholder="you@example.com" type="email" icon={Mail} autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} required />
        <FormInput label="Phone number" type="tel" icon={Phone} autoComplete="tel" placeholder="0300 1234567" value={values.phone} onChange={set('phone')} error={errors.phone} required />
        <div>
          <FormInput label="Password" placeholder="At least 8 characters, letters & numbers" type="password" icon={Lock} autoComplete="new-password" value={values.password} onChange={set('password')} error={errors.password} required />
          {values.password && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i < strength.score ? (strength.score >= 4 ? 'bg-emerald-500' : strength.score >= 3 ? 'bg-gold-500' : 'bg-red-400') : 'bg-ivory-300'}`} />
                ))}
              </div>
              <span className="text-xs text-ink-muted">{strength.label}</span>
            </div>
          )}
        </div>
        <FormInput label="Confirm password" placeholder="Re-enter your password" type="password" icon={Lock} autoComplete="new-password" value={values.confirm} onChange={set('confirm')} error={errors.confirm} required />
        <div>
          <label className="flex items-start gap-2.5 text-sm text-ink-soft">
            <input type="checkbox" checked={values.accept} onChange={set('accept')} className="mt-0.5 h-4 w-4 rounded border-ivory-300 accent-gold-600" />
            <span>
              I agree to the <Link to="/terms" className="font-semibold text-gold-700 hover:underline">Terms</Link> and{' '}
              <Link to="/privacy" className="font-semibold text-gold-700 hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          {errors.accept && <p className="error-text">{errors.accept}</p>}
        </div>
        <Button type="submit" className="w-full" size="lg" icon={UserPlus} loading={loading}>Create account</Button>
        <p className="text-center text-xs text-ink-muted">After signing up, sign in to complete your profile, verify your CNIC and make a deposit.</p>
      </form>
    </div>
  )
}
