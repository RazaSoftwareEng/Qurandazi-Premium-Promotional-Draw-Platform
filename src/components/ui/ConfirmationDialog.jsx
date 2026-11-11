import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import { TextArea } from './FormInput'

/**
 * Confirmation dialog.
 * - `confirmText`: if set, the user must type this exact text to enable confirm (for destructive actions).
 * - `requireReason`: shows a reason textarea; value passed to onConfirm(reason).
 */
export default function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  confirmText,
  requireReason = false,
  reasonLabel = 'Reason',
  loading = false,
  children,
}) {
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) {
      setTyped('')
      setReason('')
    }
  }, [open])

  const blocked = (confirmText && typed !== confirmText) || (requireReason && reason.trim().length < 5)
  const Icon = tone === 'danger' ? AlertTriangle : ShieldCheck

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'navy'}
            onClick={() => onConfirm(reason.trim())}
            loading={loading}
            disabled={blocked}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-gold-100 text-gold-700'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-4 text-sm text-ink-soft">
          {message && <div>{message}</div>}
          {children}
          {requireReason && (
            <TextArea
              label={reasonLabel}
              rows={3}
              placeholder="Explain why (at least 5 characters)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              help="Minimum 5 characters. This is recorded in the audit log."
              maxLength={500}
            />
          )}
          {confirmText && (
            <div>
              <label className="label" htmlFor="confirm-type">
                Type <span className="font-mono text-red-700">{confirmText}</span> to confirm
              </label>
              <input id="confirm-type" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
