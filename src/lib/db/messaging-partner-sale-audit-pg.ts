import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

function safeDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const out = { ...detail }
  for (const key of Object.keys(out)) {
    if (/secret|token|jwt|password|signature/i.test(key)) delete out[key]
  }
  return out
}

export async function writePartnerSaleAuditFromPg(input: {
  partnerId: string
  eventType: string
  actorKey?: string | null
  entityType?: string | null
  entityId?: string | null
  detail?: Record<string, unknown>
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `insert into public.messaging_partner_sale_audit_log
       (partner_id, event_type, actor_key, entity_type, entity_id, detail)
     values ($1::uuid,$2,$3,$4,$5,$6::jsonb)`,
    [
      input.partnerId,
      input.eventType.slice(0, 80),
      input.actorKey?.slice(0, 180) || null,
      input.entityType?.slice(0, 80) || null,
      input.entityId?.slice(0, 180) || null,
      JSON.stringify(safeDetail(input.detail ?? {})),
    ]
  ).catch((error) => console.warn('[writePartnerSaleAuditFromPg]', error))
}
