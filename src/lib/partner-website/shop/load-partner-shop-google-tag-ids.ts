import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

/**
 * Đọc GA4 / Ads / Pixel / TikTok / GTM theo slug. Chỉ gọi từ server (layout).
 * Không import file này từ module mà preview Sửa nhanh kéo vào trình duyệt.
 */
export async function loadPartnerShopGoogleTagIdsBySlug(slug: string): Promise<{
  ga4MeasurementId: string | null
  googleAdsId: string | null
  facebookPixelId: string | null
  tiktokPixelId: string | null
  gtmContainerId: string | null
} | null> {
  const key = slug.trim()
  if (!key || !/^[a-z0-9][a-z0-9-]{0,80}$/i.test(key) || !isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      ga4_measurement_id: string | null
      google_ads_id: string | null
      facebook_pixel_id: string | null
      tiktok_pixel_id: string | null
      gtm_container_id: string | null
    }>(
      `select nullif(trim(coalesce(ga4_measurement_id, '')), '') as ga4_measurement_id,
              nullif(trim(coalesce(google_ads_id, '')), '') as google_ads_id,
              nullif(trim(coalesce(facebook_pixel_id, '')), '') as facebook_pixel_id,
              nullif(trim(coalesce(tiktok_pixel_id, '')), '') as tiktok_pixel_id,
              nullif(trim(coalesce(gtm_container_id, '')), '') as gtm_container_id
         from public.messaging_partners
        where slug = $1
        limit 1`,
      [key]
    )
    if (!row) return null
    return {
      ga4MeasurementId: row.ga4_measurement_id ? String(row.ga4_measurement_id).trim() : null,
      googleAdsId: row.google_ads_id ? String(row.google_ads_id).trim() : null,
      facebookPixelId: row.facebook_pixel_id ? String(row.facebook_pixel_id).trim() : null,
      tiktokPixelId: row.tiktok_pixel_id ? String(row.tiktok_pixel_id).trim() : null,
      gtmContainerId: row.gtm_container_id ? String(row.gtm_container_id).trim() : null,
    }
  } catch (e) {
    console.warn('[loadPartnerShopGoogleTagIdsBySlug]', e)
    return null
  }
}
