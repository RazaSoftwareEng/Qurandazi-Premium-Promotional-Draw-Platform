import { useState } from 'react'
import { Archive, Inbox, Mail, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, ConfirmationDialog, DataTable, EmptyState, Modal, Select } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { adminService } from '@/services/adminService'
import { formatDateTime, truncate } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

const TONE = { new: 'gold', read: 'neutral', archived: 'info' }

export default function Messages() {
  useDocumentTitle('Contact Inbox')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const pg = usePagination(15)
  const { data, loading, error, reload } = useAsync(() => adminService.messages({ status, from: pg.from, to: pg.to }), [status, pg.from])

  const view = async (m) => {
    setOpen(m)
    if (m.status === 'new') {
      try {
        await adminService.setMessageStatus(m.id, 'read')
        reload()
      } catch {
        /* non-critical */
      }
    }
  }

  const archive = async (m) => {
    try {
      await adminService.setMessageStatus(m.id, 'archived')
      toast.success('Message archived')
      setOpen(null)
      reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await adminService.deleteMessage(deleting.id)
      toast.success('Message deleted')
      setDeleting(null)
      setOpen(null)
      reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Contact Inbox" description="Messages submitted through the public Contact page." />
      <DataTable
        columns={[
          { key: 'from', header: 'From', render: (m) => <div><p className="font-semibold text-navy-900">{m.name}</p><p className="text-xs text-ink-muted">{m.email}</p></div> },
          { key: 'subject', header: 'Subject', render: (m) => <div><p className={m.status === 'new' ? 'font-bold text-navy-900' : ''}>{m.subject}</p><p className="text-xs text-ink-muted">{truncate(m.message, 70)}</p></div> },
          { key: 'status', header: 'Status', render: (m) => <Badge tone={TONE[m.status]} dot>{m.status}</Badge> },
          { key: 'created_at', header: 'Received', render: (m) => formatDateTime(m.created_at) },
        ]}
        rows={data?.data || []}
        loading={loading}
        error={error}
        onRetry={reload}
        page={pg.page}
        pageSize={pg.pageSize}
        total={data?.count || 0}
        onPageChange={pg.setPage}
        onRowClick={view}
        toolbar={<Select aria-label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); pg.reset() }} placeholder="All messages" options={[{ value: 'new', label: 'New' }, { value: 'read', label: 'Read' }, { value: 'archived', label: 'Archived' }]} />}
        empty={<EmptyState icon={Inbox} title="Inbox is empty" />}
      />
      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.subject}
        description={open ? `${open.name} · ${open.email} · ${formatDateTime(open.created_at)}` : ''}
        footer={open && <>
          <Button variant="ghost" className="text-red-600 hover:bg-red-50" icon={Trash2} onClick={() => setDeleting(open)}>Delete</Button>
          {open.status !== 'archived' && <Button variant="outline" icon={Archive} onClick={() => archive(open)}>Archive</Button>}
          <Button href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject}`)}`} icon={Mail}>Reply by email</Button>
        </>}
      >
        <p className="whitespace-pre-line text-sm leading-7 text-ink-soft">{open?.message}</p>
      </Modal>
      <ConfirmationDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} loading={busy} title="Delete this message?" message="This cannot be undone." confirmLabel="Delete" />
    </>
  )
}
