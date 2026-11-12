import { useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Banknote, CheckCircle2, IdCard, Landmark, Lock, ShieldCheck, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Alert, Badge, Button, EmptyState, ErrorState, FormInput, Modal, PrivateFileLink, PrivateUpload, Select, Skeleton,
  StatusBadge, TextArea,
} from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { categoryService } from '@/services/categoryService'
import { depositService } from '@/services/depositService'
import { DEPOSIT_STATUS, PAYMENT_METHODS, paymentMethodShort, requiresDeposit, withdrawalState } from '@/utils/deposit'
import { formatDate, formatPKR } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

const OPEN = ['pending', 'verified', 'withdrawal_requested']

function TermsText({ text }) {
  return (
    <ul className="space-y-1.5">
      {String(text || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => (
          <li key={l} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {l}</li>
        ))}
    </ul>
  )
}

function QrPayment({ terms }) {
  const copyTill = async () => {
    try {
      await navigator.clipboard.writeText(terms.till_id)
      toast.success('Till ID copied')
    } catch {
      toast.error('Copy failed. Please note the Till ID manually.')
    }
  }
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
      {terms.qr_image_url && (
        <a href={terms.qr_image_url} target="_blank" rel="noreferrer" className="mx-auto block w-44 overflow-hidden rounded-xl bg-white ring-1 ring-ivory-300 sm:w-full" title="Open full-size QR code">
          <img src={terms.qr_image_url} alt="JazzCash / Raast payment QR code" className="h-auto w-full" loading="lazy" />
        </a>
      )}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Scan & pay with any banking or wallet app (Raast QR)</p>
        {terms.qr_account_name && (
          <p className="text-ink-muted">Account name: <strong className="text-navy-900">{terms.qr_account_name}</strong></p>
        )}
        {terms.till_id && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-muted">Till ID:</span>
            <span className="select-all rounded-lg bg-white px-3 py-1 font-mono text-lg font-extrabold tracking-[0.2em] text-navy-900 ring-1 ring-ivory-300">{terms.till_id}</span>
            <Button size="sm" variant="ghost" onClick={copyTill}>Copy</Button>
          </div>
        )}
        {terms.till_id && (
          <p className="text-xs text-ink-soft">No QR scanner? Dial <strong className="font-mono">*786*10#</strong> from your JazzCash number and enter the Till ID.</p>
        )}
      </div>
    </div>
  )
}

function PaymentDetails({ terms }) {
  const hasQr = Boolean(terms.qr_image_url || terms.till_id)
  const rows = [
    // The plain wallet number is only shown when no QR / Till ID is configured
    [terms.wallet_providers || 'Mobile wallet', hasQr ? null : terms.wallet_number],
    ['Bank', terms.bank_name],
    ['Account title', terms.account_title],
    ['Account number', terms.account_number],
    ['IBAN', terms.iban],
  ].filter(([, v]) => v)
  return (
    <div className="rounded-xl border border-ivory-300 bg-ivory-100/60 p-4 text-sm">
      <p className="mb-3 flex items-center gap-2 font-bold text-navy-900"><Landmark className="h-4 w-4 text-gold-600" /> Pay only to the official QURANDAZI account</p>
      {hasQr && <QrPayment terms={terms} />}
      {hasQr && rows.length > 0 && <div className="my-3 border-t border-ivory-300" />}
      {rows.length ? (
        <dl className="grid gap-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-muted">{k}</dt><dd className="select-all text-right font-mono font-semibold text-navy-900">{v}</dd></div>
          ))}
        </dl>
      ) : hasQr ? null : (
        <p className="text-ink-muted">Payment details have not been published yet. Contact support before paying.</p>
      )}
      {terms.gateway_instructions && <p className="mt-3 whitespace-pre-line border-t border-ivory-300 pt-3 text-ink-soft">{terms.gateway_instructions}</p>}
      <p className="mt-3 text-xs text-ink-muted">Pay only to the account shown here. Never pay anyone who contacts you by phone or WhatsApp claiming to be from us.</p>
    </div>
  )
}

