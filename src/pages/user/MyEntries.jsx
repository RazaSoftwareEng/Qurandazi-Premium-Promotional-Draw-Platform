import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, DataTable, EmptyState, Select, StatusBadge } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { entryService } from '@/services/entryService'
import { ENTRY_STATUS, getCampaignPhase } from '@/utils/campaign'
import { formatDateTime } from '@/utils/format'

export default function MyEntries() {
  useDocumentTitle('My Entries')
  const { user } = useAuth()
  const [status, setStatus] = useState('')
  const pg = usePagination(10)
  const { data, loading, error, reload } = useAsync(() => entryService.mine({ userId: user.id, status, from: pg.from, to: pg.to }), [user.id, status, pg.from])

  const copy = (ref) => {
    navigator.clipboard?.writeText(ref).then(() => toast.success('Reference copied'), () => toast.error('Copy failed'))
  }

  const columns = [
    {
      key: 'reference', header: 'Entry reference',
      render: (e) => (
        <button onClick={() => copy(e.reference)} className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-navy-900 hover:text-gold-700" title="Copy reference">
          {e.reference} <Copy className="h-3 w-3" />
        </button>
      ),
    },
    { key: 'campaign', header: 'Campaign', render: (e) => <Link to={`/campaigns/${e.campaign?.slug}`} className="font-semibold text-navy-900 hover:text-gold-700">{e.campaign?.title}</Link> },
    { key: 'created_at', header: 'Entry date', render: (e) => formatDateTime(e.created_at) },
    { key: 'phase', header: 'Campaign status', render: (e) => getCampaignPhase(e.campaign).label, hideOnMobile: true },
    {
      key: 'status', header: 'Entry status',
      render: (e) => (
        <div>
          <StatusBadge map={ENTRY_STATUS} value={e.status} />
          {e.status_note && <p className="mt-1 max-w-[220px] text-xs text-ink-muted">{e.status_note}</p>}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="My Entries" description="Every entry you’ve submitted, with its unique reference number. An entry stays in its draw only if your deposit is still active when the campaign closes." />
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
        toolbar={
          <Select aria-label="Filter by status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); pg.reset() }} placeholder="All statuses" options={Object.entries(ENTRY_STATUS).map(([value, m]) => ({ value, label: m.label }))} />
        }
        empty={<EmptyState icon={ClipboardList} title="No entries yet" message="Join a campaign to get your first entry reference." action={<Button to="/dashboard/campaigns" size="sm">Browse campaigns</Button>} />}
      />
    </>
  )
}
