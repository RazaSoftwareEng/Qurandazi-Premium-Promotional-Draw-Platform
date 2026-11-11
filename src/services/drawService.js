import { supabase, unwrap } from './supabase'
import { storageService } from './storageService'

export const HANDOVER_BUCKET = 'handover-documents'

export const drawService = {
  // ---------------- Public ----------------
  async publishedWinners({ search, from = 0, to = 11 } = {}) {
    return unwrap(
      await supabase.rpc('get_published_winners', {
        p_limit: to - from + 1,
        p_offset: from,
        p_search: search || null,
      }),
    )
  },

  async publishedDraws(limit = 20) {
    return unwrap(
      await supabase
        .from('draws')
        .select('id, title, scheduled_at, published_at, entry_count, winners_count, campaign:campaigns(id, title, slug)')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(limit),
    )
  },

  async audit(drawId) {
    return unwrap(await supabase.rpc('get_draw_audit', { p_draw_id: drawId }))
  },

  async publicStats() {
    return unwrap(await supabase.rpc('get_public_stats'))
  },

  async myHistory() {
    return unwrap(await supabase.rpc('get_my_draw_history'))
  },

  // ---------------- Admin ----------------
  async adminList({ status, from = 0, to = 9 } = {}) {
    let q = supabase
      .from('draws')
      .select('*, campaign:campaigns(id, title, slug, end_date, entries_count, status)', { count: 'exact' })
    if (status) q = q.eq('status', status)
    return unwrap(await q.order('created_at', { ascending: false }).range(from, to))
  },

  async adminResults({ from = 0, to = 9, status } = {}) {
    let q = supabase
      .from('draw_results')
      .select(
        'id, rank, entry_reference, winner_display_name, snapshot_position, pool_size, created_at, user_id, campaign_id, draw:draws!inner(id, title, status, published_at, approved_at, campaign:campaigns(id, title, prize_description)), handover:prize_handovers(*)',
        { count: 'exact' },
      )
    if (status) q = q.eq('draw.status', status)
    return unwrap(await q.order('created_at', { ascending: false }).range(from, to))
  },

  schedule: async ({ campaign_id, title, scheduled_at, winners_count, notes }) =>
    unwrap(
      await supabase.rpc('schedule_draw', {
        p_campaign_id: campaign_id,
        p_title: title,
        p_scheduled_at: scheduled_at,
        p_winners_count: Number(winners_count),
        p_notes: notes || null,
      }),
    ),

  update: async (id, { title, scheduled_at, winners_count, notes }) =>
    unwrap(
      await supabase.rpc('update_draw', {
        p_draw_id: id,
        p_title: title,
        p_scheduled_at: scheduled_at,
        p_winners_count: Number(winners_count),
        p_notes: notes || null,
      }),
    ),

  freeze: async (id) => unwrap(await supabase.rpc('freeze_draw', { p_draw_id: id })),
  execute: async (id) => unwrap(await supabase.rpc('execute_draw', { p_draw_id: id })),
  approve: async (id) => unwrap(await supabase.rpc('approve_draw', { p_draw_id: id })),
  publish: async (id) => unwrap(await supabase.rpc('publish_draw', { p_draw_id: id })),
  cancel: async (id, reason) => unwrap(await supabase.rpc('cancel_draw', { p_draw_id: id, p_reason: reason })),

  // ---------------- Prize handover ----------------
  uploadHandoverDoc: (resultId, file) => storageService.uploadPrivate(HANDOVER_BUCKET, resultId, file, { maxMB: 10 }),
  handoverDocUrl: (path) => storageService.signedUrl(HANDOVER_BUCKET, path),

  recordHandover: async ({ resultId, presentedCnic, handedOverOn, prizeDescription, documentPaths, notes }) =>
    unwrap(
      await supabase.rpc('admin_record_handover', {
        p_result_id: resultId,
        p_presented_cnic: presentedCnic,
        p_handed_over_on: handedOverOn,
        p_prize_description: prizeDescription,
        p_document_paths: documentPaths,
        p_notes: notes || null,
      }),
    ),
}
