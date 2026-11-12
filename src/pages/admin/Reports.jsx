import { useState } from 'react'
import { ClipboardList, Download, Gift, Trophy, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, StatCard } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { adminService } from '@/services/adminService'
import { campaignService } from '@/services/campaignService'
import { entryService } from '@/services/entryService'
import { drawService } from '@/services/drawService'
import { downloadCSV } from '@/utils/csv'
import { getErrorMessage } from '@/utils/errors'
import { USER_EXPORT_COLUMNS } from './Users'
import { ENTRY_EXPORT_COLUMNS } from './Entries'
import { WINNER_EXPORT_COLUMNS } from './Winners'

const CAMPAIGN_COLUMNS = [
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'Slug' },
  { key: 'category', label: 'Category', value: (c) => c.category?.name },
  { key: 'status', label: 'Status' },
  { key: 'start_date', label: 'Start' },
  { key: 'end_date', label: 'Close' },
  { key: 'draw_date', label: 'Draw date' },
  { key: 'winners_count', label: 'Winners' },
  { key: 'entries_count', label: 'Entries' },
  { key: 'rules', label: 'Eligibility rules', value: (c) => (c.eligibility_rules || []).map((r) => r.rule_type).join('; ') },
  { key: 'created_at', label: 'Created' },
]

const stamp = () => new Date().toISOString().slice(0, 10)

export default function Reports() {
  useDocumentTitle('Reports')
  const stats = useAsync(() => adminService.stats(), [])
  const [busy, setBusy] = useState('')

  const REPORTS = [
    { id: 'users', title: 'User report', icon: Users, text: 'All members with role, status, verification and entry counts.', run: async () => ['users', await adminService.exportUsers(), USER_EXPORT_COLUMNS] },
    { id: 'campaigns', title: 'Campaign report', icon: Gift, text: 'Every campaign with dates, status, eligibility rules and entry totals.', run: async () => ['campaigns', (await campaignService.adminList({ from: 0, to: 9999 })).data, CAMPAIGN_COLUMNS] },
    { id: 'entries', title: 'Entry report', icon: ClipboardList, text: 'All entries with participant details and review status.', run: async () => ['entries', await entryService.adminExport(), ENTRY_EXPORT_COLUMNS] },
    { id: 'winners', title: 'Winner report', icon: Trophy, text: 'All selected winners with draw status and publication dates.', run: async () => ['winners', (await drawService.adminResults({ from: 0, to: 9999 })).data, WINNER_EXPORT_COLUMNS] },
  ]

  const run = async (r) => {
    setBusy(r.id)
    try {
      const [name, rows, cols] = await r.run()
      if (!rows.length) {
        toast('No records to export')
        return
      }
      downloadCSV(`qurandazi-${name}-report-${stamp()}`, rows, cols)
      adminService.logEvent(`report.export_${name}`, 'reports', { rows: rows.length })
      toast.success(`${rows.length} record(s) exported`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy('')
    }
  }

  const s = stats.data || {}
  return (
    <>
      <PageHeader title="Reports" description="Export complete records as CSV. Every export is recorded in the activity log." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" value={s.total_users} icon={Users} loading={stats.loading} />
        <StatCard label="Campaigns" value={s.total_campaigns} icon={Gift} loading={stats.loading} />
        <StatCard label="Entries" value={s.total_entries} icon={ClipboardList} loading={stats.loading} />
        <StatCard label="Published draws" value={s.completed_draws} icon={Trophy} loading={stats.loading} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {REPORTS.map((r) => (
          <div key={r.id} className="card flex flex-col p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-gold-400"><r.icon className="h-5 w-5" /></span>
              <h2 className="text-lg font-bold text-navy-900">{r.title}</h2>
            </div>
            <p className="mt-3 flex-1 text-sm text-ink-muted">{r.text}</p>
            <Button className="mt-5 self-start" icon={Download} loading={busy === r.id} disabled={Boolean(busy) && busy !== r.id} onClick={() => run(r)}>Export CSV</Button>
          </div>
        ))}
      </div>
    </>
  )
}
