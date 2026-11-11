import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, FormInput, ImageUpload, TextArea, Toggle } from '@/components/ui'
import PageHeader from '@/components/layout/PageHeader'
import { useSettings } from '@/context/SettingsContext'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { settingsService } from '@/services/settingsService'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'
import { ChangePasswordCard, SecurityCard } from '../user/AccountSettings'

const TABS = [
  { id: 'branding', label: 'Branding' },
  { id: 'contact', label: 'Contact information' },
  { id: 'homepage', label: 'Website content' },
  { id: 'social', label: 'Social links' },
  { id: 'deposit_terms', label: 'Deposits & payments' },
  { id: 'account', label: 'Admin account' },
]

const FIELDS = {
  branding: [
    { key: 'site_name', label: 'Site name', placeholder: 'QURANDAZI', validators: [rules.required(), rules.max(40)] },
    { key: 'tagline', label: 'Tagline', placeholder: 'Your Chance. Your Moment.', validators: [rules.max(80)] },
    { key: 'logo_url', label: 'Logo', type: 'image' },
  ],
  contact: [
    { key: 'email', label: 'Support email', placeholder: 'support@yourdomain.com', validators: [rules.required(), rules.email()] },
    { key: 'phone', label: 'Phone', placeholder: '+92 300 1234567', validators: [rules.phone()] },
    { key: 'address', label: 'Address', placeholder: 'Office address, city', validators: [rules.max(200)] },
    { key: 'hours', label: 'Support hours', placeholder: 'Mon–Fri, 10:00–18:00 PKT', validators: [rules.max(80)] },
  ],
  homepage: [
    { key: 'hero_title', label: 'Hero headline', placeholder: 'Your Chance. Your Moment.', help: 'Use a full stop to split the headline into two lines, e.g. “Your Chance. Your Moment.”', validators: [rules.required(), rules.max(80)] },
    { key: 'hero_subtitle', label: 'Hero subtitle', placeholder: 'Short description under the headline…', type: 'textarea', validators: [rules.max(300)] },
    { key: 'announcement', label: 'Announcement banner (optional)', placeholder: 'e.g. New Grande campaign now open!', validators: [rules.max(140)] },
  ],
  deposit_terms: [
    { key: 'version', label: 'Terms version', placeholder: 'v1', help: 'Recorded on every new deposit. Change it (e.g. v2) whenever you change the terms below.', validators: [rules.required(), rules.max(20)] },
    { key: 'allow_early_withdrawal', label: 'Allow withdrawal before the lock-in period ends', description: 'If on, members can request a refund at any time.', type: 'toggle' },
    { key: 'wallet_providers', label: 'Mobile wallets accepted', placeholder: 'EasyPaisa / JazzCash / NayaPay / SadaPay', validators: [rules.max(120)] },
    { key: 'wallet_number', label: 'Wallet account number', placeholder: '03003209005', help: 'Shown to members as the number to send their deposit to.', validators: [(v) => (!v || /^03\d{9}$/.test(String(v).replace(/[\s-]/g, '')) ? null : 'Enter an 11-digit mobile number, e.g. 03003209005')] },
    { key: 'bank_name', label: 'Bank name', placeholder: 'e.g. Meezan Bank', validators: [rules.max(80)] },
    { key: 'account_title', label: 'Account title (company name)', placeholder: 'e.g. Qurandazi (Pvt) Ltd', validators: [rules.max(120)] },
    { key: 'account_number', label: 'Account number', validators: [rules.max(40)] },
    { key: 'iban', label: 'IBAN', placeholder: 'PK00XXXX0000000000000000', validators: [(v) => (!v || /^PK\d{2}[A-Z]{4}\d{16}$/.test(String(v).replace(/\s/g, '').toUpperCase()) ? null : 'Enter a valid Pakistani IBAN (24 characters)')] },
    { key: 'gateway_instructions', label: 'Payment gateway instructions (optional)', type: 'textarea', placeholder: 'e.g. Pay via our JazzCash merchant account "Qurandazi (Pvt) Ltd"…', validators: [rules.max(1000)] },
    { key: 'terms_text', label: 'Deposit & refund terms (one point per line)', type: 'textarea', rows: 8, help: 'Shown to members before they pay. Say clearly that the deposit is not a fee, and include the refund rules.', validators: [rules.required(), rules.max(4000)] },
  ],
  social: ['facebook', 'instagram', 'x', 'youtube'].map((k) => ({
    key: k,
    label: k === 'x' ? 'X (Twitter)' : k[0].toUpperCase() + k.slice(1),
    validators: [(v) => (!v || /^https:\/\//.test(v) ? null : 'Must start with https://')],
  })),
}

function SettingsForm({ section }) {
  const { settings, reload } = useSettings()
  const [values, setValues] = useState(settings[section] || {})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(settings[section] || {})
  }, [settings, section])

  const submit = async (e) => {
    e.preventDefault()
    const schema = Object.fromEntries(FIELDS[section].filter((f) => f.validators).map((f) => [f.key, f.validators]))
    const errs = validate(schema, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))
      await settingsService.save(section, clean)
      await reload()
      toast.success('Settings saved')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card max-w-3xl space-y-5 p-6">
      {FIELDS[section].map((f) =>
        f.type === 'image' ? (
          <ImageUpload key={f.key} label={f.label} value={values[f.key]} onChange={(url) => setValues((v) => ({ ...v, [f.key]: url }))} folder="branding" aspect="aspect-[4/1]" />
        ) : f.type === 'toggle' ? (
          <Toggle key={f.key} label={f.label} description={f.description} checked={Boolean(values[f.key])} onChange={(on) => setValues((v) => ({ ...v, [f.key]: on }))} />
        ) : f.type === 'textarea' ? (
          <TextArea key={f.key} label={f.label} placeholder={f.placeholder} rows={f.rows || 3} value={values[f.key] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} error={errors[f.key]} help={f.help} />
        ) : (
          <FormInput key={f.key} label={f.label} placeholder={f.placeholder} value={values[f.key] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} error={errors[f.key]} help={f.help} />
        ),
      )}
      <Button type="submit" icon={Save} loading={saving}>Save changes</Button>
    </form>
  )
}

export default function Settings() {
  useDocumentTitle('System Settings')
  const [tab, setTab] = useState('branding')
  return (
    <>
      <PageHeader title="System Settings" description="Website branding, contact details, content, deposit terms and your administrator account." />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-ivory-300 scrollbar-thin" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === t.id ? 'border-gold-500 text-navy-900' : 'border-transparent text-ink-muted hover:text-navy-900'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'account' ? (
        <div className="grid gap-6 lg:grid-cols-2"><ChangePasswordCard /><SecurityCard /></div>
      ) : (
        <SettingsForm key={tab} section={tab} />
      )}
    </>
  )
}
