import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { settingsService, DEFAULT_SETTINGS } from '@/services/settingsService'
import { isSupabaseConfigured } from '@/services/supabase'

const SettingsContext = createContext({ settings: DEFAULT_SETTINGS, reload: () => {} })

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      setSettings(await settingsService.getAll())
    } catch {
      /* fall back to defaults */
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return <SettingsContext.Provider value={{ settings, reload }}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
