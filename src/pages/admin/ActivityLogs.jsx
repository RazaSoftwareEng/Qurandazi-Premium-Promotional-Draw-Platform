import { useState } from 'react'
import { Download, ScrollText } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, DataTable, EmptyState, Modal, SearchInput, Select } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { adminService } from '@/services/adminService'
import { downloadCSV } from '@/utils/csv'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

const GROUPS = ['deposit', 'kyc', 'handover', 'draw', 'entry', 'user', 'campaigns', 'categories', 'profiles', 'site_settings', 'announcement', 'report', 'eligibility_rules', 'contact_messages']

export default function ActivityLogs() {
  useDocumentTitle('Activity Logs')
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [detail, setDetail] = useState(null)
  const [exporting, setExporting] = useState(false)
  const q = useDebounce(search)
  const pg = usePagination(20)
  const { data, loading, error, reload } = useAsync(() => adminService.logs({ search: q, action, from: pg.from, to: pg.to }), [q, action, pg.from])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await adminService.logs({ search: q, action, from: 0, to: 9999 })
      downloadCSV(`qurandazi-activity-log-${new Date().toISOString().slice(0, 10)}`, res.data, [
        { key: 'created_at', label: 'Timestamp' },
        { key: 'admin_id', label: 'Administrator ID' },
        { key: 'admin_name', label: 'Administrator' },
        { key: 'admin_email', label: 'Email' },
        { key: 'action', label: 'Action' },
        { key: 'entity_type', label: 'Entity type' },
        { key: 'entity_id', label: 'Affected record' },
        { key: 'details', label: 'Details' },
      ])
      adminService.logEvent('report.export_activity_logs', 'admin_activity_logs', { rows: res.data.length })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader title="Activity Logs" description="Append-only record of every sensitive action: admin decisions, KYC and deposit events, withdrawals, refunds, draws and handovers. Records can't be edited or deleted." actions={<Button variant="outline" icon={Download} onClick={exportCsv} loading={exporting}>Export CSV</Button>} />
      <DataTable
        columns={[
          { key: 'created_at', header: 'Timestamp', render: (l) => <span className="whitespace-nowrap text-xs">{formatDateTime(l.created_at)}</span> },
          { key: 'admin', header: 'Actor', render: (l) => <div><p className="font-semibold text-navy-900">{l.admin_name || '—'}</p><p className="text-xs text-ink-muted">{l.admin_email}</p></div> },
          { key: 'action', header: 'Action', render: (l) => <span className="rounded-md bg-navy-900 px-2 py-0.5 font-mono text-[11px] text-gold-400">{l.action}</span> },
          { key: 'entity', header: 'Affected record', render: (l) => <span className="font-mono text-xs">{l.entity_type}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ''}</span> },
        ]}
        rows={data?.data || []}
        loading={loading}
        error={error}
        onRetry={reload}
        page={pg.page}
        pageSize={pg.pageSize}
        total={data?.count || 0}
        onPageChange={pg.setPage}
        onRowClick={setDetail}
        toolbar={
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <SearchInput value={search} onChange={(v) => { setSearch(v); pg.reset() }} placeholder="Search actor, action or record ID…" />
            <Select aria-label="Action group" value={action} onChange={(e) => { setAction(e.target.value); pg.reset() }} placeholder="All actions" options={GROUPS.map((g) => ({ value: g, label: g }))} />
          </div>
        }
        empty={<EmptyState icon={ScrollText} title="No activity found" />}
      />
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} size="lg" title={detail?.action} description={detail ? `${formatDateTime(detail.created_at)} · ${detail.admin_name || detail.admin_email || 'System'}` : ''}>
        {detail && (
          <div className="space-y-3 text-sm">
            <p><span className="text-ink-muted">Administrator ID:</span> <span className="font-mono text-xs">{detail.admin_id || '—'}</span></p>
            <p><span className="text-ink-muted">Affected record:</span> <span className="font-mono text-xs">{detail.entity_type} / {detail.entity_id || '—'}</span></p>
            <pre className="max-h-96 overflow-auto rounded-xl bg-navy-950 p-4 font-mono text-[11px] leading-5 text-gold-200 scrollbar-thin">{JSON.stringify(detail.details, null, 2)}</pre>
          </div>
        )}
      </Modal>
    </>
  )
}
