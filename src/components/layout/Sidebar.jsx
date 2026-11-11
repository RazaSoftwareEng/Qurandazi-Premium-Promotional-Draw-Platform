import { NavLink } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import Logo from '../ui/Logo'
import { useAuth } from '@/context/AuthContext'

/** Dark navy sidebar shared by the user and admin dashboards. */
export default function Sidebar({ sections, open, onClose, badge }) {
  const { signOut } = useAuth()

  const content = (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className="flex h-[68px] items-center justify-between border-b border-white/10 px-5">
        <Logo light to="/" />
        <button className="btn-icon text-white/70 hover:bg-white/10 hover:text-white lg:hidden" onClick={onClose} aria-label="Close sidebar">
          <X className="h-5 w-5" />
        </button>
      </div>
      {badge && <div className="px-5 pt-4">{badge}</div>}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label="Dashboard">
        {sections.map((section) => (
          <div key={section.title || 'main'} className="mb-5">
            {section.title && (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">{section.title}</p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${
                        isActive ? 'bg-white/[0.07] text-gold-400' : 'text-white/65 hover:bg-white/[0.04] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-gold-500" />}
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.count > 0 && (
                          <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-navy-900">{item.count}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-white/65 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={onClose} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-up shadow-2xl">{content}</aside>
        </div>
      )}
    </>
  )
}
