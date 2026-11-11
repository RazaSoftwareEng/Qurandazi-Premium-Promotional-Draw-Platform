import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CheckCircle2, Download, Eye, MoreVertical, Undo2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Alert, Badge, Button, ConfirmationDialog, DataTable, Dropdown, EmptyState, FormInput, Modal, PrivateFileLink, PrivateImage,
  SearchInput, Select, StatusBadge, TextArea,
} from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { adminService } from '@/services/adminService'
import { categoryService } from '@/services/categoryService'
import { depositService } from '@/services/depositService'
import { DEPOSIT_STATUS, KYC_STATUS, paymentMethodLabel } from '@/utils/deposit'
import { downloadCSV } from '@/utils/csv'
import { formatDateTime, formatPKR } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

const TABS = [
  ['pending', 'Pending'],
  ['verified', 'Active'],
  ['withdrawal_requested', 'Withdrawals'],
  ['refunded', 'Refunded'],
  ['rejected', 'Rejected'],
  ['', 'All'],
]

const EXPORT_COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'name', label: 'Depositor', value: (d) => d.profile?.full_name },
  { key: 'email', label: 'Email', value: (d) => d.profile?.email },
  { key: 'cnic', label: 'CNIC', value: (d) => d.profile?.cnic },
  { key: 'category', label: 'Category', value: (d) => d.category?.name },
  { key: 'amount', label: 'Amount (PKR)' },
  { key: 'payment_method', label: 'Method' },
  { key: 'transaction_id', label: 'Transaction ID' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Submitted' },
  { key: 'verified_at', label: 'Verified' },
  { key: 'locked_until', label: 'Locked until' },
  { key: 'rejection_reason', label: 'Rejection reason' },
  { key: 'withdrawal_requested_at', label: 'Withdrawal requested' },
  { key: 'refunded_at', label: 'Refunded' },
  { key: 'payout_transaction_id', label: 'Payout transaction ID' },
]

function RefundModal({ deposit, onClose, onDone }) {
  const [txn, setTxn] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (txn.trim().length < 4) return toast.error('Enter the payout transaction ID')
    setBusy(true)
    try {
      await depositService.completeRefund(deposit.id, txn.trim(), note.trim())
      toast.success('Deposit marked as refunded')
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
      title="Record refund payout"
      description={`${deposit.reference} · ${deposit.profile?.full_name} · ${formatPKR(deposit.amount)}`}
      footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="navy" loading={busy} onClick={submit}>Mark refunded</Button></>}
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-ivory-100 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Pay to (provided by user)</p>
          <p className="mt-1 whitespace-pre-line font-medium text-navy-900">{deposit.payout_details || '—'}</p>
        </div>
        <Alert tone="warning" title="Make the transfer first">
          Send {formatPKR(deposit.amount)} to the account above, then record the bank's payout transaction ID. This step can't be undone.
        </Alert>
        <FormInput label="Payout transaction ID" required value={txn} maxLength={100} onChange={(e) => setTxn(e.target.value)} placeholder="e.g. IBFT-2611-889901" />
        <TextArea label="Admin note (optional)" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}

