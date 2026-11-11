import { Link } from 'react-router-dom'

/** QURANDAZI monogram: an eight-point star (two interlaced squares) with a gold core. */
export function LogoMark({ className = 'h-9 w-9', dark = true }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill={dark ? '#101B31' : '#FFFFFF'} />
      <g fill="none" stroke="#D4AF57" strokeWidth="2.5">
        <rect x="17" y="17" width="30" height="30" transform="rotate(45 32 32)" />
        <rect x="17" y="17" width="30" height="30" />
      </g>
      <circle cx="32" cy="32" r="6" fill="#D4AF57" />
    </svg>
  )
}

export default function Logo({ to = '/', light = false, compact = false }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="QURANDAZI home">
      <LogoMark className="h-9 w-9 shrink-0 transition-transform duration-300 group-hover:rotate-45" dark={!light ? true : true} />
      {!compact && (
        <span className="leading-none">
          <span className={`block text-[17px] font-extrabold tracking-[0.2em] ${light ? 'text-white' : 'text-navy-900'}`}>
            QURANDAZI
          </span>
          <span className={`mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.26em] ${light ? 'text-gold-400' : 'text-gold-700'}`}>
            Your Chance · Your Moment
          </span>
        </span>
      )}
    </Link>
  )
}
