import type { Json } from '@/types/database.types'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export async function fetchMessagingGuestCartFromPg(input: {
  partnerId: string
  accountKey: string
}): Promise<Json | null> {
  if (!isPgConfigured()) return null
  const accountKey = input.accountKey.trim()
  if (!accountKey) return null
  try {
    const row = await pgQueryOne<{ cart_items: Json }>(
      `select cart_items
       from public.messaging_guest_carts
       where partner_id = $1::uuid and account_key = $2
       limit 1`,
      [input.partnerId, accountKey]
    )
    return row?.cart_items ?? []
  } catch (e) {
    console.warn('[fetchMessagingGuestCartFromPg]', e)
    return null
  }
}

export async function upsertMessagingGuestCartFromPg(input: {
  partnerId: string
  accountKey: string
  cartItems: Json
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const accountKey = input.accountKey.trim()
  if (!accountKey) return false
  try {
    await getPgPool().query(
      `insert into public.messaging_guest_carts (partner_id, account_key, cart_items, updated_at)
       values ($1::uuid, $2, $3::jsonb, now())
       on conflict (partner_id, account_key) do update set
         cart_items = excluded.cart_items,
         updated_at = now()`,
      [input.partnerId, accountKey, JSON.stringify(input.cartItems ?? [])]
    )
    return true
  } catch (e) {
    console.warn('[upsertMessagingGuestCartFromPg]', e)
    return false
  }
}
