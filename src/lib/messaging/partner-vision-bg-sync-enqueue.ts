import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>

export type VisionBgSyncEnqueueJobCode =
  | 'no_ai_row'
  | 'vision_disabled'
  | 'already_active'
  | 'db_error'

export type VisionBgSyncEnqueueJobResult =
  | { ok: true }
  | { ok: false; error: string; code: VisionBgSyncEnqueueJobCode }

/**
 * Xếp hàng đồng bộ Vision nền (queued). Dùng từ server action (sau khi đã xác thực chủ shop) hoặc cron service role.
 * `resumeAfterId` null = quét từ đầu (sau khi chuẩn hóa cursor nếu không còn hợp lệ).
 */
export async function enqueueVisionCatalogBackgroundSyncJob(
  db: Db,
  partnerId: string,
  resumeAfterId: string | null
): Promise<VisionBgSyncEnqueueJobResult> {
  const { data: row, error: selErr } = await db
    .from('messaging_partner_ai_settings')
    .select('vision_product_search_enabled, vision_bg_sync_status')
    .eq('partner_id', partnerId)
    .maybeSingle()

  if (selErr) return { ok: false, error: selErr.message, code: 'db_error' }
  if (!row) return { ok: false, error: 'No AI settings row for partner.', code: 'no_ai_row' }
  if (!row.vision_product_search_enabled) {
    return { ok: false, error: 'Image-based suggestions are disabled for this partner.', code: 'vision_disabled' }
  }
  if (row.vision_bg_sync_status === 'queued' || row.vision_bg_sync_status === 'running') {
    return { ok: false, error: 'Background sync is already queued or running.', code: 'already_active' }
  }

  let resume: string | null = resumeAfterId?.trim() || null
  if (resume) {
    const { data: nextRow, error: nextErr } = await db
      .from('messaging_partner_inventory')
      .select('id')
      .eq('partner_id', partnerId)
      .gt('id', resume)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (nextErr || !nextRow) resume = null
  }

  const now = new Date().toISOString()
  const { error } = await db
    .from('messaging_partner_ai_settings')
    .update({
      vision_bg_sync_status: 'queued',
      vision_bg_sync_resume_after_id: resume,
      vision_bg_sync_rounds: 0,
      vision_bg_sync_imported: 0,
      vision_bg_sync_removed: 0,
      vision_bg_sync_started_at: null,
      vision_bg_sync_finished_at: null,
      vision_bg_sync_error: '',
      vision_bg_sync_report: '',
      updated_at: now,
    })
    .eq('partner_id', partnerId)

  if (error) return { ok: false, error: error.message, code: 'db_error' }
  return { ok: true }
}
