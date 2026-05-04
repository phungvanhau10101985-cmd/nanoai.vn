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
       where conversation_id = $1::uuid and status in ('pending', 'processing')`,
      [conversationId]
    )
    return true
  } catch (e) {
    console.error('[messaging-partner-ai-jobs-pg] cancelPendingAiJobsForConversationPg', e)
    return false
  }
}

/** Worker gọi trước khi gửi tin — false nếu job đã bị hủy (tin khách mới / shop can thiệp). */
export async function partnerAiJobIsStillProcessingPg(jobId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ status: string }>(
      `select status::text as status from public.messaging_partner_ai_jobs where id = $1::uuid`,
      [jobId]
    )
    return row?.status === 'processing'
  } catch (e) {
    console.error('[messaging-partner-ai-jobs-pg] partnerAiJobIsStillProcessingPg', e)
    return null
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

/** Job đang chờ chạy hoặc đang xử lý LLM — dùng cho UI «đang soạn tin» phía shop. */
export async function countActivePartnerAiJobsForConversationFromPg(
  partnerId: string,
  conversationId: string
): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c
       from public.messaging_partner_ai_jobs
       join public.customer_care_messages trigger_msg
         on trigger_msg.id = messaging_partner_ai_jobs.trigger_message_id
       where messaging_partner_ai_jobs.partner_id = $1::uuid
         and messaging_partner_ai_jobs.conversation_id = $2::uuid
         and messaging_partner_ai_jobs.status in ('pending', 'processing')
         and not exists (
           select 1
           from public.customer_care_messages out_msg
           where out_msg.conversation_id = messaging_partner_ai_jobs.conversation_id
             and out_msg.direction = 'outbound'
             and out_msg.created_at > trigger_msg.created_at
         )`,
      [partnerId, conversationId]
    )
    return typeof row?.c === 'number' && Number.isFinite(row.c) ? Math.max(0, row.c) : 0
  } catch (e) {
    console.error('[messaging-partner-ai-jobs-pg] countActivePartnerAiJobsForConversationFromPg', e)
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
         and exists (
           select 1
           from public.messaging_partners p
           where p.id = messaging_partner_ai_jobs.partner_id
             and coalesce(p.industry_key, 'fashion') <> 'hotel'
         )
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
