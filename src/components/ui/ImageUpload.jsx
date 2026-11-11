import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { storageService, validateImage } from '@/services/storageService'
import { getErrorMessage } from '@/utils/errors'

/** Uploads to Supabase Storage and returns the public URL via onChange(url). */
export default function ImageUpload({ label, value, onChange, bucket = 'media', folder = 'uploads', maxMB = 5, aspect = 'aspect-[16/7]', help }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    const problem = validateImage(file, maxMB)
    if (problem) return toast.error(problem)
    setUploading(true)
    try {
      const url = await storageService.uploadImage(bucket, folder, file, maxMB)
      onChange(url)
      toast.success('Image uploaded')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div
        className={`group relative ${aspect} w-full overflow-hidden rounded-xl border-2 border-dashed border-ivory-300 bg-ivory-100 transition-colors hover:border-gold-500`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleFile(e.dataTransfer.files?.[0])
        }}
      >
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-navy-950/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button type="button" className="btn btn-sm bg-white text-navy-900" onClick={() => inputRef.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Replace
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange(null)}>
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-muted"
          >
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-sm font-semibold">{uploading ? 'Uploading…' : 'Click or drop an image'}</span>
            <span className="text-xs">JPG, PNG or WebP · max {maxMB} MB</span>
          </button>
        )}
        {uploading && value && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-navy-900" />
          </div>
        )}
      </div>
      {help && <p className="help-text">{help}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  )
}
