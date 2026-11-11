import { useState } from 'react'
import { KeyRound, LogOut, MailCheck, ShieldCheck, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, ConfirmationDialog, FormInput } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { authService } from '@/services/authService'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'

const PASSWORD_SCHEMA = {
  current: [rules.required('Enter your current password')],
  password: [rules.required('Enter a new password'), rules.password(), (v, all) => (v && v === all.current ? 'Choose a different password' : null)],
  confirm: [rules.required('Confirm your new password'), rules.matches('password', 'Passwords do not match')],
}

/** Shared by the user dashboard and the admin "Admin account" panel. */
export function ChangePasswordCard() {
  const { user } = useAuth()
  const [values, setValues] = useState({ current: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  useLiveValidation(PASSWORD_SCHEMA, values, errors, setErrors)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(PASSWORD_SCHEMA, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await authService.changePassword({ email: user.email, currentPassword: values.current, newPassword: values.password })
      setValues({ current: '', password: '', confirm: '' })
      toast.success('Password changed')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card p-6">
      <h2 className="flex items-center gap-2 font-bold text-navy-900"><KeyRound className="h-5 w-5 text-gold-600" /> Change password</h2>
      <div className="mt-5 grid gap-4">
        <FormInput label="Current password" placeholder="Enter your current password" type="password" autoComplete="current-password" value={values.current} onChange={(e) => setValues({ ...values, current: e.target.value })} error={errors.current} />
        <FormInput label="New password" placeholder="At least 8 characters, letters & numbers" type="password" autoComplete="new-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} error={errors.password} help="At least 8 characters with letters and numbers." />
        <FormInput label="Confirm new password" placeholder="Re-enter your new password" type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => setValues({ ...values, confirm: e.target.value })} error={errors.confirm} />
      </div>
      <Button type="submit" className="mt-5" loading={saving}>Update password</Button>
    </form>
  )
}

export function SecurityCard() {
  const { user, isEmailVerified, signOut } = useAuth()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const signOutAll = async () => {
    setBusy(true)
    try {
      await authService.signOutEverywhere()
      toast.success('Signed out of all devices')
      await signOut()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }

  const resend = async () => {
    try {
      await authService.resendVerification(user.email)
      toast.success('Verification email sent')
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="card p-6">
      <h2 className="flex items-center gap-2 font-bold text-navy-900"><ShieldCheck className="h-5 w-5 text-gold-600" /> Account security</h2>
      <dl className="mt-5 divide-y divide-ivory-200 text-sm">
        <div className="flex items-center justify-between py-3">
          <dt className="text-ink-muted">Email</dt>
          <dd className="font-semibold text-navy-900">{user.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <dt className="text-ink-muted">Verification</dt>
          <dd className="flex items-center gap-2">
            {isEmailVerified ? <Badge tone="success" dot>Verified</Badge> : <><Badge tone="warning" dot>Unverified</Badge><Button size="sm" variant="ghost" icon={MailCheck} onClick={resend}>Resend</Button></>}
          </dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-ink-muted">Last sign-in</dt>
          <dd className="font-semibold text-navy-900">{formatDateTime(user.last_sign_in_at)}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="navy" icon={LogOut} onClick={signOut}>Log out</Button>
        <Button variant="outline" icon={ShieldAlert} onClick={() => setConfirm(true)}>Sign out of all devices</Button>
      </div>
      <ConfirmationDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={signOutAll}
        loading={busy}
        tone="navy"
        title="Sign out everywhere?"
        message="This ends every active session for your account, including this one."
        confirmLabel="Sign out everywhere"
      />
    </div>
  )
}

export default function AccountSettings() {
  useDocumentTitle('Account Settings')
  return (
    <>
      <PageHeader title="Account Settings" description="Manage your password and account security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChangePasswordCard />
        <SecurityCard />
      </div>
    </>
  )
}
