import { GoogleGenerativeAI } from '@google/generative-ai'
import { resolvePartnerWebsiteGeminiApiKey } from '@/lib/partner-website/partner-website-gemini-key'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import type { WebLocale } from '@/lib/i18n/config'
import {
  ensureAdsPlatformPolicyParagraphs,
  isPartnerSiteAdsPolicyPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'

const LOCALE_LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  zh: 'Chinese Simplified (简体中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
}

export type InfoPageAiRewriteInput = {
  pageTitle: string
  pageLabel: string
  pageKey?: string
  shopName: string
  locale: WebLocale
  currentTitle: string
  currentContent: string
  extraPrompt?: string
}

export type InfoPageAiRewriteResult = {
  title: string
  paragraphs: string[]
  seoTitle: string
  seoDescription: string
  keywords: string[]
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function rewritePartnerInfoPageWithAi(
  input: InfoPageAiRewriteInput
): Promise<InfoPageAiRewriteResult | null> {
  const key = resolvePartnerWebsiteGeminiApiKey()
  if (!key) return null
  const lang = LOCALE_LANGUAGE_NAME[input.locale] ?? LOCALE_LANGUAGE_NAME.vi
  const extra = input.extraPrompt?.trim() || ''
  const isAdsPolicyPage = isPartnerSiteAdsPolicyPageKey(input.pageKey || input.pageLabel)
  const adsPolicyRule = isAdsPolicyPage
    ? `For this policy page, always include one paragraph stating the shop complies with the advertising policies of Google Merchant Center, Facebook (Meta), and TikTok when running catalogs, pixels, and ad campaigns. Do not omit this paragraph.`
    : ''
  const prompt = `You rewrite shop policy / guide / about copy for SEO and clarity.
Shop: ${input.shopName}
Page: ${input.pageLabel} (${input.pageTitle})
Write entirely in ${lang}.
Keep facts from the merchant draft. Do not invent prices, phones, or legal claims that are not in the draft or extra notes.
If Extra notes are empty, still rewrite the whole page for clarity and SEO — invent nothing factual beyond the draft and the page type.
Always auto-optimize SEO: strong seoTitle, seoDescription, and keywords even when Extra notes are blank.
${adsPolicyRule}
Return ONLY JSON:
{"title":"...","paragraphs":["..."],"seoTitle":"...","seoDescription":"...","keywords":["..."]}
seoTitle: max 60 characters. seoDescription: 140-160 characters.
paragraphs: 2 to 7 short paragraphs. No markdown.
keywords: 3 to 8 high-intent SEO keywords/phrases for this page (no hashtags). Required every time.

Current heading:
${input.currentTitle || '(none)'}

Merchant draft:
${input.currentContent || '(empty — write a clear SEO page for this page type using only safe generic shop policy facts)'}

Extra notes (optional — may be empty):
${extra || '(none — auto-optimize SEO keywords yourself)'}`
  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: GEMINI_25_FLASH_NO_THINKING.model,
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    })
    const result = await model.generateContent(prompt)
    const parsed = parseJsonObject(result.response.text()?.trim() || '')
    if (!parsed) return null
    const title = String(parsed.title || '').trim().slice(0, 200)
    const paragraphs = Array.isArray(parsed.paragraphs)
      ? parsed.paragraphs.map((p) => String(p || '').trim()).filter(Boolean).slice(0, 8)
      : []
    if (!title || !paragraphs.length) return null
    const ensuredParagraphs = isAdsPolicyPage
      ? ensureAdsPlatformPolicyParagraphs(paragraphs, input.locale)
      : paragraphs
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 12)
      : []
    return {
      title,
      paragraphs: ensuredParagraphs,
      seoTitle: String(parsed.seoTitle || title).trim().slice(0, 70),
      seoDescription: String(parsed.seoDescription || paragraphs[0] || title).trim().slice(0, 180),
      keywords,
    }
  } catch (e) {
    console.warn('[partner-info-page-ai-rewrite] Gemini failed', e)
    return null
  }
}
