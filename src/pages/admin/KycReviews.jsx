import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IdCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { Alert, Badge, Button, ConfirmationDialog, DataTable, EmptyState, Modal, PrivateImage, SearchInput, StatusBadge } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { kycService } from '@/services/kycService'
import { KYC_STATUS } from '@/utils/deposit'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

const TABS = [
  ['pending', 'Pending review'],
  ['verified', 'Verified'],
  ['rejected', 'Rejected'],
  ['', 'All submissions'],
]

export default function KycReviews() {
  useDocumentTitle('KYC Reviews')
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState(null)
  const [decision, setDecision] = useState(null)
  const [busy, setBusy] = useState(false)
  const q = useDebounce(search)
  const pg = usePagination(15)
  const { data, loading, error, reload } = useAsync(() => kycService.adminList({ status, search: q, from: pg.from, to: pg.to }), [status, q, pg.from])

  const review = async (note) => {
    setBusy(true)
    try {
      await kycService.review(viewing.id, decision, note)
      toast.success(decision === 'verified' ? 'User marked KYC Verified' : 'CNIC rejected — user notified')
      setDecision(null)
      setViewing(null)
      reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const v = viewing
  const checks = v
    ? [
        ['Email verified', Boolean(v.email_confirmed_at)],
        ['Account active', v.status === 'active'],
        ['Phone & address on profile', Boolean(v.phone && v.address)],
        ['Both CNIC images uploaded', Boolean(v.cnic_front_path && v.cnic_back_path)],
      ]
    : []

  return (
    <>
      <PageHeader title="KYC Reviews" description="Check each CNIC against the member's profile. Only KYC-verified members can make deposits." />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ivory-300 scrollbar-thin" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id || 'all'} role="tab" aria-selected={status === id} onClick={() => { setStatus(id); pg.reset() }} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${status === id ? 'border-gold-500 text-navy-900' : 'border-transparent text-ink-muted hover:text-navy-900'}`}>
            {label}
          </button>
        ))}
      </div>
      <DataTable
        columns={[
          { key: 'name', header: 'Member', render: (u) => <div><p className="font-semibold text-navy-900">{u.full_name || '—'}</p><p className="text-xs text-ink-muted">{u.email}</p></div> },
          { key: 'cnic', header: 'CNIC', render: (u) => <span className="font-mono text-xs">{u.cnic || '—'}</span> },
          { key: 'submitted', header: 'Submitted', hideOnMobile: true, render: (u) => <span className="text-xs">{formatDateTime(u.kyc_submitted_at)}</span> },
          { key: 'status', header: 'Status', render: (u) => <StatusBadge map={KYC_STATUS} value={u.kyc_status} /> },
          { key: 'action', header: '', className: 'text-right', render: (u) => <Button size="sm" variant={u.kyc_status === 'pending' ? 'navy' : 'outline'}>{u.kyc_status === 'pending' ? 'Review' : 'View'}</Button> },
        ]}
        rows={data?.data || []}
        loading={loading}
        error={error}
        onRetry={reload}
        page={pg.page}
        pageSize={pg.pageSize}
        total={data?.count || 0}
        onPageChange={pg.setPage}
        onRowClick={setViewing}
        toolbar={<SearchInput value={search} onChange={(val) => { setSearch(val); pg.reset() }} placeholder="Search by name, email or CNIC…" />}
        empty={<EmptyState icon={IdCard} title="Nothing to review" message={status === 'pending' ? 'No CNIC submissions are waiting.' : 'No records in this view.'} />}
      />

      <Modal
        open={Boolean(v)}
        onClose={() => setViewing(null)}
        size="xl"
        title={v?.full_name || 'KYC review'}
        description={v?.email}
        footer={v && <>
          <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          {v.kyc_status === 'pending' && <Button variant="danger" onClick={() => setDecision('rejected')}>Reject</Button>}
          {v.kyc_status === 'pending' && <Button variant="navy" onClick={() => setDecision('verified')}>Mark KYC Verified</Button>}
        </>}
      >
        {v && (
          <div className="space-y-5 text-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">CNIC front</p>
                <PrivateImage path={v.cnic_front_path} getUrl={kycService.signedUrl} alt="CNIC front" className="aspect-[1.58] w-full rounded-xl ring-1 ring-ivory-300" />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">CNIC back</p>
                <PrivateImage path={v.cnic_back_path} getUrl={kycService.signedUrl} alt="CNIC back" className="aspect-[1.58] w-full rounded-xl ring-1 ring-ivory-300" />
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <dl className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><dt className="text-xs text-ink-muted">Full name (must match CNIC)</dt><dd className="text-base font-bold text-navy-900">{v.full_name}</dd></div>
                <div><dt className="text-xs text-ink-muted">CNIC number</dt><dd className="font-mono font-semibold text-navy-900">{v.cnic}</dd></div>
                <div><dt className="text-xs text-ink-muted">Status</dt><dd><StatusBadge map={KYC_STATUS} value={v.kyc_status} /></dd></div>
                <div><dt className="text-xs text-ink-muted">Phone</dt><dd className="font-semibold text-navy-900">{v.phone || '—'}</dd></div>
                <div><dt className="text-xs text-ink-muted">City</dt><dd className="font-semibold text-navy-900">{v.city || '—'}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-ink-muted">Address</dt><dd className="font-semibold text-navy-900">{v.address || '—'}</dd></div>
              </dl>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">Pre-checks</p>
                <ul className="space-y-1.5">
                  {checks.map(([label, ok]) => (
                    <li key={label} className="flex items-center justify-between"><span>{label}</span><Badge tone={ok ? 'success' : 'danger'}>{ok ? 'Pass' : 'Fail'}</Badge></li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-muted">Also confirm by eye: the name and number match the card, the card isn't expired, and the photo is clear and unedited.</p>
                {v.kyc_note && <Alert tone={v.kyc_status === 'rejected' ? 'danger' : 'info'} title="Reviewer note" className="mt-3">{v.kyc_note}</Alert>}
                <Link to={`/admin/users/${v.id}`} className="mt-3 inline-block text-sm font-semibold text-gold-700 hover:underline">Open user record</Link>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        onConfirm={review}
        loading={busy}
        tone={decision === 'rejected' ? 'danger' : 'navy'}
        title={decision === 'rejected' ? 'Reject this CNIC?' : 'Mark this member KYC Verified?'}
        message={decision === 'rejected' ? 'The member will be asked to resubmit. Give a clear reason.' : `${v?.full_name} · ${v?.cnic}. The member will be able to make deposits.`}
        requireReason={decision === 'rejected'}
        reasonLabel="Reason (shared with the member)"
        confirmLabel={decision === 'rejected' ? 'Reject' : 'Mark verified'}
      />
    </>
  )
}