function DepositWizard({ category, onClose, onDone }) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const terms = settings.deposit_terms || {}
  const [step, setStep] = useState(1)
  const [accepted, setAccepted] = useState(false)
  const [values, setValues] = useState({ method: 'mobile_wallet', txn: '', proof: null })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const errs = {}
    if (!values.method) errs.method = 'Select a payment method'
    if (values.txn.trim().length < 4) errs.txn = 'Enter the transaction ID / reference from your bank or gateway receipt'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const res = await depositService.create({
        categoryId: category.id,
        paymentMethod: values.method,
        transactionId: values.txn.trim(),
        proofPath: values.proof,
        acceptTerms: accepted,
      })
      toast.success(`Deposit ${res.reference} submitted — pending verification`)
      window.dispatchEvent(new Event('qz:notifications-changed'))
      onDone()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      size="lg"
      title={`${category.name} deposit — ${formatPKR(category.deposit_amount)}`}
      description={step === 1 ? 'Step 1 of 2 · Review the deposit terms' : 'Step 2 of 2 · Pay and submit your proof'}
      footer={
        step === 1 ? (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button iconRight={ArrowRight} disabled={!accepted} onClick={() => setStep(2)}>I agree — continue to payment</Button>
          </>
        ) : (
          <>
            <Button variant="outline" icon={ArrowLeft} onClick={() => setStep(1)} disabled={busy}>Back</Button>
            <Button icon={ShieldCheck} loading={busy} onClick={submit}>Submit deposit</Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-4 text-sm text-ink-soft">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Deposit amount', formatPKR(category.deposit_amount)],
              ['Lock-in period', `${category.deposit_lock_in_days} day${category.deposit_lock_in_days === 1 ? '' : 's'}`],
              ['Early withdrawal', terms.allow_early_withdrawal ? 'Allowed' : 'Not before lock-in ends'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ivory-100 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{k}</p>
                <p className="mt-0.5 font-extrabold text-navy-900">{v}</p>
              </div>
            ))}
          </div>
          <Alert tone="gold" icon={Wallet} title="This deposit is not a fee">
            It stays in your name and is returned to you in full according to the terms below.
          </Alert>
          <div>
            <p className="mb-2 font-bold text-navy-900">Deposit & refund terms {terms.version && <span className="font-mono text-xs font-normal text-ink-muted">({terms.version})</span>}</p>
            <TermsText text={terms.terms_text} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ivory-300 p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-gold-600" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              I have read and accept these deposit terms. I understand the deposit is refundable and that withdrawing it before a campaign closes removes my entry from that campaign's draw.
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <PaymentDetails terms={terms} />
          <p className="text-sm text-ink-soft">
            Transfer exactly <strong className="text-navy-900">{formatPKR(category.deposit_amount)}</strong>, then enter the transaction ID from your receipt.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Payment method" required value={values.method} onChange={(e) => setValues((v) => ({ ...v, method: e.target.value }))} options={PAYMENT_METHODS} error={errors.method} />
            <FormInput label="Transaction ID" required placeholder="e.g. 41234567890 (TID from SMS / receipt)" value={values.txn} maxLength={100} onChange={(e) => setValues((v) => ({ ...v, txn: e.target.value }))} error={errors.txn} />
            <div className="sm:col-span-2">
              <PrivateUpload
                label="Payment proof (recommended)"
                value={values.proof}
                onChange={(p) => setValues((v) => ({ ...v, proof: p }))}
                upload={(f) => depositService.uploadProof(user.id, f)}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                help="Screenshot or PDF receipt · JPG, PNG, WebP or PDF up to 5 MB"
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function WithdrawModal({ deposit, onClose, onDone }) {
  const impact = useAsync(() => depositService.withdrawalImpact(deposit.id), [deposit.id])
  const [payout, setPayout] = useState('')
  const [busy, setBusy] = useState(false)
  const excluded = impact.data || []

  const submit = async () => {
    if (payout.trim().length < 5) return toast.error('Enter the bank account details for your refund')
    setBusy(true)
    try {
      await depositService.requestWithdrawal(deposit.id, payout.trim())
      toast.success('Withdrawal requested')
      window.dispatchEvent(new Event('qz:notifications-changed'))
      onDone()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="Request withdrawal"
      description={`${deposit.reference} · ${deposit.category?.name} · ${formatPKR(deposit.amount)}`}
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="danger" loading={busy} disabled={impact.loading} onClick={submit}>Request withdrawal</Button></>}
    >
      <div className="space-y-4 text-sm">
        {impact.loading ? (
          <Skeleton className="h-16 w-full" />
        ) : impact.error ? (
          <ErrorState error={impact.error} onRetry={impact.reload} />
        ) : excluded.length > 0 ? (
          <Alert tone="danger" icon={AlertTriangle} title={`Your entry will be excluded from ${excluded.length} open campaign${excluded.length === 1 ? '' : 's'}`}>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {excluded.map((c) => (
                <li key={c.campaign_id}>{c.title} <span className="font-mono text-xs">({c.reference})</span> — closes {formatDate(c.end_date)}</li>
              ))}
            </ul>
            <p className="mt-2">These campaigns close after your withdrawal, so your entries will not be part of their draws.</p>
          </Alert>
        ) : (
          <Alert tone="info" title="No open entries are affected">None of your entries in open campaigns rely on this deposit.</Alert>
        )}
        <p className="text-ink-soft">Once requested, this deposit stops counting as active immediately and cannot be reactivated. You can make a new deposit at any time.</p>
        <TextArea
          label="Refund account details"
          required
          rows={3}
          maxLength={500}
          placeholder={'Bank name\nAccount title (must match your CNIC name)\nIBAN / account number'}
          value={payout}
          onChange={(e) => setPayout(e.target.value)}
        />
      </div>
    </Modal>
  )
}

