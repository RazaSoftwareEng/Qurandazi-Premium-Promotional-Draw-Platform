import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { Alert, Button, FormInput, Spinner } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { authService } from '@/services/authService'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

const SCHEMA = {
  password: [rules.required('Enter a new password'), rules.password()],
  confirm: [rules.required('Confirm your new password'), rules.matches('password', 'Passwords do not match')],
}

export default function ResetPassword() {
  useDocumentTitle('Set new password')
  const navigate = useNavigate()
  const { loading: authLoading, isAuthenticated, setRecovery, isAdmin } = useAuth()
  const [values, setValues] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  useLiveValidation(SCHEMA, values, errors, setErrors)

  if (authLoading) return <Spinner />
  if (!isAuthenticated) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold text-navy-900">Link expired</h1>
        <Alert tone="warning" className="mt-6">This password reset link is invalid or has expired. Please request a new one.</Alert>
        <Button to="/forgot-password" className="mt-6">Request new link</Button>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(SCHEMA, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      await authService.updatePassword(values.password)
      setRecovery(false)
      toast.success('Password updated')
      navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-900">Choose a new password</h1>
      <p className="mt-2 text-sm text-ink-muted">Use at least 8 characters with letters and numbers.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-5">
        <FormInput label="New password" placeholder="At least 8 characters, letters & numbers" type="password" icon={Lock} autoComplete="new-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} error={errors.password} />
        <FormInput label="Confirm new password" placeholder="Re-enter your new password" type="password" icon={Lock} autoComplete="new-password" value={values.confirm} onChange={(e) => setValues({ ...values, confirm: e.target.value })} error={errors.confirm} />
        <Button type="submit" className="w-full" size="lg" icon={KeyRound} loading={loading}>Update password</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/" className="text-ink-muted hover:text-navy-900">Cancel</Link></p>
    </div>
  )
}
