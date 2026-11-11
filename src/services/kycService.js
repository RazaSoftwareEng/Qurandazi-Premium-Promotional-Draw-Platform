import { supabase, unwrap } from './supabase'
import { storageService } from './storageService'

export const KYC_BUCKET = 'kyc-documents'

export const kycService = {
  uploadCnicImage: (userId, file, side) =>
    storageService.uploadPrivate(KYC_BUCKET, userId, file, { allowPdf: false, prefix: `cnic-${side}-` }),

  submit: async ({ cnic, frontPath, backPath }) =>
    unwrap(await supabase.rpc('submit_kyc', { p_cnic: cnic, p_front_path: frontPath, p_back_path: backPath })),

  signedUrl: (path) => storageService.signedUrl(KYC_BUCKET, path),

  // ---------------- Admin ----------------
  async adminList({ status = 'pending', search, from = 0, to = 14 } = {}) {
    let q = supabase
      .from('profiles')
      .select(
        'id, full_name, email, phone, address, city, cnic, cnic_front_path, cnic_back_path, kyc_status, kyc_note, kyc_submitted_at, kyc_reviewed_at, email_confirmed_at, status, created_at',
        { count: 'exact' },
      )
    if (status) q = q.eq('kyc_status', status)
    else q = q.neq('kyc_status', 'not_submitted')
    if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,cnic.ilike.%${search}%`)
    return unwrap(await q.order('kyc_submitted_at', { ascending: status === 'pending', nullsFirst: false }).range(from, to))
  },

  review: async (userId, decision, note) =>
    unwrap(await supabase.rpc('admin_review_kyc', { p_user_id: userId, p_decision: decision, p_note: note || null })),
}
