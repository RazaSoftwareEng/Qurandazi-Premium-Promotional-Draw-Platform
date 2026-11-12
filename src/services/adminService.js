import { supabase, unwrap } from './supabase'

async function invokeAdminUsers(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // Surface the function's JSON error message when available
    let message = error.message
    try {
      const ctx = await error.context?.json?.()
      if (ctx?.error) message = ctx.error
    } catch {
      /* ignore */
    }
    if (/Failed to send a request/i.test(message)) {
      message = 'The admin-users server function is not deployed or not reachable. Deploy it in Supabase -> Edge Functions (slug: admin-users).'
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export const adminService = {
  // ---------------- Analytics ----------------
  stats: async () => unwrap(await supabase.rpc('admin_dashboard_stats')),
  timeseries: async (days = 30) => unwrap(await supabase.rpc('admin_timeseries', { p_days: days })),

  async recentRegistrations(limit = 6) {
    return unwrap(
      await supabase.from('profiles').select('id, full_name, email, avatar_url, created_at, status').order('created_at', { ascending: false }).limit(limit),
    )
  },

  async topCampaigns(limit = 6) {
    return unwrap(
      await supabase.from('campaigns').select('id, title, entries_count, status').neq('status', 'draft').order('entries_count', { ascending: false }).limit(limit),
    )
  },

  // ---------------- Users ----------------
  buildUsersQuery({ search, status, role } = {}) {
    let q = supabase
      .from('profiles')
      .select(`*, user_roles${role ? '!inner' : ''}(role), entries(count)`, { count: 'exact' })
    if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    if (status) q = q.eq('status', status)
    if (role) q = q.eq('user_roles.role', role)
    return q
  },

  async listUsers(filters = {}, { from = 0, to = 9 } = {}) {
    const res = unwrap(await this.buildUsersQuery(filters).order('created_at', { ascending: false }).range(from, to))
    res.data = res.data.map(normalizeUser)
    return res
  },

  async exportUsers(filters = {}) {
    const rows = []
    for (let from = 0; ; from += 1000) {
      const { data } = unwrap(await this.buildUsersQuery(filters).order('created_at').range(from, from + 999))
      rows.push(...data.map(normalizeUser))
      if (data.length < 1000) break
    }
    return rows
  },

  async getUser(id) {
    const row = unwrap(await supabase.from('profiles').select('*, user_roles(role), entries(count)').eq('id', id).single())
    return normalizeUser(row)
  },

  async updateUser(id, patch) {
    const allowed = (({ full_name, phone, address, city, status }) => ({ full_name, phone, address, city, status }))(patch)
    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k])
    return unwrap(await supabase.from('profiles').update(allowed).eq('id', id).select().single())
  },

  setUserStatus: async (id, status) =>
    unwrap(await supabase.from('profiles').update({ status }).eq('id', id).select().single()),

  setUserRole: async (id, role) => unwrap(await supabase.rpc('admin_set_user_role', { p_user_id: id, p_role: role })),

  createUser: (payload) => invokeAdminUsers({ action: 'create', ...payload }),
  // Database function: works without the admin-users Edge Function being deployed
  deleteUser: async (userId) => unwrap(await supabase.rpc('admin_delete_user', { p_user_id: userId })),

  // ---------------- Logs ----------------
  async logs({ search, action, from = 0, to = 19 } = {}) {
    let q = supabase.from('admin_activity_logs').select('*', { count: 'exact' })
    if (action) q = q.ilike('action', `${action}%`)
    if (search) q = q.or(`admin_name.ilike.%${search}%,admin_email.ilike.%${search}%,action.ilike.%${search}%,entity_id.ilike.%${search}%`)
    return unwrap(await q.order('created_at', { ascending: false }).range(from, to))
  },

  async recentLogs(limit = 6) {
    return unwrap(await supabase.from('admin_activity_logs').select('*').order('created_at', { ascending: false }).limit(limit))
  },

  logEvent: async (action, entityType, details = {}) => {
    try {
      await supabase.rpc('log_client_admin_event', { p_action: action, p_entity_type: entityType, p_details: details })
    } catch {
      /* logging must never block the user */
    }
  },

  // ---------------- Announcements ----------------
  async announcements({ from = 0, to = 9 } = {}) {
    return unwrap(
      await supabase
        .from('announcements')
        .select('*, campaign:campaigns(id, title)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to),
    )
  },

  sendAnnouncement: async ({ title, body, type, audience, campaign_id, link }) =>
    unwrap(
      await supabase.rpc('send_announcement', {
        p_title: title,
        p_body: body,
        p_type: type,
        p_audience: audience,
        p_campaign_id: audience === 'campaign' ? campaign_id : null,
        p_link: link || null,
      }),
    ),

  // ---------------- Contact messages ----------------
  async messages({ status, from = 0, to = 9 } = {}) {
    let q = supabase.from('contact_messages').select('*', { count: 'exact' })
    if (status) q = q.eq('status', status)
    return unwrap(await q.order('created_at', { ascending: false }).range(from, to))
  },
  setMessageStatus: async (id, status) => unwrap(await supabase.from('contact_messages').update({ status }).eq('id', id)),
  deleteMessage: async (id) => unwrap(await supabase.from('contact_messages').delete().eq('id', id)),
}

function normalizeUser(u) {
  const roleRow = Array.isArray(u.user_roles) ? u.user_roles[0] : u.user_roles
  return { ...u, role: roleRow?.role || 'user', entries_count: u.entries?.[0]?.count ?? 0 }
}
