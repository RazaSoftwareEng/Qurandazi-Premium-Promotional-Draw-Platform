export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const PHONE_RE = /^\+?[0-9][0-9 -]{6,19}$/

export const rules = {
  required: (msg = 'This field is required') => (v) =>
    v === null || v === undefined || String(v).trim() === '' ? msg : null,
  email: (msg = 'Enter a valid email address') => (v) => (!v || EMAIL_RE.test(String(v).trim()) ? null : msg),
  phone: (msg = 'Enter a valid phone number, e.g. +92 300 1234567') => (v) =>
    !v || PHONE_RE.test(String(v).trim()) ? null : msg,
  min: (n, msg) => (v) => (!v || String(v).trim().length >= n ? null : msg || `Must be at least ${n} characters`),
  max: (n, msg) => (v) => (!v || String(v).length <= n ? null : msg || `Must be ${n} characters or fewer`),
  password: () => (v) => {
    if (!v) return null
    if (v.length < 8) return 'Use at least 8 characters'
    if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Include both letters and numbers'
    return null
  },
  matches: (field, msg = 'Values do not match') => (v, all) => (v === all[field] ? null : msg),
  slug: () => (v) => (!v || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? null : 'Use lowercase letters, numbers and dashes'),
  intRange: (lo, hi) => (v) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= lo && n <= hi ? null : `Enter a whole number between ${lo} and ${hi}`
  },
}

/**
 * validate({ email: [rules.required(), rules.email()] }, values)
 * => { email: 'Enter a valid email address' } (only fields with errors)
 */
export function validate(schema, values) {
  const errors = {}
  for (const [field, validators] of Object.entries(schema)) {
    for (const fn of validators) {
      const msg = fn(values[field], values)
      if (msg) {
        errors[field] = msg
        break
      }
    }
  }
  return errors
}

export function passwordStrength(pw = '') {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  return { score, label: labels[score] }
}
