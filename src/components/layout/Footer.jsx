import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import Logo from '../ui/Logo'
import { useSettings } from '@/context/SettingsContext'

const COLS = [
  {
    title: 'Platform',
    links: [
      ['/campaigns', 'Campaigns'],
      ['/how-it-works', 'How It Works'],
      ['/winners', 'Winners & Audits'],
      ['/register', 'Create Free Account'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['/about', 'About Us'],
      ['/faqs', 'FAQs'],
      ['/contact', 'Contact Us'],
    ],
  },
  {
    title: 'Legal',
    links: [
      ['/terms', 'Terms & Conditions'],
      ['/privacy', 'Privacy Policy'],
    ],
  },
]

export default function Footer() {
  const { settings } = useSettings()
  const c = settings.contact
  return (
    <footer className="relative overflow-hidden bg-navy-950 text-white/70">
      <div className="pattern-stars pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="hairline-gold" />
      <div className="container-page relative grid gap-10 py-14 md:grid-cols-12">
        <div className="md:col-span-4">
          <Logo light />
          <p className="mt-5 max-w-xs text-sm leading-6">
            Promotional campaigns with transparent, independently verifiable draws. Deposits are refundable, never a fee.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold-500/30 px-3 py-1.5 text-xs font-semibold text-gold-400">
            <ShieldCheck className="h-3.5 w-3.5" /> 100% free participation
          </div>
        </div>
        {COLS.map((col) => (
          <div key={col.title} className="md:col-span-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400">{col.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="transition-colors hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="md:col-span-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400">Reach us</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
              <a href={`mailto:${c.email}`} className="break-all hover:text-white">{c.email}</a>
            </li>
            <li className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
              <a href={`tel:${c.phone?.replace(/\s/g, '')}`} className="hover:text-white">{c.phone}</a>
            </li>
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
              {c.address}
            </li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} {settings.branding.site_name}. All rights reserved.</p>
          <p className="text-white/50">No entry fees. Deposits are refundable under the published deposit terms.</p>
        </div>
      </div>
    </footer>
  )
}
