import { matchVietnamProvince } from '@/lib/partner-website/shop/vietnam-provinces'

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

function stripProvinceSuffix(line: string, province: string): string {
  const trimmed = line.trim()
  const name = province.trim()
  if (!name) return trimmed
  const lower = trimmed.toLowerCase()
  const suffix = name.toLowerCase()
  for (const mark of [`, ${suffix}`, ` ${suffix}`]) {
    if (lower.endsWith(mark)) {
      return trimmed.slice(0, trimmed.length - mark.length).replace(/[,\s]+$/, '').trim()
    }
  }
  return trimmed
}

/** Tách dòng địa chỉ chat/giỏ thành phố + tỉnh chuẩn, không nhân đôi tên tỉnh. */
export function splitCheckoutAddressForBook(input: {
  shippingAddress: string
  shippingProvince?: string | null
}): { street_address: string; province: string } {
  const line = String(input.shippingAddress ?? '').trim().slice(0, 500)
  const province =
    matchVietnamProvince(input.shippingProvince) || matchVietnamProvince(line) || ''
  if (!province) return { street_address: line, province: '' }
  const street = stripProvinceSuffix(line, province)
  if (street.length >= 5) return { street_address: street, province }
  return { street_address: line, province }
}

/**
 * Tỉnh gửi lúc đặt: ưu tiên tỉnh sổ khi dòng địa chỉ vẫn thuộc tỉnh đó.
 * Khách đổi sang tỉnh khác trong ô chữ thì dùng tỉnh mới.
 */
export function resolveCheckoutShippingProvince(input: {
  bookProvince?: string | null
  shippingAddress?: string | null
}): string {
  const book = matchVietnamProvince(input.bookProvince) || ''
  const fromLine = matchVietnamProvince(input.shippingAddress) || ''
  if (book && fromLine && book !== fromLine) return fromLine
  return book || fromLine
}

/** Bản ghi sổ mặc định từ form chat. Thiếu tên / SĐT / địa chỉ thì không ghi sổ. */
export function checkoutAddressBookInputFromOrder(input: {
  customerName: string
  customerPhone: string
  shippingAddress: string
  shippingProvince?: string | null
}): PartnerSiteCustomerAddressInput | null {
  const full_name = String(input.customerName ?? '').trim().slice(0, 255)
  const phone = String(input.customerPhone ?? '').replace(/\s+/g, '').slice(0, 20)
  const shippingAddress = String(input.shippingAddress ?? '').trim().slice(0, 500)
  if (full_name.length < 2 || phone.length < 10 || shippingAddress.length < 5) return null
  const split = splitCheckoutAddressForBook({
    shippingAddress,
    shippingProvince: input.shippingProvince,
  })
  if (split.street_address.trim().length < 5) return null
  return {
    full_name,
    phone,
    province: split.province,
    district: '',
    ward: '',
    street_address: split.street_address,
    is_default: true,
  }
}
