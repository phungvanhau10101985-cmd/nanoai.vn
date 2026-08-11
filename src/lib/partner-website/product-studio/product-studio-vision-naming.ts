import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import type { WebLocale } from '@/lib/i18n/config'
import type { ProductStudioJobPayload } from '@/lib/partner-website/product-studio/product-studio-types'

/**
 * PS.6 — nếu mode AI để trống tên sản phẩm: Gemini Vision đọc 1 ảnh đã duyệt (màu chính) + thuộc
 * tính đã nhập để đề xuất tên SEO + phân tích ngắn + màu nhận diện được. Viết theo `locale` shop.
 */

const LOCALE_LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  zh: 'Chinese Simplified (简体中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
}

async function fetchImageAsInlinePart(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!mime.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return { mimeType: mime, data: buf.toString('base64') }
  } catch {
    return null
  }
}

export type ProductVisionNamingResult = {
  name: string
  analysis: string
  colors: string[]
}

export async function nameProductFromReferenceImage(
  userId: string | null,
  imageUrl: string,
  payload: ProductStudioJobPayload,
  locale: WebLocale
): Promise<ProductVisionNamingResult | null> {
  const inline = await fetchImageAsInlinePart(imageUrl)
  if (!inline) return null
  let apiKey: string
  try {
    apiKey = (await requireGoogleApiKeyForUser(userId)).apiKey
  } catch {
    return null
  }
  const lang = LOCALE_LANGUAGE_NAME[locale] ?? LOCALE_LANGUAGE_NAME.vi
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_25_FLASH_NO_THINKING.model })

  const attrs: string[] = []
  if (payload.productType) attrs.push(`product type: ${payload.productType}`)
  if (payload.gender) attrs.push(`gender: ${payload.gender}`)
  if (payload.material) attrs.push(`material: ${payload.material}`)
  if (payload.style) attrs.push(`style: ${payload.style}`)

  const prompt = `You are an e-commerce cataloguer. Look at the attached product photo and propose a
short, SEO-friendly product name for an online shop listing — natural, specific, no marketing fluff,
no brand names you can't see, NEVER mention any internal code/SKU.
Known attributes: ${attrs.join(', ') || 'none provided'}.
Write entirely in ${lang}.
Return ONLY this JSON: {"name": "product name (max 12 words)", "analysis": "1 short sentence describing what you see (silhouette, color, notable details)", "colors": ["color name(s) you can see, 1-3 items"]}`

  try {
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: inline.mimeType, data: inline.data } },
    ] as never)
    const text = result.response.text()?.trim() ?? ''
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const name = String(parsed.name ?? '').trim()
    if (!name) return null
    return {
      name: name.slice(0, 200),
      analysis: String(parsed.analysis ?? '').trim(),
      colors: Array.isArray(parsed.colors) ? parsed.colors.map((x) => String(x ?? '').trim()).filter(Boolean) : [],
    }
  } catch (e) {
    console.warn('[product-studio-vision-naming] failed', e)
    return null
  }
}
