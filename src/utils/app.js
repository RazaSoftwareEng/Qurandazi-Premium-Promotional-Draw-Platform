/** Android app download (file lives in /public/downloads, served as-is). */
export const APP_DOWNLOAD_URL = '/downloads/qurandazi.apk'
export const APP_FILE_NAME = 'QURANDAZI.apk'
export const APP_SIZE_LABEL = '6.9 MB'

const PROMPT_KEY = 'qz_app_prompt_choice'

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '')
export const isIOS = () => /iPad|iPhone|iPod/.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1)
export const isAndroid = () => /Android/i.test(ua())

/** True when the page is running inside an installed app / WebView rather than a browser. */
export const isInApp = () =>
  /\bwv\b|QurandaziApp/i.test(ua()) ||
  (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)

export const appPrompt = {
  get choice() {
    try {
      return localStorage.getItem(PROMPT_KEY)
    } catch {
      return 'unavailable'
    }
  },
  set(choice) {
    try {
      localStorage.setItem(PROMPT_KEY, choice)
    } catch {
      /* private mode: prompt may show again next visit */
    }
  },
}
