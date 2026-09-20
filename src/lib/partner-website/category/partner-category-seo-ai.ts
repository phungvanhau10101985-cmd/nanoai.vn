import { GoogleGenerativeAI } from '@google/generative-ai'
import { resolvePartnerWebsiteGeminiApiKey } from '@/lib/partner-website/partner-website-gemini-key'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import type { WebLocale } from '@/lib/i18n/config'

/**
 * Sinh SEO danh mục — cùng Gemini 2.5 Flash + cùng yêu cầu nội dung với
 * 188-com-vn `category_seo_service.py` (meta 140–155 ký tự, đoạn 150–300 từ,
 * gợi ý kiểu/bảo quản, internal link danh mục anh em).
 *
 * Khác 188 (đa tenant): tên shop thật, locale shop, không slogan 188, không mẫu dự phòng.
 * Gọi khi đăng SP tạo danh mục mới hoặc nút admin. Không gọi lúc khách mở `/c/…`.
 */

const LOCALE_LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  zh: 'Chinese Simplified (简体中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
}

export type CategorySeoAiContext = {
  categoryName: string
  /** Tên breadcrumb từ gốc tới danh mục hiện tại, vd ["Áo", "Áo thun nam"]. */
  breadcrumbNames: string[]
  productCount: number
  sampleProductNames: string[]
  /** Tên danh mục anh em cùng cấp — AI nhắc 2–3 tên để gắn internal link (188). */
  relatedCategoryNames?: string[]
  shopDisplayName: string
  locale: WebLocale
}

export type CategorySeoAiError = 'gemini_not_configured' | 'gemini_seo_failed'

async function callGeminiText(
  prompt: string,
  maxOutputTokens: number
): Promise<{ ok: true; text: string } | { ok: false; error: CategorySeoAiError }> {
  const key = resolvePartnerWebsiteGeminiApiKey()
  if (!key) return { ok: false, error: 'gemini_not_configured' }
  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: GEMINI_25_FLASH_NO_THINKING.model,
      generationConfig: { temperature: 0.7, maxOutputTokens },
    })
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() ?? ''
    if (!text) return { ok: false, error: 'gemini_seo_failed' }
    return { ok: true, text }
  } catch (e) {
    console.warn('[partner-category-seo-ai] Gemini call failed', e)
    return { ok: false, error: 'gemini_seo_failed' }
  }
}

function categoryLabel(ctx: CategorySeoAiContext): string {
  return ctx.breadcrumbNames.length > 0 ? ctx.breadcrumbNames.join(' > ') : ctx.categoryName
}

function sampleContext(ctx: CategorySeoAiContext): string {
  if (!ctx.sampleProductNames.length) return ''
  return `\nVí dụ sản phẩm trong danh mục: ${ctx.sampleProductNames.slice(0, 5).join(', ')}`
}

function relatedInstruction(ctx: CategorySeoAiContext): string {
  const names = (ctx.relatedCategoryNames ?? []).map((n) => n.trim()).filter(Boolean).slice(0, 8)
  if (names.length === 0) return ''
  const namesStr = names.join(', ')
  if (ctx.locale === 'vi') {
    return `
4. QUAN TRỌNG - Internal link: Hãy nhắc một cách TỰ NHIÊN ít nhất 2-3 trong các danh mục sau (đúng tên để hệ thống gắn link): ${namesStr}.
   Ví dụ: "Bên cạnh ..., bạn có thể xem thêm [tên 1], [tên 2] để đa dạng tủ đồ." Dùng đúng chính tả tên danh mục như trong list.`
  }
  return `
4. IMPORTANT — internal links: naturally mention at least 2-3 of these sibling category names (exact spelling): ${namesStr}.`
}

function buildDescriptionPrompt(ctx: CategorySeoAiContext): string {
  const shop = ctx.shopDisplayName
  const name = ctx.categoryName
  const breadcrumb = categoryLabel(ctx)
  if (ctx.locale === 'vi') {
    return `Bạn là chuyên gia SEO cho website shop "${shop}".
Nhiệm vụ: Viết meta description chuẩn SEO cho trang danh mục sản phẩm.

Thông tin danh mục:
- Tên: ${name}
- Đường dẫn: ${breadcrumb}${sampleContext(ctx)}

Yêu cầu:
1. Độ dài: 140-155 ký tự (tối ưu cho Google)
2. Bắt đầu bằng từ khóa chính (tên danh mục)
3. Bao gồm: lợi ích mua hàng (đa dạng mẫu mã, chất lượng). KHÔNG ghi số lượng sản phẩm cụ thể (số thay đổi hàng ngày).
4. Kêu gọi hành động (CTA) nhẹ nhàng
5. Tự nhiên, không spam từ khóa
6. Phù hợp thương hiệu "${shop}"

Chỉ trả về mô tả, không giải thích, không markdown, không dấu ngoặc kép.`
  }
  const lang = LOCALE_LANGUAGE_NAME[ctx.locale] ?? LOCALE_LANGUAGE_NAME.vi
  return `You are an SEO expert writing for the online shop "${shop}".
Write ONE meta description for a product category page.
Category: ${breadcrumb}
${ctx.sampleProductNames.length ? `Example products currently in this category: ${ctx.sampleProductNames.slice(0, 5).join(', ')}` : ''}
Requirements:
1. Length: 140-155 characters (optimized for Google search results)
2. Start with the main keyword (the category name)
3. Mention a shopping benefit naturally — do NOT include an exact product count (it changes daily)
4. Add a soft call-to-action at the end
5. Natural tone, no keyword stuffing, no emoji
6. Write entirely in ${lang}
Return ONLY the description text — no quotes, no markdown, no explanation.`
}

