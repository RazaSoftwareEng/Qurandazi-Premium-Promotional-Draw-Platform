import { supabase, unwrap } from './supabase'
import { storageService } from './storageService'

export const profileService = {
  async getMine(userId) {
    const profile = unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
    const roleRow = unwrap(await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle())
    return { profile, role: roleRow?.role || 'user' }
  },

  async updateMine(userId, patch) {
    const allowed = (({ full_name, phone, address, city, avatar_url }) => ({ full_name, phone, address, city, avatar_url }))(patch)
    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k])
    return unwrap(await supabase.from('profiles').update(allowed).eq('id', userId).select().single())
  },

  async uploadAvatar(userId, file) {
    return storageService.uploadImage('avatars', userId, file, 2)
  },
}
