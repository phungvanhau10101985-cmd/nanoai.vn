import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { toNanoAiFeatureCatalogIdFromHref } from '@/lib/catalog/nanoai-feature-catalog-id'
import { WEDDING_ADD_TO_CART_VALUE_VND, WEDDING_COMMERCE_PATH } from '@/lib/wedding/wedding-commerce-events'

/**
 * Id nội dung remarketing = cột `id` feed Facebook catalog (`/catalog/nanoai-facebook-feed.csv`).
 * Giá xem / thêm giỏ cùng giá dòng feed đó.
 */
export function nanoAiFeatureRemarketing(href: string): { contentId: string; valueVnd: number } {
  const path = String(href || '').trim() || '/'
  return {
    contentId: toNanoAiFeatureCatalogIdFromHref(path),
    valueVnd: path === WEDDING_COMMERCE_PATH ? WEDDING_ADD_TO_CART_VALUE_VND : CREDIT_UNIT_PRICE_VND,
  }
}
