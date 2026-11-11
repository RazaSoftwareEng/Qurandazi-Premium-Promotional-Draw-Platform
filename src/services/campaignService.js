import { supabase, unwrap } from './supabase'

const PUBLIC_FIELDS =
  'id, title, slug, summary, banner_url, prize_description, start_date, end_date, draw_date, status, is_featured, winners_count, entries_count, eligibility_summary, category:categories(id, name, slug, deposit_amount)'

function applyPhase(q, phase) {
  const now = new Date().toISOString()
  switch (phase) {
    case 'open':
      return q.eq('status', 'active').lte('start_date', now).gt('end_date', now)
    case 'upcoming':
      return q.or(`status.eq.upcoming,and(status.eq.active,start_date.gt.${now})`)
    case 'closed':
      return q.or(`status.in.(closed,completed),and(status.eq.active,end_date.lte.${now})`)
    case 'live':
      // open + upcoming (default public listing)
      return q.or(`status.eq.upcoming,and(status.eq.active,end_date.gt.${now})`)
    default:
      return q
  }
}

export const campaignService = {
  async listPublic({ categoryId, phase = 'live', search, from = 0, to = 11 } = {}) {
    let q = supabase
      .from('campaigns')
      .select(PUBLIC_FIELDS, { count: 'exact' })
      .neq('status', 'draft')
      .neq('status', 'cancelled')
    if (categoryId) q = q.eq('category_id', categoryId)
    if (search) q = q.ilike('title', `%${search}%`)
    q = applyPhase(q, phase)
    return unwrap(await q.order('is_featured', { ascending: false }).order('end_date').range(from, to))
  },

  async featured(limit = 3) {
    const now = new Date().toISOString()
    const rows = unwrap(
      await supabase
        .from('campaigns')
        .select(PUBLIC_FIELDS)
        .or(`status.eq.upcoming,and(status.eq.active,end_date.gt.${now})`)
        .order('is_featured', { ascending: false })
        .order('end_date')
        .limit(limit),
    )
    return rows
  },

  async getBySlug(slug) {
    return unwrap(
      await supabase
        .from('campaigns')
        .select('*, category:categories(id, name, slug, reference_amount, reference_label, deposit_amount, deposit_lock_in_days), eligibility_rules(*)')
        .eq('slug', slug)
        .maybeSingle(),
    )
  },

  async checkEligibility(campaignId) {
    return unwrap(await supabase.rpc('check_campaign_eligibility', { p_campaign_id: campaignId }))
  },

  async join(campaignId) {
    return unwrap(await supabase.rpc('join_campaign', { p_campaign_id: campaignId }))
  },

  // ---------------- Admin ----------------
  async adminList({ search, status, categoryId, from = 0, to = 9 } = {}) {
    let q = supabase
      .from('campaigns')
      .select('*, category:categories(id, name), eligibility_rules(id, rule_type, rule_value, description)', {
        count: 'exact',
      })
    if (search) q = q.ilike('title', `%${search}%`)
    if (status) q = q.eq('status', status)
    if (categoryId) q = q.eq('category_id', categoryId)
    return unwrap(await q.order('created_at', { ascending: false }).range(from, to))
  },

  async adminOptions() {
    return unwrap(
      await supabase.from('campaigns').select('id, title, status, end_date, winners_count').order('created_at', { ascending: false }),
    )
  },

  async create(values, rules = []) {
    const row = unwrap(await supabase.from('campaigns').insert(values).select().single())
    await this.saveRules(row.id, rules)
    return row
  },

  async update(id, values, rules) {
    const row = unwrap(await supabase.from('campaigns').update(values).eq('id', id).select().single())
    if (rules) await this.saveRules(id, rules)
    return row
  },

  async saveRules(campaignId, rules) {
    const existing = unwrap(await supabase.from('eligibility_rules').select('id, rule_type').eq('campaign_id', campaignId))
    const keep = new Set(rules.map((r) => r.rule_type))
    const toDelete = existing.filter((r) => !keep.has(r.rule_type)).map((r) => r.id)
    if (toDelete.length) unwrap(await supabase.from('eligibility_rules').delete().in('id', toDelete))
    if (rules.length) {
      unwrap(
        await supabase.from('eligibility_rules').upsert(
          rules.map((r) => ({
            campaign_id: campaignId,
            rule_type: r.rule_type,
            rule_value: r.rule_value || null,
            description: r.description || null,
          })),
          { onConflict: 'campaign_id,rule_type' },
        ),
      )
    }
  },

  async setStatus(id, status) {
    return unwrap(await supabase.from('campaigns').update({ status }).eq('id', id).select().single())
  },

  async remove(id) {
    return unwrap(await supabase.from('campaigns').delete().eq('id', id))
  },
}
