import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy, ExternalLink, MoreVertical, Pencil, Plus, Power, PowerOff, Star, Trash2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, ConfirmationDialog, DataTable, Dropdown, FormInput, ImageUpload, Modal, SearchInput, Select, TextArea, Toggle } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { campaignService } from '@/services/campaignService'
import { categoryService } from '@/services/categoryService'
import { CAMPAIGN_STATUSES, RULE_TYPES, getCampaignPhase } from '@/utils/campaign'
import { formatDate, formatNumber, fromLocalInput, slugify, toLocalInput } from '@/utils/format'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

const EMPTY = {
  title: '', slug: '', category_id: '', summary: '', description: '', prize_description: '', rules: '',
  participation_instructions: '', eligibility_summary: '', banner_url: null, start_date: '', end_date: '', draw_date: '',
  status: 'draft', is_featured: false, winners_count: 1,
}

function CampaignForm({ open, onClose, campaign, initial, categories, onSaved }) {
  const [values, setValues] = useState(EMPTY)
  const [ruleState, setRuleState] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)

  if (open && !lastOpen) {
    setLastOpen(true)
    setErrors({})
    const src = campaign || initial
    if (src) {
      const picked = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, src[k] ?? (k === 'banner_url' ? null : EMPTY[k])]))
      setValues({
        ...picked,
        start_date: toLocalInput(src.start_date),
        end_date: toLocalInput(src.end_date),
        draw_date: toLocalInput(src.draw_date),
      })
      setRuleState(Object.fromEntries((src.eligibility_rules || []).map((r) => [r.rule_type, { on: true, value: r.rule_value || '', description: r.description || '' }])))
      setSlugTouched(true)
    } else {
      setValues(EMPTY)
      setRuleState({ profile_complete: { on: true, value: '', description: '' } })
      setSlugTouched(false)
    }
  }
  if (!open && lastOpen) setLastOpen(false)

  const set = (k) => (e) => {
    const v = e.target.value
    setValues((s) => ({ ...s, [k]: v, ...(k === 'title' && !slugTouched ? { slug: slugify(v) } : {}) }))
    if (errors[k]) setErrors(({ [k]: _removed, ...rest }) => rest)
  }
  const setRule = (type, patch) => {
    setRuleState((s) => ({ ...s, [type]: { on: false, value: '', description: '', ...s[type], ...patch } }))
    if (errors[`rule_${type}`]) setErrors(({ [`rule_${type}`]: _removed, ...rest }) => rest)
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(
      {
        title: [rules.required(), rules.min(3), rules.max(150)],
        slug: [rules.required(), rules.slug()],
        category_id: [rules.required('Select a category')],
        summary: [rules.max(300)],
        description: [rules.max(10000)],
        prize_description: [rules.max(500)],
        rules: [rules.max(10000)],
        participation_instructions: [rules.max(5000)],
        eligibility_summary: [rules.max(2000)],
        start_date: [rules.required('Start date is required')],
        end_date: [rules.required('Closing date is required'), (v, a) => (a.start_date && v && new Date(v) <= new Date(a.start_date) ? 'Closing date must be after the start date' : null)],
        draw_date: [(v, a) => (v && a.end_date && new Date(v) < new Date(a.end_date) ? 'Draw date must be on or after the closing date' : null)],
        winners_count: [rules.intRange(1, 100)],
      },
      values,
    )
    for (const t of RULE_TYPES) {
      const r = ruleState[t.value]
      if (r?.on && t.needsValue && !r.value?.trim()) errs[`rule_${t.value}`] = 'A value is required'
      if (r?.on && t.value === 'min_account_age_days' && !/^\d+$/.test(r.value)) errs[`rule_${t.value}`] = 'Enter a whole number of days'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return toast.error('Please fix the highlighted fields')

    const payload = {
      title: values.title.trim(), slug: values.slug, category_id: values.category_id,
      summary: values.summary?.trim() || null, description: values.description?.trim() || null,
      prize_description: values.prize_description?.trim() || null, rules: values.rules?.trim() || null,
      participation_instructions: values.participation_instructions?.trim() || null,
      eligibility_summary: values.eligibility_summary?.trim() || null, banner_url: values.banner_url || null,
      start_date: fromLocalInput(values.start_date), end_date: fromLocalInput(values.end_date), draw_date: fromLocalInput(values.draw_date),
      status: values.status, is_featured: Boolean(values.is_featured), winners_count: Number(values.winners_count),
    }
    const ruleList = RULE_TYPES.filter((t) => ruleState[t.value]?.on).map((t) => ({
      rule_type: t.value, rule_value: t.needsValue ? ruleState[t.value].value.trim() : null, description: ruleState[t.value].description?.trim() || null,
    }))
    setSaving(true)
    try {
      if (campaign) await campaignService.update(campaign.id, payload, ruleList)
      else await campaignService.create(payload, ruleList)
      toast.success(campaign ? 'Campaign updated' : 'Campaign created')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title={campaign ? 'Edit campaign' : 'Create campaign'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="campaign-form" loading={saving}>Save campaign</Button></>}>
      <form id="campaign-form" onSubmit={submit} noValidate className="space-y-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-gold-700">Basics</legend>
          <FormInput label="Title" placeholder="e.g. Grande Winter Showcase" required value={values.title} onChange={set('title')} error={errors.title} className="sm:col-span-2" />
          <FormInput label="URL slug" placeholder="e.g. grande-winter-showcase" required value={values.slug} onChange={(e) => { setSlugTouched(true); set('slug')(e) }} error={errors.slug} />
          <Select label="Category" required value={values.category_id} onChange={set('category_id')} error={errors.category_id} placeholder="Select category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <TextArea label="Summary" placeholder="One or two sentences shown on campaign cards…" rows={2} className="sm:col-span-2" value={values.summary} onChange={set('summary')} error={errors.summary} maxLength={300} help="Shown on campaign cards (max 300 characters)." />
          <TextArea label="Description" placeholder="Full campaign description…" rows={4} className="sm:col-span-2" value={values.description} onChange={set('description')} error={errors.description} maxLength={10000} />
          <FormInput label="Reward description" placeholder="e.g. Premium home electronics bundle" className="sm:col-span-2" value={values.prize_description} onChange={set('prize_description')} error={errors.prize_description} maxLength={500} />
          <div className="sm:col-span-2"><ImageUpload label="Campaign banner" value={values.banner_url} onChange={(url) => setValues((s) => ({ ...s, banner_url: url }))} folder="campaigns" /></div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-gold-700">Schedule & status</legend>
          <FormInput label="Start date" type="datetime-local" required value={values.start_date} onChange={set('start_date')} error={errors.start_date} />
          <FormInput label="Closing date" type="datetime-local" required value={values.end_date} onChange={set('end_date')} error={errors.end_date} />
          <FormInput label="Draw date" type="datetime-local" value={values.draw_date} onChange={set('draw_date')} error={errors.draw_date} help="Optional; set when scheduling a draw." />
          <Select label="Status" value={values.status} onChange={set('status')} options={CAMPAIGN_STATUSES} help="Draft campaigns are hidden from the public." />
          <FormInput label="Number of winners" placeholder="e.g. 1" type="number" min="1" max="100" value={values.winners_count} onChange={set('winners_count')} error={errors.winners_count} />
          <div className="flex items-end pb-2"><Toggle label="Featured" description="Show on homepage" checked={Boolean(values.is_featured)} onChange={(v) => setValues((s) => ({ ...s, is_featured: v }))} /></div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-gold-700">Eligibility rules (enforced server-side)</legend>
          <div className="divide-y divide-ivory-200 rounded-xl border border-ivory-300">
            {RULE_TYPES.map((t) => (
              <div key={t.value} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr] sm:items-center">
                <label className="flex items-center gap-3 text-sm font-semibold text-navy-900">
                  <input type="checkbox" className="h-4 w-4 accent-gold-600" checked={Boolean(ruleState[t.value]?.on)} onChange={(e) => setRule(t.value, { on: e.target.checked })} />
                  {t.label}
                </label>
                {t.needsValue && ruleState[t.value]?.on && (
                  <FormInput aria-label={t.label} placeholder={t.placeholder} value={ruleState[t.value]?.value || ''} onChange={(e) => setRule(t.value, { value: e.target.value })} error={errors[`rule_${t.value}`]} />
                )}
              </div>
            ))}
          </div>
          <TextArea label="Eligibility summary (public text)" placeholder="e.g. Open to registered members with a verified email…" rows={2} className="mt-4" value={values.eligibility_summary} onChange={set('eligibility_summary')} error={errors.eligibility_summary} maxLength={2000} />
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-gold-700">Rules & instructions</legend>
          <TextArea label="Campaign rules" placeholder={"1. One entry per member.\n2. …"} rows={5} value={values.rules} onChange={set('rules')} error={errors.rules} maxLength={10000} />
          <TextArea label="Participation instructions" placeholder="e.g. Sign in, verify your CNIC, make a deposit, then press “Join Campaign”." rows={3} value={values.participation_instructions} onChange={set('participation_instructions')} error={errors.participation_instructions} maxLength={5000} />
          <p className="rounded-lg bg-gold-100/50 px-3 py-2 text-xs text-navy-900">The deposit requirement comes from the campaign’s category (Categories → Required deposit). No entry fee can be charged.</p>
        </fieldset>
      </form>
    </Modal>
  )
}

