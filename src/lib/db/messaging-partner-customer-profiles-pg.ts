import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export type MessagingPartnerCustomerProfileRow = {
  id: string
  partner_id: string
  email_normalized: string
  email_raw: string
  customer_name: string
  customer_phone: string
  shipping_address: string
  updated_at: string
}

export async function fetchPartnerCustomerProfileByEmailFromPg(input: {
  partnerId: string
  emailNormalized: string
}): Promise<MessagingPartnerCustomerProfileRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, partner_id::text, email_normalized, email_raw, customer_name, customer_phone, shipping_address, updated_at
       from public.messaging_partner_customer_profiles
       where partner_id = $1::uuid and email_normalized = $2
       limit 1`,
      [input.partnerId, input.emailNormalized]
    )
    if (!row) return null
    return {
      id: String(row.id),
      partner_id: String(row.partner_id),
      email_normalized: String(row.email_normalized ?? ''),
      email_raw: String(row.email_raw ?? ''),
      customer_name: String(row.customer_name ?? ''),
      customer_phone: String(row.customer_phone ?? ''),
      shipping_address: String(row.shipping_address ?? ''),
      updated_at: String(row.updated_at ?? ''),
    }
  } catch (e) {
    console.warn('[fetchPartnerCustomerProfileByEmailFromPg]', e)
    return null
  }
}

export async function upsertPartnerCustomerProfileByEmailFromPg(input: {
  partnerId: string
  emailNormalized: string
  emailRaw: string
  customerName: string
  customerPhone: string
  shippingAddress: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQueryOne(
      `insert into public.messaging_partner_customer_profiles (
         partner_id, email_normalized, email_raw, customer_name, customer_phone, shipping_address, created_at, updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, now(), now()
       )
       on conflict (partner_id, email_normalized) do update set
         email_raw = excluded.email_raw,
         customer_name = excluded.customer_name,
         customer_phone = excluded.customer_phone,
         shipping_address = excluded.shipping_address,
         updated_at = now()
       returning id::text`,
      [
        input.partnerId,
        input.emailNormalized,
        input.emailRaw,
        input.customerName,
        input.customerPhone,
        input.shippingAddress,
      ]
    )
    return true
  } catch (e) {
    console.warn('[upsertPartnerCustomerProfileByEmailFromPg]', e)
    return false
  }
}