function DepositHistoryCard({ deposit: d, allowEarly, onWithdraw }) {
  const w = withdrawalState(d, allowEarly)
  const locked = d.status === 'verified' && d.locked_until && new Date(d.locked_until) > new Date()
  const facts = [
    ['Payment', paymentMethodShort(d.payment_method)],
    ['Transaction ID', <span key="t" className="break-all font-mono">{d.transaction_id}</span>],
    ['Submitted', formatDate(d.created_at)],
    d.verified_at && ['Verified', formatDate(d.verified_at)],
    locked && ['Locked until', formatDate(d.locked_until)],
    d.withdrawal_requested_at && ['Withdrawal requested', formatDate(d.withdrawal_requested_at)],
    d.refunded_at && ['Refunded', formatDate(d.refunded_at)],
    d.payout_transaction_id && ['Payout transaction', <span key="p" className="break-all font-mono">{d.payout_transaction_id}</span>],
  ].filter(Boolean)

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-base font-bold leading-snug text-navy-900">{d.category?.name}</p>
          <p className="mt-0.5 text-lg font-extrabold tabular-nums text-navy-900">{formatPKR(d.amount)}</p>
          <p className="mt-0.5 font-mono text-xs text-ink-muted">{d.reference}</p>
        </div>
        <div className="shrink-0"><StatusBadge map={DEPOSIT_STATUS} value={d.status} /></div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-ivory-200 pt-4 text-sm min-[420px]:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{k}</dt>
            <dd className="mt-0.5 font-medium text-navy-900">{v}</dd>
          </div>
        ))}
      </dl>

      {d.status === 'rejected' && d.rejection_reason && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"><strong>Reason:</strong> {d.rejection_reason}</p>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-ivory-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <PrivateFileLink path={d.proof_path} getUrl={depositService.proofUrl}>View payment proof</PrivateFileLink>
        {d.status === 'verified' &&
          (w.allowed ? (
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={onWithdraw}>Request withdrawal</Button>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Lock className="h-3.5 w-3.5" /> Withdrawable from {formatDate(d.locked_until)}</p>
          ))}
      </div>
    </li>
  )
}

