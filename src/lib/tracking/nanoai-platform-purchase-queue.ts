import { cookies } from 'next/headers'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { nanoAiFeatureRemarketing } from '@/lib/catalog/nanoai-feature-remarketing'
import {
  CURRICULUM_CONTENT_ID,
  NANO_PLATFORM_PURCHASE_COOKIE,
  STUDENT_PLAN_CONTENT_ID,
  designPurchaseHref,
  parsePlatformPurchases,
  serializePlatformPurchases,
  type PlatformPurchaseRow,
} from '@/lib/tracking/nanoai-platform-commerce'

function remember(row: PlatformPurchaseRow): void {
  if (!row.contentId || row.valueVnd <= 0 || !row.orderId) return
  try {
    const jar = cookies()
    const prev = parsePlatformPurchases(jar.get(NANO_PLATFORM_PURCHASE_COOKIE)?.value || '')
    const next = [...prev.filter((item) => item.orderId !== row.orderId), row].slice(-8)
    jar.set(NANO_PLATFORM_PURCHASE_COOKIE, serializePlatformPurchases(next), {
      path: '/',
      maxAge: 180,
      sameSite: 'lax',
      httpOnly: false,
    })
  } catch {
    // Worker / script ngoài request không có cookie trình duyệt.
  }
}

/** Trừ credit thành công trên tính năng ảnh/thiết kế. Giá trị = số credit × đơn giá. */
export function rememberDesignCreditPurchase(feature: string, credits: number): void {
  const href = designPurchaseHref(feature)
  const charged = Number(credits)
  if (!href || !Number.isFinite(charged) || charged <= 0) return
  const { contentId } = nanoAiFeatureRemarketing(href)
  const valueVnd = Math.max(1, Math.round(charged * CREDIT_UNIT_PRICE_VND))
  remember({
    contentId,
    valueVnd,
    orderId: `cr_${contentId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    contentName: href,
  })
}

/** Mua gói học sinh. Giá trị đơn = giá gói. */
export function rememberStudentPlanPurchase(input: { orderId: string; priceVnd: number }): void {
  remember({
    contentId: STUDENT_PLAN_CONTENT_ID,
    valueVnd: Math.round(input.priceVnd),
    orderId: input.orderId.slice(0, 80),
    contentName: 'Gói học sinh',
  })
}

/** Trả credit để tạo / mua giáo trình. */
export function rememberCurriculumPurchase(input: { orderId: string; priceVnd: number }): void {
  remember({
    contentId: CURRICULUM_CONTENT_ID,
    valueVnd: Math.round(input.priceVnd),
    orderId: input.orderId.slice(0, 80),
    contentName: 'Tạo giáo trình AI',
  })
}
