import type { WebLocale } from '@/lib/i18n/config'
import { PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL } from '@/lib/partner-website/generate-partner-website-from-mockup-vision'
import type { PartnerWebsiteSiteType } from '@/lib/partner-website/partner-website-studio-flow'
import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'

export type PartnerWebsiteProNavItem = { label: string; href: string }

export type PartnerWebsiteProHero = {
  badge?: string
  headline: string
  headlineAccent?: string
  subheadline: string
  ctaPrimary: string
  ctaSecondary?: string
  trustBadges: string[]
}

export type PartnerWebsiteProMaterial = {
  title: string
  body: string
  bullets: string[]
}

export type PartnerWebsiteProBenefit = {
  title: string
  description: string
}

export type PartnerWebsiteProProduct = {
  name: string
  price: string
  description: string
  color?: string
}

export type PartnerWebsiteProTestimonial = {
  name: string
  quote: string
  role?: string
}

export type PartnerWebsiteProFaq = {
  question: string
  answer: string
}

export type PartnerWebsiteProContent = {
  brandName: string
  nav: PartnerWebsiteProNavItem[]
  hero: PartnerWebsiteProHero
  material?: PartnerWebsiteProMaterial
  benefits: PartnerWebsiteProBenefit[]
  products: PartnerWebsiteProProduct[]
  testimonials: PartnerWebsiteProTestimonial[]
  faq: PartnerWebsiteProFaq[]
  ctaBanner?: { headline: string; subheadline?: string; cta: string }
  footer: {
    phone?: string
    email?: string
    address?: string
    copyright: string
  }
}

const CONTENT_SYSTEM = `You are a senior Vietnamese ecommerce copywriter and landing page strategist.
Output ONLY valid JSON matching the schema. All user-facing copy must be in the requested UI language.
Write premium, conversion-focused copy — no lorem ipsum, no placeholder English unless locale is en.`

function localeLanguage(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

function buildContentPrompt(input: {
  locale: WebLocale
  title: string
  briefText: string
  siteType: PartnerWebsiteSiteType
  siteSlug: string
  mockupSpecText?: string
}): string {
  const lang = localeLanguage(input.locale)
  const shopExtra =
    input.siteType === 'web_shop'
      ? `
- Include 4 products in "products" with realistic VND prices (e.g. 890.000₫)
- Nav must include link to /site/${input.siteSlug}/products for catalog
- Hero CTA primary should encourage exploration; secondary for material/story`
      : `
- "products" may be empty or 2-3 highlight items
- Focus on lead generation and brand story`

  const specBlock = input.mockupSpecText?.trim()
    ? `
MOCKUP LAYOUT SPEC (match section order and visible copy cues — do not invent sections missing from spec):
${input.mockupSpecText.trim()}
`
    : ''

  return `Create complete landing page copy in ${lang}.

Brand/title: ${input.title}
Site type: ${input.siteType}

Customer brief:
${input.briefText}
${specBlock}${shopExtra}

Return JSON schema:
{
  "brandName": "string",
  "nav": [{ "label": "string", "href": "#section or path" }],
  "hero": {
    "badge": "optional collection badge",
    "headline": "main headline part 1",
    "headlineAccent": "accent colored part",
    "subheadline": "2-3 sentences value prop",
    "ctaPrimary": "button label",
    "ctaSecondary": "optional ghost button",
    "trustBadges": ["3 short trust items"]
  },
  "material": {
    "title": "material/story section title",
    "body": "2-3 sentences",
    "bullets": ["3-4 bullets"]
  },
  "benefits": [{ "title": "string", "description": "1-2 sentences" }],
  "products": [{ "name": "string", "price": "string", "description": "string", "color": "optional" }],
  "testimonials": [{ "name": "string", "quote": "string", "role": "optional" }],
  "faq": [{ "question": "string", "answer": "string" }],
  "ctaBanner": { "headline": "string", "subheadline": "optional", "cta": "string" },
  "footer": {
    "phone": "optional",
    "email": "optional",
    "address": "optional",
    "copyright": "string"
  }
}

Requirements:
- Exactly 3 benefits, 3 testimonials, 4-5 FAQ items
- Professional tone matching brief style/mood
- Include Vietnamese cultural nuance when locale is vi`
}

function normalizeProContent(raw: unknown, fallbackTitle: string): PartnerWebsiteProContent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const hero = o.hero as Record<string, unknown> | undefined
  if (!hero || typeof hero.headline !== 'string' || typeof hero.subheadline !== 'string') return null

  const nav = Array.isArray(o.nav)
    ? o.nav
        .filter((n): n is PartnerWebsiteProNavItem => Boolean(n && typeof n === 'object'))
        .map((n) => ({
          label: String((n as PartnerWebsiteProNavItem).label ?? '').trim(),
          href: String((n as PartnerWebsiteProNavItem).href ?? '#').trim(),
        }))
        .filter((n) => n.label)
    : []

  const benefits = Array.isArray(o.benefits)
    ? o.benefits
        .map((b) => {
          if (!b || typeof b !== 'object') return null
          const row = b as PartnerWebsiteProBenefit
          const title = String(row.title ?? '').trim()
          const description = String(row.description ?? '').trim()
          if (!title) return null
          return { title, description }
        })
        .filter(Boolean) as PartnerWebsiteProBenefit[]
    : []

  const products = Array.isArray(o.products)
    ? o.products
        .map((p) => {
          if (!p || typeof p !== 'object') return null
          const row = p as PartnerWebsiteProProduct
          const name = String(row.name ?? '').trim()
          const price = String(row.price ?? '').trim()
          const description = String(row.description ?? '').trim()
          if (!name) return null
          return {
            name,
            price,
            description,
            color: typeof row.color === 'string' ? row.color.trim() : undefined,
          }
        })
        .filter(Boolean) as PartnerWebsiteProProduct[]
    : []

  const testimonials = Array.isArray(o.testimonials)
    ? o.testimonials
        .map((t) => {
          if (!t || typeof t !== 'object') return null
          const row = t as PartnerWebsiteProTestimonial
          const name = String(row.name ?? '').trim()
          const quote = String(row.quote ?? '').trim()
          if (!name || !quote) return null
          return {
            name,
            quote,
            role: typeof row.role === 'string' ? row.role.trim() : undefined,
          }
        })
        .filter(Boolean) as PartnerWebsiteProTestimonial[]
    : []

  const faq = Array.isArray(o.faq)
    ? o.faq
        .map((f) => {
          if (!f || typeof f !== 'object') return null
          const row = f as PartnerWebsiteProFaq
          const question = String(row.question ?? '').trim()
          const answer = String(row.answer ?? '').trim()
          if (!question || !answer) return null
          return { question, answer }
        })
        .filter(Boolean) as PartnerWebsiteProFaq[]
    : []

  const materialRaw = o.material as Record<string, unknown> | undefined
  const material =
    materialRaw && typeof materialRaw.title === 'string'
      ? {
          title: String(materialRaw.title).trim(),
          body: String(materialRaw.body ?? '').trim(),
          bullets: Array.isArray(materialRaw.bullets)
            ? materialRaw.bullets.map((b) => String(b).trim()).filter(Boolean)
            : [],
        }
      : undefined

  const footerRaw = o.footer as Record<string, unknown> | undefined
  const ctaRaw = o.ctaBanner as Record<string, unknown> | undefined

  return {
    brandName: String(o.brandName ?? fallbackTitle).trim() || fallbackTitle,
    nav,
    hero: {
      badge: typeof hero.badge === 'string' ? hero.badge.trim() : undefined,
      headline: String(hero.headline).trim(),
      headlineAccent:
        typeof hero.headlineAccent === 'string' ? hero.headlineAccent.trim() : undefined,
      subheadline: String(hero.subheadline).trim(),
      ctaPrimary: String(hero.ctaPrimary ?? 'Khám phá ngay').trim(),
      ctaSecondary:
        typeof hero.ctaSecondary === 'string' ? hero.ctaSecondary.trim() : undefined,
      trustBadges: Array.isArray(hero.trustBadges)
        ? hero.trustBadges.map((b) => String(b).trim()).filter(Boolean).slice(0, 4)
        : [],
    },
    material,
    benefits,
    products,
    testimonials,
    faq,
    ctaBanner:
      ctaRaw && typeof ctaRaw.headline === 'string'
        ? {
            headline: String(ctaRaw.headline).trim(),
            subheadline:
              typeof ctaRaw.subheadline === 'string' ? ctaRaw.subheadline.trim() : undefined,
            cta: String(ctaRaw.cta ?? '').trim() || 'Liên hệ',
          }
        : undefined,
    footer: {
      phone: typeof footerRaw?.phone === 'string' ? footerRaw.phone.trim() : undefined,
      email: typeof footerRaw?.email === 'string' ? footerRaw.email.trim() : undefined,
      address: typeof footerRaw?.address === 'string' ? footerRaw.address.trim() : undefined,
      copyright:
        String(footerRaw?.copyright ?? `© ${new Date().getFullYear()} ${fallbackTitle}`).trim(),
    },
  }
}

