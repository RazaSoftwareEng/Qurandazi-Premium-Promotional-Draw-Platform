// QURANDAZI — admin-users Edge Function
// Privileged user operations that require the Supabase service-role key.
// The service-role key is injected by Supabase at runtime and never reaches the browser.
//
// Actions (POST JSON):
//   { action: "create", email, password, full_name, phone?, role? }
//   { action: "delete", user_id }
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ROLES = ['user', 'admin', 'super_admin']

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // 1. Identify the caller from their JWT
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const caller = userData.user

    // 2. Verify the caller's role server-side
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const { data: callerRow } = await admin
      .from('user_roles')
      .select('role, profiles!inner(status, full_name, email)')
      .eq('user_id', caller.id)
      .single()
    const callerRole = callerRow?.role as string | undefined
    // deno-lint-ignore no-explicit-any
    const callerProfile = (callerRow as any)?.profiles
    if (!callerRole || !['admin', 'super_admin'].includes(callerRole) || callerProfile?.status !== 'active') {
      return json({ error: 'Forbidden' }, 403)
    }

    const log = (action: string, entityId: string | null, details: Record<string, unknown>) =>
      admin.from('admin_activity_logs').insert({
        admin_id: caller.id,
        admin_name: callerProfile?.full_name ?? null,
        admin_email: callerProfile?.email ?? caller.email,
        action,
        entity_type: 'profiles',
        entity_id: entityId,
        details,
      })

    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '')

    // ---------------- create ----------------
    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const fullName = String(body.full_name ?? '').trim().slice(0, 120)
      const phone = body.phone ? String(body.phone).trim().slice(0, 20) : undefined
      const role = String(body.role ?? 'user')

      if (!EMAIL_RE.test(email)) return json({ error: 'A valid email is required' }, 400)
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
      if (fullName.length < 2) return json({ error: 'Full name is required' }, 400)
      if (!ROLES.includes(role)) return json({ error: 'Invalid role' }, 400)
      if (role !== 'user' && callerRole !== 'super_admin') {
        return json({ error: 'Only a Super Admin can create staff accounts' }, 403)
      }

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      })
      if (error) return json({ error: error.message }, 400)

      if (role !== 'user') {
        await admin
          .from('user_roles')
          .update({ role, assigned_by: caller.id, assigned_at: new Date().toISOString() })
          .eq('user_id', data.user.id)
      }
      await log('user.create', data.user.id, { email, role })
      return json({ id: data.user.id })
    }

    // ---------------- delete ----------------
    if (action === 'delete') {
      const userId = String(body.user_id ?? '')
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Invalid user id' }, 400)
      if (userId === caller.id) return json({ error: 'You cannot delete your own account' }, 400)

      const { data: target } = await admin
        .from('user_roles')
        .select('role, profiles!inner(email, full_name)')
        .eq('user_id', userId)
        .single()
      if (!target) return json({ error: 'User not found' }, 404)
      if (target.role !== 'user' && callerRole !== 'super_admin') {
        return json({ error: 'Only a Super Admin can delete staff accounts' }, 403)
      }

      // Winners are retained for audit integrity — suspend instead.
      const { count } = await admin
        .from('draw_results')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if ((count ?? 0) > 0) {
        return json({ error: 'This user has draw results on record. Suspend the account instead of deleting it.' }, 409)
      }

      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) return json({ error: error.message }, 400)
      // deno-lint-ignore no-explicit-any
      await log('user.delete', userId, { email: (target as any).profiles?.email, role: target.role })
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
