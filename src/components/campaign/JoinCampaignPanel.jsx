import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Info, Lock, Sparkles, Wallet, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Modal, Skeleton } from '../ui'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { campaignService } from '@/services/campaignService'
import { getErrorMessage } from '@/utils/errors'
import { getCampaignPhase } from '@/utils/campaign'
import { formatPKR } from '@/utils/format'

/** "Requires verified deposit: PKR X" line used on cards and detail pages. */
export function DepositRequirement({ amount, className = '' }) {
  if (!Number(amount)) return null
  return (
    <p className={`flex items-center gap-1.5 text-xs font-semibold text-navy-800 ${className}`}>
      <Wallet className="h-3.5 w-3.5 shrink-0 text-gold-600" /> Requires verified deposit: {formatPKR(amount)}
    </p>
  )
}

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
  const required = Number(elig.data?.required_deposit ?? campaign.category?.deposit_amount ?? 0)

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
        <p className="text-sm text-ink-muted">
          Sign in or create an account to join this campaign.
          {required > 0 && ' You will need a KYC-verified CNIC and a verified deposit.'}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button to="/login" state={{ from: location }} variant="navy">Sign in</Button>
          <Button to="/register" variant="primary">Create account</Button>
        </div>
      </>
    )
  } else if (isAdmin) {
    body = <p className="flex gap-2 text-sm text-ink-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" /> Staff accounts cannot participate in campaigns.</p>
  } else if (elig.loading && !elig.data) {
    body = <Skeleton className="h-11 w-full" />
  } else if (elig.data?.already_joined) {
    const atRisk = required > 0 && elig.data.deposit_active === false && phase.key === 'open'
    body = (
      <div className="space-y-3">
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> You have joined this campaign</p>
          <p className="mt-1">Entry reference: <span className="font-mono font-bold">{elig.data.entry_reference}</span></p>
          <Link to="/dashboard/entries" className="mt-2 inline-block font-semibold underline">View my entries</Link>
        </div>
        {atRisk && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-900">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> No active deposit</p>
            <p className="mt-1">This entry will be left out of the draw unless you have a verified deposit of {formatPKR(required)} or more when the campaign closes.</p>
            <Link to="/dashboard/deposits" className="mt-2 inline-block font-semibold underline">Go to my deposits</Link>
          </div>
        )}
      </div>
    )
  } else if (elig.data?.eligible) {
    body = (
      <>
        <Button className="w-full" size="lg" icon={Sparkles} onClick={() => setConfirming(true)}>Join Campaign</Button>
        <p className="mt-2 text-center text-xs text-ink-muted">
          {required > 0 ? 'Your verified deposit qualifies you. No fee is charged to join.' : 'No fee is charged to join.'}
        </p>
      </>
    )
  } else {
    const reasons = elig.data?.reasons || []
    const needsKyc = reasons.some((r) => /CNIC|KYC|identity/i.test(r))
    const needsDeposit = reasons.some((r) => /deposit/i.test(r) && !/awaiting/i.test(r))
    const needsProfile = reasons.some((r) => /profile|phone/i.test(r))
    body = (
      <>
        <Button className="w-full" size="lg" icon={Lock} disabled>{phase.key === 'open' ? 'Not yet eligible' : phase.label}</Button>
        {reasons.length > 0 && (
          <>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-muted">What's missing</p>
            <ul className="mt-1.5 space-y-1.5">
              {reasons.map((r) => (
                <li key={r} className="flex gap-2 text-sm text-ink-soft"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> {r}</li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(needsProfile || needsKyc) && <Button to="/dashboard/profile" variant="outline" size="sm">{needsKyc ? 'Verify my CNIC' : 'Complete my profile'}</Button>}
          {needsDeposit && !needsKyc && <Button to="/dashboard/deposits" variant="navy" size="sm" icon={Wallet}>Make a deposit</Button>}
        </div>
      </>
    )
  }

  return (
    <div className={compact ? '' : 'card p-6'}>
      {!compact && <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-navy-900">Participate</h3>}
      {!compact && required > 0 && (
        <div className="mb-4 rounded-xl border border-gold-500/30 bg-gold-100/40 px-4 py-3">
          <DepositRequirement amount={required} className="text-sm" />
          <p className="mt-1 text-xs text-ink-muted">
            A verified, active {elig.data?.category_name || campaign.category?.name} deposit or higher. It's refundable, and it must still be active when the campaign closes.
          </p>
        </div>
      )}
      {body}
      <Modal
        open={confirming}
        onClose={() => !joining && (setConfirming(false), setResult(null))}
        title={result ? 'Entry confirmed' : 'Confirm your entry'}
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
            <p className="mt-2 text-xs text-ink-muted">Keep this reference. It identifies your entry in the published draw snapshot.</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-ink-soft">
            <p>You're about to submit one entry into <strong className="text-navy-900">{campaign.title}</strong>.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>One entry per member. It can't be duplicated.</li>
              {required > 0 && <li>Keep your deposit active until the campaign closes. If you withdraw it before then, this entry is left out of the draw.</li>}
              <li>No fee is charged to join.</li>
              <li>By joining you accept the campaign rules and our Terms.</li>
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}
