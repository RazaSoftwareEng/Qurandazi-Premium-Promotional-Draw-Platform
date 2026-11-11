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
      'Promotional campaigns with transparent, independently verifiable draws. Your deposit is refundable, never a fee.',
    announcement: '',
  },
  social: { facebook: '', instagram: '', x: '', youtube: '' },
  deposit_terms: {
    version: 'v1',
    allow_early_withdrawal: false,
    wallet_providers: 'EasyPaisa / JazzCash / NayaPay / SadaPay',
    wallet_number: '03003209005',
    bank_name: '',
    account_title: '',
    account_number: '',
    iban: '',
    gateway_instructions: '',
    terms_text: [
      "Your deposit is not a fee. It is held in the company's account and returned to you in full, as set out in these terms.",
      'The deposit stays locked for the lock-in period shown for its category. After that you can request a withdrawal from your dashboard at any time.',
      'While your deposit is verified and active, you can join campaigns in its category and in any lower category.',
      'If you withdraw your deposit before a campaign closes, your entry in that campaign is automatically excluded from its draw.',
      'Refunds are paid to the account you provide, and the payout transaction ID is recorded on your deposit.',
    ].join('\n'),
  },
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
