import { useEffect, useRef, useState } from 'react'

/** Accessible dropdown menu. items: [{ label, icon, onClick, danger, disabled, hidden }] */
export default function Dropdown({ trigger, items = [], align = 'right', label = 'Open menu' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const visible = items.filter((i) => !i.hidden)

  return (
    <div className="relative inline-block" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn-icon" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-ivory-300 bg-white py-1 shadow-lift animate-fade-up ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
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
        </div>
      )}
    </div>
  )
}
