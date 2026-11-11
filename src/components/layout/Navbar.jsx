import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import Logo from '../ui/Logo'
import Button from '../ui/Button'
import { useAuth } from '@/context/AuthContext'

const LINKS = [
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/winners', label: 'Winners' },
  { to: '/about', label: 'About' },
  { to: '/faqs', label: 'FAQs' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { isAuthenticated, isAdmin, signOut } = useAuth()
  const { pathname } = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const dashTo = isAdmin ? '/admin' : '/dashboard'

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled ? 'border-white/10 bg-navy-900/95 shadow-lg backdrop-blur' : 'border-transparent bg-navy-900'
      }`}
    >
      <nav className="container-page flex h-[72px] items-center justify-between gap-6" aria-label="Main">
        <Logo light />
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  `relative rounded-md px-3 py-2 text-[13.5px] font-semibold transition-colors ${
                    isActive ? 'text-gold-400' : 'text-white/75 hover:text-white'
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 lg:flex">
          {isAuthenticated ? (
            <>
              <Button to={dashTo} variant="primary" size="sm" icon={isAdmin ? ShieldCheck : LayoutDashboard}>
                {isAdmin ? 'Admin Console' : 'My Dashboard'}
              </Button>
              <button onClick={signOut} className="btn btn-sm text-white/70 hover:text-white" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Button to="/login" variant="outline-light" size="sm">
                Sign in
              </Button>
              <Button to="/register" variant="primary" size="sm">
                Join Free
              </Button>
            </>
          )}
        </div>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-navy-900 lg:hidden">
          <ul className="container-page space-y-1 py-4">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-white/5 text-gold-400' : 'text-white/80'}`
                  }
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
            <li className="grid grid-cols-2 gap-2 pt-3">
              {isAuthenticated ? (
                <>
                  <Button to={dashTo} variant="primary" size="sm">
                    {isAdmin ? 'Admin Console' : 'Dashboard'}
                  </Button>
                  <Button variant="outline-light" size="sm" onClick={signOut}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button to="/login" variant="outline-light" size="sm">
                    Sign in
                  </Button>
                  <Button to="/register" variant="primary" size="sm">
                    Join Free
                  </Button>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
