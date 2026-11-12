import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Download, Eye, MoreVertical, Pencil, PlayCircle, Trash2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { Avatar, Badge, Button, ConfirmationDialog, DataTable, Dropdown, FormInput, Modal, SearchInput, Select, TextArea } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { useDebounce } from '@/hooks/useDebounce'
import { usePagination } from '@/hooks/usePagination'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { adminService } from '@/services/adminService'
import { downloadCSV } from '@/utils/csv'
import { formatDate, formatDateTime } from '@/utils/format'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

export const ROLE_META = {
  user: { label: 'User', tone: 'neutral' },
  admin: { label: 'Admin', tone: 'info' },
  super_admin: { label: 'Super Admin', tone: 'gold' },
}

export const USER_EXPORT_COLUMNS = [
  { key: 'id', label: 'User ID' },
  { key: 'full_name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'entries_count', label: 'Entries' },
  { key: 'created_at', label: 'Registered at' },
]

/** Create or edit a user. Creation goes through the admin-users Edge Function. */
export function UserFormModal({ open, onClose, user, onSaved }) {
  const { isSuperAdmin } = useAuth()
  const isEdit = Boolean(user)
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)

  if (open && !lastOpen) {
    setLastOpen(true)
    setValues(
      isEdit
        ? { full_name: user.full_name || '', phone: user.phone || '', city: user.city || '', address: user.address || '', role: user.role }
        : { full_name: '', email: '', phone: '', password: '', role: 'user' },
    )
    setErrors({})
  }
  if (!open && lastOpen) setLastOpen(false)

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))
  const schema = {
    full_name: [rules.required('Full name is required'), rules.min(2), rules.max(60), rules.personName()],
    phone: [rules.mobilePK()],
    city: [rules.max(80)],
    address: [rules.max(300)],
    ...(isEdit ? {} : { email: [rules.required('Email is required'), rules.email()], password: [rules.required('Set a temporary password'), rules.password()] }),
  }
  useLiveValidation(schema, values, errors, setErrors)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(schema, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      if (isEdit) {
        await adminService.updateUser(user.id, {
          full_name: values.full_name.trim(),
          phone: values.phone.trim() || null,
          city: values.city.trim() || null,
          address: values.address.trim() || null,
        })
        if (isSuperAdmin && values.role !== user.role) await adminService.setUserRole(user.id, values.role)
        toast.success('User updated')
      } else {
        await adminService.createUser({
          email: values.email.trim(),
          password: values.password,
          full_name: values.full_name.trim(),
          phone: values.phone.trim() || undefined,
          role: values.role,
        })
        toast.success('User created')
      }
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'Add user'}
      description={isEdit ? user.email : 'The account is created with a verified email.'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="user-form" loading={saving}>{isEdit ? 'Save changes' : 'Create user'}</Button></>}
    >
      <form id="user-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormInput label="Full name" maxLength={60} placeholder="e.g. Ahmed Khan" required className="sm:col-span-2" value={values.full_name || ''} onChange={set('full_name')} error={errors.full_name} />
        {!isEdit && <FormInput label="Email" placeholder="user@example.com" type="email" required value={values.email || ''} onChange={set('email')} error={errors.email} />}
        {!isEdit && <FormInput label="Temporary password" placeholder="At least 8 characters, letters & numbers" type="password" required value={values.password || ''} onChange={set('password')} error={errors.password} autoComplete="new-password" />}
        <FormInput label="Phone" placeholder="0300 1234567" type="tel" value={values.phone || ''} onChange={set('phone')} error={errors.phone} />
        {isEdit && <FormInput label="City" maxLength={80} placeholder="e.g. Karachi" value={values.city || ''} onChange={set('city')} />}
        {isEdit && <TextArea label="Address" maxLength={300} placeholder="House / street, area, city" rows={2} className="sm:col-span-2" value={values.address || ''} onChange={set('address')} />}
        <Select
          label="Role"
          value={values.role || 'user'}
          onChange={set('role')}
          disabled={!isSuperAdmin}
          help={isSuperAdmin ? 'Role changes are logged.' : 'Only a Super Admin can assign roles.'}
          options={Object.entries(ROLE_META).map(([value, m]) => ({ value, label: m.label }))}
        />
      </form>
    </Modal>
  )
}

