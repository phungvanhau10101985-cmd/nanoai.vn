import { fetchMessagingPartnerBySlugFromPg, isMessagingPartnerInboundOpen } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'

export type ActiveMessagingPartner = {
  id: string
  display_name: string
  embed_key: string
  /** URL logo shop — hiển thị tròn (crop góc vuông). */
  logo_url: string | null
  /** Meta Pixel ID — fbq trên trang tư vấn (không bí mật). */
  facebook_pixel_id: string | null
  /** GA4 measurement ID — gtag config thứ hai trên trang tư vấn (Realtime trong GA4). */
  ga4_measurement_id: string | null
}

/**
 * Partner guest (slug) còn active — chỉ Postgres.
 */
export async function resolveActiveMessagingPartnerBySlug(slug: string): Promise<ActiveMessagingPartner | null> {
  if (isReservedMessagingGuestSlug(slug)) return null
  if (!isPgConfigured()) {
    console.warn('[resolveActiveMessagingPartnerBySlug] DATABASE_URL not set')
    return null
  }
  const fromPg = await fetchMessagingPartnerBySlugFromPg(slug)
  if (!fromPg) return null
  if (!isMessagingPartnerInboundOpen(fromPg)) return null
  return {
    id: fromPg.id,
    display_name: fromPg.display_name,
    embed_key: fromPg.embed_key,
    logo_url: fromPg.logo_url,
    facebook_pixel_id: fromPg.facebook_pixel_id?.trim() || null,
    ga4_measurement_id: fromPg.ga4_measurement_id?.trim() || null,
  }
}
