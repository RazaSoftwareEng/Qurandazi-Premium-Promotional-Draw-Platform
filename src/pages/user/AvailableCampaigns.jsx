import { useState } from 'react'
import { CalendarDays, Gift, Sparkles } from 'lucide-react'
import { Button, CardSkeleton, EmptyState, ErrorState, Modal, Pagination, SearchInput } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import CampaignCard from '@/components/campaign/CampaignCard'
import JoinCampaignPanel from '@/components/campaign/JoinCampaignPanel'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { campaignService } from '@/services/campaignService'
import { entryService } from '@/services/entryService'
import { formatDateTime } from '@/utils/format'

export default function AvailableCampaigns() {
  useDocumentTitle('Available Campaigns')
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState('open')
  const [selected, setSelected] = useState(null)
  const q = useDebounce(search)
  const pg = usePagination(9)

  const list = useAsync(() => campaignService.listPublic({ phase, search: q, from: pg.from, to: pg.to }), [phase, q, pg.from])
  const joined = useAsync(() => entryService.myCampaignIds(user.id), [user.id], { initialData: new Set() })

  return (
    <>
      <PageHeader title="Available Campaigns" description="Join any open campaign for free. Your eligibility is checked instantly." />
      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={(v) => { setSearch(v); pg.reset() }} placeholder="Search campaigns…" className="sm:w-80" />
        <div className="flex gap-1 rounded-lg bg-ivory-100 p-1" role="tablist">
          {[['open', 'Open now'], ['upcoming', 'Upcoming']].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={phase === v} onClick={() => { setPhase(v); pg.reset() }} className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${phase === v ? 'bg-white text-navy-900 shadow-sm' : 'text-ink-muted hover:text-navy-900'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {list.loading && !list.data ? (
          <CardSkeleton count={3} />
        ) : list.error ? (
          <div className="card col-span-full"><ErrorState error={list.error} onRetry={list.reload} /></div>
        ) : list.data?.data?.length ? (
          list.data.data.map((c) => (
            <div key={c.id} className="flex flex-col">
              <CampaignCard campaign={c} joined={joined.data?.has(c.id)} />
              <Button variant={joined.data?.has(c.id) ? 'outline' : 'navy'} className="mt-2" icon={Sparkles} onClick={() => setSelected(c)}>
                {joined.data?.has(c.id) ? 'View my entry' : 'Participate'}
              </Button>
            </div>
          ))
        ) : (
          <div className="card col-span-full"><EmptyState icon={Gift} title={phase === 'open' ? 'No campaigns are open right now' : 'No upcoming campaigns'} message="We’ll notify you as soon as a new campaign opens." /></div>
        )}
      </div>
      <Pagination className="mt-6" page={pg.page} pageSize={pg.pageSize} total={list.data?.count || 0} onPageChange={pg.setPage} />

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title} description={selected?.category?.name} size="md">
        {selected && (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-ink-soft">{selected.summary}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-ivory-100 p-3"><p className="flex items-center gap-1 text-xs text-ink-muted"><CalendarDays className="h-3.5 w-3.5" /> Closes</p><p className="mt-1 font-bold text-navy-900">{formatDateTime(selected.end_date)}</p></div>
              <div className="rounded-xl bg-ivory-100 p-3"><p className="flex items-center gap-1 text-xs text-ink-muted"><Gift className="h-3.5 w-3.5" /> Reward</p><p className="mt-1 font-bold text-navy-900">{selected.prize_description || '—'}</p></div>
            </div>
            {selected.eligibility_summary && <p className="text-sm text-ink-muted"><strong className="text-navy-900">Eligibility:</strong> {selected.eligibility_summary}</p>}
            <JoinCampaignPanel campaign={selected} compact onJoined={() => { joined.reload(); list.reload() }} />
            <Button to={`/campaigns/${selected.slug}`} variant="ghost" size="sm">Full campaign details & rules</Button>
          </div>
        )}
      </Modal>
    </>
  )
}
