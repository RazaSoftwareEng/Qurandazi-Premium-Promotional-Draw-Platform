import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, CheckCircle2, ClipboardList, Gift, Hourglass, Inbox, UserCheck, Users } from 'lucide-react'
import { Alert, Avatar, EmptyState, ErrorState, Select, Skeleton, StatCard } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { adminService } from '@/services/adminService'
import { formatRelative } from '@/utils/format'

const axis = { fontSize: 11, fill: '#6B7385' }
const tooltipStyle = { borderRadius: 12, border: '1px solid #E3DDCC', fontSize: 12 }

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-ivory-200 px-5 py-4">
        <h2 className="font-bold text-navy-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function AdminOverview() {
  useDocumentTitle('Admin Dashboard')
  const [days, setDays] = useState('30')
  const stats = useAsync(() => adminService.stats(), [])
  const series = useAsync(() => adminService.timeseries(Number(days)), [days])
  const top = useAsync(() => adminService.topCampaigns(6), [])
  const regs = useAsync(() => adminService.recentRegistrations(6), [])
  const logs = useAsync(() => adminService.recentLogs(6), [])
  const s = stats.data || {}

  const chartData = (series.data || []).map((d) => ({
    day: new Date(d.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    Registrations: Number(d.registrations),
    Entries: Number(d.entries),
  }))

  return (
    <>
      <PageHeader title="Dashboard" description="Platform health, participation and governance at a glance." />
      {stats.error && <div className="card mb-6"><ErrorState error={stats.error} onRetry={stats.reload} /></div>}
      {s.pending_approvals > 0 && (
        <Alert tone="warning" icon={Hourglass} title={`${s.pending_approvals} draw result(s) awaiting Super Admin approval`} className="mb-6">
          <Link to="/admin/draws" className="font-semibold underline">Review draws</Link>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Registered users" value={s.total_users} icon={Users} loading={stats.loading} accent />
        <StatCard label="Active users" value={s.active_users} icon={UserCheck} loading={stats.loading} hint={`${s.active_30d ?? 0} signed in last 30 days · ${s.suspended_users ?? 0} suspended`} />
        <StatCard label="Total campaigns" value={s.total_campaigns} icon={Gift} loading={stats.loading} />
        <StatCard label="Active campaigns" value={s.active_campaigns} icon={Activity} loading={stats.loading} />
        <StatCard label="Total free entries" value={s.total_entries} icon={ClipboardList} loading={stats.loading} />
        <StatCard label="Completed draws" value={s.completed_draws} icon={CheckCircle2} loading={stats.loading} hint={s.unread_messages ? `${s.unread_messages} new contact message(s)` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Registrations & entries"
          className="xl:col-span-2"
          action={<Select aria-label="Range" value={days} onChange={(e) => setDays(e.target.value)} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} className="w-40" />}
        >
          <div className="h-72 p-4">
            {series.loading ? <Skeleton className="h-full w-full" /> : series.error ? <ErrorState error={series.error} onRetry={series.reload} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4AF57" stopOpacity={0.35} /><stop offset="100%" stopColor="#D4AF57" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1D2B45" stopOpacity={0.25} /><stop offset="100%" stopColor="#1D2B45" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EFEBE0" vertical={false} />
                  <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Entries" stroke="#B8933D" strokeWidth={2} fill="url(#gGold)" />
                  <Area type="monotone" dataKey="Registrations" stroke="#1D2B45" strokeWidth={2} fill="url(#gNavy)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        <Panel title="Entries by campaign">
          <div className="h-72 p-4">
            {top.loading ? <Skeleton className="h-full w-full" /> : top.data?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top.data.map((c) => ({ name: c.title.length > 16 ? `${c.title.slice(0, 15)}…` : c.title, Entries: c.entries_count }))} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="#EFEBE0" horizontal={false} />
                  <XAxis type="number" tick={axis} allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={axis} width={110} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F7F5EF' }} />
                  <Bar dataKey="Entries" fill="#D4AF57" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={Gift} title="No campaign data yet" />}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Recent registrations" action={<Link to="/admin/users" className="text-sm font-semibold text-gold-700 hover:underline">All users</Link>}>
          {regs.loading ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div> : regs.data?.length ? (
            <ul className="divide-y divide-ivory-200">
              {regs.data.map((u) => (
                <li key={u.id}>
                  <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ivory-100/70">
                    <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-navy-900">{u.full_name || '—'}</p>
                      <p className="truncate text-xs text-ink-muted">{u.email}</p>
                    </div>
                    <span className="text-xs text-ink-muted">{formatRelative(u.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Users} title="No users yet" />}
        </Panel>
        <Panel title="Recent admin activity" action={<Link to="/admin/logs" className="text-sm font-semibold text-gold-700 hover:underline">Full log</Link>}>
          {logs.loading ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div> : logs.data?.length ? (
            <ul className="divide-y divide-ivory-200">
              {logs.data.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 rounded-md bg-navy-900 px-2 py-0.5 font-mono text-[10px] text-gold-400">{l.action}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate text-navy-900">{l.admin_name || l.admin_email || 'System'}</p>
                    <p className="text-xs text-ink-muted">{l.entity_type}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ''}</p>
                  </div>
                  <span className="text-xs text-ink-muted">{formatRelative(l.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Inbox} title="No activity recorded yet" />}
        </Panel>
      </div>
    </>
  )
}