export async function generatePartnerWebsiteProContent(input: {
  locale: WebLocale
  userId: string
  title: string
  briefText: string
  siteType: PartnerWebsiteSiteType
  siteSlug: string
  /** Formatted mockup UI spec — guides which sections/copy to emphasize. */
  mockupSpecText?: string
}): Promise<PartnerWebsiteProContent | { error: string }> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openaiKey) {
    return {
      error:
        input.locale === 'vi'
          ? 'Thiếu OPENAI_API_KEY để sinh nội dung landing.'
          : 'Missing OPENAI_API_KEY for landing content generation.',
    }
  }

  const modelId = PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL
  const prompt = buildContentPrompt(input)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        temperature: 0.55,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CONTENT_SYSTEM },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4096,
      }),
    })
    const rawText = await res.text()
    if (!res.ok) {
      return {
        error:
          input.locale === 'vi'
            ? 'GPT không sinh được nội dung — thử lại.'
            : 'GPT content generation failed — retry.',
      }
    }
    const data = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
    if (!text) {
      return { error: input.locale === 'vi' ? 'Nội dung trống.' : 'Empty content response.' }
    }
    trackOpenAiStyleCompletionUsage({
      userId: input.userId,
      model: modelId,
      feature: 'partner-website-pro-content',
      usage: data?.usage,
      fallbackPromptChars: prompt.length,
      fallbackOutputChars: text.length,
    })
    const parsed = normalizeProContent(
      (() => {
        try {
          return JSON.parse(text)
        } catch {
          const start = text.indexOf('{')
          const end = text.lastIndexOf('}')
          if (start >= 0 && end > start) {
            try {
              return JSON.parse(text.slice(start, end + 1))
            } catch {
              return null
            }
          }
          return null
        }
      })(),
      input.title
    )
    if (!parsed) {
      return {
        error:
          input.locale === 'vi'
            ? 'GPT trả về nội dung không hợp lệ.'
            : 'Invalid content JSON from GPT.',
      }
    }
    return parsed
  } catch {
    return {
      error:
        input.locale === 'vi'
          ? 'Lỗi khi sinh nội dung landing.'
          : 'Landing content generation error.',
    }
  }
}

export function formatProContentForBuildPrompt(content: PartnerWebsiteProContent): string {
  return JSON.stringify(content, null, 2)
}
