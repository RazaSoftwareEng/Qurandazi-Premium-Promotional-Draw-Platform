/**
 * Independent, client-side verification of a published draw (QZ-SHA256-v1).
 * Mirrors the SQL in supabase/migrations/*_functions.sql exactly.
 */
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyDraw(audit) {
  const { draw, snapshot, results } = audit
  const checks = []

  // 1. Snapshot hash
  const snapshotText = snapshot.map((s) => `${s.position}:${s.reference}`).join('\n')
  const snapshotHash = await sha256Hex(snapshotText)
  checks.push({
    id: 'snapshot',
    label: 'Eligible-entry snapshot matches its published hash',
    ok: snapshotHash === draw.snapshot_hash,
    detail: snapshotHash,
  })

  // 2. Seed commitment
  if (!draw.seed_reveal) {
    checks.push({ id: 'seed', label: 'Seed has not been revealed yet', ok: false })
    return { ok: false, checks, recomputed: [] }
  }
  const commitment = await sha256Hex(draw.seed_reveal)
  checks.push({
    id: 'commitment',
    label: 'Revealed seed matches the commitment published at freeze time',
    ok: commitment === draw.seed_commitment,
    detail: commitment,
  })

  // 3. Recompute winners
  let pool = snapshot.map((s) => s.position).sort((a, b) => a - b)
  const byPos = new Map(snapshot.map((s) => [s.position, s.reference]))
  const recomputed = []
  for (let k = 1; k <= results.length; k++) {
    const h = await sha256Hex(`${draw.seed_reveal}:${draw.snapshot_hash}:${k}`)
    const idx = Number(BigInt('0x' + h.slice(0, 15)) % BigInt(pool.length))
    const pos = pool[idx]
    pool = pool.filter((p) => p !== pos)
    recomputed.push({ rank: k, position: pos, reference: byPos.get(pos), derivation: h })
  }
  const winnersMatch = recomputed.every((r, i) => {
    const pub = results[i]
    return pub && pub.position === r.position && pub.reference === r.reference && pub.derivation === r.derivation
  })
  checks.push({ id: 'winners', label: 'Every published winner is reproduced by the algorithm', ok: winnersMatch })

  return { ok: checks.every((c) => c.ok), checks, recomputed }
}
