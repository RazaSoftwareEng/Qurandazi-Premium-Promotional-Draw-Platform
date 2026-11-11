import { supabase } from './supabase'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_DOCS = [...ALLOWED, 'application/pdf']

export function validateImage(file, maxMB = 5) {
  if (!file) return 'Select an image'
  if (!ALLOWED.includes(file.type)) return 'Use a JPG, PNG or WebP image'
  if (file.size > maxMB * 1024 * 1024) return `Image must be ${maxMB} MB or smaller`
  return null
}

export function validateDocument(file, { maxMB = 5, allowPdf = true } = {}) {
  if (!file) return 'Select a file'
  const allowed = allowPdf ? ALLOWED_DOCS : ALLOWED
  if (!allowed.includes(file.type)) return allowPdf ? 'Use a JPG, PNG, WebP or PDF file' : 'Use a JPG, PNG or WebP image'
  if (file.size > maxMB * 1024 * 1024) return `File must be ${maxMB} MB or smaller`
  return null
}

const randomName = (file, prefix = '') => {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
}

export const storageService = {
  /** Uploads an image and returns its public URL. */
  async uploadImage(bucket, folder, file, maxMB = 5) {
    const problem = validateImage(file, maxMB)
    if (problem) throw new Error(problem)
    const path = `${folder}/${randomName(file)}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type,
    })
    if (error) throw error
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  },

  /**
   * Uploads to a PRIVATE bucket and returns the storage path (not a URL).
   * Private files are viewed through short-lived signed URLs.
   */
  async uploadPrivate(bucket, folder, file, { maxMB = 5, allowPdf = true, prefix = '' } = {}) {
    const problem = validateDocument(file, { maxMB, allowPdf })
    if (problem) throw new Error(problem)
    const path = `${folder}/${randomName(file, prefix)}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type })
    if (error) throw error
    return path
  },

  async signedUrl(bucket, path, expiresIn = 300) {
    if (!path) return null
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
    if (error) throw error
    return data.signedUrl
  },
}