export default function Campaigns() {
  useDocumentTitle('Campaign Management')
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState(params.get('category') || '')
  const [form, setForm] = useState({ open: false, campaign: null })
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const q = useDebounce(search)
  const pg = usePagination(10)
  const cats = useAsync(() => categoryService.list({ includeInactive: true }), [], { initialData: [] })
  const { data, loading, error, reload } = useAsync(() => campaignService.adminList({ search: q, status, categoryId, from: pg.from, to: pg.to }), [q, status, categoryId, pg.from])

  const duplicate = (c) =>
    setForm({ open: true, campaign: null, initial: { ...c, title: `${c.title} (copy)`, slug: `${c.slug}-copy`, status: 'draft', is_featured: false } })

  const runConfirm = async () => {
    setBusy(true)
    try {
      if (confirm.type === 'delete') {
        await campaignService.remove(confirm.c.id)
        toast.success('Campaign deleted')
      } else {
        await campaignService.setStatus(confirm.c.id, confirm.status)
        toast.success(`Campaign ${confirm.status === 'active' ? 'activated' : confirm.status === 'cancelled' ? 'cancelled' : 'updated'}`)
      }
      setConfirm(null)
      reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'title', header: 'Campaign',
      render: (c) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-navy-900">{c.is_featured && <Star className="h-3.5 w-3.5 fill-gold-500 text-gold-500" />}{c.title}</p>
          <p className="text-xs text-ink-muted">{c.category?.name} · /{c.slug}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (c) => { const p = getCampaignPhase(c); return <div className="flex flex-col gap-1"><Badge tone={p.tone} dot>{p.label}</Badge>{p.label.toLowerCase() !== c.status && <span className="text-[11px] text-ink-muted">status: {c.status}</span>}</div> } },
    { key: 'dates', header: 'Window', render: (c) => <span className="text-xs">{formatDate(c.start_date)} → {formatDate(c.end_date)}</span> },
    { key: 'rules', header: 'Rules', render: (c) => <span className="text-xs">{c.eligibility_rules?.length || 0}</span>, hideOnMobile: true },
    { key: 'entries_count', header: 'Entries', render: (c) => formatNumber(c.entries_count) },
    {
      key: 'actions', header: '', className: 'w-12 text-right',
      render: (c) => (
        <Dropdown
          trigger={<MoreVertical className="h-4 w-4" />}
          items={[
            { label: 'Edit', icon: Pencil, onClick: () => setForm({ open: true, campaign: c }) },
            { label: 'View public page', icon: ExternalLink, onClick: () => window.open(`/campaigns/${c.slug}`, '_blank', 'noopener') },
            { label: 'Duplicate', icon: Copy, onClick: () => duplicate(c) },
            { label: 'Activate', icon: Power, hidden: ['active', 'completed'].includes(c.status), onClick: () => setConfirm({ type: 'status', c, status: 'active' }) },
            { label: 'Deactivate (draft)', icon: PowerOff, hidden: !['active', 'upcoming'].includes(c.status) || c.entries_count > 0, onClick: () => setConfirm({ type: 'status', c, status: 'draft' }) },
            { label: 'Close entries', icon: PowerOff, hidden: c.status !== 'active' || c.entries_count === 0, onClick: () => setConfirm({ type: 'status', c, status: 'closed' }) },
            { label: 'Cancel campaign', icon: XCircle, hidden: ['completed', 'cancelled'].includes(c.status), onClick: () => setConfirm({ type: 'status', c, status: 'cancelled' }) },
            { divider: true },
            { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm({ type: 'delete', c }) },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Campaigns" description="Create and manage promotional campaigns, schedules and eligibility." actions={<Button icon={Plus} onClick={() => setForm({ open: true, campaign: null })}>Create campaign</Button>} />
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
        toolbar={
          <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
            <SearchInput value={search} onChange={(v) => { setSearch(v); pg.reset() }} placeholder="Search campaigns…" />
            <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); pg.reset() }} placeholder="All statuses" options={CAMPAIGN_STATUSES} />
            <Select aria-label="Category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); pg.reset() }} placeholder="All categories" options={(cats.data || []).map((c) => ({ value: c.id, label: c.name }))} />
          </div>
        }
      />
      <CampaignForm
        open={form.open}
        campaign={form.campaign}
        initial={form.initial}
        categories={cats.data || []}
        onClose={() => setForm({ open: false, campaign: null, initial: null })}
        onSaved={reload}
      />
      <ConfirmationDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        loading={busy}
        tone={confirm?.type === 'delete' || confirm?.status === 'cancelled' ? 'danger' : 'navy'}
        title={confirm?.type === 'delete' ? `Delete “${confirm?.c.title}”?` : `Set campaign to “${confirm?.status}”?`}
        message={
          confirm?.type === 'delete'
            ? confirm.c.entries_count > 0
              ? 'This campaign has entries and cannot be deleted. Cancel it instead to preserve the audit trail.'
              : 'Campaigns without entries or draws can be permanently deleted.'
            : confirm?.status === 'cancelled'
              ? 'Cancelling stops all participation. Existing entries are preserved for audit.'
              : 'This change is recorded in the activity log.'
        }
        confirmText={confirm?.type === 'delete' ? 'DELETE' : undefined}
        confirmLabel={confirm?.type === 'delete' ? 'Delete campaign' : 'Confirm'}
      />
    </>
  )
}
