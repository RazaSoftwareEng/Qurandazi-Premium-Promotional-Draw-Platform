import { Link } from 'react-router-dom'
import { Bell, Menu } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { useAuth } from '@/context/AuthContext'

export default function DashboardHeader({ onMenu, unread = 0, notificationsTo, profileTo }) {
  const { profile, user, role } = useAuth()
  const name = profile?.full_name || user?.email
  return (
    <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-4 border-b border-ivory-300/70 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button className="btn-icon lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden text-sm text-ink-muted lg:block">
        {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {notificationsTo && (
          <Link to={notificationsTo} className="btn-icon relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-bold text-navy-900">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        )}
        <Link to={profileTo} className="flex items-center gap-3 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-ivory-100">
          <Avatar src={profile?.avatar_url} name={name} size="sm" />
          <div className="hidden text-left sm:block">
            <p className="max-w-[160px] truncate text-sm font-bold leading-tight text-navy-900">{name}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-700">{(role || 'user').replace('_', ' ')}</p>
          </div>
        </Link>
      </div>
    </header>
  )
}
