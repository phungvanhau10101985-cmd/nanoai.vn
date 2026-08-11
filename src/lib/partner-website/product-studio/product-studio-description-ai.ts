import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import type { WebLocale } from '@/lib/i18n/config'
import type { ProductStudioJobPayload } from '@/lib/partner-website/product-studio/product-studio-types'

/**
 * PS.7 — DeepSeek viết mô tả sản phẩm cuối (chỉ gọi khi merchant để trống mô tả lúc publish).
 * Viết theo `locale` shop (không hardcode tiếng Việt như 188) + brand voice = tên shop thật
 * (không hardcode "188.com.vn").
 */

const LOCALE_LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  zh: 'Chinese Simplified (简体中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
}

export async function generateProductStudioDescription(
  payload: ProductStudioJobPayload,
  productName: string,
  locale: WebLocale,
  brandName: string
): Promise<string | null> {
  const lang = LOCALE_LANGUAGE_NAME[locale] ?? LOCALE_LANGUAGE_NAME.vi
  const attrs = [
    payload.material ? `material: ${payload.material}` : '',
    payload.style ? `style: ${payload.style}` : '',
    payload.gender ? `for: ${payload.gender}` : '',
    payload.sizes?.length ? `sizes: ${payload.sizes.join(', ')}` : '',
    payload.colors?.length ? `colors: ${payload.colors.map((c) => c.name).join(', ')}` : '',
    payload.notes ? `admin note: ${payload.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const system = `You are an e-commerce copywriter for the online shop "${brandName}". Write honest, persuasive
product descriptions using ONLY the facts given — never invent specs, certifications, or claims. Write
entirely in ${lang}. NEVER mention SKU/internal codes.`
  const user = `Product name: ${productName}
${attrs}

Task: write a product listing description (60-120 words) highlighting the material/style/use-case benefits
naturally, ending with a soft call to action. Plain text only, no markdown, no headings.
Return ONLY the description text.`

  const r = await deepseekPartnerChat(system, user, { feature: 'product-studio-description-ai', userId: null })
  if (r.error || !r.text) {
    console.warn('[product-studio-description-ai] failed', r.error)
    return null
  }
  return r.text.trim().slice(0, 3000)
}
