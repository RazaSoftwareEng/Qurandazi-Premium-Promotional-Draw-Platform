import { useCallback, useMemo, useState } from 'react'

export function usePagination(pageSize = 10) {
  const [page, setPage] = useState(1)
  const range = useMemo(() => {
    const from = (page - 1) * pageSize
    return { from, to: from + pageSize - 1 }
  }, [page, pageSize])
  const reset = useCallback(() => setPage(1), [])
  return { page, setPage, pageSize, ...range, reset }
}
