import { Skeleton } from './Feedback'
import { formatNumber } from '@/utils/format'

export default function StatCard({ label, value, icon: Icon, hint, loading, accent = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-card transition-shadow hover:shadow-lift ${
        accent ? 'border-navy-800 bg-navy-900 text-white' : 'border-ivory-300/70 bg-white'
      }`}
    >
      {accent && <div className="pattern-stars pointer-events-none absolute inset-0 opacity-60" aria-hidden />}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${accent ? 'text-gold-400' : 'text-ink-muted'}`}>{label}</p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-20" />
          ) : (
            <p className={`mt-2 text-3xl font-extrabold tabular-nums ${accent ? 'text-white' : 'text-navy-900'}`}>
              {typeof value === 'number' ? formatNumber(value) : value ?? '—'}
            </p>
          )}
          {hint && <p className={`mt-1 text-xs ${accent ? 'text-white/60' : 'text-ink-muted'}`}>{hint}</p>}
        </div>
        {Icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              accent ? 'bg-gold-500/15 text-gold-400' : 'bg-gold-100/70 text-gold-700'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}
