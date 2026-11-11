import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, FileText, Loader2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/errors'

/**
 * Uploads a file to a private bucket via `upload(file) => path` and reports
 * the storage path through onChange(path). Shows a local preview only.
 */
export default function PrivateUpload({ label, value, onChange, upload, accept = 'image/jpeg,image/png,image/webp', help, required, disabled }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])
  useEffect(() => {
    if (!value) {
      setPreview(null)
      setFileName('')
    }
  }, [value])

  const handle = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const path = await upload(file)
      setFileName(file.name)
      setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
      onChange(path)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      {label && (
        <span className="label">
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
        </span>
      )}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handle(e.dataTransfer.files?.[0])
        }}
        className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-3 text-left transition-colors disabled:opacity-60 ${
          value ? 'border-emerald-300 bg-emerald-50/50' : 'border-ivory-300 bg-ivory-100 hover:border-gold-500'
        }`}
      >
        <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-ivory-300">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
          ) : preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : value ? (
            <FileText className="h-5 w-5 text-emerald-700" />
          ) : (
            <Upload className="h-5 w-5 text-ink-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          {value ? (
            <p className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> <span className="truncate">{fileName || 'Uploaded'}</span>
            </p>
          ) : (
            <p className="font-semibold text-navy-900">{busy ? 'Uploading…' : 'Click or drop a file'}</p>
          )}
          <p className="text-xs text-ink-muted">{value ? 'Click to replace' : help || 'Stored privately — only you and our verification team can see it.'}</p>
        </div>
      </button>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
    </div>
  )
}

/** Opens a private file through a short-lived signed URL. */
export function PrivateFileLink({ path, getUrl, children = 'View', className = '' }) {
  const [busy, setBusy] = useState(false)
  if (!path) return <span className="text-ink-muted">—</span>
  const open = async (e) => {
    e.stopPropagation()
    // Open synchronously to avoid popup blockers, then point it at the signed URL
    // ('noopener' would make window.open return null, so detach the opener manually)
    const win = window.open('', '_blank')
    if (win) win.opener = null
    setBusy(true)
    try {
      const url = await getUrl(path)
      if (win) win.location.href = url
      else window.location.assign(url)
    } catch (err) {
      win?.close()
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" onClick={open} className={`inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline ${className}`}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} {children}
    </button>
  )
}

/** Inline image preview of a private file (signed URL). */
export function PrivateImage({ path, getUrl, alt = '', className = '' }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    setUrl(null)
    setFailed(false)
    if (path) {
      getUrl(path)
        .then((u) => alive && setUrl(u))
        .catch(() => alive && setFailed(true))
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  if (!path) return <div className={`flex items-center justify-center bg-ivory-100 text-xs text-ink-muted ${className}`}>Not provided</div>
  if (failed) return <div className={`flex items-center justify-center bg-red-50 text-xs text-red-700 ${className}`}>Could not load</div>
  if (!url) return <div className={`flex items-center justify-center bg-ivory-100 ${className}`}><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
  if (/\.pdf($|\?)/i.test(path)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={`flex flex-col items-center justify-center gap-1 bg-ivory-100 text-sm font-semibold text-gold-700 ${className}`}>
        <FileText className="h-6 w-6" /> Open PDF
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`block overflow-hidden ${className}`}>
      <img src={url} alt={alt} className="h-full w-full object-contain bg-navy-950/5" />
    </a>
  )
}
