import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · QURANDAZI` : 'QURANDAZI — Your Chance. Your Moment.'
  }, [title])
}
