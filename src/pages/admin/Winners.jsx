import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ExternalLink, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, DataTable, EmptyState, Select, StatusBadge } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { drawService } from '@/services/drawService'
import { adminService } from '@/services/adminService'
import { DRAW_STATUS } from '@/utils/campaign'
import { downloadCSV } from '@/utils/csv'
import { formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

export const WINNER_EXPORT_COLUMNS = [
  { key: 'draw', label: 'Draw', value: (r) => r.draw?.title },
  { key: 'rank', label: 'Rank' },
  { key: 'winner_display_name', label: 'Winner (public)' },
  { key: 'entry_reference', label: 'Entry reference' },
  { key: 'user_id', label: 'User ID' },
  { key: 'status', label: 'Draw status', value: (r) => r.draw?.status },
  { key: 'published', label: 'Published at', value: (r) => r.draw?.published_at },
]

export default function Winners() {
  useDocumentTitle('Winner Management')
  const [status, setStatus] = useState('')
  const [exporting, setExporting] = useState(false)
  const pg = usePagination(15)
  const { data, loading, error, reload } = useAsync(() => drawService.adminResults({ status, from: pg.from, to: pg.to }), [status, pg.from])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await drawService.adminResults({ status, from: 0, to: 9999 })
      downloadCSV(`qurandazi-winners-${new Date().toISOString().slice(0, 10)}`, res.data, WINNER_EXPORT_COLUMNS)
      adminService.logEvent('report.export_winners', 'draw_results', { rows: res.data.length })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    { key: 'winner', header: 'Winner', render: (r) => <Link to={`/admin/users/${r.user_id}`} className="flex items-center gap-2 font-semibold text-navy-900 hover:text-gold-700"><Trophy className="h-4 w-4 text-gold-600" /> {r.winner_display_name}</Link> },
    { key: 'rank', header: 'Rank', render: (r) => `#${r.rank}` },
    { key: 'entry_reference', header: 'Entry', render: (r) => <span className="font-mono text-xs">{r.entry_reference}</span> },
    { key: 'draw', header: 'Draw', render: (r) => r.draw?.title },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge map={DRAW_STATUS} value={r.draw?.status} /> },
    { key: 'created_at', header: 'Drawn', render: (r) => formatDateTime(r.created_at), hideOnMobile: true },
    { key: 'audit', header: '', render: (r) => (r.draw?.status === 'published' ? <Link to={`/winners/${r.draw.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">Public audit <ExternalLink className="h-3.5 w-3.5" /></Link> : <Link to="/admin/draws" className="text-sm font-semibold text-gold-700 hover:underline">Review</Link>) },
  ]

  return (
    <>
      <PageHeader
        title="Winners"
        description="Selected winners across all draws. Results are immutable; approval and publication happen in Draw Management."
        actions={<><Button variant="outline" icon={Download} loading={exporting} onClick={exportCsv}>Export CSV</Button><Button to="/admin/notifications" variant="navy">Publish announcement</Button></>}
      />
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
        toolbar={<Select aria-label="Draw status" className="sm:w-60" value={status} onChange={(e) => { setStatus(e.target.value); pg.reset() }} placeholder="All draw statuses" options={['drawn', 'approved', 'published'].map((s) => ({ value: s, label: DRAW_STATUS[s].label }))} />}
        empty={<EmptyState icon={Trophy} title="No winners yet" message="Winners appear here once a draw has been executed." action={<Button to="/admin/draws" size="sm">Go to Draw Management</Button>} />}
      />
    </>
  )
}