function buildBodyPrompt(ctx: CategorySeoAiContext): string {
  const shop = ctx.shopDisplayName
  const name = ctx.categoryName
  const breadcrumb = categoryLabel(ctx)
  const related = relatedInstruction(ctx)
  if (ctx.locale === 'vi') {
    return `Bạn là chuyên gia nội dung SEO cho website shop "${shop}".
Nhiệm vụ: Viết MỘT đoạn văn (paragraph) từ 150 đến 300 từ, dùng cho cuối trang danh mục sản phẩm.

Thông tin danh mục:
- Tên: ${name}
- Đường dẫn: ${breadcrumb}.${sampleContext(ctx)}

Yêu cầu nội dung (tự nhiên, không liệt kê số):
- KHÔNG đề cập số lượng sản phẩm cụ thể (số thay đổi hàng ngày). Có thể dùng "đa dạng", "nhiều mẫu mã" nếu cần.
1. Tại sao nên mua ${name.toLowerCase()} tại ${shop} (chất lượng, giá, giao hàng).
2. Các kiểu dáng/loại phổ biến phù hợp với danh mục này (ví dụ giày: Oxford, Derby, Loafer; áo: slim, regular...).
3. Gợi ý bảo quản hoặc phối đồ ngắn gọn (1-2 câu).${related}

Giọng văn: thân thiện, chuyên nghiệp, có CTA nhẹ (xem thêm, mua ngay tại ${shop}). Không spam từ khóa.
Chỉ trả về đoạn văn liền mạch, không tiêu đề con, không markdown, không dấu ngoặc kép.`
  }
  const lang = LOCALE_LANGUAGE_NAME[ctx.locale] ?? LOCALE_LANGUAGE_NAME.vi
  return `You are an SEO content writer for the online shop "${shop}".
Write ONE paragraph (150 to 300 words) to display at the bottom of a product category page.
Category: ${breadcrumb}
${ctx.sampleProductNames.length ? `Example products: ${ctx.sampleProductNames.slice(0, 5).join(', ')}.` : ''}
Requirements:
- Do NOT mention a specific product count (it changes daily).
1. Why shop ${name} at ${shop} (quality, price, delivery).
2. Popular styles/types in this category.
3. One or two short care or styling tips.${related}
4. Do NOT invent specific prices, discounts, guarantees, or made-up statistics.
5. Warm, trustworthy tone. Soft CTA to view more at ${shop}.
6. Write entirely in ${lang}
Return ONLY the paragraph — no title, no markdown, no quotes.`
}

export type CategorySeoAiResult =
  | { ok: true; description: string; body: string }
  | { ok: false; error: CategorySeoAiError }

/** Title trang danh mục (~60 ký tự) — không tốn thêm lời gọi AI. */
export function buildPartnerCategorySeoTitle(categoryName: string, shopDisplayName: string): string {
  const name = categoryName.trim()
  const shop = shopDisplayName.trim()
  const raw = shop && shop.toLowerCase() !== name.toLowerCase() ? `${name} | ${shop}` : name
  return raw.slice(0, 60)
}

function normalizeDescription(text: string): string {
  let content = text.trim().replace(/^["']+|["']+$/g, '')
  if (content.length > 160) content = `${content.slice(0, 157)}...`
  return content
}

function normalizeBody(text: string): string {
  let content = text.trim().replace(/^["']+|["']+$/g, '')
  if (content.length > 2200) content = `${content.slice(0, 2197)}...`
  return content
}

/** Sinh cả seo_description + seo_body. Không dùng mẫu dự phòng — AI lỗi thì trả error và caller phải dừng. */
const MIN_VALID_DESCRIPTION_LEN = 40
const MIN_VALID_BODY_LEN = 200

export async function generatePartnerCategorySeoContent(ctx: CategorySeoAiContext): Promise<CategorySeoAiResult> {
  // maxOutputTokens rộng rãi: gemini-2.5-flash không hỗ trợ tắt "thinking" (xem gemini-config.ts),
  // token suy luận nội bộ trừ vào cùng ngân sách này — đặt thấp sẽ khiến câu trả lời bị cắt cụt.
  const [rawDescription, rawBody] = await Promise.all([
    callGeminiText(buildDescriptionPrompt(ctx), 1024),
    callGeminiText(buildBodyPrompt(ctx), 4096),
  ])
  if (!rawDescription.ok) return rawDescription
  if (!rawBody.ok) return rawBody
  const description = normalizeDescription(rawDescription.text)
  const body = normalizeBody(rawBody.text)
  if (description.length < MIN_VALID_DESCRIPTION_LEN || body.length < MIN_VALID_BODY_LEN) {
    return { ok: false, error: 'gemini_seo_failed' }
  }
  return { ok: true, description, body }
}
