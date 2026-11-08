import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'
import { nanoAiFeatureRemarketing } from '@/lib/catalog/nanoai-feature-remarketing'

/** Google Ads item id: chữ, số, gạch. Tối đa 50 ký tự. */
const ADS_ITEM_ID_MAX = 50

export type NanoAiDynamicRemarketingPageType = 'home' | 'searchresults' | 'product' | 'other'

export type NanoAiDynamicRemarketingPage = {
  pagetype: NanoAiDynamicRemarketingPageType
  contentId: string
  valueVnd: number
}

function pathOnly(pathname: string): string {
  const raw = String(pathname || '').trim() || '/'
  const cut = raw.split('?')[0]?.split('#')[0] || '/'
  if (!cut.startsWith('/')) return `/${cut}`
  return cut.length > 1 && cut.endsWith('/') ? cut.slice(0, -1) : cut
}

export function clipNanoAiAdsItemId(id: string): string {
  const clean = String(id || '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, ADS_ITEM_ID_MAX)
  return clean || 'feature_other'
}

/**
 * Một trang nanoai.vn → một id tiếp thị lại động.
 * Trang tính năng dùng đúng id feed (`feature_*`). Trang khác lấy từ đường dẫn, không lấy query.
 */
export function buildNanoAiDynamicRemarketingPage(
  pathname: string,
  matchedFeature: string | null
): NanoAiDynamicRemarketingPage {
  const path = pathOnly(pathname)
  if (path === '/') {
    return { pagetype: 'home', contentId: 'feature_home', valueVnd: 0 }
  }
  if (path === '/tim-kiem' || path.startsWith('/tim-kiem/')) {
    return { pagetype: 'searchresults', contentId: 'feature_tim_kiem', valueVnd: 0 }
  }
  const feature = String(matchedFeature || '').trim()
  if (feature) {
    const row = nanoAiFeatureRemarketing(feature)
    return {
      pagetype: 'product',
      contentId: clipNanoAiAdsItemId(row.contentId),
      valueVnd: row.valueVnd,
    }
  }
  return {
    pagetype: 'other',
    contentId: clipNanoAiAdsItemId(toNanoAiFeatureCatalogIdFromHref(path)),
    valueVnd: 0,
  }
}
