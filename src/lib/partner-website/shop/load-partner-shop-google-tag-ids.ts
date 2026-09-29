import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

/**
 * Đọc GA4 / Ads theo slug. Chỉ gọi từ server (layout).
 * Không import file này từ module mà preview Sửa nhanh kéo vào trình duyệt.
 */
export async function loadPartnerShopGoogleTagIdsBySlug(slug: string): Promise<{
  ga4MeasurementId: string | null
  googleAdsId: string | null
} | null> {
  const key = slug.trim()
  if (!key || !/^[a-z0-9][a-z0-9-]{0,80}$/i.test(key) || !isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ga4_measurement_id: string | null; google_ads_id: string | null }>(
      `select nullif(trim(coalesce(ga4_measurement_id, '')), '') as ga4_measurement_id,
              nullif(trim(coalesce(google_ads_id, '')), '') as google_ads_id
         from public.messaging_partners
        where slug = $1
        limit 1`,
      [key]
    )
    if (!row) return null
    return {
      ga4MeasurementId: row.ga4_measurement_id ? String(row.ga4_measurement_id).trim() : null,
      googleAdsId: row.google_ads_id ? String(row.google_ads_id).trim() : null,
    }
  } catch (e) {
    console.warn('[loadPartnerShopGoogleTagIdsBySlug]', e)
    return null
  }
}
