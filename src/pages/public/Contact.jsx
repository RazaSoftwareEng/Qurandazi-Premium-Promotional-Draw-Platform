import { useState } from 'react'
import { CheckCircle2, Clock, Mail, MapPin, Phone, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, FormInput, TextArea } from '@/components/ui'
import { PublicHero } from '@/components/layout/PageHeader'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLiveValidation } from '@/hooks/useLiveValidation'
import { useSettings } from '@/context/SettingsContext'
import { settingsService } from '@/services/settingsService'
import { rules, validate } from '@/utils/validation'
import { getErrorMessage } from '@/utils/errors'

const EMPTY = { name: '', email: '', subject: '', message: '' }
const SCHEMA = {
  name: [rules.required(), rules.min(2), rules.max(120)],
  email: [rules.required(), rules.email()],
  subject: [rules.required(), rules.min(2), rules.max(200)],
  message: [rules.required(), rules.min(10, 'Please write at least 10 characters'), rules.max(5000)],
}

export default function Contact() {
  useDocumentTitle('Contact Us')
  const { settings } = useSettings()
  const c = settings.contact
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }))
  useLiveValidation(SCHEMA, values, errors, setErrors)

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(SCHEMA, values)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSending(true)
    try {
      await settingsService.submitContact(values)
      setSent(true)
      setValues(EMPTY)
      toast.success('Message sent')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const info = [
    [Mail, 'Email', c.email, `mailto:${c.email}`],
    [Phone, 'Phone', c.phone, `tel:${c.phone?.replace(/\s/g, '')}`],
    [MapPin, 'Office', c.address],
    [Clock, 'Hours', c.hours],
  ]

  return (
    <>
      <PublicHero eyebrow="Contact" title="We’re here to help" subtitle="Questions about a campaign, your account or a published result? Send us a message." />
      <section className="container-page grid gap-8 py-14 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          {info.map(([Icon, label, value, href]) => (
            <div key={label} className="card flex items-start gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-gold-400"><Icon className="h-5 w-5" /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</p>
                {href ? <a href={href} className="font-semibold text-navy-900 hover:text-gold-700">{value}</a> : <p className="font-semibold text-navy-900">{value}</p>}
              </div>
            </div>
          ))}
          <p className="px-1 text-xs text-ink-muted">QURANDAZI will never ask you for a payment to participate or to claim a reward.</p>
        </div>
        <div className="card p-6 sm:p-8 lg:col-span-8">
          {sent ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="mt-4 text-xl font-bold text-navy-900">Thank you — message received</h2>
              <p className="mt-2 text-ink-muted">Our team usually replies within one business day.</p>
              <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
              <FormInput label="Full name" placeholder="e.g. Ahmed Khan" required value={values.name} onChange={set('name')} error={errors.name} autoComplete="name" />
              <FormInput label="Email" placeholder="you@example.com" type="email" required value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" />
              <FormInput label="Subject" placeholder="What is your message about?" required className="sm:col-span-2" value={values.subject} onChange={set('subject')} error={errors.subject} />
              <TextArea label="Message" placeholder="Write your message (at least 10 characters)…" required rows={6} className="sm:col-span-2" value={values.message} onChange={set('message')} error={errors.message} maxLength={5000} />
              <div className="sm:col-span-2">
                <Button type="submit" icon={Send} loading={sending}>Send message</Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
