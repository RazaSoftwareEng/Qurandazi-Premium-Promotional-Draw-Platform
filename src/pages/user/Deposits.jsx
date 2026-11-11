import { useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Banknote, CheckCircle2, IdCard, Landmark, Lock, ShieldCheck, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Alert, Badge, Button, DataTable, EmptyState, ErrorState, FormInput, Modal, PrivateFileLink, PrivateUpload, Select, Skeleton,
  StatusBadge, TextArea,
} from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { categoryService } from '@/services/categoryService'
import { depositService } from '@/services/depositService'
import { DEPOSIT_STATUS, PAYMENT_METHODS, paymentMethodLabel, requiresDeposit, withdrawalState } from '@/utils/deposit'
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

function PaymentDetails({ terms }) {
  const rows = [
    ['Bank', terms.bank_name],
    ['Account title', terms.account_title],
    ['Account number', terms.account_number],
    ['IBAN', terms.iban],
  ].filter(([, v]) => v)
  return (
    <div className="rounded-xl border border-ivory-300 bg-ivory-100/60 p-4 text-sm">
      <p className="mb-2 flex items-center gap-2 font-bold text-navy-900"><Landmark className="h-4 w-4 text-gold-600" /> Pay only to our company account</p>
      {rows.length ? (
        <dl className="grid gap-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3"><dt className="text-ink-muted">{k}</dt><dd className="select-all text-right font-mono font-semibold text-navy-900">{v}</dd></div>
          ))}
        </dl>
      ) : (
        <p className="text-ink-muted">Payment details have not been published yet. Contact support before paying.</p>
      )}
      {terms.gateway_instructions && <p className="mt-3 whitespace-pre-line border-t border-ivory-300 pt-3 text-ink-soft">{terms.gateway_instructions}</p>}
      <p className="mt-3 text-xs text-ink-muted">Never pay to a personal account, and never pay anyone who contacts you claiming to be from us.</p>
    </div>
  )
}

function DepositWizard({ category, onClose, onDone }) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const terms = settings.deposit_terms || {}
  const [step, setStep] = useState(1)
  const [accepted, setAccepted] = useState(false)
  const [values, setValues] = useState({ method: 'bank_transfer', txn: '', proof: null })
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
            <FormInput label="Transaction ID" required placeholder="e.g. FT2611110012345" value={values.txn} maxLength={100} onChange={(e) => setValues((v) => ({ ...v, txn: e.target.value }))} error={errors.txn} />
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

  const columns = [
    { key: 'reference', header: 'Reference', render: (d) => <span className="font-mono text-xs font-bold">{d.reference}</span> },
    { key: 'category', header: 'Category', render: (d) => <div><p className="font-semibold text-navy-900">{d.category?.name}</p><p className="text-xs text-ink-muted">{formatPKR(d.amount)}</p></div> },
    { key: 'txn', header: 'Payment', hideOnMobile: true, render: (d) => <div className="text-xs"><p>{paymentMethodLabel(d.payment_method)}</p><p className="font-mono text-ink-muted">{d.transaction_id}</p><PrivateFileLink path={d.proof_path} getUrl={depositService.proofUrl} className="text-xs">Proof</PrivateFileLink></div> },
    { key: 'created_at', header: 'Submitted', hideOnMobile: true, render: (d) => formatDate(d.created_at) },
    {
      key: 'status',
      header: 'Status',
      render: (d) => (
        <div className="space-y-1">
          <StatusBadge map={DEPOSIT_STATUS} value={d.status} />
          {d.status === 'rejected' && d.rejection_reason && <p className="max-w-[16rem] text-xs text-red-700">{d.rejection_reason}</p>}
          {d.status === 'verified' && d.locked_until && new Date(d.locked_until) > new Date() && <p className="flex items-center gap-1 text-xs text-ink-muted"><Lock className="h-3 w-3" /> Locked until {formatDate(d.locked_until)}</p>}
          {d.status === 'withdrawal_requested' && <p className="text-xs text-ink-muted">Requested {formatDate(d.withdrawal_requested_at)}</p>}
          {d.status === 'refunded' && <p className="text-xs text-ink-muted">Refunded {formatDate(d.refunded_at)} · <span className="font-mono">{d.payout_transaction_id}</span></p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (d) => {
        const w = withdrawalState(d, allowEarly)
        if (d.status !== 'verified') return null
        return w.allowed ? (
          <Button size="sm" variant="outline" onClick={() => setWithdrawing(d)}>Withdraw</Button>
        ) : (
          <span className="text-xs text-ink-muted">Withdrawable from {formatDate(d.locked_until)}</span>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader title="My Deposits" description="A verified, refundable deposit makes you eligible for campaigns in its category and every lower category." />

      {!kycVerified && (
        <Alert tone="warning" icon={IdCard} title="Verify your identity first" className="mb-6">
          Only KYC-verified members can make deposits.{' '}
          {profile?.kyc_status === 'pending' ? 'Your CNIC is under review — we will notify you once it is verified.' : 'Submit your CNIC from your profile.'}
          {profile?.kyc_status !== 'pending' && <div className="mt-2"><Button to="/dashboard/profile" size="sm" variant="navy">Go to my profile</Button></div>}
        </Alert>
      )}

      {bestActive && (
        <Alert tone="success" icon={ShieldCheck} title={`Active deposit: ${bestActive.category?.name} · ${formatPKR(bestActive.amount)}`} className="mb-6">
          You can join any campaign that requires {formatPKR(bestActive.amount)} or less.
        </Alert>
      )}

      <h2 className="mb-3 text-lg font-bold text-navy-900">Choose a category</h2>
      {cats.loading ? (
        <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
      ) : cats.error ? (
        <div className="card"><ErrorState error={cats.error} onRetry={cats.reload} /></div>
      ) : !tiers.length ? (
        <div className="card"><EmptyState icon={Banknote} title="No deposit categories yet" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((c) => {
            const open = openByCategory[c.id]
            const covered = tiers.filter((t) => Number(t.deposit_amount) <= Number(c.deposit_amount)).map((t) => t.name)
            return (
              <article key={c.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-2xl font-semibold text-navy-900">{c.name}</h3>
                  {open && <StatusBadge map={DEPOSIT_STATUS} value={open.status} />}
                </div>
                <p className="mt-2 text-2xl font-extrabold tabular-nums text-navy-900">{formatPKR(c.deposit_amount)}</p>
                <p className="text-xs text-ink-muted">Refundable · {c.deposit_lock_in_days}-day lock-in</p>
                <p className="mt-3 flex-1 text-sm text-ink-soft">Eligible for: {covered.join(', ')} campaigns</p>
                <Button
                  className="mt-4 w-full"
                  variant={open ? 'outline' : 'primary'}
                  disabled={!kycVerified || Boolean(open)}
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
      <DataTable
        columns={columns}
        rows={deposits}
        loading={mine.loading}
        error={mine.error}
        onRetry={mine.reload}
        empty={<EmptyState icon={Wallet} title="No deposits yet" message="Choose a category above to make your first refundable deposit." />}
      />
      <p className="mt-3 text-xs text-ink-muted">
        Statuses: Pending → Verified (active) → Withdrawal Requested → Refunded. {allowEarly ? 'Withdrawals are currently allowed at any time.' : 'Withdrawals open after the lock-in period.'}
      </p>

      {depositFor && <DepositWizard category={depositFor} onClose={() => setDepositFor(null)} onDone={done} />}
      {withdrawing && <WithdrawModal deposit={withdrawing} onClose={() => setWithdrawing(null)} onDone={done} />}
    </>
  )
}
