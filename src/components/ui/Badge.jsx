const TONES = {
  neutral: 'bg-navy-900/[0.06] text-ink-soft',
  info: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200',
  success: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  gold: 'bg-gold-100 text-gold-800 ring-1 ring-inset ring-gold-300',
  navy: 'bg-navy-900 text-gold-400',
}

export default function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  return (
    <span className={`badge whitespace-nowrap ${TONES[tone] || TONES.neutral} ${className}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

export function StatusBadge({ map, value, fallback }) {
  const meta = map?.[value] || { label: fallback || value, tone: 'neutral' }
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}
