import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import {
  parseIsoDateOfBirth,
  parsePartnerShopGender,
  type PartnerShopGender,
} from '@/lib/partner-website/shop/partner-site-profile-demographics'

export type MessagingPartnerCustomerProfileRow = {
  id: string
  partner_id: string
  email_normalized: string
  email_raw: string
  customer_name: string
  customer_phone: string
  shipping_address: string
  gender: PartnerShopGender | null
  date_of_birth: string | null
  updated_at: string
}

function mapProfileRow(row: Record<string, unknown>): MessagingPartnerCustomerProfileRow {
  const dob = parseIsoDateOfBirth(row.date_of_birth)
  return {
    id: String(row.id),
    partner_id: String(row.partner_id),
    email_normalized: String(row.email_normalized ?? ''),
    email_raw: String(row.email_raw ?? ''),
    customer_name: String(row.customer_name ?? ''),
    customer_phone: String(row.customer_phone ?? ''),
    shipping_address: String(row.shipping_address ?? ''),
    gender: parsePartnerShopGender(row.gender),
    date_of_birth: dob,
    updated_at: String(row.updated_at ?? ''),
  }
}

export async function fetchPartnerCustomerProfileByEmailFromPg(input: {
  partnerId: string
  emailNormalized: string
}): Promise<MessagingPartnerCustomerProfileRow | null> {
  if (!isPgConfigured()) return null
  try {
    let row: Record<string, unknown> | null = null
    try {
      row = await pgQueryOne<Record<string, unknown>>(
        `select id::text, partner_id::text, email_normalized, email_raw, customer_name, customer_phone, shipping_address,
                gender, date_of_birth::text as date_of_birth, updated_at
         from public.messaging_partner_customer_profiles
         where partner_id = $1::uuid and email_normalized = $2
         limit 1`,
        [input.partnerId, input.emailNormalized]
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/gender|date_of_birth/i.test(msg)) throw e
      row = await pgQueryOne<Record<string, unknown>>(
        `select id::text, partner_id::text, email_normalized, email_raw, customer_name, customer_phone, shipping_address, updated_at
         from public.messaging_partner_customer_profiles
         where partner_id = $1::uuid and email_normalized = $2
         limit 1`,
        [input.partnerId, input.emailNormalized]
      )
    }
    if (!row) return null
    return mapProfileRow(row)
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
  gender?: PartnerShopGender | null
  dateOfBirth?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const gender = parsePartnerShopGender(input.gender)
  const dateOfBirth = parseIsoDateOfBirth(input.dateOfBirth)
  try {
    await pgQueryOne(
      `insert into public.messaging_partner_customer_profiles (
         partner_id, email_normalized, email_raw, customer_name, customer_phone, shipping_address, gender, date_of_birth, created_at, updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8::date, now(), now()
       )
       on conflict (partner_id, email_normalized) do update set
         email_raw = excluded.email_raw,
         customer_name = excluded.customer_name,
         customer_phone = excluded.customer_phone,
         shipping_address = excluded.shipping_address,
         gender = coalesce(excluded.gender, messaging_partner_customer_profiles.gender),
         date_of_birth = coalesce(excluded.date_of_birth, messaging_partner_customer_profiles.date_of_birth),
         updated_at = now()
       returning id::text`,
      [
        input.partnerId,
        input.emailNormalized,
        input.emailRaw,
        input.customerName,
        input.customerPhone,
        input.shippingAddress,
        gender,
        dateOfBirth,
      ]
    )
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/gender|date_of_birth/i.test(msg)) {
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
      } catch (fallbackErr) {
        console.warn('[upsertPartnerCustomerProfileByEmailFromPg]', fallbackErr)
        return false
      }
    }
    console.warn('[upsertPartnerCustomerProfileByEmailFromPg]', e)
    return false
  }
}
