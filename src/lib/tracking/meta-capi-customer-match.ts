import { listPartnerCustomerAddressesFromPg } from '@/lib/db/messaging-partner-customer-addresses-pg'
import { fetchPartnerCustomerProfileByEmailFromPg } from '@/lib/db/messaging-partner-customer-profiles-pg'
import {
  partnerSiteMetaCapiCustomerInfo,
  partnerSiteMetaMatchingParams,
} from '@/lib/partner-website/shop/partner-site-meta-advanced-matching'
import type { MetaCapiCustomerInfo } from '@/lib/tracking/meta-capi-user-data'

export type MetaCapiCustomerMatch = {
  customerEmail: string | null
  customerPhone: string | null
  externalId: string | null
  customerInfo: MetaCapiCustomerInfo
}

function emailOf(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase()
}

/**
 * Ghép hồ sơ + sổ địa chỉ vào user_data CAPI: họ, tên, giới tính, ngày sinh, quận, tỉnh, quốc gia.
 * Mã ZIP chỉ khi địa chỉ đã có 6 số.
 */
export async function metaCapiCustomerFromPartner(input: {
  partnerId: string
  email?: string | null
  phone?: string | null
  fullName?: string | null
  shippingAddress?: string | null
  externalId?: string | null
  clientInfo?: MetaCapiCustomerInfo | null
}): Promise<MetaCapiCustomerMatch> {
  const email = emailOf(input.email)
  let phone = String(input.phone ?? '').trim()
  let fullName = String(input.fullName ?? '').trim()
  let shippingAddress = String(input.shippingAddress ?? '').trim()
  let gender: string | null = null
  let dateOfBirth: string | null = null
  let city = ''
  let state = ''

  if (email.includes('@')) {
    try {
      const [profile, addresses] = await Promise.all([
        fetchPartnerCustomerProfileByEmailFromPg({ partnerId: input.partnerId, emailNormalized: email }),
        listPartnerCustomerAddressesFromPg({ partnerId: input.partnerId, emailNormalized: email }),
      ])
      const address = addresses.find((row) => row.is_default) ?? addresses[0] ?? null
      if (!phone) phone = profile?.customer_phone || address?.phone || ''
      if (!fullName) fullName = profile?.customer_name || address?.full_name || ''
      if (!shippingAddress) shippingAddress = profile?.shipping_address || ''
      gender = profile?.gender ?? null
      dateOfBirth = profile?.date_of_birth ?? null
      city = address?.district || address?.ward || ''
      state = address?.province || ''
    } catch {
      /* hồ sơ lỗi không được chặn sự kiện */
    }
  }

  const matching = partnerSiteMetaMatchingParams({
    email,
    phone,
    fullName,
    externalId: input.externalId,
    gender,
    dateOfBirth,
    city,
    state,
    shippingAddress,
  })
  const serverInfo = partnerSiteMetaCapiCustomerInfo(matching)
  const customerInfo: MetaCapiCustomerInfo = { ...serverInfo }
  const client = input.clientInfo
  if (client) {
    for (const key of ['fn', 'ln', 'ge', 'db', 'ct', 'st', 'zp', 'country'] as const) {
      const value = String(client[key] ?? '').trim()
      if (value) customerInfo[key] = value
    }
  }
  return {
    customerEmail: matching.em || (email.includes('@') ? email : null),
    customerPhone: phone || null,
    externalId: matching.external_id || String(input.externalId ?? '').trim() || null,
    customerInfo,
  }
}
