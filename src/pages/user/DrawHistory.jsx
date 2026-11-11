import { Link } from 'react-router-dom'
import { History, ShieldCheck, Trophy } from 'lucide-react'
import { Badge, Button, DataTable, EmptyState } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { drawService } from '@/services/drawService'
import { formatDate, formatDateTime } from '@/utils/format'

export default function DrawHistory() {
  useDocumentTitle('Draw History')
  const { data, loading, error, reload } = useAsync(() => drawService.myHistory(), [])

  const result = (h) => {
    if (h.result_status === 'published') {
      return h.won ? <Badge tone="gold"><Trophy className="h-3 w-3" /> Winner · Rank #{h.rank}</Badge> : <Badge tone="neutral">Not selected</Badge>
    }
    if (h.result_status === 'pending') return <Badge tone="warning" dot>Draw in progress</Badge>
    return <Badge tone="info" dot>Awaiting draw</Badge>
  }

  const columns = [
    { key: 'campaign_title', header: 'Campaign', render: (h) => <Link to={`/campaigns/${h.campaign_slug}`} className="font-semibold text-navy-900 hover:text-gold-700">{h.campaign_title}</Link> },
    { key: 'reference', header: 'My entry', render: (h) => <span className="font-mono text-xs">{h.reference}</span> },
    { key: 'end_date', header: 'Closed', render: (h) => formatDate(h.end_date), hideOnMobile: true },
    { key: 'draw_date', header: 'Draw date', render: (h) => (h.draw_date ? formatDateTime(h.draw_date) : 'TBA') },
    { key: 'result', header: 'Result', render: result },
    {
      key: 'audit', header: 'Audit',
      render: (h) => (h.result_status === 'published' ? <Link to={`/winners/${h.draw_id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline"><ShieldCheck className="h-4 w-4" /> Verify</Link> : '—'),
    },
  ]

  const wins = (data || []).filter((h) => h.won)

  return (
    <>
      <PageHeader title="Draw History" description="Your previous campaigns, draw dates and published results." />
      {wins.length > 0 && (
        <div className="mb-6 rounded-2xl border border-gold-500/40 bg-gold-100/50 p-5">
          <p className="flex items-center gap-2 font-bold text-navy-900"><Trophy className="h-5 w-5 text-gold-700" /> Congratulations! You have {wins.length} winning {wins.length === 1 ? 'entry' : 'entries'}.</p>
          <p className="mt-1 text-sm text-ink-soft">Our team will contact you using your profile details. We will never ask you for a payment to claim a reward.</p>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data || []}
        rowKey="entry_id"
        loading={loading}
        error={error}
        onRetry={reload}
        empty={<EmptyState icon={History} title="No participation history yet" message="Your campaigns and their results will appear here." action={<Button to="/dashboard/campaigns" size="sm">Browse campaigns</Button>} />}
      />
    </>
  )
}