export default function Deposits() {
  useDocumentTitle('My Deposits')
  const { user, profile } = useAuth()
  const { settings } = useSettings()
  const allowEarly = Boolean(settings.deposit_terms?.allow_early_withdrawal)
  const [depositFor, setDepositFor] = useState(null)
  const [withdrawing, setWithdrawing] = useState(null)
  const cats = useAsync(() => categoryService.list(), [])
  const mine = useAsync(() => depositService.mine(user.id), [user.id])
  const kycVerified = profile?.kyc_status === 'verified'

  const tiers = (cats.data || []).filter(requiresDeposit).sort((a, b) => Number(b.deposit_amount) - Number(a.deposit_amount))
  const deposits = mine.data || []
  const openByCategory = Object.fromEntries(deposits.filter((d) => OPEN.includes(d.status)).map((d) => [d.category_id, d]))
  const bestActive = deposits.filter((d) => d.status === 'verified').reduce((m, d) => (Number(d.amount) > Number(m?.amount || 0) ? d : m), null)

  const done = () => {
    setDepositFor(null)
    setWithdrawing(null)
    mine.reload()
  }


  return (
    <>
      <PageHeader title="My Deposits" description="A verified, refundable deposit makes you eligible for campaigns in its category and every lower category." />

      {!kycVerified && (
        <Alert tone="info" icon={IdCard} title={profile?.kyc_status === 'pending' ? 'Your CNIC is under review' : 'CNIC verification is still needed'} className="mb-6">
          You can pay and submit your deposit now. It will wait for admin approval. To join campaigns you will also need a KYC-verified CNIC.
          {profile?.kyc_status !== 'pending' && <div className="mt-2"><Button to="/dashboard/profile" size="sm" variant="navy">Verify my CNIC</Button></div>}
        </Alert>
      )}

      {bestActive && (
        <Alert tone="success" icon={ShieldCheck} title={`Active deposit: ${bestActive.category?.name} · ${formatPKR(bestActive.amount)}`} className="mb-6">
          You can join any campaign that requires {formatPKR(bestActive.amount)} or less.
        </Alert>
      )}

      <h2 className="mb-3 text-lg font-bold text-navy-900">Choose a category</h2>
      {cats.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
      ) : cats.error ? (
        <div className="card"><ErrorState error={cats.error} onRetry={cats.reload} /></div>
      ) : !tiers.length ? (
        <div className="card"><EmptyState icon={Banknote} title="No deposit categories yet" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tiers.map((c) => {
            const open = openByCategory[c.id]
            const covered = tiers.filter((t) => Number(t.deposit_amount) <= Number(c.deposit_amount)).map((t) => t.name)
            return (
              <article key={c.id} className="card flex flex-col p-5">
                {open && <div className="mb-2"><StatusBadge map={DEPOSIT_STATUS} value={open.status} /></div>}
                <h3 className="break-words font-display text-xl font-semibold leading-tight text-navy-900 sm:text-2xl">{c.name}</h3>
                <p className="mt-2 text-xl font-extrabold tabular-nums text-navy-900 sm:text-2xl">{formatPKR(c.deposit_amount)}</p>
                <p className="text-xs text-ink-muted">Refundable · {c.deposit_lock_in_days}-day lock-in</p>
                <p className="mt-3 flex-1 text-sm text-ink-soft">Eligible for: {covered.join(', ')} campaigns</p>
                <Button
                  className="mt-4 w-full"
                  variant={open ? 'outline' : 'primary'}
                  disabled={Boolean(open)}
                  onClick={() => setDepositFor(c)}
                >
                  {open ? 'Deposit already open' : `Deposit ${formatPKR(c.deposit_amount)}`}
                </Button>
              </article>
            )
          })}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-bold text-navy-900">Deposit history</h2>
      {mine.loading && !deposits.length ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
      ) : mine.error ? (
        <div className="card"><ErrorState error={mine.error} onRetry={mine.reload} /></div>
      ) : !deposits.length ? (
        <div className="card"><EmptyState icon={Wallet} title="No deposits yet" message="Choose a category above to make your first refundable deposit." /></div>
      ) : (
        <ul className="space-y-3">
          {deposits.map((d) => (
            <DepositHistoryCard key={d.id} deposit={d} allowEarly={allowEarly} onWithdraw={() => setWithdrawing(d)} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Statuses: Pending → Verified (active) → Withdrawal Requested → Refunded. {allowEarly ? 'Withdrawals are currently allowed at any time.' : 'Withdrawals open after the lock-in period.'}
      </p>

      {depositFor && <DepositWizard category={depositFor} onClose={() => setDepositFor(null)} onDone={done} />}
      {withdrawing && <WithdrawModal deposit={withdrawing} onClose={() => setWithdrawing(null)} onDone={done} />}
    </>
  )
}
