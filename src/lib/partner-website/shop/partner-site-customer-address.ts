export type PartnerSiteCustomerAddress = {
  id: string
  full_name: string
  phone: string
  province: string
  district: string
  ward: string
  street_address: string
  is_default: boolean
}

export type PartnerSiteCustomerAddressInput = {
  full_name: string
  phone: string
  province?: string
  district?: string
  ward?: string
  street_address: string
  is_default?: boolean
}

export function formatPartnerSiteAddressLine(addr: {
  street_address?: string | null
  ward?: string | null
  district?: string | null
  province?: string | null
}): string {
  return [addr.street_address, addr.ward, addr.district, addr.province]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

export function emptyPartnerSiteAddressInput(seed?: {
  full_name?: string
  phone?: string
  is_default?: boolean
}): PartnerSiteCustomerAddressInput {
  return {
    full_name: seed?.full_name?.trim() || '',
    phone: seed?.phone?.trim() || '',
    province: '',
    district: '',
    ward: '',
    street_address: '',
    is_default: seed?.is_default === true,
  }
}

export function parsePartnerSiteAddressInput(raw: unknown): PartnerSiteCustomerAddressInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const full_name = String(o.full_name ?? '').trim().slice(0, 255)
  const phone = String(o.phone ?? '').replace(/\s+/g, '').slice(0, 20)
  const street_address = String(o.street_address ?? '').trim().slice(0, 500)
  if (full_name.length < 2 || phone.length < 10 || street_address.length < 5) return null
  return {
    full_name,
    phone,
    province: String(o.province ?? '').trim().slice(0, 255),
    district: String(o.district ?? '').trim().slice(0, 255),
    ward: String(o.ward ?? '').trim().slice(0, 255),
    street_address,
    is_default: o.is_default === true,
  }
}
