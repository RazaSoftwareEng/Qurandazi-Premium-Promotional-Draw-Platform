import { useState } from 'react'
import { BadgeCheck, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Alert, Button, ErrorState, FormInput, Modal, PrivateFileLink, PrivateUpload, Skeleton, StatusBadge, TextArea } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import { adminService } from '@/services/adminService'
import { drawService } from '@/services/drawService'
import { KYC_STATUS, formatCnicInput, normalizeCnic } from '@/utils/deposit'
import { formatDate, formatDateTime } from '@/utils/format'
import { getErrorMessage } from '@/utils/errors'

export const handoverOf = (r) => (Array.isArray(r?.handover) ? r.handover[0] : r?.handover) || null

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Step 6: match the winner's presented CNIC against their verified profile and record the prize handover. */
export default function HandoverModal({ result, onClose, onSaved }) {
  const existing = handoverOf(result)
  const winner = useAsync(() => adminService.getUser(result.user_id), [result.user_id])
  const [cnic, setCnic] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [prize, setPrize] = useState(result.draw?.campaign?.prize_description || '')
  const [docs, setDocs] = useState([null])
  const [notes, setNotes] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const [busy, setBusy] = useState(false)
  const w = winner.data

  const presented = normalizeCnic(cnic)
  const localMatch = presented && w?.cnic ? presented === w.cnic : null

  const submit = async () => {
    const paths = docs.filter(Boolean)
    if (!presented) return toast.error('Enter the 13-digit CNIC number from the card the winner presented')
    if (!paths.length) return toast.error('Attach at least one handover document')
    if (prize.trim().length < 2) return toast.error('Describe the prize handed over')
    setBusy(true)
    try {
      const res = await drawService.recordHandover({
        resultId: result.id,
        presentedCnic: presented,
        handedOverOn: date,
        prizeDescription: prize.trim(),
        documentPaths: paths,
        notes: notes.trim(),
      })
      if (!res?.ok) {
        setMismatch(true)
        toast.error('CNIC does not match the winner’s verified profile. The attempt has been logged.')
        return
      }
      toast.success('Prize handover recorded')
      onSaved()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={busy ? undefined : onClose}
      title={existing ? 'Prize handover record' : 'Record prize handover'}
      description={`${result.draw?.campaign?.title || result.draw?.title} · Rank #${result.rank} · ${result.entry_reference}`}
      footer={
        existing ? (
          <Button variant="outline" onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="navy" loading={busy} disabled={!w || w.kyc_status !== 'verified'} onClick={submit}>Record handover</Button>
          </>
        )
      }
    >
      {winner.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : winner.error ? (
        <ErrorState error={winner.error} onRetry={winner.reload} />
      ) : (
        <div className="space-y-5 text-sm">
          <dl className="grid grid-cols-2 gap-4 rounded-xl bg-ivory-100 p-4">
            <div><dt className="text-xs text-ink-muted">Winner (full name)</dt><dd className="font-bold text-navy-900">{w.full_name}</dd></div>
            <div><dt className="text-xs text-ink-muted">KYC</dt><dd><StatusBadge map={KYC_STATUS} value={w.kyc_status} /></dd></div>
            <div><dt className="text-xs text-ink-muted">CNIC on profile</dt><dd className="font-mono font-semibold text-navy-900">{w.cnic || '—'}</dd></div>
            <div><dt className="text-xs text-ink-muted">Phone</dt><dd className="font-semibold text-navy-900">{w.phone || '—'}</dd></div>
          </dl>

          {existing ? (
            <div className="space-y-3">
              <Alert tone="success" icon={BadgeCheck} title={`Handed over on ${formatDate(existing.handed_over_on)}`}>
                CNIC {existing.presented_cnic} matched the verified profile. Recorded {formatDateTime(existing.created_at)}.
              </Alert>
              <p><span className="text-ink-muted">Prize:</span> <strong>{existing.prize_description}</strong></p>
              {existing.notes && <p className="whitespace-pre-line"><span className="text-ink-muted">Notes:</span> {existing.notes}</p>}
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-muted">Documents</p>
                <ul className="space-y-1">
                  {existing.document_paths.map((p, i) => (
                    <li key={p}><PrivateFileLink path={p} getUrl={drawService.handoverDocUrl}>Document {i + 1}</PrivateFileLink></li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-ink-muted">Handover records can't be changed and are kept in the activity log.</p>
            </div>
          ) : w.kyc_status !== 'verified' || !w.cnic ? (
            <Alert tone="danger" icon={ShieldAlert} title="Winner has no verified CNIC">A handover can be recorded only after the winner's CNIC is KYC-verified.</Alert>
          ) : (
            <>
              <div>
                <FormInput
                  label="CNIC number on the presented card"
                  required
                  inputMode="numeric"
                  placeholder="42101-1234567-1"
                  value={cnic}
                  onChange={(e) => { setCnic(formatCnicInput(e.target.value)); setMismatch(false) }}
                  help="Type the number from the physical CNIC. Don't copy it from the profile."
                />
                {localMatch === true && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Matches the verified profile</p>}
                {(localMatch === false || mismatch) && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700"><ShieldAlert className="h-3.5 w-3.5" /> Does not match. Don't hand over the prize.</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput label="Handover date" type="date" required max={todayLocal()} value={date} onChange={(e) => setDate(e.target.value)} />
                <FormInput label="Prize handed over" required placeholder="e.g. Honda CD 70 (2026), chassis #…" value={prize} maxLength={500} onChange={(e) => setPrize(e.target.value)} />
              </div>
              <div className="space-y-3">
                <span className="label">Documents <span className="text-red-600">*</span></span>
                {docs.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1">
                      <PrivateUpload
                        value={d}
                        onChange={(p) => setDocs((arr) => arr.map((x, j) => (j === i ? p : x)))}
                        upload={(f) => drawService.uploadHandoverDoc(result.id, f)}
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        help="Signed receipt, delivery note, photo with winner or CNIC copy · up to 10 MB"
                      />
                    </div>
                    {docs.length > 1 && <button type="button" className="btn-icon mt-4 text-red-600" aria-label="Remove document" onClick={() => setDocs((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
                {docs.length < 6 && <Button size="sm" variant="ghost" icon={Plus} onClick={() => setDocs((a) => [...a, null])}>Add another document</Button>}
              </div>
              <TextArea label="Admin notes" rows={3} maxLength={2000} placeholder="Who handed it over, where, registration/transfer details…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
