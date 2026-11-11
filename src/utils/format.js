const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const numberFmt = new Intl.NumberFormat('en-US')

export const formatDate = (v) => (v ? dateFmt.format(new Date(v)) : '—')
export const formatDateTime = (v) => (v ? dateTimeFmt.format(new Date(v)) : '—')
export const formatNumber = (v) => numberFmt.format(Number(v || 0))
export const formatPKR = (v) => (v === null || v === undefined || v === '' ? '—' : `PKR ${numberFmt.format(Number(v))}`)

export function formatRelative(value) {
  if (!value) return '—'
  const diff = (new Date(value).getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ]
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf.format(Math.round(diff / secs), unit)
  }
  return 'just now'
}

export function countdown(to) {
  const ms = new Date(to).getTime() - Date.now()
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function initials(name = '', fallback = 'Q') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return fallback
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export const truncate = (s = '', n = 120) => (s && s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s || '')

export function slugify(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/** Convert ISO string -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

export function shortHash(h = '', n = 10) {
  if (!h) return '—'
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-6)}` : h
}
