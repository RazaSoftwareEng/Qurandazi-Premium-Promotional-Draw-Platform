const FRIENDLY = [
  [/column .*(deposit_amount|deposit_lock_in_days|kyc_status|cnic|deposit_id).* does not exist|relation .*(deposits|prize_handovers).* does not exist/i, 'The database is missing the deposits/KYC update. Run supabase/migrations/20260101000005_deposits_kyc.sql in the Supabase SQL Editor, then supabase/seed.sql.'],
  [/Could not find the (table|function)/i, 'The database is not set up yet. Run the SQL files in supabase/migrations and supabase/seed.sql (see README).'],
  [/Failed to fetch|NetworkError|placeholder\.supabase/i, 'Unable to reach the server. Check your connection or Supabase configuration.'],
  [/Invalid login credentials/i, 'Incorrect email or password.'],
  [/Email not confirmed/i, 'Please verify your email address before signing in.'],
  [/User already registered/i, 'An account with this email already exists.'],
  [/JWT expired/i, 'Your session has expired. Please sign in again.'],
  [/duplicate key value.*slug/i, 'That URL slug is already in use. Choose another.'],
  [/duplicate key value.*name/i, 'That name is already in use.'],
  [/violates foreign key constraint.*campaigns_category_id/i, 'This category still has campaigns. Reassign or remove them first.'],
  [/row-level security/i, 'You do not have permission to perform this action.'],
  [/campaigns_dates_chk/i, 'The closing date must be after the start date.'],
  [/campaigns_draw_date_chk/i, 'The draw date must be on or after the closing date.'],
  [/deposits_user_id_fkey|entries_deposit_id_fkey/i, 'This user has deposit records, which must be kept. Suspend the account instead of deleting it.'],
  [/categories_deposit_amount_chk/i, 'The deposit amount must be zero or more.'],
  [/profiles_cnic_unique/i, 'This CNIC is already registered to another account.'],
  [/The object exceeded the maximum allowed size|Payload too large/i, 'That file is too large.'],
  [/mime type .* is not supported/i, 'That file type is not allowed.'],
]

export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  const msg = typeof err === 'string' ? err : err.message || err.error_description || err.error || ''
  for (const [re, friendly] of FRIENDLY) if (re.test(msg)) return friendly
  return msg || fallback
}
