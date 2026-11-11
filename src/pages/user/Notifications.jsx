import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Gift, Megaphone, ClipboardCheck, Trash2, Trophy, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { notificationService } from '@/services/notificationService'
import { formatRelative } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

const ICONS = { announcement: Megaphone, campaign: Gift, entry: ClipboardCheck, winner: Trophy, result: Trophy, system: Info }
const FILTERS = [
  ['', 'All'],
  ['announcement', 'Announcements'],
  ['entry', 'Entries'],
  ['winner', 'Winner'],
  ['result', 'Results'],
]

export default function Notifications() {
  useDocumentTitle('Notifications')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [type, setType] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const pg = usePagination(10)
  const { data, loading, error, reload } = useAsync(
    () => notificationService.list({ userId: user.id, type, unreadOnly, from: pg.from, to: pg.to }),
    [user.id, type, unreadOnly, pg.from],
  )

  const changed = () => {
    reload()
    window.dispatchEvent(new Event('qz:notifications-changed'))
  }
  const act = async (fn, msg) => {
    try {
      await fn()
      if (msg) toast.success(msg)
      changed()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const open = async (n) => {
    if (!n.read_at) await act(() => notificationService.markRead(n.id))
    if (n.link) navigate(n.link)
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Campaign announcements, entry confirmations and results."
        actions={<Button variant="outline" size="sm" icon={CheckCheck} onClick={() => act(() => notificationService.markAllRead(user.id), 'All marked as read')}>Mark all read</Button>}
      />
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-200 p-4">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(([v, l]) => (
              <button key={v} onClick={() => { setType(v); pg.reset() }} className={`rounded-full px-3 py-1 text-xs font-semibold ${type === v ? 'bg-navy-900 text-gold-400' : 'bg-ivory-100 text-ink-soft hover:bg-ivory-200'}`}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); pg.reset() }} className="h-4 w-4 accent-gold-600" /> Unread only
          </label>
        </div>
        {loading && !data ? (
          <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : data?.data?.length ? (
          <ul className="divide-y divide-ivory-200">
            {data.data.map((n) => {
              const Icon = ICONS[n.type] || Bell
              return (
                <li key={n.id} className={`flex gap-4 px-5 py-4 ${n.read_at ? '' : 'bg-gold-100/25'}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${n.type === 'winner' ? 'bg-gold-500 text-navy-900' : 'bg-navy-900 text-gold-400'}`}><Icon className="h-5 w-5" /></span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                    <p className="flex items-center gap-2 font-bold text-navy-900">
                      {n.title} {!n.read_at && <span className="h-2 w-2 rounded-full bg-gold-500" aria-label="Unread" />}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-muted">{formatRelative(n.created_at)}</p>
                  </button>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                    <button className="btn-icon" title={n.read_at ? 'Mark unread' : 'Mark read'} aria-label={n.read_at ? 'Mark unread' : 'Mark read'} onClick={() => act(() => notificationService.markRead(n.id, !n.read_at))}>
                      <CheckCheck className="h-4 w-4" />
                    </button>
                    <button className="btn-icon hover:text-red-600" title="Delete" aria-label="Delete notification" onClick={() => act(() => notificationService.remove(n.id), 'Notification deleted')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon={Bell} title="No notifications" message="You’re all caught up." />
        )}
        {data?.count > 0 && <div className="border-t border-ivory-200 px-4 py-3"><Pagination page={pg.page} pageSize={pg.pageSize} total={data.count} onPageChange={pg.setPage} /></div>}
      </div>
    </>
  )
}
