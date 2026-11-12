/**
 * Derives the user-facing phase of a campaign from its admin status and dates.
 * tone: used by <StatusBadge /> for colours.
 */
export function getCampaignPhase(c) {
  if (!c) return { key: 'unknown', label: 'Unknown', tone: 'neutral' }
  const now = Date.now()
  const start = new Date(c.start_date).getTime()
  const end = new Date(c.end_date).getTime()

  switch (c.status) {
    case 'draft':
      return { key: 'draft', label: 'Draft', tone: 'neutral' }
    case 'cancelled':
      return { key: 'cancelled', label: 'Cancelled', tone: 'danger' }
    case 'completed':
      return { key: 'completed', label: 'Results Published', tone: 'gold' }
    case 'closed':
      return { key: 'closed', label: 'Closed', tone: 'neutral' }
    case 'upcoming':
      return { key: 'upcoming', label: 'Upcoming', tone: 'info' }
    case 'active':
      if (now < start) return { key: 'upcoming', label: 'Upcoming', tone: 'info' }
      if (now >= end) return { key: 'closed', label: 'Closed', tone: 'neutral' }
      return { key: 'open', label: 'Open', tone: 'success' }
    default:
      return { key: c.status, label: c.status, tone: 'neutral' }
  }
}

export const isCampaignOpen = (c) => getCampaignPhase(c).key === 'open'

export const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const RULE_TYPES = [
  { value: 'profile_complete', label: 'Complete profile (name, phone, address)', needsValue: false },
  { value: 'phone_required', label: 'Phone number on profile', needsValue: false },
  { value: 'min_account_age_days', label: 'Minimum account age (days)', needsValue: true, placeholder: 'e.g. 7' },
  { value: 'city_in', label: 'Residents of specific cities', needsValue: true, placeholder: 'e.g. Karachi, Lahore' },
]

export const ruleLabel = (type) => RULE_TYPES.find((r) => r.value === type)?.label || type

export function describeRule(rule) {
  if (rule.description) return rule.description
  switch (rule.rule_type) {
    case 'min_account_age_days':
      return `Account must be at least ${rule.rule_value} days old`
    case 'city_in':
      return `Open to residents of ${rule.rule_value}`
    default:
      return ruleLabel(rule.rule_type)
  }
}

export const DRAW_STATUS = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  frozen: { label: 'Entries Frozen', tone: 'warning' },
  drawn: { label: 'Awaiting Approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  published: { label: 'Published', tone: 'gold' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export const ENTRY_STATUS = {
  confirmed: { label: 'Confirmed', tone: 'info' },
  verified: { label: 'Verified', tone: 'success' },
  disqualified: { label: 'Ineligible', tone: 'danger' },
}
