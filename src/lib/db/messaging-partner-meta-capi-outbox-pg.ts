import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const MAX_ATTEMPTS = 8

export type MetaCapiOutboxRow = {
  id: string
  partnerId: string
  eventId: string
  eventName: string
  payload: Record<string, unknown>
  status: 'pending' | 'sent' | 'failed' | 'dead'
  attempts: number
  lastError: string
  nextRetryAt: string
}

function isMissingOutboxTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  if (!err) return false
  if (err.code === '42P01') return true
  return String(err.message ?? '').includes('messaging_partner_meta_capi_outbox')
}

export async function enqueuePartnerMetaCapiOutboxFromPg(input: {
  partnerId: string
  eventId: string
  eventName: string
  payload: Record<string, unknown>
  lastError?: string
}): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.messaging_partner_meta_capi_outbox
         (partner_id, event_id, event_name, payload, status, attempts, last_error, next_retry_at)
       values ($1::uuid, $2, $3, $4::jsonb, 'pending', 0, $5, now() + interval '2 minutes')
       returning id::text`,
      [
        input.partnerId,
        input.eventId.slice(0, 180),
        input.eventName.slice(0, 80),
        JSON.stringify(input.payload),
        String(input.lastError ?? '').slice(0, 500),
      ]
    )
    return row?.id ?? null
  } catch (e) {
    if (isMissingOutboxTable(e)) return null
    console.warn('[enqueuePartnerMetaCapiOutboxFromPg]', e)
    return null
  }
}

export async function fetchDuePartnerMetaCapiOutboxFromPg(limit = 20): Promise<MetaCapiOutboxRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{
      id: string
      partner_id: string
      event_id: string
      event_name: string
      payload: unknown
      status: string
      attempts: number
      last_error: string
      next_retry_at: unknown
    }>(
      `select id::text, partner_id::text, event_id, event_name, payload, status, attempts,
              coalesce(last_error, '') as last_error, next_retry_at
       from public.messaging_partner_meta_capi_outbox
       where status = 'pending' and next_retry_at <= now()
       order by next_retry_at asc
       limit $1`,
      [Math.max(1, Math.min(50, limit))]
    )
    return rows.map((r) => ({
      id: r.id,
      partnerId: r.partner_id,
      eventId: r.event_id,
      eventName: r.event_name,
      payload: (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>,
      status: 'pending',
      attempts: Number(r.attempts) || 0,
      lastError: r.last_error ?? '',
      nextRetryAt: String(r.next_retry_at ?? ''),
    }))
  } catch (e) {
    if (isMissingOutboxTable(e)) return []
    console.warn('[fetchDuePartnerMetaCapiOutboxFromPg]', e)
    return []
  }
}

export async function markPartnerMetaCapiOutboxSentFromPg(id: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partner_meta_capi_outbox
       set status = 'sent', sent_at = now(), updated_at = now(), last_error = ''
       where id = $1::uuid
       returning id::text`,
      [id]
    )
    return Boolean(row?.id)
  } catch (e) {
    if (isMissingOutboxTable(e)) return false
    console.warn('[markPartnerMetaCapiOutboxSentFromPg]', e)
    return false
  }
}

export async function markPartnerMetaCapiOutboxRetryFromPg(
  id: string,
  attempts: number,
  lastError: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const nextAttempts = attempts + 1
  const dead = nextAttempts >= MAX_ATTEMPTS
  const delayMinutes = Math.min(60, Math.pow(2, Math.min(6, nextAttempts)))
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partner_meta_capi_outbox
       set status = $2,
           attempts = $3,
           last_error = $4,
           next_retry_at = now() + ($5::text || ' minutes')::interval,
           updated_at = now()
       where id = $1::uuid
       returning id::text`,
      [id, dead ? 'dead' : 'pending', nextAttempts, lastError.slice(0, 500), String(delayMinutes)]
    )
    return Boolean(row?.id)
  } catch (e) {
    if (isMissingOutboxTable(e)) return false
    console.warn('[markPartnerMetaCapiOutboxRetryFromPg]', e)
    return false
  }
}

export { MAX_ATTEMPTS as META_CAPI_OUTBOX_MAX_ATTEMPTS }