export default function Users() {
  useDocumentTitle('User Management')
  const navigate = useNavigate()
  const { user: me } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const [form, setForm] = useState({ open: false, user: null })
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const q = useDebounce(search)
  const pg = usePagination(10)
  const filters = { search: q, status, role }
  const { data, loading, error, reload } = useAsync(() => adminService.listUsers(filters, pg), [q, status, role, pg.from])

  const runConfirm = async () => {
    setBusy(true)
    try {
      if (confirm.type === 'delete') {
        await adminService.deleteUser(confirm.user.id)
        toast.success('User deleted')
      } else {
        const next = confirm.user.status === 'active' ? 'suspended' : 'active'
        await adminService.setUserStatus(confirm.user.id, next)
        toast.success(next === 'active' ? 'Account activated' : 'Account suspended')
      }
      setConfirm(null)
      reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = await adminService.exportUsers(filters)
      downloadCSV(`qurandazi-users-${new Date().toISOString().slice(0, 10)}`, rows, USER_EXPORT_COLUMNS)
      adminService.logEvent('report.export_users', 'profiles', { rows: rows.length, filters })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'user', header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar src={u.avatar_url} name={u.full_name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy-900">{u.full_name || '—'}</p>
            <p className="truncate text-xs text-ink-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (u) => u.phone || '—', hideOnMobile: true },
    { key: 'role', header: 'Role', render: (u) => <Badge tone={ROLE_META[u.role]?.tone}>{ROLE_META[u.role]?.label}</Badge> },
    { key: 'status', header: 'Status', render: (u) => <Badge tone={u.status === 'active' ? 'success' : 'danger'} dot>{u.status}</Badge> },
    { key: 'entries_count', header: 'Entries', hideOnMobile: true },
    { key: 'created_at', header: 'Registered', render: (u) => <span title={formatDateTime(u.created_at)}>{formatDate(u.created_at)}</span> },
    {
      key: 'actions', header: '', className: 'w-12 text-right',
      render: (u) => (
        <Dropdown
          trigger={<MoreVertical className="h-4 w-4" />}
          label={`Actions for ${u.full_name || u.email}`}
          items={[
            { label: 'View details', icon: Eye, onClick: () => navigate(`/admin/users/${u.id}`) },
            { label: 'Edit user', icon: Pencil, onClick: () => setForm({ open: true, user: u }) },
            { label: u.status === 'active' ? 'Suspend account' : 'Activate account', icon: u.status === 'active' ? Ban : PlayCircle, onClick: () => setConfirm({ type: 'status', user: u }), hidden: u.id === me.id },
            { divider: true, hidden: u.id === me.id },
            { label: 'Delete user', icon: Trash2, danger: true, onClick: () => setConfirm({ type: 'delete', user: u }), hidden: u.id === me.id },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage member accounts, roles and access."
        actions={<>
          <Button variant="outline" icon={Download} onClick={exportCsv} loading={exporting}>Export CSV</Button>
          <Button icon={UserPlus} onClick={() => setForm({ open: true, user: null })}>Add user</Button>
        </>}
      />
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
        onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
        toolbar={
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <SearchInput value={search} onChange={(v) => { setSearch(v); pg.reset() }} placeholder="Search name, email or phone…" />
            <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); pg.reset() }} placeholder="All statuses" options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
            <Select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); pg.reset() }} placeholder="All roles" options={Object.entries(ROLE_META).map(([value, m]) => ({ value, label: m.label }))} />
          </div>
        }
      />
      <UserFormModal open={form.open} user={form.user} onClose={() => setForm({ open: false, user: null })} onSaved={reload} />
      <ConfirmationDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        loading={busy}
        tone={confirm?.type === 'delete' || confirm?.user?.status === 'active' ? 'danger' : 'navy'}
        title={confirm?.type === 'delete' ? 'Delete user permanently?' : confirm?.user?.status === 'active' ? 'Suspend this account?' : 'Activate this account?'}
        message={
          confirm?.type === 'delete'
            ? <>This permanently deletes <strong>{confirm.user.email}</strong>, their profile and entries. Users with draw results cannot be deleted — suspend them instead.</>
            : confirm?.user?.status === 'active'
              ? 'Suspended users cannot join campaigns and are excluded from future draw snapshots.'
              : 'The user will regain full access to their account.'
        }
        confirmText={confirm?.type === 'delete' ? 'DELETE' : undefined}
        confirmLabel={confirm?.type === 'delete' ? 'Delete user' : confirm?.user?.status === 'active' ? 'Suspend' : 'Activate'}
      />
    </>
  )
}
