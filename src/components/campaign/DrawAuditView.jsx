import { useState } from 'react'
import { CheckCircle2, Fingerprint, ShieldCheck, Trophy, XCircle } from 'lucide-react'
import { Button, StatusBadge } from '../ui'
import { verifyDraw } from '@/utils/drawVerification'
import { DRAW_STATUS } from '@/utils/campaign'
import { formatDateTime, formatNumber } from '@/utils/format'

function HashRow({ label, value }) {
  return (
    <div className="py-3">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-navy-900">{value || <span className="text-ink-muted">— not yet available —</span>}</dd>
    </div>
  )
}

/** Shows a draw's audit record and verifies it client-side. Used publicly and in admin. */
export default function DrawAuditView({ audit, showStaff = false }) {
  const [verifying, setVerifying] = useState(false)
  const [verification, setVerification] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const { draw, snapshot, results } = audit

  const run = async () => {
    setVerifying(true)
    try {
      setVerification(await verifyDraw(audit))
    } finally {
      setVerifying(false)
    }
  }

  const timeline = [
    ['Entries frozen', draw.frozen_at, draw.frozen_by],
    ['Draw executed', draw.executed_at, draw.executed_by],
    ['Results approved', draw.approved_at, draw.approved_by],
    ['Results published', draw.published_at, draw.published_by],
  ]
  const snapRows = showAll ? snapshot : snapshot.slice(0, 50)

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900"><Trophy className="h-5 w-5 text-gold-600" /> Winners</h2>
            <StatusBadge map={DRAW_STATUS} value={draw.status} />
          </div>
          {results.length ? (
            <ol className="mt-4 divide-y divide-ivory-200">
              {results.map((r) => (
                <li key={r.rank} className="flex items-center gap-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-gold-400">#{r.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-navy-900">{r.winner}</p>
                    <p className="font-mono text-xs text-ink-muted">{r.reference} · position {r.position} of pool {r.pool_size}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-ink-muted">Winners have not been drawn yet.</p>
          )}
        </section>

        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900"><Fingerprint className="h-5 w-5 text-gold-600" /> Frozen entry snapshot</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {formatNumber(snapshot.length)} eligible entries, ordered by entry time.
            {Number(draw.required_deposit) > 0 && <> Only entries with a deposit of PKR {formatNumber(draw.required_deposit)} or more still active at closing were included{draw.excluded_entries > 0 ? ` (${formatNumber(draw.excluded_entries)} excluded)` : ''}.</>}
          </p>
          <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-ivory-200 scrollbar-thin">
            <table className="table-qz">
              <thead><tr><th>Position</th><th>Entry reference</th></tr></thead>
              <tbody>
                {snapRows.map((s) => (
                  <tr key={s.position}><td className="font-mono text-xs">{s.position}</td><td className="font-mono text-xs">{s.reference}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {snapshot.length > 50 && !showAll && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll(true)}>Show all {formatNumber(snapshot.length)}</Button>
          )}
        </section>
      </div>

      <aside className="space-y-6 lg:col-span-5">
        <section className="card p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900"><ShieldCheck className="h-5 w-5 text-gold-600" /> Independent verification</h2>
          <p className="mt-2 text-sm text-ink-muted">Your browser recomputes the snapshot fingerprint, checks the seed commitment and re-derives every winner using algorithm <span className="font-mono">{draw.algorithm_version}</span>.</p>
          <Button className="mt-4 w-full" onClick={run} loading={verifying} disabled={!draw.seed_reveal}>
            {draw.seed_reveal ? 'Verify in my browser' : 'Available after the draw'}
          </Button>
          {verification && (
            <div className={`mt-4 rounded-xl border p-4 ${verification.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <p className={`font-bold ${verification.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                {verification.ok ? 'Verified — this draw is reproducible and untampered.' : 'Verification failed.'}
              </p>
              <ul className="mt-2 space-y-1.5">
                {verification.checks.map((c) => (
                  <li key={c.id} className="flex gap-2 text-sm">
                    {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <dl className="mt-4 divide-y divide-ivory-200 border-t border-ivory-200">
            <HashRow label="Snapshot SHA-256" value={draw.snapshot_hash} />
            <HashRow label="Seed commitment (published at freeze)" value={draw.seed_commitment} />
            <HashRow label="Revealed seed" value={draw.seed_reveal} />
          </dl>
          <details className="mt-3 text-xs text-ink-muted">
            <summary className="cursor-pointer font-semibold text-navy-900">Algorithm details</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-ivory-100 p-3 font-mono text-[11px] leading-5">{`snapshot_hash = SHA256("1:REF\\n2:REF\\n…N:REF")
commitment    = SHA256(seed_hex)
for k = 1..W:
  h   = SHA256(seed_hex + ":" + snapshot_hash + ":" + k)
  idx = int(h[0:15], 16) mod |pool|
  winner_k = pool[idx]; remove from pool`}</pre>
          </details>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-bold text-navy-900">Audit timeline</h2>
          <ol className="mt-4 space-y-4 border-l border-gold-500/40 pl-5">
            <li className="relative">
              <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-gold-500" />
              <p className="text-sm font-bold text-navy-900">Scheduled</p>
              <p className="text-xs text-ink-muted">{formatDateTime(draw.scheduled_at)}</p>
            </li>
            {timeline.map(([label, at, by]) => (
              <li key={label} className="relative">
                <span className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ${at ? 'bg-gold-500' : 'bg-ivory-300'}`} />
                <p className={`text-sm font-bold ${at ? 'text-navy-900' : 'text-ink-muted'}`}>{label}</p>
                <p className="text-xs text-ink-muted">{at ? formatDateTime(at) : 'Pending'}{showStaff && by ? ` · ${by}` : ''}</p>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  )
}
