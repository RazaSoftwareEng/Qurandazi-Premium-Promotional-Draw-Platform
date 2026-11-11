import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Runs an async loader and tracks { data, loading, error }.
 * Re-runs whenever `deps` change; `reload()` re-runs on demand.
 */
export function useAsync(loader, deps = [], { immediate = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const callId = useRef(0)

  const run = useCallback(async () => {
    const id = ++callId.current
    setLoading(true)
    setError(null)
    try {
      const result = await loader()
      if (id === callId.current) setData(result)
      return result
    } catch (e) {
      if (id === callId.current) setError(e)
      return undefined
    } finally {
      if (id === callId.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (immediate) run()
  }, [run, immediate])

  return { data, setData, loading, error, reload: run }
}
