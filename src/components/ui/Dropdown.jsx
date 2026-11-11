import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const GAP = 4
const MARGIN = 8

/**
 * Accessible dropdown menu. items: [{ label, icon, onClick, danger, disabled, hidden }]
 * The menu is rendered in a portal with fixed positioning so it is never clipped by
 * scrollable containers (e.g. tables), and it flips upward when there is no room below.
 */
export default function Dropdown({ trigger, items = [], align = 'right', label = 'Open menu' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const place = () => {
    const btn = btnRef.current
    const menu = menuRef.current
    if (!btn || !menu) return
    const r = btn.getBoundingClientRect()
    const mw = menu.offsetWidth
    const mh = menu.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = align === 'right' ? r.right - mw : r.left
    left = Math.min(Math.max(MARGIN, left), vw - mw - MARGIN)

    const spaceBelow = vh - r.bottom
    const openUp = spaceBelow < mh + GAP + MARGIN && r.top > spaceBelow
    let top = openUp ? r.top - mh - GAP : r.bottom + GAP
    top = Math.min(Math.max(MARGIN, top), vh - mh - MARGIN)

    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (open) place()
    else setPos(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false)
    }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    const dismiss = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open])

  const visible = items.filter((i) => !i.hidden)

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} type="button" className="btn-icon" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
            className="z-[70] min-w-[12rem] overflow-hidden rounded-xl border border-ivory-300 bg-white py-1 shadow-lift"
          >
            {visible.map((item, i) =>
              item.divider ? (
                <div key={i} className="my-1 h-px bg-ivory-200" />
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onClick?.()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
                    item.danger ? 'text-red-600 hover:bg-red-50' : 'text-navy-900 hover:bg-ivory-100'
                  }`}
                >
                  {item.icon && <item.icon className="h-4 w-4 opacity-70" />}
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
