import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import { profileService } from '@/services/profileService'
import { authService } from '@/services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null)
      setRole(null)
      return
    }
    try {
      const { profile: p, role: r } = await profileService.getMine(user.id)
      setProfile(p)
      setRole(r)
    } catch {
      setProfile(null)
      setRole('user')
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadProfile(data.session?.user)
      if (mounted) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(next)
      // Defer DB calls outside the auth callback (avoids supabase-js lock deadlocks)
      setTimeout(() => {
        if (!mounted) return
        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setRole(null)
        } else if (['SIGNED_IN', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
          loadProfile(next?.user)
        }
      }, 0)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(() => loadProfile(session?.user), [loadProfile, session])

  const signOut = useCallback(async () => {
    try {
      await authService.signOut()
    } finally {
      setSession(null)
      setProfile(null)
      setRole(null)
    }
  }, [])

  const value = useMemo(() => {
    const user = session?.user ?? null
    return {
      session,
      user,
      profile,
      role,
      loading,
      recovery,
      setRecovery,
      isAuthenticated: Boolean(user),
      isEmailVerified: Boolean(user?.email_confirmed_at),
      isSuspended: profile?.status === 'suspended',
      isAdmin: role === 'admin' || role === 'super_admin',
      isSuperAdmin: role === 'super_admin',
      refreshProfile,
      setProfile,
      signOut,
    }
  }, [session, profile, role, loading, recovery, refreshProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
