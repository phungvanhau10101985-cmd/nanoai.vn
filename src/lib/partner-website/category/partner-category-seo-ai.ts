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
 * Giống 188 ở chỗ: gọi AI theo yêu cầu (nút admin), KHÔNG tự gọi AI mỗi lần trang danh mục được
 * render — trang công khai chỉ đọc `seo_body`/`seo_description` đã lưu sẵn trong DB.
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

async function callGeminiText(prompt: string, maxOutputTokens: number): Promise<string | null> {
  const key = resolvePartnerWebsiteGeminiApiKey()
  if (!key) return null
  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: GEMINI_25_FLASH_NO_THINKING.model,
      generationConfig: { temperature: 0.6, maxOutputTokens },
    })
    const result = await model.generateContent(prompt)
    const text = result.response.text()?.trim() ?? ''
    return text || null
  } catch (e) {
    console.warn('[partner-category-seo-ai] Gemini call failed', e)
    return null
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

function fallbackDescription(ctx: CategorySeoAiContext): string {
  const label = ctx.categoryName
  const templates: Record<WebLocale, string> = {
    vi: `${label} chính hãng, đa dạng mẫu mã tại ${ctx.shopDisplayName}. Giao hàng nhanh, đổi trả dễ dàng. Khám phá ngay hôm nay!`,
    en: `Shop ${label} at ${ctx.shopDisplayName} — genuine products, wide selection, fast delivery and easy returns. Explore now!`,
    zh: `在 ${ctx.shopDisplayName} 选购正品${label}，款式多样，配送快捷，退换无忧。立即选购！`,
    ja: `${ctx.shopDisplayName}で${label}をお買い求めください。豊富な品揃え、迅速な配送、簡単な返品。今すぐチェック!`,
    ko: `${ctx.shopDisplayName}에서 정품 ${label}을(를) 만나보세요. 다양한 상품, 빠른 배송, 간편한 반품. 지금 확인하세요!`,
  }
  return (templates[ctx.locale] ?? templates.vi).slice(0, 160)
}

function fallbackBody(ctx: CategorySeoAiContext): string {
  const label = ctx.categoryName
  const templates: Record<WebLocale, string> = {
    vi: `${label} là một trong những danh mục sản phẩm được quan tâm tại ${ctx.shopDisplayName}. Chúng tôi liên tục cập nhật những mẫu ${label.toLowerCase()} mới với chất lượng đảm bảo, phù hợp cho nhiều nhu cầu sử dụng khác nhau. Khi lựa chọn ${label.toLowerCase()}, khách hàng nên cân nhắc kỹ về chất liệu, kích thước và mục đích sử dụng để có được sản phẩm ưng ý nhất. Đội ngũ ${ctx.shopDisplayName} luôn sẵn sàng tư vấn chi tiết giúp bạn chọn được sản phẩm phù hợp với nhu cầu và ngân sách. Với chính sách đổi trả linh hoạt cùng dịch vụ giao hàng nhanh chóng, mua sắm ${label.toLowerCase()} tại ${ctx.shopDisplayName} mang lại trải nghiệm thuận tiện và an tâm. Hãy khám phá thêm nhiều lựa chọn ${label.toLowerCase()} đa dạng về mẫu mã, phong cách để tìm ra sản phẩm phù hợp nhất với bạn.`,
    en: `${label} is one of the most popular categories at ${ctx.shopDisplayName}. We regularly update our ${label.toLowerCase()} selection with quality items suited to a variety of needs. When choosing ${label.toLowerCase()}, it's worth considering material, size, and intended use to find the best fit. Our team at ${ctx.shopDisplayName} is always ready to help you pick the right option for your needs and budget. With flexible returns and fast shipping, shopping for ${label.toLowerCase()} at ${ctx.shopDisplayName} is convenient and worry-free. Browse our full range of ${label.toLowerCase()} styles and designs to find exactly what you're looking for.`,
    zh: `${label}是${ctx.shopDisplayName}最受欢迎的品类之一。我们持续更新优质的${label}系列，满足不同使用需求。选购${label}时，建议关注材质、尺码和使用场景，以挑选到最合适的产品。${ctx.shopDisplayName}团队随时为您提供专业建议，帮助您在预算内找到心仪商品。灵活的退换货政策与快速配送服务，让您在${ctx.shopDisplayName}选购${label}更加安心便捷。欢迎浏览更多款式与风格的${label}，找到最适合您的选择。`,
    ja: `${label}は${ctx.shopDisplayName}で人気のカテゴリーの一つです。さまざまなニーズに対応できるよう、品質にこだわった${label}を随時更新しています。${label}を選ぶ際は、素材やサイズ、用途をよくご確認いただくことで、より満足度の高い商品をお選びいただけます。${ctx.shopDisplayName}のスタッフが、ご予算やご要望に合わせて丁寧にご提案いたします。柔軟な返品ポリシーと迅速な配送により、${ctx.shopDisplayName}での${label}のお買い物を安心してお楽しみいただけます。ぜひ豊富なデザインの${label}をご覧ください。`,
    ko: `${label}은(는) ${ctx.shopDisplayName}에서 인기 있는 카테고리 중 하나입니다. 다양한 용도에 맞는 품질 좋은 ${label} 상품을 지속적으로 업데이트하고 있습니다. ${label}을(를) 선택할 때는 소재, 사이즈, 사용 목적을 꼼꼼히 확인하시면 더 만족스러운 제품을 고르실 수 있습니다. ${ctx.shopDisplayName} 팀이 예산과 필요에 맞는 상품을 친절하게 안내해 드립니다. 유연한 반품 정책과 빠른 배송으로 ${ctx.shopDisplayName}에서의 ${label} 쇼핑이 더욱 편리하고 안심됩니다. 다양한 스타일의 ${label}을(를) 지금 둘러보세요.`,
  }
  return templates[ctx.locale] ?? templates.vi
}

export type CategorySeoAiResult = {
  description: string
  body: string
  /** `false` nếu Gemini không cấu hình/không phản hồi và hệ thống phải dùng câu mẫu dự phòng. */
  usedAi: boolean
}

/** Sinh cả seo_description + seo_body cùng lúc (2 lời gọi Gemini song song). Luôn trả về nội dung — dùng mẫu dự phòng nếu AI lỗi/chưa cấu hình. */
/** Ngưỡng tối thiểu coi là câu trả lời hợp lệ — chặn trường hợp bị cắt cụt do hết ngân sách "thinking" token. */
const MIN_VALID_DESCRIPTION_LEN = 40
const MIN_VALID_BODY_LEN = 200

export async function generatePartnerCategorySeoContent(ctx: CategorySeoAiContext): Promise<CategorySeoAiResult> {
  // maxOutputTokens rộng rãi: gemini-2.5-flash không hỗ trợ tắt "thinking" (xem gemini-config.ts),
  // token suy luận nội bộ trừ vào cùng ngân sách này — đặt thấp sẽ khiến câu trả lời bị cắt cụt.
  const [rawDescription, rawBody] = await Promise.all([
    callGeminiText(buildDescriptionPrompt(ctx), 1024),
    callGeminiText(buildBodyPrompt(ctx), 4096),
  ])
  const description = rawDescription && rawDescription.length >= MIN_VALID_DESCRIPTION_LEN ? rawDescription : null
  const body = rawBody && rawBody.length >= MIN_VALID_BODY_LEN ? rawBody : null
  if (description && body) return { description, body, usedAi: true }
  return {
    description: description || fallbackDescription(ctx),
    body: body || fallbackBody(ctx),
    usedAi: Boolean(description || body),
  }
}
