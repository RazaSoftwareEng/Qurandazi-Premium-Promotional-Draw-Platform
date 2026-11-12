import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BadgeCheck, Bell, Download, Globe, ShieldCheck, Smartphone, Wallet, X, Zap } from 'lucide-react'
import { LogoMark } from '@/components/ui/Logo'
import { APP_DOWNLOAD_URL, APP_FILE_NAME, APP_SIZE_LABEL, appPrompt, isAndroid, isIOS, isInApp } from '@/utils/app'

// Shown once per page load: a refresh of the home page shows it again, but moving
// between pages inside the site does not keep re-opening it.
let shownThisLoad = false

const PERKS = [
  { icon: Zap, text: 'Faster sign-up and login' },
  { icon: Wallet, text: 'Deposit and track it from your phone' },
  { icon: Bell, text: 'Instant results and winner alerts' },
]

function PhoneArt() {
  return (
    <div className="relative mx-auto h-36 w-24 sm:h-44 sm:w-28" aria-hidden>
      <div className="absolute -inset-6 rounded-full bg-gold-500/20 blur-2xl" />
      <div className="relative h-full w-full rounded-[1.4rem] border-[3px] border-gold-400/80 bg-navy-950 p-1.5 shadow-2xl shadow-black/40">
        <div className="mx-auto mb-1.5 h-1 w-8 rounded-full bg-white/20" />
        <div className="flex h-[calc(100%-0.75rem)] flex-col items-center justify-center gap-2 rounded-[1rem] bg-gradient-to-b from-navy-800 to-navy-900">
          <LogoMark className="h-9 w-9 sm:h-11 sm:w-11" />
          <span className="text-[8px] font-extrabold tracking-[0.25em] text-white sm:text-[9px]">QURANDAZI</span>
          <span className="h-1 w-10 rounded-full bg-gold-500/70" />
          <span className="h-1 w-7 rounded-full bg-white/15" />
        </div>
      </div>
    </div>
  )
}

/** Home page choice: download the Android app or continue on the website. */
export default function AppDownloadPrompt() {
  const [open, setOpen] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const android = isAndroid()

  useEffect(() => {
    if (shownThisLoad || isIOS() || isInApp()) return undefined
    const t = setTimeout(() => {
      shownThisLoad = true
      setOpen(true)
    }, 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && close('web')
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = (choice) => {
    if (choice) appPrompt.set(choice)
    setOpen(false)
    setDownloaded(false)
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="app-prompt-title">
      <div className="absolute inset-0 animate-fade-in bg-navy-950/70 backdrop-blur-sm" onClick={() => close('web')} aria-hidden />

      <div className="relative max-h-[92dvh] w-full max-w-md animate-fade-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 px-6 pb-6 pt-7 text-center text-white">
          <div className="pattern-stars pointer-events-none absolute inset-0 opacity-60" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-gold-500 to-transparent" aria-hidden />
          <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-white/25 sm:hidden" aria-hidden />
          <button
            type="button"
            onClick={() => close('web')}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative">
            <PhoneArt />
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-gold-400">{downloaded ? 'Almost there' : 'New · Android app'}</p>
            <h2 id="app-prompt-title" className="mt-1.5 font-display text-[28px] font-semibold leading-tight text-white sm:text-3xl">
              {downloaded ? 'Install QURANDAZI' : <>Your chance, <span className="text-gold-400">in your pocket</span></>}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 pb-6 pt-5 sm:px-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {downloaded ? (
            <>
              <ol className="space-y-3">
                {[
                  <>Open <strong className="text-navy-900">{APP_FILE_NAME}</strong> from your notifications or the Downloads folder.</>,
                  <>If asked, allow <strong className="text-navy-900">“Install unknown apps”</strong> for your browser, then tap <strong className="text-navy-900">Install</strong>.</>,
                  <>Open the app and create your account or sign in.</>,
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink-soft">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-extrabold text-navy-900">{i + 1}</span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900"><ShieldCheck className="h-4 w-4 shrink-0" /> Only install the app downloaded from this official website.</p>
              <div className="grid grid-cols-2 gap-2">
                <a href={APP_DOWNLOAD_URL} download={APP_FILE_NAME} className="btn btn-outline"><Download className="h-4 w-4" /> Again</a>
                <button type="button" className="btn btn-navy" onClick={() => close()}>Done</button>
              </div>
            </>
          ) : (
            <>
              <ul className="space-y-2.5">
                {PERKS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm font-medium text-navy-900">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-700"><Icon className="h-4 w-4" /></span>
                    {text}
                  </li>
                ))}
              </ul>

              {android ? (
                <a
                  href={APP_DOWNLOAD_URL}
                  download={APP_FILE_NAME}
                  onClick={() => {
                    appPrompt.set('app')
                    setDownloaded(true)
                  }}
                  className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 px-5 py-4 text-base font-extrabold text-navy-900 shadow-lg shadow-gold-500/30 transition-transform active:scale-[0.98]"
                >
                  <Download className="h-5 w-5 transition-transform group-hover:translate-y-0.5" /> Download the app
                  <span className="rounded-md bg-navy-900/10 px-1.5 py-0.5 text-[11px] font-bold">{APP_SIZE_LABEL}</span>
                </a>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-gold-500/50 bg-gold-100/40 p-4">
                  <Smartphone className="h-8 w-8 shrink-0 text-gold-700" />
                  <div className="min-w-0 text-sm">
                    <p className="font-bold text-navy-900">Open this page on your Android phone</p>
                    <p className="text-xs text-ink-muted">The app installs on Android phones only.</p>
                  </div>
                  <a href={APP_DOWNLOAD_URL} download={APP_FILE_NAME} onClick={() => appPrompt.set('app')} className="btn btn-sm btn-navy shrink-0"><Download className="h-4 w-4" /> APK</a>
                </div>
              )}

              <button
                type="button"
                onClick={() => close('web')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ivory-300 px-5 py-3.5 text-sm font-bold text-navy-900 transition-colors hover:bg-ivory-100 active:scale-[0.98]"
              >
                <Globe className="h-4 w-4" /> Continue on the website
              </button>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Official QURANDAZI app · free download
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Small reusable "Get the Android app" link. */
export function AppDownloadLink({ className = '', children = 'Download the Android app' }) {
  if (isIOS() || isInApp()) return null
  return (
    <a href={APP_DOWNLOAD_URL} download={APP_FILE_NAME} onClick={() => appPrompt.set('app')} className={`inline-flex items-center gap-1.5 font-semibold ${className}`}>
      <Smartphone className="h-4 w-4" /> {children}
    </a>
  )
}
