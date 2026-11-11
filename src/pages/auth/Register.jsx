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

const SCHEMA = {
  full_name: [
    rules.required('Enter your full name'),
    rules.min(2),
    rules.max(120),
    (v) => (!v || /^[\p{L}][\p{L} .'-]*$/u.test(v.trim()) ? null : 'Use letters, spaces, dots, hyphens or apostrophes only'),
  ],
  email: [rules.required(), rules.email()],
  phone: [rules.phone()],
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
      const res = await authService.signUp(values)
      if (res?.session) {
        toast.success('Account created')
        navigate('/dashboard', { replace: true })
      } else {
        navigate(`/verify-email?email=${encodeURIComponent(values.email.trim())}`, { replace: true })
      }
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-900">Create your free account</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Already a member? <Link to="/login" className="font-semibold text-gold-700 hover:underline">Sign in</Link>
      </p>
      {formError && <Alert tone="danger" className="mt-6">{formError}</Alert>}
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <FormInput label="Full name" placeholder="e.g. Ahmed Khan" icon={User} autoComplete="name" value={values.full_name} onChange={set('full_name')} error={errors.full_name} required />
        <FormInput label="Email" placeholder="you@example.com" type="email" icon={Mail} autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} required />
        <FormInput label="Phone (optional)" type="tel" icon={Phone} autoComplete="tel" placeholder="+92 300 1234567" value={values.phone} onChange={set('phone')} error={errors.phone} />
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
        <p className="text-center text-xs text-ink-muted">Registration and participation are always free.</p>
      </form>
    </div>
  )
}
