import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export async function findPartnerTryOnBillingUserIdByKeyHashPg(
  keyHash: string
): Promise<{ billingUserId: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ billing_user_id: string }>(
      `select billing_user_id::text as billing_user_id
       from public.partner_try_on_clients
       where key_hash = $1 and is_active = true
       limit 1`,
      [keyHash]
    )
    return row?.billing_user_id ? { billingUserId: row.billing_user_id } : null
  } catch (e) {
    console.error('[partner-try-on-pg] findPartnerTryOnBillingUserIdByKeyHashPg', e)
    return null
  }
}
