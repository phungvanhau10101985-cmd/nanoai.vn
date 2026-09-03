import { GoogleGenerativeAI } from '@google/generative-ai'
import { resolvePartnerWebsiteGeminiApiKey } from '@/lib/partner-website/partner-website-gemini-key'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import type { WebLocale } from '@/lib/i18n/config'

/**
 * W4.12 (bổ sung) — tự động sinh nội dung SEO danh mục bằng AI (Gemini), tương đương tính năng
 * "Sinh SEO bằng Gemini" của 188-com-vn (`backend/app/services/category_seo_service.py`).
 *
 * Khác 188 ở 2 điểm phù hợp kiến trúc đa tenant/đa ngôn ngữ của NanoAI:
 * 1. Sinh theo `locale` của shop (vi/en/zh/ja/ko) thay vì cố định tiếng Việt — đúng quy tắc
 *    đa ngôn ngữ của dự án (không hardcode 1 ngôn ngữ).
 * 2. Không tự nhúng thương hiệu "188.com.vn" vào prompt — dùng tên shop thật (`shopDisplayName`).
 *
 * Gọi AI khi đăng sản phẩm lên web (import đủ cột / Product Studio AI / đăng thủ công) tạo
 * danh mục mới, hoặc khi merchant bấm nút admin. Không dùng mẫu dự phòng — AI lỗi thì dừng.
 * KHÔNG tự gọi AI mỗi lần trang danh mục được render.
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
      generationConfig: { temperature: 0.6, maxOutputTokens },
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

function buildDescriptionPrompt(ctx: CategorySeoAiContext): string {
  const lang = LOCALE_LANGUAGE_NAME[ctx.locale] ?? LOCALE_LANGUAGE_NAME.vi
  return `You are an SEO expert writing for the online shop "${ctx.shopDisplayName}".
Write ONE meta description for a product category page.
Category: ${categoryLabel(ctx)}
${ctx.sampleProductNames.length ? `Example products currently in this category: ${ctx.sampleProductNames.join(', ')}` : ''}
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
  const lang = LOCALE_LANGUAGE_NAME[ctx.locale] ?? LOCALE_LANGUAGE_NAME.vi
  return `You are an SEO content writer for the online shop "${ctx.shopDisplayName}".
Write ONE paragraph (150 to 300 words) to display at the bottom of a product category page, to help
this page rank on Google for the category's main keyword.
Category: ${categoryLabel(ctx)}
${ctx.sampleProductNames.length ? `Example products currently in this category: ${ctx.sampleProductNames.join(', ')}` : ''}
Requirements:
1. 150-300 words total, a single flowing paragraph — no headings, no bullet points, no markdown
2. Naturally mention the category name 2-3 times (never stuff keywords unnaturally)
3. Describe what customers can typically find here, common use cases, and 1-2 buying tips
4. Do NOT invent specific prices, discounts, guarantees, or made-up statistics
5. Warm, trustworthy tone appropriate for an online shop named "${ctx.shopDisplayName}"
6. Write entirely in ${lang}
Return ONLY the paragraph text — no title, no markdown, no quotes.`
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
  if (rawDescription.text.length < MIN_VALID_DESCRIPTION_LEN || rawBody.text.length < MIN_VALID_BODY_LEN) {
    return { ok: false, error: 'gemini_seo_failed' }
  }
  return { ok: true, description: rawDescription.text, body: rawBody.text }
}
