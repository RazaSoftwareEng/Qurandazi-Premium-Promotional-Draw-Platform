import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { Avatar, Badge, Button, FormInput, TextArea } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import KycCard from '@/components/deposit/KycCard'
import { useAuth } from '@/context/AuthContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { profileService } from '@/services/profileService'
import { validateImage } from '@/services/storageService'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'
import { formatDate } from '@/utils/format'

const SCHEMA = {
  full_name: [rules.required('Full name is required'), rules.min(2), rules.max(60), rules.personName()],
  phone: [rules.required('Phone number is required'), rules.mobilePK()],
  address: [rules.max(300)],
  city: [rules.max(80)],
}
const fromProfile = (p) => ({ full_name: p?.full_name || '', phone: p?.phone || '', address: p?.address || '', city: p?.city || '' })

export default function Profile() {
  useDocumentTitle('My Profile')
  const { user, profile, setProfile } = useAuth()
  const [values, setValues] = useState(fromProfile(profile))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const fileRef = useRef(null)
  const nameLocked = ['pending', 'verified'].includes(profile?.kyc_status)

  useEffect(() => {
    if (profile && !editing) setValues(fromProfile(profile))
  }, [profile, editing])

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))
  useLiveValidation(SCHEMA, values, errors, setErrors)

  const save = async (e) => {
    e.preventDefault()
    const errs = validate(SCHEMA, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const updated = await profileService.updateMine(user.id, {
        full_name: values.full_name.trim(),
        phone: values.phone.trim() || null,
        address: values.address.trim() || null,
        city: values.city.trim() || null,
      })
      setProfile(updated)
      setEditing(false)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onAvatar = async (file) => {
    if (!file) return
    const problem = validateImage(file, 2)
    if (problem) return toast.error(problem)
    setUploading(true)
    try {
      const url = await profileService.uploadAvatar(user.id, file)
      setProfile(await profileService.updateMine(user.id, { avatar_url: url }))
      toast.success('Profile image updated')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeAvatar = async () => {
    try {
      setProfile(await profileService.updateMine(user.id, { avatar_url: null }))
      toast.success('Profile image removed')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="My Profile" description="Keep your details up to date and verify your identity — both are required before you can make a deposit." />
      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="card p-6 text-center lg:col-span-4">
          <div className="relative mx-auto w-fit">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size="xl" />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-gold-500 text-navy-900 shadow-md hover:bg-gold-400"
              aria-label="Upload profile image"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-navy-900">{profile?.full_name || 'Unnamed member'}</h2>
          <p className="text-sm text-ink-muted">{user.email}</p>
          <div className="mt-3 flex justify-center gap-2">
            {profile?.kyc_status === 'verified' && <Badge tone="gold" dot>KYC Verified</Badge>}
            <Badge tone={profile?.status === 'active' ? 'info' : 'danger'} dot>{profile?.status}</Badge>
          </div>
          <p className="mt-4 text-xs text-ink-muted">Member since {formatDate(profile?.created_at)}</p>
          {profile?.avatar_url && <Button variant="ghost" size="sm" className="mt-3" onClick={removeAvatar}>Remove image</Button>}
          <p className="mt-2 text-xs text-ink-muted">JPG, PNG or WebP up to 2 MB.</p>
        </aside>

        <form onSubmit={save} noValidate className="card p-6 lg:col-span-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-bold text-navy-900">Personal information</h2>
            {!editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit profile</Button>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormInput label="Full name (as on CNIC)" maxLength={60} placeholder="e.g. Ahmed Khan" required value={values.full_name} onChange={set('full_name')} error={errors.full_name} disabled={!editing || nameLocked} autoComplete="name" help={nameLocked ? 'Locked after CNIC submission. Contact support to change it.' : undefined} />
            <FormInput label="Email" value={user.email} disabled help="Contact support to change your email." />
            <FormInput label="Phone number" required type="tel" placeholder="0300 1234567" value={values.phone} onChange={set('phone')} error={errors.phone} disabled={!editing} autoComplete="tel" />
            <FormInput label="City" maxLength={80} placeholder="e.g. Karachi" value={values.city} onChange={set('city')} error={errors.city} disabled={!editing} autoComplete="address-level2" />
            <TextArea label="Address" placeholder="House / street, area, city" className="sm:col-span-2" rows={3} value={values.address} onChange={set('address')} error={errors.address} disabled={!editing} maxLength={300} />
          </div>
          {editing && (
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditing(false); setErrors({}) }}>Cancel</Button>
              <Button type="submit" icon={Save} loading={saving}>Save changes</Button>
            </div>
          )}
        </form>
        <div className="lg:col-span-12">
          <KycCard />
        </div>
      </div>
    </>
  )
}
