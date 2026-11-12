import { useState } from 'react'
import { BadgeCheck, Clock, IdCard, Send, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { Alert, Badge, Button, FormInput, PrivateUpload, StatusBadge } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { kycService } from '@/services/kycService'
import { KYC_STATUS, formatCnicInput, maskCnic, normalizeCnic } from '@/utils/deposit'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

/** Step 1 of the deposit flow: CNIC number + front/back images, reviewed by an admin. */
export default function KycCard() {
  const { user, profile, refreshProfile } = useAuth()
  const [cnic, setCnic] = useState('')
  const [front, setFront] = useState(null)
  const [back, setBack] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const status = profile?.kyc_status || 'not_submitted'
  const profileComplete = Boolean(profile?.full_name?.trim() && profile?.phone?.trim() && profile?.address?.trim())
  const canSubmit = status === 'not_submitted' || status === 'rejected'

  const submit = async (e) => {
    e.preventDefault()
    const normalized = normalizeCnic(cnic)
    if (!normalized) return setError('Enter your 13-digit CNIC, e.g. 42101-1234567-1')
    if (!front || !back) return toast.error('Upload both the front and back of your CNIC')
    setError(null)
    setBusy(true)
    try {
      await kycService.submit({ cnic: normalized, frontPath: front, backPath: back })
      toast.success('CNIC submitted for verification')
      setFront(null)
      setBack(null)
      await refreshProfile()
      window.dispatchEvent(new Event('qz:notifications-changed'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-navy-900"><IdCard className="h-5 w-5 text-gold-600" /> Identity verification (KYC)</h2>
        <StatusBadge map={KYC_STATUS} value={status} />
      </div>

      {status === 'verified' && (
        <Alert tone="success" icon={BadgeCheck} title="Your account is KYC Verified">
          CNIC {maskCnic(profile.cnic)} · verified {formatDateTime(profile.kyc_reviewed_at)}. You can now make a deposit.
          <div className="mt-3"><Button to="/dashboard/deposits" size="sm" variant="navy">Make a deposit</Button></div>
        </Alert>
      )}

      {status === 'pending' && (
        <Alert tone="warning" icon={Clock} title="Your CNIC is under review">
          Submitted {formatDateTime(profile.kyc_submitted_at)} for CNIC {maskCnic(profile.cnic)}. We'll notify you when an administrator has reviewed it.
          Your name is locked while the review is in progress.
        </Alert>
      )}

      {status === 'rejected' && (
        <Alert tone="danger" icon={ShieldAlert} title="Your CNIC could not be verified" className="mb-4">
          {profile.kyc_note ? <>Reason: {profile.kyc_note}. </> : null}Please check your details and submit again.
        </Alert>
      )}

      {canSubmit && (
        <>
          <p className="mb-4 text-sm text-ink-muted">
            Only KYC-verified members can make deposits. Your full name must match your CNIC exactly. Your CNIC images are stored privately and seen only by our verification team.
          </p>
          {!profileComplete ? (
            <Alert tone="info" title="Before you submit">
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Complete your full name, phone number and address above.</li>
              </ul>
            </Alert>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="CNIC number"
                required
                className="sm:col-span-2"
                inputMode="numeric"
                placeholder="42101-1234567-1"
                value={cnic}
                onChange={(e) => setCnic(formatCnicInput(e.target.value))}
                error={error}
                help={<>Name on CNIC must be: <strong>{profile.full_name}</strong></>}
              />
              <PrivateUpload label="CNIC — front" required value={front} onChange={setFront} upload={(f) => kycService.uploadCnicImage(user.id, f, 'front')} help="JPG, PNG or WebP up to 5 MB" />
              <PrivateUpload label="CNIC — back" required value={back} onChange={setBack} upload={(f) => kycService.uploadCnicImage(user.id, f, 'back')} help="JPG, PNG or WebP up to 5 MB" />
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <Badge tone="neutral">Reviewed manually by an administrator</Badge>
                <Button type="submit" icon={Send} loading={busy}>Submit for verification</Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}
