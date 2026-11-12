// QURANDAZI — register Edge Function (public)
//
// Creates a member account server-side with the email already confirmed, so
// Supabase never sends a sign-up email. This avoids the built-in mailer's
// "email rate limit exceeded" error and works whatever the dashboard's
// "Confirm email" setting is. The member then signs in normally.
//
// POST JSON: { full_name, email, phone, password }
// Deploy:    supabase functions deploy register --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
// Self-contained (no shared imports) so it can also be pasted into the
// Supabase Dashboard -> Edge Functions editor.
const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim())
function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = allowed.includes('*') ? '*' : origin && allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const NAME_RE = /^[\p{L}][\p{L} .'-]*$/u

/** Returns "03XXXXXXXXX" for a valid Pakistani mobile number, otherwise null. */
function normalizeMobilePK(v: string): string | null {
  let d = String(v || '').replace(/\D/g, '')
  if (d.startsWith('0092')) d = d.slice(4)
  else if (d.startsWith('92') && d.length === 12) d = d.slice(2)
  if (d.length === 10 && d.startsWith('3')) d = `0${d}`
  return /^03\d{9}$/.test(d) ? d : null
}

// Best-effort abuse protection: max 5 sign-ups per IP per 10 minutes (per instance).
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  list.push(now)
  hits.set(ip, list)
  return list.length > MAX_PER_WINDOW
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return json({ error: 'Too many sign-up attempts. Please wait a few minutes and try again.' }, 429)

  try {
    const body = await req.json().catch(() => ({}))
    const fullName = String(body.full_name ?? '').trim().replace(/\s+/g, ' ')
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const phone = normalizeMobilePK(String(body.phone ?? ''))

    if (fullName.length < 2 || fullName.length > 60 || !NAME_RE.test(fullName)) {
      return json({ error: 'Enter your full name (letters only, up to 60 characters).' }, 400)
    }
    if (!EMAIL_RE.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400)
    if (!phone) return json({ error: 'Enter a valid Pakistani mobile number, e.g. 0300 1234567.' }, 400)
    if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return json({ error: 'Password must be 8–72 characters and include letters and numbers.' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    // Clear duplicate messages before touching auth.users
    const { data: emailTaken } = await admin.from('profiles').select('id').eq('email', email).limit(1)
    if (emailTaken?.length) return json({ error: 'An account with this email already exists. Please sign in instead.' }, 409)
    const { data: phoneFree } = await admin.rpc('is_phone_available', { p_phone: phone })
    if (phoneFree === false) return json({ error: 'This phone number is already registered to another account.' }, 409)

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no confirmation email is sent
      user_metadata: { full_name: fullName, phone },
    })
    if (error) {
      const msg = error.message || ''
      if (/already (been )?registered|already exists/i.test(msg)) {
        return json({ error: 'An account with this email already exists. Please sign in instead.' }, 409)
      }
      if (/phone number is already registered/i.test(msg)) {
        return json({ error: 'This phone number is already registered to another account.' }, 409)
      }
      console.error('register: createUser failed', msg)
      return json({ error: 'We could not create your account. Please try again.' }, 400)
    }

    return json({ ok: true, user_id: data.user?.id })
  } catch (e) {
    console.error('register: unexpected error', e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
