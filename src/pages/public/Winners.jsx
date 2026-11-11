import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Trophy } from 'lucide-react'
import { DataTable, SearchInput } from '@/components/ui'
import { PublicHero } from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { drawService } from '@/services/drawService'
import { formatDate, formatNumber } from '@/utils/format'

export default function Winners() {
  useDocumentTitle('Winners')
  const [search, setSearch] = useState('')
  const q = useDebounce(search)
  const pg = usePagination(12)
  const { data, loading, error, reload } = useAsync(() => drawService.publishedWinners({ search: q, from: pg.from, to: pg.to }), [q, pg.from])

  const columns = [
    {
      key: 'winner', header: 'Winner',
      render: (w) => (
        <span className="flex items-center gap-2 font-bold text-navy-900">
          <Trophy className="h-4 w-4 text-gold-600" /> {w.winner_display_name}
        </span>
      ),
    },
    { key: 'campaign_title', header: 'Campaign', render: (w) => <span className="font-semibold">{w.campaign_title}</span> },
    { key: 'rank', header: 'Rank', render: (w) => `#${w.rank}` },
    { key: 'entry_reference', header: 'Entry ref.', render: (w) => <span className="font-mono text-xs">{w.entry_reference}</span> },
    { key: 'entry_count', header: 'Pool', render: (w) => formatNumber(w.entry_count), hideOnMobile: true },
    { key: 'published_at', header: 'Published', render: (w) => formatDate(w.published_at) },
    {
      key: 'audit', header: 'Audit',
      render: (w) => (
        <Link to={`/winners/${w.draw_id}`} className="inline-flex items-center gap-1 text-sm font-bold text-gold-700 hover:text-navy-900">
          Verify <ArrowRight className="h-4 w-4" />
        </Link>
      ),
    },
  ]

  return (
    <>
      <PublicHero
        eyebrow="Winners"
        title="Published winners & audits"
        subtitle="Every result below links to its full audit record. Verify any draw yourself — directly in your browser."
      />
      <section className="container-page py-12">
        <DataTable
          columns={columns}
          rows={data?.rows || []}
          loading={loading}
          error={error}
          onRetry={reload}
          page={pg.page}
          pageSize={pg.pageSize}
          total={data?.total || 0}
          onPageChange={pg.setPage}
          toolbar={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput value={search} onChange={(v) => { setSearch(v); pg.reset() }} placeholder="Search by campaign, name or reference…" className="sm:w-96" />
              <p className="flex items-center gap-2 text-xs text-ink-muted"><ShieldCheck className="h-4 w-4 text-gold-600" /> Names are partially masked for privacy.</p>
            </div>
          }
        />
      </section>
    </>
  )
}
