import { supabase, unwrap } from './supabase'
import { storageService } from './storageService'

export const PROOF_BUCKET = 'deposit-proofs'

const adminSelect = (inner) => `*, category:categories(id, name, slug),
  profile:profiles${inner ? '!inner' : ''}(id, full_name, email, phone, cnic, kyc_status)`

export const depositService = {
  // ---------------- User ----------------
  async mine(userId) {
    return unwrap(
      await supabase
        .from('deposits')
        .select('*, category:categories(id, name, slug)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    )
  },

  uploadProof: (userId, file) => storageService.uploadPrivate(PROOF_BUCKET, userId, file, { prefix: 'proof-' }),
  proofUrl: (path) => storageService.signedUrl(PROOF_BUCKET, path),

  create: async ({ categoryId, paymentMethod, transactionId, proofPath, acceptTerms }) =>
    unwrap(
      await supabase.rpc('create_deposit', {
        p_category_id: categoryId,
        p_payment_method: paymentMethod,
        p_transaction_id: transactionId,
        p_proof_path: proofPath || null,
        p_accept_terms: Boolean(acceptTerms),
      }),
    ),

  withdrawalImpact: async (depositId) => unwrap(await supabase.rpc('get_deposit_withdrawal_impact', { p_deposit_id: depositId })),

  requestWithdrawal: async (depositId, payoutDetails) =>
    unwrap(await supabase.rpc('request_deposit_withdrawal', { p_deposit_id: depositId, p_payout_details: payoutDetails })),

  // ---------------- Admin ----------------
  buildAdminQuery({ status, categoryId, search, userId } = {}) {
    // Searches containing a digit (and no "@") match the deposit reference or
    // bank transaction ID; anything else matches the depositor's name / email.
    const s = search?.trim().replace(/[%,()]/g, '')
    const byTxn = s && /\d/.test(s) && !s.includes('@')
    const joinProfile = Boolean(s && !byTxn)
    let q = supabase.from('deposits').select(adminSelect(joinProfile), { count: 'exact' })
    if (status) q = q.eq('status', status)
    if (categoryId) q = q.eq('category_id', categoryId)
    if (userId) q = q.eq('user_id', userId)
    if (byTxn) q = q.or(`reference.ilike.%${s}%,transaction_id.ilike.%${s}%`)
    else if (s) q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`, { referencedTable: 'profiles' })
    return q
  },

  async adminList(filters = {}, { from = 0, to = 14 } = {}) {
    return unwrap(await this.buildAdminQuery(filters).order('created_at', { ascending: false }).range(from, to))
  },

  async adminExport(filters = {}) {
    const rows = []
    for (let from = 0; ; from += 1000) {
      const { data } = unwrap(await this.buildAdminQuery(filters).order('created_at').range(from, from + 999))
      rows.push(...data)
      if (data.length < 1000) break
    }
    return rows
  },

  review: async (depositId, decision, reason) =>
    unwrap(await supabase.rpc('admin_review_deposit', { p_deposit_id: depositId, p_decision: decision, p_reason: reason || null })),

  completeRefund: async (depositId, payoutTxn, note) =>
    unwrap(
      await supabase.rpc('admin_complete_refund', {
        p_deposit_id: depositId,
        p_payout_transaction_id: payoutTxn,
        p_note: note || null,
      }),
    ),
}
