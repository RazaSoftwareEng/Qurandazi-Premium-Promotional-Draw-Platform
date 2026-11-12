import { Link } from 'react-router-dom'
import { ArrowRight, Bell, CheckCircle2, Circle, ClipboardList, Sparkles, Trophy, UserCircle2, Wallet } from 'lucide-react'
import { Alert, Avatar, Badge, Button, EmptyState, ErrorState, Skeleton, StatCard, StatusBadge } from '@/components/ui'
import CampaignCard from '@/components/campaign/CampaignCard'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { campaignService } from '@/services/campaignService'
import { entryService } from '@/services/entryService'
import { drawService } from '@/services/drawService'
import { notificationService } from '@/services/notificationService'
import { depositService } from '@/services/depositService'
import { ENTRY_STATUS } from '@/utils/campaign'
import { formatDate, formatPKR, formatRelative } from '@/utils/format'

export default function Overview() {
  useDocumentTitle('Dashboard')
  const { user, profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const entries = useAsync(() => entryService.myRecent(user.id, 5), [user.id])
  const history = useAsync(() => drawService.myHistory(), [user.id])
  const campaigns = useAsync(() => campaignService.listPublic({ phase: 'open', from: 0, to: 2 }), [])
  const notes = useAsync(() => notificationService.list({ userId: user.id, from: 0, to: 4 }), [user.id])
  const deposits = useAsync(() => depositService.mine(user.id), [user.id])

  const all = history.data || []
  const wins = all.filter((h) => h.won).length
  const pending = all.filter((h) => h.result_status !== 'published').length
  const profileComplete = Boolean(profile?.full_name && profile?.phone && profile?.address)
  const active = (deposits.data || []).filter((d) => d.status === 'verified').sort((a, b) => b.amount - a.amount)[0]
  const pendingDeposit = (deposits.data || []).some((d) => d.status === 'pending')
  const kyc = profile?.kyc_status
  const steps = [
    { done: profileComplete, label: 'Complete your profile', hint: 'Full name, phone and address.', to: '/dashboard/profile' },
    { done: kyc === 'verified', label: 'Get KYC verified', hint: kyc === 'pending' ? 'Your CNIC is under review.' : kyc === 'rejected' ? 'Your CNIC was rejected. Please resubmit it.' : 'Upload the front and back of your CNIC.', to: '/dashboard/profile' },
    { done: Boolean(active), label: 'Make a verified deposit', hint: pendingDeposit ? 'Your deposit is awaiting verification.' : 'Grande, Alto or 125. Refundable, never a fee.', to: '/dashboard/deposits' },
  ]
  const allDone = steps.every((st) => st.done)

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-navy-900 p-6 text-white sm:p-8">
        <div className="pattern-stars pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size="lg" />
            <div>
              <p className="text-sm text-gold-400">Welcome back,</p>
              <h1 className="font-display text-4xl font-semibold text-white">{firstName}</h1>
              <p className="mt-1 text-sm text-white/60">{user.email} · Member since {formatDate(profile?.created_at)}</p>
            </div>
          </div>
          <Button to="/dashboard/campaigns" iconRight={ArrowRight}>Find campaigns</Button>
        </div>
      </section>

      {!deposits.loading && !allDone && (
        <section className="card p-5">
          <h2 className="font-bold text-navy-900">Get ready to join campaigns</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {steps.map((st, i) => {
              const Icon = st.done ? CheckCircle2 : Circle
              const inner = (
                <>
                  <p className={`flex items-center gap-2 text-sm font-bold ${st.done ? 'text-emerald-700' : 'text-navy-900'}`}><Icon className="h-4 w-4 shrink-0" /> {i + 1}. {st.label}</p>
                  {!st.done && <p className="mt-1 text-xs text-ink-muted">{st.hint}</p>}
                </>
              )
              return (
                <li key={st.label} className={`rounded-xl border p-3 ${st.done ? 'border-emerald-200 bg-emerald-50/60' : 'border-ivory-300'}`}>
                  {!st.done && st.to ? <Link to={st.to} className="block hover:opacity-80">{inner}</Link> : inner}
                </li>
              )
            })}
          </ol>
        </section>
      )}
      {active && (
        <Alert tone="success" icon={Wallet} title={`Active deposit: ${active.category?.name} · ${formatPKR(active.amount)}`}>
          You can join campaigns that require {formatPKR(active.amount)} or less. <Link to="/dashboard/deposits" className="font-semibold underline">Manage deposits</Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My entries" value={all.length} icon={ClipboardList} loading={history.loading} accent />
        <StatCard label="Awaiting results" value={pending} icon={Sparkles} loading={history.loading} />
        <StatCard label="Wins" value={wins} icon={Trophy} loading={history.loading} />
        <StatCard label="Account" value={profile?.status === 'active' ? 'Active' : 'Suspended'} icon={UserCircle2} hint={profile?.kyc_status === 'verified' ? 'KYC verified' : 'KYC not verified yet'} />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-900">Active campaigns</h2>
          <Link to="/dashboard/campaigns" className="text-sm font-semibold text-gold-700 hover:underline">View all</Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)
          ) : campaigns.error ? (
            <div className="card col-span-full"><ErrorState error={campaigns.error} onRetry={campaigns.reload} /></div>
          ) : campaigns.data?.data?.length ? (
            campaigns.data.data.map((c) => <CampaignCard key={c.id} campaign={c} />)
          ) : (
            <div className="card col-span-full"><EmptyState icon={Sparkles} title="No campaigns open right now" message="We’ll notify you when a new campaign opens." /></div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between border-b border-ivory-200 px-5 py-4">
            <h2 className="font-bold text-navy-900">My recent entries</h2>
            <Link to="/dashboard/entries" className="text-sm font-semibold text-gold-700 hover:underline">All entries</Link>
          </div>
          {entries.loading ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : entries.error ? (
            <ErrorState error={entries.error} onRetry={entries.reload} />
          ) : entries.data?.length ? (
            <ul className="divide-y divide-ivory-200">
              {entries.data.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">{e.campaign?.title}</p>
                    <p className="font-mono text-xs text-ink-muted">{e.reference} · {formatDate(e.created_at)}</p>
                  </div>
                  <StatusBadge map={ENTRY_STATUS} value={e.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardList} title="No entries yet" message="Join an open campaign to see your entries here." action={<Button to="/dashboard/campaigns" size="sm">Browse campaigns</Button>} />
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-ivory-200 px-5 py-4">
            <h2 className="font-bold text-navy-900">Recent notifications</h2>
            <Link to="/dashboard/notifications" className="text-sm font-semibold text-gold-700 hover:underline">View all</Link>
          </div>
          {notes.loading ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : notes.error ? (
            <ErrorState error={notes.error} onRetry={notes.reload} />
          ) : notes.data?.data?.length ? (
            <ul className="divide-y divide-ivory-200">
              {notes.data.data.map((n) => (
                <li key={n.id} className="flex gap-3 px-5 py-3.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-ivory-300' : 'bg-gold-500'}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900">{n.title}</p>
                    <p className="line-clamp-2 text-sm text-ink-muted">{n.body}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{formatRelative(n.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Bell} title="You’re all caught up" />
          )}
        </section>
      </div>

      {all.some((h) => h.result_status === 'published') && (
        <section className="card p-5">
          <h2 className="font-bold text-navy-900">Previous participation</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {all.filter((h) => h.result_status === 'published').slice(0, 6).map((h) => (
              <Badge key={h.entry_id} tone={h.won ? 'gold' : 'neutral'}>{h.campaign_title}{h.won ? ' · Won' : ''}</Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
