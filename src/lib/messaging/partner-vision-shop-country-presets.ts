/**
 * Preset: quốc gia / vùng shop → vùng Vertex AI Vision Image Warehouse.
 * @see partner-ai-settings-panel — chọn quốc gia gợi ý, lưu vision_shop_country + vision_location.
 */

import type { VisionGcpLocation } from '@/lib/messaging/partner-vision-constants'

export type { VisionGcpLocation }

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
  VN: 'us-central1',
  TH: 'us-central1',
  SG: 'us-central1',
  MY: 'us-central1',
  ID: 'us-central1',
  PH: 'us-central1',
  KH: 'us-central1',
  LA: 'us-central1',
  BN: 'us-central1',
  MM: 'us-central1',
  JP: 'us-central1',
  KR: 'us-central1',
  TW: 'us-central1',
  HK: 'us-central1',
  US: 'us-central1',
  CA: 'us-central1',
  GB: 'europe-west4',
  DE: 'europe-west4',
  FR: 'europe-west4',
  ES: 'europe-west4',
  IT: 'europe-west4',
  NL: 'europe-west4',
  AU: 'us-central1',
  NZ: 'us-central1',
  IN: 'us-central1',
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
