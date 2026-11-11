import { supabase, unwrap } from './supabase'

export const categoryService = {
  async list({ includeInactive = false } = {}) {
    let q = supabase.from('categories').select('*, campaigns(count)').order('sort_order').order('name')
    if (!includeInactive) q = q.eq('is_active', true)
    const rows = unwrap(await q)
    return rows.map((r) => ({ ...r, campaigns_count: r.campaigns?.[0]?.count ?? 0 }))
  },

  async create(values) {
    return unwrap(await supabase.from('categories').insert(values).select().single())
  },

  async update(id, values) {
    return unwrap(await supabase.from('categories').update(values).eq('id', id).select().single())
  },

  async remove(id) {
    return unwrap(await supabase.from('categories').delete().eq('id', id))
  },
}
