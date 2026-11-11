import { useState } from 'react'
import { Megaphone, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, ConfirmationDialog, DataTable, EmptyState, FormInput, Select, TextArea } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { adminService } from '@/services/adminService'
import { campaignService } from '@/services/campaignService'
import { formatDateTime, formatNumber, truncate } from '@/utils/format'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

const TYPES = [
  { value: 'announcement', label: 'General announcement' },
  { value: 'campaign', label: 'Campaign update' },
  { value: 'result', label: 'Published results' },
]
const EMPTY = { title: '', body: '', type: 'announcement', audience: 'all', campaign_id: '', link: '' }
const ANNOUNCEMENT_SCHEMA = {
  title: [rules.required('Title is required'), rules.min(3), rules.max(160)],
  body: [rules.required('Message is required'), rules.max(4000)],
  campaign_id: [(v, a) => (a.audience === 'campaign' && !v ? 'Select a campaign' : null)],
  link: [(v) => (!v || /^\/[\w\-/]*$/.test(v) ? null : 'Use an internal path such as /campaigns')],
}

export default function AdminNotifications() {
  useDocumentTitle('Announcements')
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [confirm, setConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const pg = usePagination(10)
  const list = useAsync(() => adminService.announcements(pg), [pg.from])
  const campaigns = useAsync(() => campaignService.adminOptions(), [], { initialData: [] })
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))

  useLiveValidation(ANNOUNCEMENT_SCHEMA, values, errors, setErrors)

  const review = (e) => {
    e.preventDefault()
    const errs = validate(ANNOUNCEMENT_SCHEMA, values)
    setErrors(errs)
    if (!Object.keys(errs).length) setConfirm(true)
  }

  const send = async () => {
    setSending(true)
    try {
      const res = await adminService.sendAnnouncement(values)
      toast.success(`Sent to ${formatNumber(res.recipients)} member(s)`)
      setValues(EMPTY)
      setConfirm(false)
      list.reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <PageHeader title="Announcements" description="Notify members about campaigns, announcements and published results." />
      <div className="grid gap-6 xl:grid-cols-12">
        <form onSubmit={review} noValidate className="card space-y-4 p-6 xl:col-span-5">
          <h2 className="flex items-center gap-2 font-bold text-navy-900"><Megaphone className="h-5 w-5 text-gold-600" /> New announcement</h2>
          <Select label="Type" value={values.type} onChange={set('type')} options={TYPES} />
          <Select label="Audience" value={values.audience} onChange={set('audience')} options={[{ value: 'all', label: 'All active members' }, { value: 'campaign', label: 'Participants of a campaign' }]} />
          {values.audience === 'campaign' && (
            <Select label="Campaign" value={values.campaign_id} onChange={set('campaign_id')} error={errors.campaign_id} placeholder="Select campaign" options={(campaigns.data || []).map((c) => ({ value: c.id, label: c.title }))} />
          )}
          <FormInput label="Title" placeholder="e.g. New campaign now open!" required value={values.title} onChange={set('title')} error={errors.title} maxLength={160} />
          <TextArea label="Message" placeholder="Write the announcement members will receive…" required rows={5} value={values.body} onChange={set('body')} error={errors.body} maxLength={4000} />
          <FormInput label="Link (optional)" placeholder="/campaigns" value={values.link} onChange={set('link')} error={errors.link} help="Internal path members open when they click the notification." />
          <Button type="submit" icon={Send}>Review & send</Button>
        </form>
        <div className="xl:col-span-7">
          <DataTable
            columns={[
              { key: 'title', header: 'Announcement', render: (a) => <div><p className="font-semibold text-navy-900">{a.title}</p><p className="text-xs text-ink-muted">{truncate(a.body, 80)}</p></div> },
              { key: 'audience', header: 'Audience', render: (a) => <Badge tone={a.audience === 'all' ? 'info' : 'gold'}>{a.audience === 'all' ? 'All members' : a.campaign?.title || 'Campaign'}</Badge> },
              { key: 'recipients_count', header: 'Recipients', render: (a) => formatNumber(a.recipients_count) },
              { key: 'created_at', header: 'Sent', render: (a) => formatDateTime(a.created_at) },
            ]}
            rows={list.data?.data || []}
            loading={list.loading}
            error={list.error}
            onRetry={list.reload}
            page={pg.page}
            pageSize={pg.pageSize}
            total={list.data?.count || 0}
            onPageChange={pg.setPage}
            empty={<EmptyState icon={Megaphone} title="No announcements sent yet" />}
          />
        </div>
      </div>
      <ConfirmationDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={send}
        loading={sending}
        tone="navy"
        title="Send this announcement?"
        message={<><p className="font-semibold text-navy-900">{values.title}</p><p className="mt-1">It will be delivered as an in-app notification to {values.audience === 'all' ? 'all active members' : 'every participant of the selected campaign'}.</p></>}
        confirmLabel="Send now"
      />
    </>
  )
}
