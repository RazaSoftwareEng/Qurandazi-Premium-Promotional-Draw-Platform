import { useState } from 'react'
import { BadgeCheck, CalendarPlus, Eye, Lock, Megaphone, Pencil, Shuffle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Alert, Button, ConfirmationDialog, DataTable, ErrorState, FormInput, Modal, Select, Skeleton, StatusBadge, TextArea } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import DrawAuditView from '@/components/campaign/DrawAuditView'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { campaignService } from '@/services/campaignService'
import { drawService } from '@/services/drawService'
import { DRAW_STATUS } from '@/utils/campaign'
import { formatDateTime, formatNumber, fromLocalInput, shortHash, toLocalInput } from '@/utils/format'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

function ScheduleModal({ open, onClose, draw, onSaved }) {
  const campaigns = useAsync(() => (open ? campaignService.adminOptions() : Promise.resolve([])), [open], { initialData: [] })
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)

  if (open && !lastOpen) {
    setLastOpen(true)
    setErrors({})
    setValues(draw
      ? { campaign_id: draw.campaign_id, title: draw.title, scheduled_at: toLocalInput(draw.scheduled_at), winners_count: draw.winners_count, notes: draw.notes || '' }
      : { campaign_id: '', title: '', scheduled_at: '', winners_count: 1, notes: '' })
  }
  if (!open && lastOpen) setLastOpen(false)

  const eligible = (campaigns.data || []).filter((c) => !['draft', 'cancelled', 'completed'].includes(c.status))
  const selected = eligible.find((c) => c.id === values.campaign_id)

  const pickCampaign = (id) => {
    const c = eligible.find((x) => x.id === id)
    setValues((v) => ({
      ...v,
      campaign_id: id,
      title: v.title || (c ? `${c.title} — Official Draw` : ''),
      winners_count: c?.winners_count || v.winners_count,
      scheduled_at: v.scheduled_at || (c ? toLocalInput(new Date(new Date(c.end_date).getTime() + 3600e3).toISOString()) : ''),
    }))
  }

  const schema = {
    campaign_id: [rules.required('Select a campaign')],
    title: [rules.required('Draw title is required'), rules.min(3), rules.max(150)],
    scheduled_at: [rules.required('Choose the draw date & time'), (v) => (selected && v && new Date(v) < new Date(selected.end_date) ? 'Must be at or after the campaign closing date' : null)],
    winners_count: [rules.intRange(1, 100)],
    notes: [rules.max(2000)],
  }
  useLiveValidation(schema, values, errors, setErrors)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(schema, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const payload = { ...values, scheduled_at: fromLocalInput(values.scheduled_at) }
      if (draw) await drawService.update(draw.id, payload)
      else await drawService.schedule(payload)
      toast.success(draw ? 'Draw updated' : 'Draw scheduled')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={draw ? 'Edit scheduled draw' : 'Schedule a draw'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="draw-form" loading={saving}>{draw ? 'Save' : 'Schedule draw'}</Button></>}>
      <form id="draw-form" onSubmit={submit} noValidate className="space-y-4">
        <Select label="Campaign" required disabled={Boolean(draw)} value={values.campaign_id || ''} onChange={(e) => pickCampaign(e.target.value)} error={errors.campaign_id} placeholder="Select campaign" options={(draw ? campaigns.data : eligible).map((c) => ({ value: c.id, label: `${c.title} (closes ${formatDateTime(c.end_date)})` }))} />
        <FormInput label="Draw title" placeholder="e.g. Grande Winter Showcase — Official Draw" required value={values.title || ''} onChange={(e) => setValues({ ...values, title: e.target.value })} error={errors.title} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Draw date & time" type="datetime-local" required value={values.scheduled_at || ''} onChange={(e) => setValues({ ...values, scheduled_at: e.target.value })} error={errors.scheduled_at} />
          <FormInput label="Winners" placeholder="e.g. 1" type="number" min="1" max="100" value={values.winners_count ?? 1} onChange={(e) => setValues({ ...values, winners_count: e.target.value })} error={errors.winners_count} />
        </div>
        <TextArea label="Internal notes" placeholder="Optional notes for the admin team…" rows={2} value={values.notes || ''} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
        <Alert tone="gold">Entries are frozen only after the campaign closes. The draw cannot be executed before its scheduled time.</Alert>
      </form>
    </Modal>
  )
}

