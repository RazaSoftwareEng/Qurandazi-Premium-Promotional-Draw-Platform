import { ChevronLeft, ChevronRight } from 'lucide-react'

function pageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set([1, totalPages, page, page - 1, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…' + p)
    out.push(p)
  })
  return out
}

export default function Pagination({ page, pageSize, total, onPageChange, className = '' }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  if (!total) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <nav className={`flex flex-col items-center justify-between gap-3 sm:flex-row ${className}`} aria-label="Pagination">
      <p className="text-xs text-ink-muted">
        Showing <span className="font-semibold text-navy-900">{start}</span>–<span className="font-semibold text-navy-900">{end}</span> of{' '}
        <span className="font-semibold text-navy-900">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button className="btn-icon disabled:opacity-40" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageList(page, totalPages).map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="px-1 text-xs text-ink-muted">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-9 min-w-9 rounded-lg px-2 text-xs font-semibold transition-colors ${
                p === page ? 'bg-navy-900 text-gold-400' : 'text-ink-soft hover:bg-navy-900/5'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="btn-icon disabled:opacity-40"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
