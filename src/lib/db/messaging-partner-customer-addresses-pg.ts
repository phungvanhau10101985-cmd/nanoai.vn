import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { formatPartnerSiteAddressLine } from '@/lib/partner-website/shop/partner-site-customer-address'
import {
  fetchPartnerCustomerProfileByEmailFromPg,
  upsertPartnerCustomerProfileByEmailFromPg,
} from '@/lib/db/messaging-partner-customer-profiles-pg'
import type { PartnerSiteCustomerAddress, PartnerSiteCustomerAddressInput } from '@/lib/partner-website/shop/partner-site-customer-address'

function mapRow(row: Record<string, unknown>): PartnerSiteCustomerAddress {
  return {
    id: String(row.id ?? ''),
    full_name: String(row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    province: String(row.province ?? ''),
    district: String(row.district ?? ''),
    ward: String(row.ward ?? ''),
    street_address: String(row.street_address ?? ''),
    is_default: row.is_default === true,
  }
}

async function syncDefaultToProfile(input: {
  partnerId: string
  emailNormalized: string
  emailRaw?: string
}): Promise<void> {
  const def = await pgQueryOne<Record<string, unknown>>(
    `select full_name, phone, street_address, ward, district, province
     from public.messaging_partner_customer_addresses
     where partner_id = $1::uuid and email_normalized = $2 and is_default
     limit 1`,
    [input.partnerId, input.emailNormalized]
  )
  const existing = await fetchPartnerCustomerProfileByEmailFromPg({
    partnerId: input.partnerId,
    emailNormalized: input.emailNormalized,
  })
  await upsertPartnerCustomerProfileByEmailFromPg({
    partnerId: input.partnerId,
    emailNormalized: input.emailNormalized,
    emailRaw: input.emailRaw?.trim() || existing?.email_raw || input.emailNormalized,
    customerName: String(def?.full_name || existing?.customer_name || ''),
    customerPhone: String(def?.phone || existing?.customer_phone || ''),
    shippingAddress: def
      ? formatPartnerSiteAddressLine(mapRow({ ...def, id: '', is_default: true }))
      : '',
  })
}

export async function ensurePartnerCustomerAddressesSeededFromPg(input: {
  partnerId: string
  emailNormalized: string
  emailRaw?: string
}): Promise<PartnerSiteCustomerAddress[]> {
  const existing = await listPartnerCustomerAddressesFromPg(input)
  if (existing.length > 0) return existing
  const profile = await fetchPartnerCustomerProfileByEmailFromPg(input)
  const street = profile?.shipping_address?.trim() || ''
  if (street.length < 5) return existing
  const created = await insertPartnerCustomerAddressFromPg({
    ...input,
    body: {
      full_name: profile?.customer_name?.trim() || 'Khách',
      phone: (profile?.customer_phone || '').replace(/\s+/g, '') || '0000000000',
      street_address: street.slice(0, 500),
      is_default: true,
    },
  })
  return created ? [created] : existing
}

export async function listPartnerCustomerAddressesFromPg(input: {
  partnerId: string
  emailNormalized: string
}): Promise<PartnerSiteCustomerAddress[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, full_name, phone, province, district, ward, street_address, is_default
       from public.messaging_partner_customer_addresses
       where partner_id = $1::uuid and email_normalized = $2
       order by is_default desc, created_at desc`,
      [input.partnerId, input.emailNormalized]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[listPartnerCustomerAddressesFromPg]', e)
    return []
  }
}

export async function insertPartnerCustomerAddressFromPg(input: {
  partnerId: string
  emailNormalized: string
  emailRaw?: string
  body: PartnerSiteCustomerAddressInput
}): Promise<PartnerSiteCustomerAddress | null> {
  if (!isPgConfigured()) return null
  try {
    const existing = await listPartnerCustomerAddressesFromPg(input)
    const makeDefault = input.body.is_default === true || existing.length === 0
    if (makeDefault) {
      await pgQuery(
        `update public.messaging_partner_customer_addresses
         set is_default = false, updated_at = now()
         where partner_id = $1::uuid and email_normalized = $2 and is_default`,
        [input.partnerId, input.emailNormalized]
      )
    }
    const row = await pgQueryOne<Record<string, unknown>>(
      `insert into public.messaging_partner_customer_addresses (
         partner_id, email_normalized, full_name, phone, province, district, ward, street_address, is_default
       ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id::text, full_name, phone, province, district, ward, street_address, is_default`,
      [
        input.partnerId,
        input.emailNormalized,
        input.body.full_name,
        input.body.phone,
        input.body.province || '',
        input.body.district || '',
        input.body.ward || '',
        input.body.street_address,
        makeDefault,
      ]
    )
    await syncDefaultToProfile(input)
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[insertPartnerCustomerAddressFromPg]', e)
    return null
  }
}

export async function updatePartnerCustomerAddressFromPg(input: {
  partnerId: string
  emailNormalized: string
  emailRaw?: string
  addressId: string
  body: PartnerSiteCustomerAddressInput
}): Promise<PartnerSiteCustomerAddress | null> {
  if (!isPgConfigured()) return null
  try {
    if (input.body.is_default === true) {
      await pgQuery(
        `update public.messaging_partner_customer_addresses
         set is_default = false, updated_at = now()
         where partner_id = $1::uuid and email_normalized = $2 and is_default and id <> $3::uuid`,
        [input.partnerId, input.emailNormalized, input.addressId]
      )
    }
    const row = await pgQueryOne<Record<string, unknown>>(
      `update public.messaging_partner_customer_addresses
       set full_name = $4, phone = $5, province = $6, district = $7, ward = $8,
           street_address = $9, is_default = coalesce($10, is_default), updated_at = now()
       where partner_id = $1::uuid and email_normalized = $2 and id = $3::uuid
       returning id::text, full_name, phone, province, district, ward, street_address, is_default`,
      [
        input.partnerId,
        input.emailNormalized,
        input.addressId,
        input.body.full_name,
        input.body.phone,
        input.body.province || '',
        input.body.district || '',
        input.body.ward || '',
        input.body.street_address,
        input.body.is_default === true ? true : input.body.is_default === false ? false : null,
      ]
    )
    await syncDefaultToProfile(input)
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[updatePartnerCustomerAddressFromPg]', e)
    return null
  }
}

export async function setDefaultPartnerCustomerAddressFromPg(input: {
  partnerId: string
  emailNormalized: string
  emailRaw?: string
  addressId: string
}): Promise<PartnerSiteCustomerAddress | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `update public.messaging_partner_customer_addresses
       set is_default = false, updated_at = now()
       where partner_id = $1::uuid and email_normalized = $2 and is_default`,
      [input.partnerId, input.emailNormalized]
    )
    const row = await pgQueryOne<Record<string, unknown>>(
      `update public.messaging_partner_customer_addresses
       set is_default = true, updated_at = now()
       where partner_id = $1::uuid and email_normalized = $2 and id = $3::uuid
       returning id::text, full_name, phone, province, district, ward, street_address, is_default`,
      [input.partnerId, input.emailNormalized, input.addressId]
    )
    await syncDefaultToProfile(input)
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[setDefaultPartnerCustomerAddressFromPg]', e)
    return null
  }
}

export async function deletePartnerCustomerAddressFromPg(input: {
  partnerId: string
  emailNormalized: string
  emailRaw?: string
  addressId: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `delete from public.messaging_partner_customer_addresses
       where partner_id = $1::uuid and email_normalized = $2 and id = $3::uuid
       returning id::text, is_default`,
      [input.partnerId, input.emailNormalized, input.addressId]
    )
    if (!row) return false
    if (row.is_default === true) {
      const next = await pgQueryOne<Record<string, unknown>>(
        `select id::text
         from public.messaging_partner_customer_addresses
         where partner_id = $1::uuid and email_normalized = $2
         order by created_at desc
         limit 1`,
        [input.partnerId, input.emailNormalized]
      )
      if (next?.id) {
        await setDefaultPartnerCustomerAddressFromPg({
          ...input,
          addressId: String(next.id),
        })
        return true
      }
    }
    await syncDefaultToProfile(input)
    return true
  } catch (e) {
    console.warn('[deletePartnerCustomerAddressFromPg]', e)
    return false
  }
}
