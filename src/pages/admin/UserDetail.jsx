import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Pencil, PlayCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Avatar, Badge, Button, ConfirmationDialog, DataTable, ErrorState, Skeleton, StatusBadge } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { adminService } from '@/services/adminService'
import { entryService } from '@/services/entryService'
import { ENTRY_STATUS } from '@/utils/campaign'
import { KYC_STATUS } from '@/utils/deposit'
import { formatDate, formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'
import { ROLE_META, UserFormModal } from './Users'

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const pg = usePagination(10)
  const user = useAsync(() => adminService.getUser(id), [id])
  const entries = useAsync(() => entryService.adminList({ userId: id }, pg), [id, pg.from])
  useDocumentTitle(user.data?.full_name || 'User')

  const run = async () => {
    setBusy(true)
    try {
      if (confirm === 'delete') {
        await adminService.deleteUser(id)
        toast.success('User deleted')
        navigate('/admin/users', { replace: true })
        return
      }
      await adminService.setUserStatus(id, user.data.status === 'active' ? 'suspended' : 'active')
      toast.success('Status updated')
      setConfirm(null)
      user.reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (user.loading) return <div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
  if (user.error) return <div className="card"><ErrorState error={user.error} onRetry={user.reload} /></div>
  const u = user.data
  const self = u.id === me.id

  const info = [
    ['Email', u.email],
    ['Phone', u.phone || '—'],
    ['City', u.city || '—'],
    ['Address', u.address || '—'],
    ['KYC', <span key="kyc" className="inline-flex flex-col items-end gap-1"><StatusBadge map={KYC_STATUS} value={u.kyc_status} />{u.kyc_status !== 'not_submitted' && <Link to="/admin/kyc" className="text-xs text-gold-700 hover:underline">KYC Reviews</Link>}</span>],
    ['CNIC', <span key="cnic" className="font-mono text-xs">{u.cnic || '—'}</span>],
    ['Deposits', <Link key="dep" to={`/admin/deposits`} className="text-gold-700 hover:underline">View in Deposits</Link>],
    ['Last sign-in', formatDateTime(u.last_sign_in_at)],
    ['Registered', formatDateTime(u.created_at)],
    ['User ID', <span key="id" className="font-mono text-xs">{u.id}</span>],
  ]

  return (
    <>
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-navy-900"><ArrowLeft className="h-4 w-4" /> Users</Link>
      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="card p-6 lg:col-span-4">
          <div className="text-center">
            <Avatar src={u.avatar_url} name={u.full_name} size="xl" className="mx-auto" />
            <h1 className="mt-4 text-xl font-bold text-navy-900">{u.full_name || 'Unnamed'}</h1>
            <div className="mt-2 flex justify-center gap-2">
              <Badge tone={ROLE_META[u.role]?.tone}>{ROLE_META[u.role]?.label}</Badge>
              <Badge tone={u.status === 'active' ? 'success' : 'danger'} dot>{u.status}</Badge>
            </div>
          </div>
          <dl className="mt-6 divide-y divide-ivory-200 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">{k}</dt><dd className="break-all text-right font-medium text-navy-900">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-6 grid gap-2">
            <Button variant="outline" icon={Pencil} onClick={() => setEditing(true)}>Edit user</Button>
            {!self && (
              <>
                <Button variant={u.status === 'active' ? 'outline' : 'navy'} icon={u.status === 'active' ? Ban : PlayCircle} onClick={() => setConfirm('status')}>
                  {u.status === 'active' ? 'Suspend account' : 'Activate account'}
                </Button>
                <Button variant="danger" icon={Trash2} onClick={() => setConfirm('delete')}>Delete user</Button>
              </>
            )}
          </div>
        </aside>
        <section className="lg:col-span-8">
          <h2 className="mb-3 text-lg font-bold text-navy-900">Participation history ({u.entries_count})</h2>
          <DataTable
            columns={[
              { key: 'reference', header: 'Reference', render: (e) => <span className="font-mono text-xs">{e.reference}</span> },
              { key: 'campaign', header: 'Campaign', render: (e) => e.campaign?.title },
              { key: 'created_at', header: 'Date', render: (e) => formatDate(e.created_at) },
              { key: 'status', header: 'Status', render: (e) => <StatusBadge map={ENTRY_STATUS} value={e.status} /> },
            ]}
            rows={entries.data?.data || []}
            loading={entries.loading}
            error={entries.error}
            onRetry={entries.reload}
            page={pg.page}
            pageSize={pg.pageSize}
            total={entries.data?.count || 0}
            onPageChange={pg.setPage}
          />
        </section>
      </div>
      <UserFormModal open={editing} user={u} onClose={() => setEditing(false)} onSaved={user.reload} />
      <ConfirmationDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={run}
        loading={busy}
        title={confirm === 'delete' ? 'Delete user permanently?' : u.status === 'active' ? 'Suspend this account?' : 'Activate this account?'}
        message={confirm === 'delete' ? 'This removes the account, profile and entries. It cannot be undone. Users with deposit records cannot be deleted; suspend them instead.' : 'This change is recorded in the activity log.'}
        confirmText={confirm === 'delete' ? 'DELETE' : undefined}
        tone={confirm === 'delete' || u.status === 'active' ? 'danger' : 'navy'}
        confirmLabel={confirm === 'delete' ? 'Delete user' : 'Confirm'}
      />
    </>
  )
}
