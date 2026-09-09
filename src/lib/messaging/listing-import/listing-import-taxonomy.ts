import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import { proposeProductStudioCategoryPath } from '@/lib/partner-website/category/partner-category-taxonomy-propose'
import type { ProductStudioJobPayload } from '@/lib/partner-website/product-studio/product-studio-types'

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
}

function hasChinese(s: string): boolean {
  return /[\u3400-\u9FFF]/.test(s)
}

/**
 * Dịch tên/mô tả + điền L1/L2/L3 — khớp bước DeepSeek taxonomy sau scrape trên 188.
 */
export async function applyListingImportTaxonomy(
  partnerId: string,
  productData: Record<string, unknown>,
  warnings: string[]
): Promise<void> {
  const titleSrc = str(productData.chinese_name) || str(productData.name)
  const descSrc = str(productData.description)
  if (!titleSrc) {
    warnings.push('taxonomy: thiếu tên — bỏ qua phân loại.')
    return
  }

  if (hasChinese(titleSrc) || hasChinese(descSrc)) {
    const r = await deepseekPartnerChat(
      'Bạn dịch listing thời trang Trung Quốc sang tiếng Việt thương mại. Trả JSON {"name":"...","description":"..."}. Không thêm markdown.',
      `Tên: ${titleSrc}\n\nMô tả:\n${descSrc.slice(0, 4000)}`,
      { feature: 'listing-import-translate', userId: null }
    )
    if (!r.error && r.text) {
      const start = r.text.indexOf('{')
      const end = r.text.lastIndexOf('}')
      if (start >= 0 && end > start) {
        try {
          const parsed = JSON.parse(r.text.slice(start, end + 1)) as { name?: string; description?: string }
          if (str(parsed.name)) productData.name = str(parsed.name).slice(0, 500)
          if (str(parsed.description)) productData.description = str(parsed.description).slice(0, 20000)
        } catch {
          warnings.push('taxonomy: không parse được JSON dịch tên.')
        }
      }
    } else if (r.error) {
      warnings.push(`taxonomy: dịch tên lỗi — ${r.error}`)
    }
  }

  if (str(productData.category) && str(productData.subcategory) && str(productData.sub_subcategory)) {
    return
  }

  const tree = (await fetchPartnerCategoriesFlatFromPg(partnerId)) ?? []
  const payload: ProductStudioJobPayload = {
    mode: 'manual',
    productName: str(productData.name) || titleSrc,
    price: typeof productData.price === 'number' ? productData.price : 0,
    material: str(productData.material),
    style: str(productData.style),
    gender: '',
    productType: 'other',
    sizes: Array.isArray(productData.sizes) ? productData.sizes.map((x) => String(x)) : [],
    noSize: !Array.isArray(productData.sizes) || (productData.sizes as unknown[]).length === 0,
    colors: [],
    mainImage: str(productData.main_image),
    gallery: [],
    description: str(productData.description),
    notes: '',
    available: typeof productData.available === 'number' ? productData.available : 0,
  }
  const proposed = await proposeProductStudioCategoryPath(payload, str(productData.name) || titleSrc, tree)
  if (!proposed) {
    warnings.push('taxonomy: không đề xuất được danh mục.')
    return
  }
  if (proposed.l1?.name) productData.category = proposed.l1.name
  if (proposed.l2?.name) productData.subcategory = proposed.l2.name
  if (proposed.l3?.name) productData.sub_subcategory = proposed.l3.name
}
