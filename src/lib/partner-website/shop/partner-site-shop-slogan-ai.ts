import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import type { WebLocale } from '@/lib/i18n/config'
import { resolvePartnerWebsiteGeminiApiKey } from '@/lib/partner-website/partner-website-gemini-key'
import {
  PW_SLOGAN_MAX,
  sanitizePartnerShopSlogan,
  sanitizePartnerShopSloganProducts,
} from '@/lib/partner-website/shop/partner-site-shop-slogan'

const LOCALE_LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  zh: 'Chinese Simplified (简体中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
}

export type PartnerShopSloganAiMode = 'rewrite' | 'create'

export type PartnerShopSloganAiInput = {
  mode: PartnerShopSloganAiMode
  shopName: string
  locale: WebLocale
  currentSlogan?: string
  idea?: string
  products?: string
}

export type PartnerShopSloganAiResult = {
  slogan: string
  alternatives: string[]
}

function readGeminiText(result: {
  response: {
    text: () => string
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
}): string {
  try {
    const direct = result.response.text()?.trim() || ''
    if (direct) return direct
  } catch {
    // text() ném khi chỉ còn thought parts / MAX_TOKENS — đọc parts thủ công.
  }
  const parts = result.response.candidates?.[0]?.content?.parts || []
  return parts.map((p) => String(p.text || '')).join('').trim()
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

function uniqueSlogans(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const next = sanitizePartnerShopSlogan(value)
    const key = next.toLowerCase()
    if (!next || seen.has(key)) continue
    seen.add(key)
    out.push(next)
    if (out.length >= 4) break
  }
  return out
}

export function parsePartnerShopSloganAiJson(raw: string): PartnerShopSloganAiResult | null {
  const parsed = parseJsonObject(raw)
  if (!parsed) return null
  const primary = sanitizePartnerShopSlogan(parsed.slogan)
  const extras = Array.isArray(parsed.alternatives)
    ? parsed.alternatives.map((item) => sanitizePartnerShopSlogan(item))
    : []
  const all = uniqueSlogans([primary, ...extras])
  if (!all.length) return null
  return { slogan: all[0], alternatives: all.slice(1, 3) }
}

export async function rewritePartnerShopSloganWithAi(
  input: PartnerShopSloganAiInput
): Promise<PartnerShopSloganAiResult | null> {
  const key = resolvePartnerWebsiteGeminiApiKey()
  if (!key) {
    console.warn('[partner-shop-slogan-ai] missing GOOGLE_API_KEY/GEMINI_API_KEY')
    return null
  }
  const shopName = sanitizePartnerShopSlogan(input.shopName, 80) || 'Shop'
  const idea = sanitizePartnerShopSlogan(input.idea, 240)
  const products = sanitizePartnerShopSloganProducts(input.products)
  const current = sanitizePartnerShopSlogan(input.currentSlogan)
  const lang = LOCALE_LANGUAGE_NAME[input.locale] ?? LOCALE_LANGUAGE_NAME.vi
  const mode = input.mode === 'create' || !current ? 'create' : 'rewrite'
  const task =
    mode === 'rewrite'
      ? `Rewrite the shop slogan. Keep the merchant's intent from the current slogan and optional idea. Do not invent a different industry.`
      : `Write a brand-new shop slogan from the shop name and the products they sell. Optional idea may steer tone.`
  const prompt = `You write short e-commerce shop slogans / taglines.
Shop name: ${shopName}
Products sold: ${products || '(not specified)'}
Current slogan: ${current || '(none)'}
Idea / notes: ${idea || '(none)'}
Write entirely in ${lang}.
${task}
Rules:
- One line, max ${PW_SLOGAN_MAX} characters.
- Memorable, honest, brand-safe. No hashtags, no emoji spam, no quotes around the slogan.
- Do not invent prices, phones, or legal claims.
- Do not mention NanoAI or a competing shop.
Return ONLY JSON:
{"slogan":"...","alternatives":["...","..."]}
alternatives: 2 more distinct options, same language, same length limit.`
  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: GEMINI_25_FLASH_NO_THINKING.model,
      generationConfig: {
        temperature: mode === 'create' ? 0.8 : 0.6,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    })
    const result = await model.generateContent(prompt)
    return parsePartnerShopSloganAiJson(readGeminiText(result))
  } catch (e) {
    console.warn('[partner-shop-slogan-ai] Gemini failed', e)
    return null
  }
}
