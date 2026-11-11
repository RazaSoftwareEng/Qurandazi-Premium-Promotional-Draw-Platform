import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Gift, Users } from 'lucide-react'
import Badge from '../ui/Badge'
import { LogoMark } from '../ui/Logo'
import { getCampaignPhase } from '@/utils/campaign'
import { countdown, formatDate, formatNumber, truncate } from '@/utils/format'

export function CampaignImage({ src, title, className = '' }) {
  if (src) return <img src={src} alt={title} loading="lazy" className={`h-full w-full object-cover ${className}`} />
  return (
    <div className={`relative flex h-full w-full items-center justify-center bg-navy-900 ${className}`}>
      <div className="pattern-stars absolute inset-0" aria-hidden />
      <LogoMark className="relative h-14 w-14 opacity-90" />
    </div>
  )
}

export default function CampaignCard({ campaign, joined = false, to }) {
  const phase = getCampaignPhase(campaign)
  const left = phase.key === 'open' ? countdown(campaign.end_date) : null
  const href = to || `/campaigns/${campaign.slug}`

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <Link to={href} className="relative block aspect-[16/9] overflow-hidden" tabIndex={-1} aria-hidden>
        <CampaignImage src={campaign.banner_url} title={campaign.title} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge tone={phase.tone} dot className="bg-white/95 shadow-sm">
            {phase.label}
          </Badge>
          {joined && <Badge tone="navy">Joined</Badge>}
        </div>
        {campaign.category?.name && (
          <span className="absolute bottom-3 left-3 rounded-md bg-navy-900/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-400 backdrop-blur">
            {campaign.category.name}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug text-navy-900">
          <Link to={href} className="hover:text-gold-700">
            {campaign.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{truncate(campaign.summary, 110)}</p>
        {campaign.prize_description && (
          <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-navy-800">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" /> {campaign.prize_description}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-ivory-200 pt-4 text-xs">
          <div>
            <dt className="font-semibold uppercase tracking-wider text-ink-muted">Opens</dt>
            <dd className="mt-0.5 font-bold text-navy-900">{formatDate(campaign.start_date)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wider text-ink-muted">Closes</dt>
            <dd className="mt-0.5 font-bold text-navy-900">{formatDate(campaign.end_date)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {formatNumber(campaign.entries_count)}
            </span>
            {left && (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CalendarClock className="h-3.5 w-3.5" /> {left} left
              </span>
            )}
          </div>
          <Link to={href} className="inline-flex items-center gap-1 text-sm font-bold text-navy-900 hover:text-gold-700">
            View Details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  )
}
