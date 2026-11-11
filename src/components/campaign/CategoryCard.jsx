import { Link } from 'react-router-dom'
import { ArrowRight, Gift, ShieldCheck } from 'lucide-react'
import { LogoMark } from '../ui/Logo'
import { formatPKR } from '@/utils/format'

/** Premium category card: visual header, concise copy, equal heights. */
export default function CategoryCard({ category, index = 0 }) {
  const count = category.campaigns_count ?? null

  return (
    <Link
      to={`/campaigns?category=${category.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-navy-800 text-white shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-gold-500/60 hover:shadow-2xl hover:shadow-black/40 focus-visible:ring-offset-navy-900"
      aria-label={`View ${category.name} campaigns`}
    >
      {/* Visual header */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {category.image_url ? (
          <img
            src={category.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center bg-navy-900">
            <div className="pattern-stars absolute inset-0" aria-hidden />
            <LogoMark className="relative h-14 w-14 opacity-80" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/40 to-transparent" aria-hidden />

        <div className="absolute inset-x-4 top-4 flex items-center justify-between">
          <span className="rounded-full bg-navy-950/70 px-2.5 py-1 font-mono text-[11px] font-medium text-gold-400 ring-1 ring-white/10 backdrop-blur">
            0{index + 1}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-navy-900 shadow">
            <ShieldCheck className="h-3 w-3" /> {Number(category.deposit_amount) > 0 ? 'Refundable deposit' : 'Open entry'}
          </span>
        </div>

        <h3 className="absolute inset-x-5 bottom-4 line-clamp-2 font-display text-3xl font-semibold leading-[1.05] text-white drop-shadow sm:text-[34px]">
          {category.name}
        </h3>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-6">
        {category.tagline && <p className="line-clamp-2 text-sm font-semibold text-gold-400">{category.tagline}</p>}
        {category.description && (
          <p className="mt-2.5 line-clamp-3 text-sm leading-6 text-white/65">{category.description}</p>
        )}

        <div className="mt-auto pt-6">
          {Number(category.deposit_amount) > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Required deposit</p>
                <p className="mt-0.5 text-lg font-extrabold tabular-nums text-white">{formatPKR(category.deposit_amount)}</p>
              </div>
              <p className="max-w-[9rem] text-right text-[11px] leading-4 text-white/45">Refundable, not a fee · {category.deposit_lock_in_days}-day lock-in</p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            {count !== null ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-white/55">
                <Gift className="h-3.5 w-3.5 text-gold-500" /> {count > 0 ? `${count} campaign${count === 1 ? '' : 's'}` : 'Campaigns coming soon'}
              </span>
            ) : (
              <span />
            )}
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-400 transition-colors group-hover:text-gold-300">
              View campaigns <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
