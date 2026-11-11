import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { CardSkeleton, EmptyState, ErrorState, Pagination, SearchInput, Select } from '@/components/ui'
import CampaignCard from '@/components/campaign/CampaignCard'
import { PublicHero } from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { campaignService } from '@/services/campaignService'
import { categoryService } from '@/services/categoryService'

const PHASES = [
  { value: 'live', label: 'Open & upcoming' },
  { value: 'open', label: 'Open now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'closed', label: 'Closed & completed' },
  { value: 'all', label: 'All campaigns' },
]
const PAGE_SIZE = 9

export default function Campaigns() {
  useDocumentTitle('Campaigns')
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const phase = params.get('status') || 'live'
  const page = Number(params.get('page') || 1)
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebounce(search)

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if ((params.get('q') || '') !== q) setParam('q', q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const cats = useAsync(() => categoryService.list(), [])
  const list = useAsync(
    () => campaignService.listPublic({ categoryId: category || null, phase, search: q, from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 }),
    [category, phase, q, page],
  )

  return (
    <>
      <PublicHero eyebrow="Campaigns" title="Promotional campaigns" subtitle="Every campaign is free to join. Choose a category, check the dates and eligibility, and take your chance." />
      <section className="container-page py-12">
        <div className="card mb-8 grid gap-3 p-4 md:grid-cols-[1fr_220px_220px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search campaigns…" />
          <Select aria-label="Category" value={category} onChange={(e) => setParam('category', e.target.value)} placeholder="All categories" options={(cats.data || []).map((c) => ({ value: c.id, label: c.name }))} />
          <Select aria-label="Status" value={phase} onChange={(e) => setParam('status', e.target.value)} options={PHASES} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.loading && !list.data ? (
            <CardSkeleton count={6} />
          ) : list.error ? (
            <div className="card col-span-full"><ErrorState error={list.error} onRetry={list.reload} /></div>
          ) : list.data?.data?.length ? (
            list.data.data.map((c) => <CampaignCard key={c.id} campaign={c} />)
          ) : (
            <div className="card col-span-full"><EmptyState icon={Gift} title="No campaigns match your filters" message="Try another category or status." /></div>
          )}
        </div>
        <Pagination className="mt-8" page={page} pageSize={PAGE_SIZE} total={list.data?.count || 0} onPageChange={(p) => setParam('page', String(p))} />
      </section>
    </>
  )
}
