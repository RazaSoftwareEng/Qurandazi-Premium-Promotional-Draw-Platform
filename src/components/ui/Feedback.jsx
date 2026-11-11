import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import Button from './Button'
import { getErrorMessage } from '@/utils/errors'

export function Skeleton({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-ivory-200 ${className}`} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  )
}

export function CardSkeleton({ count = 3 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="card overflow-hidden">
      <Skeleton className="h-44 rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  ))
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="divide-y divide-ivory-200" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-1/4' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/30 bg-gold-100/60 text-gold-700">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-navy-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-ink-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'We couldn’t load this', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`} role="alert">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-navy-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={RefreshCw} className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rotate-45 animate-spin rounded-sm border-2 border-gold-500/30 border-t-gold-500 [animation-duration:1.2s]" />
        <div className="absolute inset-0 animate-spin rounded-sm border-2 border-navy-900/10 border-b-navy-900 [animation-duration:1.6s]" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Alert({ tone = 'info', icon: Icon, title, children, className = '' }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    gold: 'border-gold-500/30 bg-gold-100/50 text-navy-900',
  }
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${tones[tone]} ${className}`} role="status">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  )
}
