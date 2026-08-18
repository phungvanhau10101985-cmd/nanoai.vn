import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import type { WebLocale } from '@/lib/i18n/config'
import type {
  LandingAiContext,
  LandingFaqData,
  LandingHeroData,
  LandingHighlightsData,
  LandingTrustCtaData,
} from '@/lib/partner-website/landing/landing-ai-types'

/**
 * L3.3 — Sinh text từng section bằng DeepSeek (JSON-mode qua prompt, không phải response_format cứng
 * vì `deepseekPartnerChat` dùng chung cho nhiều tính năng). Brand voice = tên shop THẬT (không hardcode
 * "188.com.vn"), viết theo `locale` của shop (không hardcode tiếng Việt) — xem 188_BEHAVIOR_SPEC.md.
 */

const LOCALE_LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  zh: 'Chinese Simplified (简体中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
}

function languageNameFor(locale: string): string {
  return LOCALE_LANGUAGE_NAME[locale as WebLocale] ?? LOCALE_LANGUAGE_NAME.vi
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

const BRAND_VOICE = (brandName: string, lang: string) =>
  `You are an expert e-commerce copywriter for the online shop "${brandName}". Write persuasive, honest sales copy — ` +
  `use ONLY facts present in the shop data below, never invent specs or claims that aren't there. ` +
  `Write entirely in ${lang}. NEVER mention SKU/internal codes/product IDs — only benefits and selling points.`

function contextBlock(context: LandingAiContext): string {
  const lines: string[] = [`Landing page title: ${context.title}`]
  if (context.categoryName) {
    lines.push(
      context.sourceType === 'category'
        ? `IMPORTANT — CATEGORY LANDING: all content (hero, highlights, material, FAQ) must revolve around the category "${context.categoryName}". Some extra off-topic products may appear at the end of the grid — do NOT write marketing copy about those.`
        : `Most products in this landing belong to category "${context.categoryName}" (its category page is the main SEO page for this keyword). This landing is a curated collection — do NOT copy that category page's title/description verbatim; find a distinct angle (collection, material, occasion).`
    )
  }
  if (context.materialFilter) {
    lines.push(`Mandatory material filter for the product grid: "${context.materialFilter}" — all copy must reflect this angle.`)
  }
  if (context.categorySeoTitle) lines.push(`Main category SEO title (AVOID duplicating): ${context.categorySeoTitle}`)
  if (context.categorySeoDescription) {
    lines.push(`Main category SEO description (avoid rewriting near-identically): ${context.categorySeoDescription.slice(0, 220)}`)
  }
  const names = context.products.map((p) => p.name).filter(Boolean).slice(0, 6)
  if (names.length) lines.push(`Featured products: ${names.join(', ')}`)
  if (context.dominantMaterial) lines.push(`Dominant material: ${context.dominantMaterial}`)
  if (context.priceMin != null && context.priceMax != null) {
    lines.push(`Price range: ${context.priceMin.toLocaleString()} - ${context.priceMax.toLocaleString()}`)
  }
  if (context.briefText.trim()) lines.push(`Admin creative direction (follow closely): ${context.briefText.trim()}`)
  return lines.join('\n')
}

async function callJson(system: string, user: string, feature: string): Promise<Record<string, unknown> | null> {
  const r = await deepseekPartnerChat(system, user, { feature, userId: null })
  if (r.error || !r.text) {
    console.warn(`[landing-ai-content-generator] ${feature} failed`, r.error)
    return null
  }
  return extractJsonObject(r.text)
}

export async function generateLandingHeroText(
  context: LandingAiContext,
  customInstruction?: string
): Promise<LandingHeroData | null> {
  const lang = languageNameFor(context.locale)
  const extra = customInstruction ? `\nExtra admin instruction: ${customInstruction}` : ''
  const system = BRAND_VOICE(context.brandName, lang)
  const user = `${contextBlock(context)}${extra}

Task: write the HERO section opening this sales landing page.
Return ONLY this JSON: {"headline": "short attention-grabbing headline (max 12 words)", "subheadline": "1-2 sentence supporting line with the key value proposition"}`
  const data = await callJson(system, user, 'ladipage-ai-hero')
  if (!data) return null
  return {
    headline: String(data.headline ?? context.title).trim().slice(0, 160),
    subheadline: String(data.subheadline ?? '').trim().slice(0, 300),
  }
}

export async function generateLandingHighlightsText(
  context: LandingAiContext,
  customInstruction?: string
): Promise<LandingHighlightsData | null> {
  const lang = languageNameFor(context.locale)
  const extra = customInstruction ? `\nExtra admin instruction: ${customInstruction}` : ''
  const system = BRAND_VOICE(context.brandName, lang)
  const user = `${contextBlock(context)}${extra}

Task: write 4-6 key selling points / highlights for this product(s)/collection.
Return ONLY this JSON: {"items": [{"title": "short highlight name (3-6 words)", "desc": "1 sentence"}]}`
  const data = await callJson(system, user, 'ladipage-ai-highlights')
  if (!data || !Array.isArray(data.items)) return null
  const items = (data.items as Record<string, unknown>[])
    .map((it) => ({ title: String(it.title ?? '').trim(), desc: String(it.desc ?? '').trim() }))
    .filter((it) => it.title || it.desc)
    .slice(0, 6)
  return items.length ? { items } : null
}

export async function generateLandingMaterialText(
  context: LandingAiContext,
  material: string,
  customInstruction?: string
): Promise<{ body: string; callouts: string[] } | null> {
  const lang = languageNameFor(context.locale)
  const extra = customInstruction ? `\nExtra admin instruction: ${customInstruction}` : ''
  const system = BRAND_VOICE(context.brandName, lang)
  const user = `${contextBlock(context)}
Material/USP to explain: ${material}${extra}

Task: write a short paragraph (60-90 words) explaining why "${material}" is a compelling reason to buy now
(durability, feel, unique quality — premium angle), plus 4 short callout labels (3-6 words each) for a
material-quality infographic. Return labels in this exact order/role:
1) fabric/material texture  2) stitching/construction  3) trim/detail that exists on the product  4) silhouette/form.
Each callout must be specific to "${material}" — avoid generic phrases usable for any material
(e.g. "premium quality", "great value", "comfortable").
Return ONLY this JSON: {"body": "paragraph", "callouts": ["...", "...", "...", "..."]}`
  const data = await callJson(system, user, 'ladipage-ai-material')
  if (!data) return null
  const callouts = Array.isArray(data.callouts)
    ? (data.callouts as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 4)
    : []
  return { body: String(data.body ?? '').trim(), callouts }
}

export async function generateLandingTrustCtaText(
  context: LandingAiContext,
  customInstruction?: string
): Promise<LandingTrustCtaData | null> {
  const lang = languageNameFor(context.locale)
  const extra = customInstruction ? `\nExtra admin instruction: ${customInstruction}` : ''
  const system = BRAND_VOICE(context.brandName, lang)
  const user = `${contextBlock(context)}${extra}

Task: write a closing call-to-action paragraph (60-100 words) reassuring shoppers about buying from
"${context.brandName}" (delivery, returns, quality) and pushing them to buy now.
Return ONLY this JSON: {"body": "paragraph", "cta_label": "short button label (e.g. Buy now)"}`
  const data = await callJson(system, user, 'ladipage-ai-trust-cta')
  if (!data) return null
  return {
    body: String(data.body ?? '').trim(),
    ctaLabel: String(data.cta_label ?? '').trim() || undefined,
  }
}

export async function generateLandingFaqText(
  context: LandingAiContext,
  customInstruction?: string
): Promise<LandingFaqData | null> {
  const lang = languageNameFor(context.locale)
  const extra = customInstruction ? `\nExtra admin instruction: ${customInstruction}` : ''
  const system = BRAND_VOICE(context.brandName, lang)
  const user = `${contextBlock(context)}${extra}

Task: write 3-5 frequently asked questions (with short helpful answers) shoppers would have before buying.
Return ONLY this JSON: {"items": [{"q": "question", "a": "answer"}]}`
  const data = await callJson(system, user, 'ladipage-ai-faq')
  if (!data || !Array.isArray(data.items)) return null
  const items = (data.items as Record<string, unknown>[])
    .map((it) => ({ q: String(it.q ?? '').trim(), a: String(it.a ?? '').trim() }))
    .filter((it) => it.q || it.a)
    .slice(0, 5)
  return items.length ? { items } : null
}

export async function generateLandingSeo(
  context: LandingAiContext,
  heroHeadline?: string | null,
  heroSubheadline?: string | null
): Promise<{ metaTitle: string; metaDescription: string } | null> {
  const lang = languageNameFor(context.locale)
  const heroBits = [
    heroHeadline ? `Hero headline: ${heroHeadline}` : '',
    heroSubheadline ? `Hero subheadline: ${heroSubheadline}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const materialRule = context.materialFilter
    ? `\n- MUST include the material/angle "${context.materialFilter}" in the meta title (long-tail collection angle).`
    : ''
  const categoryRule = context.categorySeoTitle
    ? '\n- Do NOT write meta that duplicates the main category page — this landing is a curated collection/USP, the category page is the head-keyword page.'
    : ''
  const system = `You are an e-commerce SEO expert writing for the online shop "${context.brandName}". Write entirely in ${lang}.`
  const user = `${contextBlock(context)}
${heroBits}

Task: write an SEO meta title and meta description for this landing page — click-worthy, honest, does not
replace the category page.
- NEVER mention SKU/internal product codes
- meta_title: max 60 characters, includes keyword + USP
- meta_description: 120-160 characters, states the benefit + a natural call to action${materialRule}${categoryRule}
Return ONLY this JSON: {"meta_title": "...", "meta_description": "..."}`
  const data = await callJson(system, user, 'ladipage-ai-seo')
  if (!data) return null
  const title = String(data.meta_title ?? context.title).trim().slice(0, 200)
  let desc = String(data.meta_description ?? '').trim()
  if (desc.length > 160) desc = desc.slice(0, 160).replace(/\s+\S*$/, '')
  if (!title) return null
  return { metaTitle: title, metaDescription: desc }
}
