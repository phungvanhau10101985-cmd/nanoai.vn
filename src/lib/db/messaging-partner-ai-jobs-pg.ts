import type { Database } from '@/types/database.types'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type PartnerAiJobRow = Database['public']['Tables']['messaging_partner_ai_jobs']['Row']

function mapJobRow(r: Record<string, unknown>): PartnerAiJobRow {
  return {
    id: String(r.id),
    partner_id: String(r.partner_id),
    conversation_id: String(r.conversation_id),
    trigger_message_id: String(r.trigger_message_id),
    run_at: String(r.run_at ?? ''),
    status: r.status as PartnerAiJobRow['status'],
    error: r.error != null ? String(r.error) : null,
    created_at: String(r.created_at ?? ''),
  }
}

export async function cancelPendingAiJobsForConversationPg(conversationId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.messaging_partner_ai_jobs
       set status = 'cancelled'
       where conversation_id = $1::uuid and status = 'pending'`,
      [conversationId]
    )
    return true
  } catch (e) {
    console.error('[messaging-partner-ai-jobs-pg] cancelPendingAiJobsForConversationPg', e)
    return false
  }
}

export async function insertPartnerAiJobPg(params: {
  partnerId: string
  conversationId: string
  triggerMessageId: string
  runAtIso: string
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.messaging_partner_ai_jobs (
         partner_id, conversation_id, trigger_message_id, run_at, status
       ) values ($1::uuid, $2::uuid, $3::uuid, $4::timestamptz, 'pending')
       returning id::text as id`,
      [params.partnerId, params.conversationId, params.triggerMessageId, params.runAtIso]
    )
    return row ?? null
  } catch (e) {
    console.error('[messaging-partner-ai-jobs-pg] insertPartnerAiJobPg', e)
    return null
  }
}

export async function fetchPendingJobsDueFromPg(nowIso: string, limit: number): Promise<PartnerAiJobRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, partner_id::text, conversation_id::text, trigger_message_id::text,
              run_at, status, error, created_at
       from public.messaging_partner_ai_jobs
       where status = 'pending' and run_at <= $1::timestamptz
       order by run_at asc
       limit $2`,
      [nowIso, limit]
    )
    return rows.map(mapJobRow)
  } catch (e) {
    console.error('[messaging-partner-ai-jobs-pg] fetchPendingJobsDueFromPg', e)
    return null
  }
}

/** Chỉ khi vẫn `pending` → `processing`. Trả về true nếu claim được. */
export async function claimPartnerAiJobProcessingPg(jobId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partner_ai_jobs
       set status = 'processing'
       where id = $1::uuid and status = 'pending'
       returning id::text as id`,
      [jobId]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.error('[messaging-partner-ai-jobs-pg] claimPartnerAiJobProcessingPg', e)
    return false
  }
}

export async function updatePartnerAiJobStatusPg(
  jobId: string,
  patch: { status: PartnerAiJobRow['status']; error?: string | null }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.messaging_partner_ai_jobs
       set status = $2, error = $3
       where id = $1::uuid`,
      [jobId, patch.status, patch.error ?? null]
    )
    return true
  } catch (e) {
    console.error('[messaging-partner-ai-jobs-pg] updatePartnerAiJobStatusPg', e)
    return false
  }
}
