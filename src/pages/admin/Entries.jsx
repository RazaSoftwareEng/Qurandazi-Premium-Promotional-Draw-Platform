import { useState } from 'react'
import { CheckCircle2, Download, Eye, MoreVertical, RotateCcw, ShieldX } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, ConfirmationDialog, DataTable, Dropdown, Modal, SearchInput, Select, StatusBadge } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { campaignService } from '@/services/campaignService'
import { entryService } from '@/services/entryService'
import { adminService } from '@/services/adminService'
import { ENTRY_STATUS } from '@/utils/campaign'
import { downloadCSV } from '@/utils/csv'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

export const ENTRY_EXPORT_COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'campaign', label: 'Campaign', value: (e) => e.campaign?.title },
  { key: 'name', label: 'Participant', value: (e) => e.profile?.full_name },
  { key: 'email', label: 'Email', value: (e) => e.profile?.email },
  { key: 'phone', label: 'Phone', value: (e) => e.profile?.phone },
  { key: 'status', label: 'Status' },
  { key: 'status_note', label: 'Note' },
  { key: 'created_at', label: 'Entered at' },
  { key: 'verified_at', label: 'Reviewed at' },
]

export default function Entries() {
  useDocumentTitle('Entry Management')
  const [search, setSearch] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [status, setStatus] = useState('')
  const [viewing, setViewing] = useState(null)
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const q = useDebounce(search)
  const pg = usePagination(15)
  const filters = { search: q, campaignId, status }
  const campaigns = useAsync(() => campaignService.adminOptions(), [], { initialData: [] })
  const { data, loading, error, reload } = useAsync(() => entryService.adminList(filters, pg), [q, campaignId, status, pg.from])

  const runAction = async (note) => {
    setBusy(true)
    try {
      await entryService.setStatus(action.entry.id, action.status, note)
      toast.success('Entry updated')
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
      const rows = await entryService.adminExport(filters)
      downloadCSV(`qurandazi-entries-${new Date().toISOString().slice(0, 10)}`, rows, ENTRY_EXPORT_COLUMNS)
      adminService.logEvent('report.export_entries', 'entries', { rows: rows.length, filters })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const menu = (e) => [
    { label: 'View details', icon: Eye, onClick: () => setViewing(e) },
    { label: 'Mark verified', icon: CheckCircle2, hidden: e.status === 'verified', onClick: () => setAction({ entry: e, status: 'verified' }) },
    { label: 'Mark ineligible', icon: ShieldX, danger: true, hidden: e.status === 'disqualified', onClick: () => setAction({ entry: e, status: 'disqualified' }) },
    { label: 'Reset to confirmed', icon: RotateCcw, hidden: e.status === 'confirmed', onClick: () => setAction({ entry: e, status: 'confirmed' }) },
  ]

  const columns = [
    { key: 'reference', header: 'Reference', render: (e) => <span className="font-mono text-xs font-bold">{e.reference}</span> },
    { key: 'participant', header: 'Participant', render: (e) => <div><p className="font-semibold text-navy-900">{e.profile?.full_name || '—'}</p><p className="text-xs text-ink-muted">{e.profile?.email}</p></div> },
    { key: 'campaign', header: 'Campaign', render: (e) => e.campaign?.title },
    { key: 'created_at', header: 'Entered', render: (e) => formatDateTime(e.created_at), hideOnMobile: true },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge map={ENTRY_STATUS} value={e.status} /> },
    { key: 'actions', header: '', className: 'w-12 text-right', render: (e) => <Dropdown trigger={<MoreVertical className="h-4 w-4" />} items={menu(e)} /> },
  ]

  const p = viewing?.profile
  const checks = viewing
    ? [
        ['Account active', p?.status === 'active'],
        ['Email verified', Boolean(p?.email_confirmed_at)],
        ['Phone on profile', Boolean(p?.phone)],
        ['Entered before closing', new Date(viewing.created_at) <= new Date(viewing.campaign?.end_date)],
      ]
    : []

  return (
    <>
      <PageHeader title="Entries" description="Review free entries, verify eligibility and export records. Duplicate entries are blocked by the database." actions={<Button variant="outline" icon={Download} onClick={exportCsv} loading={exporting}>Export CSV</Button>} />
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
          <div className="grid gap-3 md:grid-cols-[1fr_240px_180px]">
            <SearchInput value={search} onChange={(v) => { setSearch(v); pg.reset() }} placeholder="Search by name, email or QZ- reference…" />
            <Select aria-label="Campaign" value={campaignId} onChange={(e) => { setCampaignId(e.target.value); pg.reset() }} placeholder="All campaigns" options={(campaigns.data || []).map((c) => ({ value: c.id, label: c.title }))} />
            <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); pg.reset() }} placeholder="All statuses" options={Object.entries(ENTRY_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
          </div>
        }
      />

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={`Entry ${viewing?.reference || ''}`} description={viewing?.campaign?.title}
        footer={viewing && <>
          <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
          {viewing.status !== 'disqualified' && <Button variant="danger" onClick={() => setAction({ entry: viewing, status: 'disqualified' })}>Mark ineligible</Button>}
          {viewing.status !== 'verified' && <Button variant="navy" onClick={() => setAction({ entry: viewing, status: 'verified' })}>Mark verified</Button>}
        </>}
      >
        {viewing && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-4">
              <div><dt className="text-xs text-ink-muted">Participant</dt><dd className="font-semibold text-navy-900">{p?.full_name}</dd></div>
              <div><dt className="text-xs text-ink-muted">Email</dt><dd className="break-all font-semibold text-navy-900">{p?.email}</dd></div>
              <div><dt className="text-xs text-ink-muted">Entered</dt><dd className="font-semibold text-navy-900">{formatDateTime(viewing.created_at)}</dd></div>
              <div><dt className="text-xs text-ink-muted">Status</dt><dd><StatusBadge map={ENTRY_STATUS} value={viewing.status} /></dd></div>
            </dl>
            {viewing.status_note && <p className="rounded-lg bg-ivory-100 p-3"><strong>Note:</strong> {viewing.status_note}</p>}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">Eligibility check</p>
              <ul className="space-y-1.5">
                {checks.map(([label, ok]) => (
                  <li key={label} className="flex items-center justify-between"><span>{label}</span><Badge tone={ok ? 'success' : 'danger'}>{ok ? 'Pass' : 'Fail'}</Badge></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-muted">Campaign-specific rules were enforced server-side at entry time.</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        onConfirm={runAction}
        loading={busy}
        tone={action?.status === 'disqualified' ? 'danger' : 'navy'}
        title={action?.status === 'disqualified' ? 'Mark entry as ineligible?' : action?.status === 'verified' ? 'Mark entry as verified?' : 'Reset entry status?'}
        message={`Entry ${action?.entry.reference}. Changes are blocked once entries are frozen for a draw.`}
        requireReason={action?.status === 'disqualified'}
        reasonLabel="Reason (shared with the participant)"
        confirmLabel="Confirm"
      />
    </>
  )
}
