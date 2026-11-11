import { isSupabaseConfigured } from '@/services/supabase'

export default function SetupNotice() {
  if (isSupabaseConfigured) return null
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900">
      Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and set your project URL and anon key — see README.
    </div>
  )
}
