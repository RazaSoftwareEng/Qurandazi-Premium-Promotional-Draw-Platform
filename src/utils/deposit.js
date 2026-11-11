export const KYC_STATUS = {
  not_submitted: { label: 'Not submitted', tone: 'neutral' },
  pending: { label: 'Under review', tone: 'warning' },
  verified: { label: 'KYC Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const DEPOSIT_STATUS = {
  pending: { label: 'Pending', tone: 'warning' },
  verified: { label: 'Verified · Active', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  withdrawal_requested: { label: 'Withdrawal Requested', tone: 'info' },
  refunded: { label: 'Refunded', tone: 'neutral' },
}

export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'payment_gateway', label: 'Payment gateway' },
]
export const paymentMethodLabel = (v) => PAYMENT_METHODS.find((m) => m.value === v)?.label || v

/** "4210112345671" / "42101 1234567 1" -> "42101-1234567-1" (null if not 13 digits). */
export function normalizeCnic(v) {
  const d = String(v || '').replace(/\D/g, '')
  return d.length === 13 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : null
}

/** Formats while typing: inserts dashes after the 5th and 12th digit. */
export function formatCnicInput(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 13)
  if (d.length <= 5) return d
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`
}

export const maskCnic = (c) => (c ? `${c.slice(0, 5)}-•••••••-${c.slice(-1)}` : '—')

export const cnicRule = () => (v) => (normalizeCnic(v) ? null : 'Enter your 13-digit CNIC, e.g. 42101-1234567-1')

/** A deposit can be withdrawn when verified and past its lock-in (or early withdrawal is allowed). */
export function withdrawalState(deposit, allowEarly = false) {
  if (deposit.status !== 'verified') return { allowed: false }
  const locked = deposit.locked_until && new Date(deposit.locked_until) > new Date()
  return { allowed: allowEarly || !locked, locked, early: allowEarly && locked }
}

export const requiresDeposit = (category) => Number(category?.deposit_amount || 0) > 0
