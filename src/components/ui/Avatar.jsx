import { initials } from '@/utils/format'

const SIZES = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-xs', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' }

export default function Avatar({ src, name, size = 'md', className = '' }) {
  return src ? (
    <img src={src} alt={name ? `${name}'s avatar` : 'Avatar'} className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-gold-500/30 ${className}`} />
  ) : (
    <span
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full bg-navy-900 font-bold tracking-wider text-gold-400 ring-2 ring-gold-500/30 ${className}`}
      aria-label={name || 'User'}
    >
      {initials(name)}
    </span>
  )
}
