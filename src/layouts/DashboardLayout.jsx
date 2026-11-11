import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '@/components/layout/Sidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import SetupNotice from '@/components/layout/SetupNotice'
import { useAuth } from '@/context/AuthContext'
import { notificationService } from '@/services/notificationService'

/**
 * Shared shell for the user dashboard and admin console.
 * `sections` builds the sidebar; `variant` adjusts header links.
 */
export default function DashboardLayout({ sections, variant = 'user', badge }) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const { user } = useAuth()
  const { pathname } = useLocation()

  const refreshUnread = useCallback(async () => {
    if (!user || variant !== 'user') return
    try {
      setUnread(await notificationService.unreadCount(user.id))
    } catch {
      /* non-critical */
    }
  }, [user, variant])

  useEffect(() => {
    refreshUnread()
    window.scrollTo(0, 0)
  }, [pathname, refreshUnread])

  useEffect(() => {
    const handler = () => refreshUnread()
    window.addEventListener('qz:notifications-changed', handler)
    return () => window.removeEventListener('qz:notifications-changed', handler)
  }, [refreshUnread])

  const base = variant === 'admin' ? '/admin' : '/dashboard'
  const withCounts = sections.map((s) => ({
    ...s,
    items: s.items.map((i) => (i.to === '/dashboard/notifications' ? { ...i, count: unread } : i)),
  }))

  return (
    <div className="min-h-screen bg-ivory">
      <SetupNotice />
      <Sidebar sections={withCounts} open={open} onClose={() => setOpen(false)} badge={badge} />
      <div className="lg:pl-64">
        <DashboardHeader
          onMenu={() => setOpen(true)}
          unread={unread}
          notificationsTo={variant === 'user' ? '/dashboard/notifications' : null}
          profileTo={variant === 'admin' ? `${base}/settings` : `${base}/profile`}
        />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet context={{ refreshUnread }} />
        </main>
      </div>
    </div>
  )
}
