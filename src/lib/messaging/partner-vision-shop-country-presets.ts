/**
 * Preset: quốc gia / vùng shop → vùng Google Cloud Vision Product Search.
 * @see partner-ai-settings-panel — chọn quốc gia gợi ý, lưu vision_shop_country + vision_location.
 */

import { VISION_LOCATIONS } from '@/lib/messaging/partner-vision-constants'

export type VisionGcpLocation = (typeof VISION_LOCATIONS)[number]

/** Thứ tự hiển thị trong Select (VN trước, rồi theo nhóm). */
export const VISION_SHOP_COUNTRY_CODES_ORDERED = [
  'VN',
  'TH',
  'SG',
  'MY',
  'ID',
  'PH',
  'KH',
  'LA',
  'BN',
  'MM',
  'JP',
  'KR',
  'TW',
  'HK',
  'US',
  'CA',
  'GB',
  'DE',
  'FR',
  'ES',
  'IT',
  'NL',
  'AU',
  'NZ',
  'IN',
] as const

export type VisionShopCountryCode = (typeof VISION_SHOP_COUNTRY_CODES_ORDERED)[number]

export const VISION_SHOP_COUNTRY_TO_LOCATION: Record<VisionShopCountryCode, VisionGcpLocation> = {
  VN: 'asia-southeast1',
  TH: 'asia-southeast1',
  SG: 'asia-southeast1',
  MY: 'asia-southeast1',
  ID: 'asia-southeast1',
  PH: 'asia-southeast1',
  KH: 'asia-southeast1',
  LA: 'asia-southeast1',
  BN: 'asia-southeast1',
  MM: 'asia-southeast1',
  JP: 'asia-east1',
  KR: 'asia-east1',
  TW: 'asia-east1',
  HK: 'asia-east1',
  US: 'us-east1',
  CA: 'us-east1',
  GB: 'europe-west1',
  DE: 'europe-west1',
  FR: 'europe-west1',
  ES: 'europe-west1',
  IT: 'europe-west1',
  NL: 'europe-west1',
  AU: 'asia-southeast1',
  NZ: 'asia-southeast1',
  IN: 'asia-southeast1',
}

export function isVisionShopCountryCode(code: string): boolean {
  const u = code.trim().toUpperCase()
  return (VISION_SHOP_COUNTRY_CODES_ORDERED as readonly string[]).includes(u)
}

export function getVisionLocationForShopCountry(code: string): VisionGcpLocation | null {
  const u = code.trim().toUpperCase()
  if (!isVisionShopCountryCode(u)) return null
  return VISION_SHOP_COUNTRY_TO_LOCATION[u as VisionShopCountryCode]
}

/** true nếu không có preset quốc gia hoặc location khớp map. */
export function shopCountryMatchesVisionLocation(country: string | null | undefined, location: string): boolean {
  const c = (country ?? '').trim().toUpperCase()
  if (!c) return true
  const expected = getVisionLocationForShopCountry(c)
  if (!expected) return false
  return expected === location
}
