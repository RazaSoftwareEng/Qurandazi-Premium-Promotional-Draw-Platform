import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// Accepts either the legacy anon key or the newer publishable key (sb_publishable_...)
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('your-project-ref') && !anonKey.includes('your-anon'),
)

// ---------------------------------------------------------------------
// "Remember me": when enabled the session lives in localStorage (survives
// browser restarts); otherwise in sessionStorage (cleared when the browser
// closes). Passwords are never stored by the app.
// ---------------------------------------------------------------------
const REMEMBER_KEY = 'qz_remember_me'
const REMEMBER_EMAIL_KEY = 'qz_remember_email'

const safe = (fn, fallback = null) => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const rememberMe = {
  get enabled() {
    return safe(() => localStorage.getItem(REMEMBER_KEY), null) !== 'false'
  },
  set(enabled, email) {
    safe(() => {
      localStorage.setItem(REMEMBER_KEY, enabled ? 'true' : 'false')
      if (enabled && email) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim().toLowerCase())
      else localStorage.removeItem(REMEMBER_EMAIL_KEY)
    })
  },
  get email() {
    return safe(() => localStorage.getItem(REMEMBER_EMAIL_KEY), '') || ''
  },
}

const authStorage = {
  getItem: (key) => safe(() => localStorage.getItem(key) ?? sessionStorage.getItem(key)),
  setItem: (key, value) =>
    safe(() => {
      if (rememberMe.enabled) {
        localStorage.setItem(key, value)
        sessionStorage.removeItem(key)
      } else {
        sessionStorage.setItem(key, value)
        localStorage.removeItem(key)
      }
    }),
  removeItem: (key) =>
    safe(() => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }),
}

// A placeholder client keeps imports safe when env vars are missing; every
// request will fail gracefully and pages render their error states.
export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      storage: authStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
)

export const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '')

/** Throws a normalized Error if a Supabase response contains an error. */
export function unwrap({ data, error, count }) {
  if (error) {
    const err = new Error(error.message || 'Request failed')
    err.code = error.code
    err.details = error.details
    throw err
  }
  return count !== undefined && count !== null ? { data, count } : data
}
