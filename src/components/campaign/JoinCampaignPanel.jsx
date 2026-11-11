import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, Info, Lock, Sparkles, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Modal, Skeleton } from '../ui'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { campaignService } from '@/services/campaignService'
import { getErrorMessage } from '@/utils/errors'
import { getCampaignPhase } from '@/utils/campaign'

/** Eligibility-aware "Join Campaign" control with confirmation. */
export default function JoinCampaignPanel({ campaign, onJoined, compact = false }) {
  const { isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()
  const [confirming, setConfirming] = useState(false)
  const [joining, setJoining] = useState(false)
  const [result, setResult] = useState(null)
  const phase = getCampaignPhase(campaign)

  const elig = useAsync(
    () => (isAuthenticated ? campaignService.checkEligibility(campaign.id) : Promise.resolve(null)),
    [campaign.id, isAuthenticated],
  )

  const join = async () => {
    setJoining(true)
    try {
      const res = await campaignService.join(campaign.id)
      setResult(res)
      toast.success('Entry confirmed!')
      elig.reload()
      onJoined?.(res)
      window.dispatchEvent(new Event('qz:notifications-changed'))
    } catch (e) {
      toast.error(getErrorMessage(e))
      setConfirming(false)
      elig.reload()
    } finally {
      setJoining(false)
    }
  }

  let body
  if (!isAuthenticated) {
    body = (
      <>
        <p className="text-sm text-ink-muted">Sign in or create a free account to join this campaign.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button to="/login" state={{ from: location }} variant="navy">Sign in</Button>
          <Button to="/register" variant="primary">Join free</Button>
        </div>
      </>
    )
  } else if (isAdmin) {
    body = <p className="flex gap-2 text-sm text-ink-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" /> Staff accounts cannot participate in campaigns.</p>
  } else if (elig.loading && !elig.data) {
    body = <Skeleton className="h-11 w-full" />
  } else if (elig.data?.already_joined) {
    body = (
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> You have joined this campaign</p>
        <p className="mt-1">Entry reference: <span className="font-mono font-bold">{elig.data.entry_reference}</span></p>
        <Link to="/dashboard/entries" className="mt-2 inline-block font-semibold underline">View my entries</Link>
      </div>
    )
  } else if (elig.data?.eligible) {
    body = (
      <>
        <Button className="w-full" size="lg" icon={Sparkles} onClick={() => setConfirming(true)}>Join Campaign — Free</Button>
        <p className="mt-2 text-center text-xs text-ink-muted">No purchase or payment required.</p>
      </>
    )
  } else {
    const reasons = elig.data?.reasons || []
    body = (
      <>
        <Button className="w-full" size="lg" icon={Lock} disabled>{phase.key === 'open' ? 'Not yet eligible' : phase.label}</Button>
        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {reasons.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-ink-soft"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> {r}</li>
            ))}
          </ul>
        )}
        {reasons.some((r) => /profile|phone/i.test(r)) && <Button to="/dashboard/profile" variant="outline" size="sm" className="mt-3">Complete my profile</Button>}
      </>
    )
  }

  return (
    <div className={compact ? '' : 'card p-6'}>
      {!compact && <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-navy-900">Participate</h3>}
      {body}
      <Modal
        open={confirming}
        onClose={() => !joining && (setConfirming(false), setResult(null))}
        title={result ? 'Entry confirmed' : 'Confirm your free entry'}
        size="sm"
        footer={
          result ? (
            <>
              <Button variant="outline" onClick={() => { setConfirming(false); setResult(null) }}>Close</Button>
              <Button to="/dashboard/entries" variant="navy">View my entries</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={joining}>Cancel</Button>
              <Button onClick={join} loading={joining}>Confirm entry</Button>
            </>
          )
        }
      >
        {result ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="mt-3 text-sm text-ink-soft">Your entry for <strong>{campaign.title}</strong> is recorded.</p>
            <p className="mt-4 rounded-xl bg-ivory-100 px-4 py-3 font-mono text-lg font-bold tracking-wider text-navy-900">{result.reference}</p>
            <p className="mt-2 text-xs text-ink-muted">Keep this reference — it identifies your entry in the published draw snapshot.</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-ink-soft">
            <p>You are about to submit one free entry into <strong className="text-navy-900">{campaign.title}</strong>.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>One entry per member — this cannot be duplicated.</li>
              <li>No purchase, deposit or payment is involved.</li>
              <li>By joining you accept the campaign rules and our Terms.</li>
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}