export default function Deposits() {
  useDocumentTitle('Deposits')
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [viewing, setViewing] = useState(null)
  const [action, setAction] = useState(null) // { deposit, decision: 'verified' | 'rejected' }
  const [refunding, setRefunding] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const q = useDebounce(search)
  const pg = usePagination(15)
  const filters = { status, search: q, categoryId }
  const cats = useAsync(() => categoryService.list({ includeInactive: true }), [], { initialData: [] })
  const { data, loading, error, reload } = useAsync(() => depositService.adminList(filters, pg), [status, q, categoryId, pg.from])

  const review = async (reason) => {
    setBusy(true)
    try {
      await depositService.review(action.deposit.id, action.decision, reason)
      toast.success(action.decision === 'verified' ? 'Deposit verified — user notified' : 'Deposit rejected — user notified')
      setAction(null)
      setViewing(null)
      reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = await depositService.adminExport(filters)
      downloadCSV(`qurandazi-deposits-${new Date().toISOString().slice(0, 10)}`, rows, EXPORT_COLUMNS)
      adminService.logEvent('report.export_deposits', 'deposits', { rows: rows.length, filters })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const menu = (d) => [
    { label: 'View details', icon: Eye, onClick: () => setViewing(d) },
    { label: 'Verify deposit', icon: CheckCircle2, hidden: d.status !== 'pending', onClick: () => setAction({ deposit: d, decision: 'verified' }) },
    { label: 'Reject deposit', icon: XCircle, danger: true, hidden: d.status !== 'pending', onClick: () => setAction({ deposit: d, decision: 'rejected' }) },
    { label: 'Record refund', icon: Undo2, hidden: d.status !== 'withdrawal_requested', onClick: () => setRefunding(d) },
  ]

  const columns = [
    { key: 'reference', header: 'Reference', render: (d) => <span className="font-mono text-xs font-bold">{d.reference}</span> },
    { key: 'user', header: 'Depositor', render: (d) => <div><p className="font-semibold text-navy-900">{d.profile?.full_name || '—'}</p><p className="text-xs text-ink-muted">{d.profile?.email}</p></div> },
    { key: 'amount', header: 'Category / amount', render: (d) => <div><p className="font-semibold text-navy-900">{d.category?.name}</p><p className="text-xs tabular-nums text-ink-muted">{formatPKR(d.amount)}</p></div> },
    { key: 'txn', header: 'Transaction ID', render: (d) => <div><p className="font-mono text-xs">{d.transaction_id}</p><PrivateFileLink path={d.proof_path} getUrl={depositService.proofUrl} className="text-xs">Proof</PrivateFileLink></div> },
    { key: 'created_at', header: 'Submitted', hideOnMobile: true, render: (d) => <span className="text-xs">{formatDateTime(d.created_at)}</span> },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge map={DEPOSIT_STATUS} value={d.status} /> },
    { key: 'actions', header: '', className: 'w-12 text-right', render: (d) => <Dropdown trigger={<MoreVertical className="h-4 w-4" />} items={menu(d)} /> },
  ]

  const v = viewing
  const timeline = v
    ? [
        ['Submitted', v.created_at],
        ['Reviewed', v.reviewed_at],
        ['Verified', v.verified_at],
        ['Locked until', v.locked_until],
        ['Withdrawal requested', v.withdrawal_requested_at],
        ['Refunded', v.refunded_at],
      ].filter(([, t]) => t)
    : []

  return (
    <>
      <PageHeader
        title="Deposits"
        description="Check each deposit against the bank statement before verifying. Every action is written to the activity log, which can't be edited."
        actions={<Button variant="outline" icon={Download} onClick={exportCsv} loading={exporting}>Export CSV</Button>}
      />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ivory-300 scrollbar-thin" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id || 'all'} role="tab" aria-selected={status === id} onClick={() => { setStatus(id); pg.reset() }} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${status === id ? 'border-gold-500 text-navy-900' : 'border-transparent text-ink-muted hover:text-navy-900'}`}>
            {label}
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={data?.data || []}
        loading={loading}
        error={error}
        onRetry={reload}
        page={pg.page}
        pageSize={pg.pageSize}
        total={data?.count || 0}
        onPageChange={pg.setPage}
        onRowClick={setViewing}
        toolbar={
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <SearchInput value={search} onChange={(val) => { setSearch(val); pg.reset() }} placeholder="Name, email, DP- reference or transaction ID…" />
            <Select aria-label="Category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); pg.reset() }} placeholder="All categories" options={(cats.data || []).map((c) => ({ value: c.id, label: c.name }))} />
          </div>
        }
        empty={<EmptyState icon={Banknote} title="No deposits here" message={status === 'pending' ? 'There are no deposits waiting for verification.' : 'Try another tab or filter.'} />}
      />

      <Modal
        open={Boolean(v)}
        onClose={() => setViewing(null)}
        size="xl"
        title={`Deposit ${v?.reference || ''}`}
        description={v ? `${v.category?.name} · ${formatPKR(v.amount)}` : ''}
        footer={v && <>
          <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          {v.status === 'pending' && <Button variant="danger" onClick={() => setAction({ deposit: v, decision: 'rejected' })}>Reject</Button>}
          {v.status === 'pending' && <Button variant="navy" onClick={() => setAction({ deposit: v, decision: 'verified' })}>Verify deposit</Button>}
          {v.status === 'withdrawal_requested' && <Button variant="navy" onClick={() => setRefunding(v)}>Record refund</Button>}
        </>}
      >
        {v && (
          <div className="grid gap-6 text-sm md:grid-cols-2">
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="text-xs text-ink-muted">Depositor</dt><dd className="font-semibold text-navy-900"><Link to={`/admin/users/${v.user_id}`} className="hover:text-gold-700">{v.profile?.full_name}</Link></dd></div>
                <div><dt className="text-xs text-ink-muted">KYC</dt><dd><StatusBadge map={KYC_STATUS} value={v.profile?.kyc_status} /></dd></div>
                <div><dt className="text-xs text-ink-muted">Email</dt><dd className="break-all font-semibold text-navy-900">{v.profile?.email}</dd></div>
                <div><dt className="text-xs text-ink-muted">CNIC</dt><dd className="font-mono font-semibold text-navy-900">{v.profile?.cnic || '—'}</dd></div>
                <div><dt className="text-xs text-ink-muted">Amount</dt><dd className="text-lg font-extrabold text-navy-900">{formatPKR(v.amount)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Status</dt><dd><StatusBadge map={DEPOSIT_STATUS} value={v.status} /></dd></div>
                <div><dt className="text-xs text-ink-muted">Method</dt><dd className="font-semibold text-navy-900">{paymentMethodLabel(v.payment_method)}</dd></div>
                <div><dt className="text-xs text-ink-muted">Transaction ID</dt><dd className="select-all font-mono font-semibold text-navy-900">{v.transaction_id}</dd></div>
                <div><dt className="text-xs text-ink-muted">Lock-in</dt><dd className="font-semibold text-navy-900">{v.lock_in_days} days</dd></div>
                <div><dt className="text-xs text-ink-muted">Terms accepted</dt><dd className="font-semibold text-navy-900">{v.terms_version} · {formatDateTime(v.terms_accepted_at)}</dd></div>
              </dl>
              {v.rejection_reason && <Alert tone="danger" title="Rejection reason">{v.rejection_reason}</Alert>}
              {v.payout_details && (
                <div className="rounded-xl bg-ivory-100 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Refund account</p>
                  <p className="mt-1 whitespace-pre-line">{v.payout_details}</p>
                  {v.payout_transaction_id && <p className="mt-2">Payout transaction: <span className="font-mono font-semibold">{v.payout_transaction_id}</span></p>}
                  {v.refund_note && <p className="mt-1 text-ink-muted">{v.refund_note}</p>}
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">Timeline</p>
                <ul className="space-y-1">
                  {timeline.map(([k, t]) => <li key={k} className="flex justify-between"><span className="text-ink-muted">{k}</span><span className="font-medium">{formatDateTime(t)}</span></li>)}
                </ul>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">Payment proof</p>
              <PrivateImage path={v.proof_path} getUrl={depositService.proofUrl} alt="Payment proof" className="h-80 w-full rounded-xl ring-1 ring-ivory-300" />
              {v.status === 'pending' && (
                <p className="mt-3 flex gap-2 text-xs text-ink-muted"><Badge tone="warning">Checklist</Badge> The amount, transaction ID and date must match the bank statement, and the money must have reached the company account.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        onConfirm={review}
        loading={busy}
        tone={action?.decision === 'rejected' ? 'danger' : 'navy'}
        title={action?.decision === 'rejected' ? 'Reject this deposit?' : 'Verify this deposit?'}
        message={
          action && (
            <>
              <strong>{action.deposit.reference}</strong> · {formatPKR(action.deposit.amount)} · transaction <span className="font-mono">{action.deposit.transaction_id}</span>.
              {action.decision === 'verified'
                ? ` Confirm this payment appears on the bank statement. The deposit becomes active and is locked for ${action.deposit.lock_in_days} days.`
                : ' The user will see the reason you give.'}
            </>
          )
        }
        requireReason={action?.decision === 'rejected'}
        reasonLabel="Reason (shared with the user)"
        confirmLabel={action?.decision === 'rejected' ? 'Reject deposit' : 'Verify deposit'}
      />
      {refunding && <RefundModal deposit={refunding} onClose={() => setRefunding(null)} onDone={() => { setRefunding(null); setViewing(null); reload() }} />}
    </>
  )
}
