import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CheckCircle2, Gift, ListChecks, ScrollText, Trophy, Users } from 'lucide-react'
import { Badge, ErrorState, Skeleton } from '@/components/ui'
import { CampaignImage } from '@/components/campaign/CampaignCard'
import JoinCampaignPanel from '@/components/campaign/JoinCampaignPanel'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { campaignService } from '@/services/campaignService'
import { describeRule, getCampaignPhase } from '@/utils/campaign'
import { formatDateTime, formatNumber, formatPKR } from '@/utils/format'
import NotFound from './NotFound'

function Block({ icon: Icon, title, children }) {
  return (
    <section className="card p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900">
        <Icon className="h-5 w-5 text-gold-600" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function CampaignDetails() {
  const { slug } = useParams()
  const { data: c, loading, error, reload } = useAsync(() => campaignService.getBySlug(slug), [slug])
  useDocumentTitle(c?.title || 'Campaign')

  if (loading) {
    return (
      <div className="container-page space-y-6 py-10">
        <Skeleton className="aspect-[21/8] w-full rounded-2xl" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (error) return <div className="container-page py-16"><div className="card"><ErrorState error={error} onRetry={reload} /></div></div>
  if (!c) return <NotFound />

  const phase = getCampaignPhase(c)
  const needsDeposit = Number(c.category?.deposit_amount) > 0

  return (
    <>
      <section className="bg-navy-900">
        <div className="container-page pt-6">
          <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-gold-400">
            <ArrowLeft className="h-4 w-4" /> All campaigns
          </Link>
        </div>
        <div className="container-page grid gap-8 py-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap gap-2">
              <Badge tone={phase.tone} dot className="bg-white/95">{phase.label}</Badge>
              {c.category && <Badge tone="navy" className="ring-1 ring-gold-500/40">{c.category.name}</Badge>}
            </div>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-white sm:text-6xl">{c.title}</h1>
            {c.summary && <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">{c.summary}</p>}
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 lg:col-span-5">
            <div className="aspect-[16/9]"><CampaignImage src={c.banner_url} title={c.title} /></div>
          </div>
        </div>
        <div className="hairline-gold" />
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {c.description && (
            <Block icon={ScrollText} title="About this campaign">
              <p className="whitespace-pre-line text-[15px] leading-7 text-ink-soft">{c.description}</p>
            </Block>
          )}
          <Block icon={ListChecks} title="Participation eligibility">
            {c.eligibility_summary && <p className="mb-4 text-[15px] leading-7 text-ink-soft">{c.eligibility_summary}</p>}
            <ul className="space-y-2">
              <li className="flex gap-2 text-sm text-ink-soft"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> A registered QURANDAZI account in good standing</li>
              {needsDeposit && (
                <>
                  <li className="flex gap-2 text-sm text-ink-soft"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> KYC-verified identity (CNIC)</li>
                  <li className="flex gap-2 text-sm text-ink-soft"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> A verified, active {c.category.name} deposit ({formatPKR(c.category.deposit_amount)}) or higher that is still active when the campaign closes</li>
                </>
              )}
              {c.eligibility_rules?.map((r) => (
                <li key={r.id} className="flex gap-2 text-sm text-ink-soft"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {describeRule(r)}</li>
              ))}
              <li className="flex gap-2 text-sm text-ink-soft"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> One entry per member</li>
            </ul>
          </Block>
          {c.rules && (
            <Block icon={ScrollText} title="Campaign rules">
              <p className="whitespace-pre-line text-[15px] leading-7 text-ink-soft">{c.rules}</p>
            </Block>
          )}
          <Block icon={Gift} title="How to participate">
            <p className="whitespace-pre-line text-[15px] leading-7 text-ink-soft">
              {c.participation_instructions ||
                (needsDeposit
                  ? 'Sign in, complete your profile and get your CNIC verified. Then make a refundable deposit in this category or a higher one. Once the deposit is verified, press “Join Campaign”.'
                  : 'Sign in, make sure you meet the eligibility requirements, then press “Join Campaign”.')}
            </p>
            {needsDeposit && (
              <p className="mt-4 rounded-xl border border-gold-500/30 bg-gold-100/40 px-4 py-3 text-sm text-navy-900">
                <strong>Requires verified deposit: {formatPKR(c.category.deposit_amount)}.</strong> The deposit is not a fee. It is refundable after a {c.category.deposit_lock_in_days}-day lock-in period, as set out in the deposit terms. If you withdraw it before this campaign closes, your entry is left out of the draw.
              </p>
            )}
          </Block>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="lg:sticky lg:top-24 space-y-6">
            <JoinCampaignPanel campaign={c} onJoined={reload} />
            <div className="card divide-y divide-ivory-200">
              {[
                [CalendarDays, 'Starts', formatDateTime(c.start_date)],
                [CalendarDays, 'Closes', formatDateTime(c.end_date)],
                [Trophy, 'Draw date', c.draw_date ? formatDateTime(c.draw_date) : 'To be announced'],
                [Trophy, 'Winners', c.winners_count],
                [Users, 'Entries so far', formatNumber(c.entries_count)],
              ].map(([Icon, label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
                  <span className="flex items-center gap-2 text-ink-muted"><Icon className="h-4 w-4" /> {label}</span>
                  <span className="text-right font-bold text-navy-900">{value}</span>
                </div>
              ))}
              {c.prize_description && (
                <div className="px-5 py-4 text-sm">
                  <p className="text-ink-muted">Reward</p>
                  <p className="mt-1 font-bold text-navy-900">{c.prize_description}</p>
                </div>
              )}
              {needsDeposit && (
                <div className="px-5 py-4 text-sm">
                  <p className="text-ink-muted">Required deposit</p>
                  <p className="mt-1 font-bold text-navy-900">{formatPKR(c.category.deposit_amount)} · refundable</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
