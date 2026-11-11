import { Outlet } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import SetupNotice from '@/components/layout/SetupNotice'

const POINTS = [
  'No entry fee. Your deposit is refundable, never a fee',
  'One fair entry per member, per campaign',
  'Winners selected by a verifiable cryptographic process',
]

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SetupNotice />
      <div className="grid flex-1 lg:grid-cols-2">
        <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pattern-stars pointer-events-none absolute inset-0" aria-hidden />
          <Logo light />
          <div className="relative">
            <p className="eyebrow-dark">
              <span className="gold-rule" /> Members
            </p>
            <h2 className="mt-4 font-display text-5xl font-semibold leading-[1.05] text-white">
              Your chance.
              <br />
              <span className="text-gold-400">Your moment.</span>
            </h2>
            <ul className="mt-8 space-y-3">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-white/75">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/40">© {new Date().getFullYear()} QURANDAZI</p>
        </aside>
        <main id="main" className="flex items-center justify-center bg-ivory px-4 py-12 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
