import { supabase, unwrap, SITE_URL } from './supabase'

// Slug of the sign-up Edge Function (Dashboard -> Edge Functions -> URL ends with /functions/<slug>)
const REGISTER_FUNCTION = import.meta.env.VITE_REGISTER_FUNCTION || 'register'

export const authService = {
  /**
   * Creates the account through the `register` Edge Function, which confirms the
   * email server-side so Supabase never sends a sign-up email (no email rate limit).
   * Falls back to the standard client sign-up only if the function is not deployed.
   */
  async signUp({ email, password, full_name, phone }) {
    const payload = {
      email: email.trim().toLowerCase(),
      password,
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
    }
    const { data, error } = await supabase.functions.invoke(REGISTER_FUNCTION, { body: payload })
    if (!error) {
      if (data?.error) throw new Error(data.error)
      return { user: { id: data?.user_id }, session: null }
    }
    const status = error.context?.status
    if (status && status !== 404) {
      let message = error.message
      try {
        const body = await error.context.json()
        if (body?.error) message = body.error
      } catch {
        /* keep generic message */
      }
      throw new Error(message)
    }
    // Function not deployed / unreachable: standard sign-up
    return unwrap(
      await supabase.auth.signUp({
        email: payload.email,
        password,
        options: { data: { full_name: payload.full_name, phone: payload.phone } },
      }),
    )
  },

  /** True if no other account uses this phone number (normalised server-side). */
  async isPhoneAvailable(phone) {
    const { data, error } = await supabase.rpc('is_phone_available', { p_phone: phone })
    if (error) return true // check unavailable (e.g. migration not run yet): let the database decide
    return data !== false
  },

  async signIn({ email, password }) {
    return unwrap(await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }))
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async sendPasswordReset(email) {
    return unwrap(
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${SITE_URL}/reset-password`,
      }),
    )
  },

  async updatePassword(password) {
    return unwrap(await supabase.auth.updateUser({ password }))
  },

  /** Re-authenticates with the current password before changing it. */
  async changePassword({ email, currentPassword, newPassword }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (error) throw new Error('Your current password is incorrect.')
    return unwrap(await supabase.auth.updateUser({ password: newPassword }))
  },

  async signOutEverywhere() {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) throw error
  },
}
