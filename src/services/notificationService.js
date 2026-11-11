import { supabase, unwrap } from './supabase'

export const notificationService = {
  async list({ userId, type, unreadOnly, from = 0, to = 9 } = {}) {
    let q = supabase.from('notifications').select('*', { count: 'exact' }).eq('user_id', userId)
    if (type) q = q.eq('type', type)
    if (unreadOnly) q = q.is('read_at', null)
    return unwrap(await q.order('created_at', { ascending: false }).range(from, to))
  },

  async unreadCount(userId) {
    const { count } = unwrap(
      await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
    )
    return count || 0
  },

  async markRead(id, read = true) {
    return unwrap(await supabase.from('notifications').update({ read_at: read ? new Date().toISOString() : null }).eq('id', id))
  },

  async markAllRead(userId) {
    return unwrap(
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null),
    )
  },

  async remove(id) {
    return unwrap(await supabase.from('notifications').delete().eq('id', id))
  },
}
