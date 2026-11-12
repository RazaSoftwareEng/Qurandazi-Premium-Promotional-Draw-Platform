import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export default function Modal({ open, onClose, title, description, size = 'md', children, footer, dismissable = true }) {
  const panelRef = useRef(null)
  const lastFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    lastFocus.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector('input, select, textarea, button:not([data-close])')
      ;(el || panelRef.current)?.focus()
    }, 30)

    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) onClose?.()
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
        )
        if (!nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      lastFocus.current?.focus?.()
    }
  }, [open, onClose, dismissable])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]" onClick={() => dismissable && onClose?.()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        style={{ maxHeight: '92dvh' }}
        className={`relative flex max-h-[92vh] w-full ${SIZES[size]} animate-fade-up flex-col rounded-t-2xl bg-white shadow-lift outline-none sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ivory-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-navy-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {dismissable && (
            <button type="button" data-close onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close dialog">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-ivory-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
