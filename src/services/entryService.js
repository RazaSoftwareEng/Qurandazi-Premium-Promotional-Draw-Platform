import { supabase, unwrap } from './supabase'

export const entryService = {
  async mine({ userId, status, from = 0, to = 9 } = {}) {
    let q = supabase
      .from('entries')
      .select('id, reference, status, status_note, created_at, campaign:campaigns(id, title, slug, status, start_date, end_date, draw_date)', {
        count: 'exact',
      })
      .eq('user_id', userId)
    if (status) q = q.eq('status', status)
    return unwrap(await q.order('created_at', { ascending: false }).range(from, to))
  },

  async myRecent(userId, limit = 5) {
    return unwrap(
      await supabase
        .from('entries')
        .select('id, reference, status, created_at, campaign:campaigns(id, title, slug, status, start_date, end_date)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
    )
  },

  async myCampaignIds(userId) {
    const rows = unwrap(await supabase.from('entries').select('campaign_id').eq('user_id', userId))
    return new Set(rows.map((r) => r.campaign_id))
  },

  // ---------------- Admin ----------------
  buildAdminQuery({ search, campaignId, status, userId } = {}, select) {
    const s = search?.trim()
    const joinProfiles = s && !/^QZ-/i.test(s)
    let q = supabase
      .from('entries')
      .select(
        select ||
          `id, reference, status, status_note, created_at, verified_at, user_id,
           profile:profiles${joinProfiles ? '!inner' : ''}(id, full_name, email, phone, city, status, email_confirmed_at),
           campaign:campaigns(id, title, slug, end_date)`,
        { count: 'exact' },
      )
    if (campaignId) q = q.eq('campaign_id', campaignId)
    if (status) q = q.eq('status', status)
    if (userId) q = q.eq('user_id', userId)
    if (s) {
      if (/^QZ-/i.test(s)) q = q.ilike('reference', `%${s}%`)
      else q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`, { referencedTable: 'profiles' })
    }
    return q
  },

  async adminList(filters = {}, { from = 0, to = 9 } = {}) {
    return unwrap(await this.buildAdminQuery(filters).order('created_at', { ascending: false }).range(from, to))
  },

  async adminExport(filters = {}) {
    const rows = []
    for (let from = 0; ; from += 1000) {
      const { data } = unwrap(
        await this.buildAdminQuery(filters).order('created_at', { ascending: true }).range(from, from + 999),
      )
      rows.push(...data)
      if (data.length < 1000) break
    }
    return rows
  },

  async setStatus(entryId, status, note) {
    return unwrap(await supabase.rpc('admin_set_entry_status', { p_entry_id: entryId, p_status: status, p_note: note || null }))
  },
}
