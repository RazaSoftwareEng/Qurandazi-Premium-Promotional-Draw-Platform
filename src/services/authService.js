import { supabase, unwrap, SITE_URL } from './supabase'

export const authService = {
  async signUp({ email, password, full_name, phone }) {
    return unwrap(
      await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: full_name.trim(), phone: phone?.trim() || null },
          emailRedirectTo: `${SITE_URL}/auth/callback`,
        },
      }),
    )
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

  async resendVerification(email) {
    return unwrap(
      await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
      }),
    )
  },

  async signOutEverywhere() {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) throw error
  },
}
