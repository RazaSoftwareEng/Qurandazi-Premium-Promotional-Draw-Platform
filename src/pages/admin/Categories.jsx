import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, ConfirmationDialog, EmptyState, ErrorState, FormInput, ImageUpload, Modal, Skeleton, TextArea, Toggle } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useAsync } from '@/hooks/useAsync'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { categoryService } from '@/services/categoryService'
import { formatPKR, slugify } from '@/utils/format'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

const EMPTY = { name: '', slug: '', tagline: '', description: '', image_url: null, deposit_amount: '', deposit_lock_in_days: 30, sort_order: 0, is_active: true }

const CATEGORY_SCHEMA = {
  name: [rules.required('Category name is required'), rules.max(60)],
  slug: [rules.required('URL slug is required'), rules.slug()],
  tagline: [rules.max(120)],
  description: [rules.max(2000)],
  deposit_amount: [(v) => (v === '' || v === null || (Number(v) >= 0 && !Number.isNaN(Number(v))) ? null : 'Enter a positive number')],
  deposit_lock_in_days: [rules.intRange(0, 3650)],
  sort_order: [rules.intRange(0, 999)],
}

function CategoryForm({ open, onClose, category, onSaved }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)

  if (open && !lastOpen) {
    setLastOpen(true)
    setValues(category ? { ...EMPTY, ...category, deposit_amount: category.deposit_amount ?? '' } : EMPTY)
    setSlugTouched(Boolean(category))
    setErrors({})
  }
  if (!open && lastOpen) setLastOpen(false)

  const set = (k) => (e) => {
    const v = e.target.value
    setValues((s) => ({ ...s, [k]: v, ...(k === 'name' && !slugTouched ? { slug: slugify(v) } : {}) }))
  }

  useLiveValidation(CATEGORY_SCHEMA, values, errors, setErrors)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(CATEGORY_SCHEMA, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    const payload = {
      name: values.name.trim(),
      slug: values.slug,
      tagline: values.tagline?.trim() || null,
      description: values.description?.trim() || null,
      image_url: values.image_url || null,
      deposit_amount: values.deposit_amount === '' ? null : Number(values.deposit_amount),
      deposit_lock_in_days: Number(values.deposit_lock_in_days),
      sort_order: Number(values.sort_order),
      is_active: values.is_active,
    }
    try {
      if (category) await categoryService.update(category.id, payload)
      else await categoryService.create(payload)
      toast.success(category ? 'Category updated' : 'Category created')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={category ? 'Edit category' : 'Add category'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="cat-form" loading={saving}>Save category</Button></>}>
      <form id="cat-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormInput label="Name" placeholder="e.g. Grande" required value={values.name} onChange={set('name')} error={errors.name} />
        <FormInput label="URL slug" placeholder="e.g. grande" required value={values.slug} onChange={(e) => { setSlugTouched(true); set('slug')(e) }} error={errors.slug} />
        <FormInput label="Tagline" placeholder="e.g. Our flagship promotional tier" className="sm:col-span-2" value={values.tagline || ''} onChange={set('tagline')} error={errors.tagline} />
        <TextArea label="Description" placeholder="Describe this category for visitors…" className="sm:col-span-2" rows={3} value={values.description || ''} onChange={set('description')} error={errors.description} maxLength={2000} />
        <FormInput label="Required deposit (PKR)" placeholder="e.g. 20000" type="number" min="0" value={values.deposit_amount} onChange={set('deposit_amount')} error={errors.deposit_amount} help="Refundable deposit needed to join this category's campaigns. A deposit also covers every category with a lower amount. Leave empty for no deposit." />
        <FormInput label="Lock-in period (days)" placeholder="30" type="number" min="0" value={values.deposit_lock_in_days} onChange={set('deposit_lock_in_days')} error={errors.deposit_lock_in_days} help="Applies to new deposits. Existing deposits keep the terms they were made under." />
        <FormInput label="Sort order" placeholder="0" type="number" min="0" value={values.sort_order} onChange={set('sort_order')} error={errors.sort_order} />
        <div className="flex items-end pb-2"><Toggle label="Active" description="Visible on the public website" checked={values.is_active} onChange={(v) => setValues((s) => ({ ...s, is_active: v }))} /></div>
        <div className="sm:col-span-2"><ImageUpload label="Category image" value={values.image_url} onChange={(url) => setValues((s) => ({ ...s, image_url: url }))} folder="categories" /></div>
      </form>
    </Modal>
  )
}

export default function Categories() {
  useDocumentTitle('Categories')
  const { data, loading, error, reload } = useAsync(() => categoryService.list({ includeInactive: true }), [])
  const [form, setForm] = useState({ open: false, category: null })
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      await categoryService.remove(deleting.id)
      toast.success('Category deleted')
      setDeleting(null)
      reload()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Categories" description="Manage categories, their required refundable deposit, lock-in period and campaigns. Changing an amount affects new joins and future freezes, so avoid changing it while campaigns are open." actions={<Button icon={Plus} onClick={() => setForm({ open: true, category: null })}>Add category</Button>} />
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      ) : error ? (
        <div className="card"><ErrorState error={error} onRetry={reload} /></div>
      ) : !data?.length ? (
        <div className="card"><EmptyState icon={Layers} title="No categories yet" action={<Button icon={Plus} onClick={() => setForm({ open: true, category: null })}>Add category</Button>} /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <article key={c.id} className="card flex flex-col overflow-hidden">
              <div className="relative aspect-[16/7] bg-navy-900">
                {c.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" /> : <div className="pattern-stars h-full w-full" />}
                <span className="absolute bottom-3 left-4 font-display text-3xl font-semibold text-white drop-shadow">{c.name}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={c.is_active ? 'success' : 'neutral'} dot>{c.is_active ? 'Active' : 'Hidden'}</Badge>
                  {Number(c.deposit_amount) > 0 ? <Badge tone="gold">Deposit {formatPKR(c.deposit_amount)} · {c.deposit_lock_in_days}d lock-in</Badge> : <Badge tone="neutral">No deposit</Badge>}
                </div>
                <p className="mt-3 line-clamp-3 flex-1 text-sm text-ink-muted">{c.description || 'No description.'}</p>
                <Link to={`/admin/campaigns?category=${c.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-700 hover:underline">
                  <Gift className="h-4 w-4" /> {c.campaigns_count} associated campaign{c.campaigns_count === 1 ? '' : 's'}
                </Link>
                <div className="mt-4 flex gap-2 border-t border-ivory-200 pt-4">
                  <Button variant="outline" size="sm" icon={Pencil} onClick={() => setForm({ open: true, category: c })}>Edit</Button>
                  <Button variant="ghost" size="sm" icon={Trash2} className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(c)}>Delete</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <CategoryForm open={form.open} category={form.category} onClose={() => setForm({ open: false, category: null })} onSaved={reload} />
      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title={`Delete “${deleting?.name}”?`}
        message={deleting?.campaigns_count ? `This category has ${deleting.campaigns_count} campaign(s). Reassign them before deleting, or hide the category instead.` : 'This cannot be undone.'}
        confirmLabel="Delete category"
      />
    </>
  )
}