const ACTIONS = {
  freeze: { label: 'Freeze entries', icon: Lock, title: 'Freeze eligible entries?', message: "A snapshot of all eligible entries is created and a secret seed is committed. The snapshot can't be changed. Entries whose deposit was not active at closing time are left out. After this, entries can't be added or changed for this campaign.", confirmText: 'FREEZE' },
  execute: { label: 'Execute draw', icon: Shuffle, title: 'Execute the draw now?', message: 'Winners are derived from the committed seed. This can only happen once and cannot be undone.', confirmText: 'DRAW' },
  approve: { label: 'Approve results', icon: BadgeCheck, title: 'Approve these results?', message: 'Confirm you have reviewed the audit record. A different Super Admin from the executor must approve when one exists.' },
  publish: { label: 'Publish results', icon: Megaphone, title: 'Publish results publicly?', message: 'Results become public, the campaign is completed and all participants are notified.', confirmText: 'PUBLISH' },
  cancel: { label: 'Cancel draw', icon: XCircle, title: 'Cancel this draw?', message: 'Only scheduled or frozen draws can be cancelled. The reason is recorded in the audit log.', requireReason: true, danger: true },
}

export default function Draws() {
  useDocumentTitle('Draw Management')
  const { isSuperAdmin } = useAuth()
  const [status, setStatus] = useState('')
  const [schedule, setSchedule] = useState({ open: false, draw: null })
  const [action, setAction] = useState(null)
  const [auditId, setAuditId] = useState(null)
  const [busy, setBusy] = useState(false)
  const pg = usePagination(10)
  const { data, loading, error, reload } = useAsync(() => drawService.adminList({ status, from: pg.from, to: pg.to }), [status, pg.from])
  const audit = useAsync(() => (auditId ? drawService.audit(auditId) : Promise.resolve(null)), [auditId])

  const run = async (reason) => {
    setBusy(true)
    try {
      const { type, draw } = action
      if (type === 'cancel') await drawService.cancel(draw.id, reason)
      else {
        const res = await drawService[type](draw.id)
        if (type === 'freeze' && res?.excluded_entries > 0) {
          toast(`${res.excluded_entries} entr${res.excluded_entries === 1 ? 'y was' : 'ies were'} excluded: no active deposit at closing.`, { icon: 'ℹ️', duration: 8000 })
        }
      }
      toast.success(`${ACTIONS[type].label} — done`)
      setAction(null)
      reload()
      if (auditId) audit.reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const buttonsFor = (d) => {
    const now = Date.now()
    const b = []
    if (d.status === 'scheduled') {
      b.push(<Button key="e" size="sm" variant="ghost" icon={Pencil} onClick={() => setSchedule({ open: true, draw: d })}>Edit</Button>)
      const closed = new Date(d.campaign?.end_date).getTime() <= now
      b.push(<Button key="f" size="sm" variant="navy" icon={Lock} disabled={!closed} title={closed ? '' : 'Available after the campaign closes'} onClick={() => setAction({ type: 'freeze', draw: d })}>Freeze</Button>)
    }
    if (d.status === 'frozen') {
      const due = new Date(d.scheduled_at).getTime() <= now
      b.push(<Button key="x" size="sm" icon={Shuffle} disabled={!due} title={due ? '' : 'Available at the scheduled time'} onClick={() => setAction({ type: 'execute', draw: d })}>Execute</Button>)
    }
    if (d.status === 'drawn' && isSuperAdmin) b.push(<Button key="a" size="sm" variant="navy" icon={BadgeCheck} onClick={() => setAction({ type: 'approve', draw: d })}>Approve</Button>)
    if (d.status === 'approved' && isSuperAdmin) b.push(<Button key="p" size="sm" icon={Megaphone} onClick={() => setAction({ type: 'publish', draw: d })}>Publish</Button>)
    if (['frozen', 'drawn', 'approved', 'published'].includes(d.status)) b.push(<Button key="v" size="sm" variant="outline" icon={Eye} onClick={() => setAuditId(d.id)}>Audit</Button>)
    if (d.status === 'scheduled' || (d.status === 'frozen' && isSuperAdmin)) b.push(<Button key="c" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setAction({ type: 'cancel', draw: d })}>Cancel</Button>)
    return <div className="flex flex-wrap justify-end gap-1.5">{b}</div>
  }

  const columns = [
    { key: 'title', header: 'Draw', render: (d) => <div><p className="font-semibold text-navy-900">{d.title}</p><p className="text-xs text-ink-muted">{d.campaign?.title}</p></div> },
    { key: 'scheduled_at', header: 'Scheduled', render: (d) => formatDateTime(d.scheduled_at) },
    { key: 'pool', header: 'Pool / Winners', render: (d) => `${d.entry_count != null ? formatNumber(d.entry_count) : formatNumber(d.campaign?.entries_count)} / ${d.winners_count}` },
    { key: 'hash', header: 'Snapshot', render: (d) => <span className="font-mono text-[11px] text-ink-muted" title={d.snapshot_hash || ''}>{shortHash(d.snapshot_hash, 8)}</span>, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge map={DRAW_STATUS} value={d.status} /> },
    { key: 'actions', header: 'Actions', className: 'text-right', render: buttonsFor },
  ]

  const cfg = action ? ACTIONS[action.type] : null

  return (
    <>
      <PageHeader title="Draw Management" description="Schedule, freeze, execute, approve and publish draws through an auditable, one-way lifecycle." actions={<Button icon={CalendarPlus} onClick={() => setSchedule({ open: true, draw: null })}>Schedule draw</Button>} />
      <ol className="mb-6 grid gap-2 text-xs sm:grid-cols-5">
        {['Scheduled', 'Frozen (snapshot + seed commitment)', 'Drawn (seed revealed)', 'Approved by Super Admin', 'Published'].map((s, i) => (
          <li key={s} className="flex items-center gap-2 rounded-xl border border-ivory-300 bg-white px-3 py-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-900 text-[10px] font-bold text-gold-400">{i + 1}</span>{s}</li>
        ))}
      </ol>
      <DataTable
        columns={columns}
        rows={data?.data || []}
        loading={loading}
        error={error}
        onRetry={reload}
        page={pg.page}
        pageSize={pg.pageSize}
        total={data?.count || 0}
        onPageChange={pg.setPage}
        toolbar={<Select aria-label="Status" className="sm:w-60" value={status} onChange={(e) => { setStatus(e.target.value); pg.reset() }} placeholder="All statuses" options={Object.entries(DRAW_STATUS).map(([value, m]) => ({ value, label: m.label }))} />}
      />
      <ScheduleModal open={schedule.open} draw={schedule.draw} onClose={() => setSchedule({ open: false, draw: null })} onSaved={reload} />
      <ConfirmationDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        onConfirm={run}
        loading={busy}
        tone={cfg?.danger ? 'danger' : 'navy'}
        title={cfg?.title}
        message={<><p className="font-semibold text-navy-900">{action?.draw.title}</p><p className="mt-1">{cfg?.message}</p></>}
        confirmText={cfg?.confirmText}
        requireReason={cfg?.requireReason}
        confirmLabel={cfg?.label}
      />
      <Modal open={Boolean(auditId)} onClose={() => setAuditId(null)} size="xl" title="Draw audit record" description="Verify the result independently before approving or publishing.">
        {audit.loading ? <Skeleton className="h-96" /> : audit.error ? <ErrorState error={audit.error} onRetry={audit.reload} /> : audit.data && <DrawAuditView audit={audit.data} showStaff />}
      </Modal>
    </>
  )
}
