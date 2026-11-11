import { supabase, unwrap } from './supabase'

export const DEFAULT_SETTINGS = {
  branding: { site_name: 'QURANDAZI', tagline: 'Your Chance. Your Moment.', logo_url: null },
  contact: {
    email: 'support@qurandazi.example',
    phone: '+92 300 0000000',
    address: 'Karachi, Pakistan',
    hours: 'Mon–Fri, 10:00–18:00 PKT',
  },
  homepage: {
    hero_title: 'Your Chance. Your Moment.',
    hero_subtitle:
      'Free-entry promotional campaigns with transparent, independently verifiable draws. No purchase. No deposit. Just your moment.',
    announcement: '',
  },
  social: { facebook: '', instagram: '', x: '', youtube: '' },
}

export const settingsService = {
  async getAll() {
    const rows = unwrap(await supabase.from('site_settings').select('key, value'))
    const map = structuredClone(DEFAULT_SETTINGS)
    for (const r of rows) map[r.key] = { ...(map[r.key] || {}), ...(r.value || {}) }
    return map
  },

  async save(key, value) {
    return unwrap(await supabase.from('site_settings').upsert({ key, value }, { onConflict: 'key' }).select().single())
  },

  async submitContact(values) {
    return unwrap(
      await supabase.from('contact_messages').insert({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        subject: values.subject.trim(),
        message: values.message.trim(),
      }),
    )
  },
}
