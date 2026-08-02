import { loadImageBufferFromUrl } from '@/lib/hub-agent/sharpen-pipeline'
import type { WebLocale } from '@/lib/i18n/config'
import { PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL } from '@/lib/partner-website/generate-partner-website-from-mockup-vision'
import {
  normalizePartnerWebsiteMockupUiSpec,
  PARTNER_WEBSITE_BACKEND_HOOKS,
  PARTNER_WEBSITE_SECTION_TYPES,
  type PartnerWebsiteMockupUiSpec,
} from '@/lib/partner-website/pro/partner-website-mockup-ui-spec'
import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'

const ANALYZE_SYSTEM = `You are a senior UX analyst for ecommerce fashion websites.
You receive an approved UI mockup image (often desktop + mobile side by side).
Extract the REAL visual structure — do not invent sections that are not visible.
Output ONLY valid JSON matching the schema. No markdown.`

function localeHint(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

function buildAnalyzePrompt(input: {
  locale: WebLocale
  title: string
  briefText?: string
  siteSlug: string
}): string {
  return `Analyze the attached website mockup for brand "${input.title}".
UI language for summary/titleHint/copyHints: ${localeHint(input.locale)}.
${input.briefText ? `Brand brief (context only):\n${input.briefText.slice(0, 1200)}\n` : ''}

Describe what is ON the mockup: components, layout, density, colors, typography.

Allowed section types: ${PARTNER_WEBSITE_SECTION_TYPES.join(', ')}
Allowed backendHooks (pick only when the mockup implies that control): ${PARTNER_WEBSITE_BACKEND_HOOKS.join(', ')}
Image slot keys for photos on the mockup: hero, material, lifestyle, product_1, product_2, product_3, product_4
(Assign product_N for each distinct product card photo left→right / top→bottom.)

Site slug for path context: ${input.siteSlug}
- nav_products → catalog
- nav_cart → cart icon/link
- nav_wishlist → favorites
- open_chat → buy/consult CTA
- search_text → header/search bar (platform wires text search)
- search_image → camera / image search control next to search
- catalog_products → ALWAYS on product_grid sections (live shop inventory; platform fills cards)
- personalize_recommended → only if mockup shows a separate "for you"/recommended strip (not the main product grid)

Return JSON:
{
  "summary": "2-4 sentences describing the overall UI",
  "palette": { "primary": "#hex", "secondary": "#hex?", "accent": "#hex?", "background": "#hex?", "text": "#hex?" },
  "typography": { "headlineStyle": "e.g. bold serif", "bodyStyle": "e.g. clean sans", "googleFontsHint": "optional Font Name" },
  "layoutNotes": "grid density, spacing, hero treatment, mobile bottom bar if any",
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "titleHint": "short label",
      "imageSlots": ["hero"],
      "copyHints": "visible headline/CTA text cues from mockup",
      "backendHooks": ["open_chat"],
      "productCardCount": null
    }
  ]
}

Rules:
- Order sections top → bottom as on desktop mockup (ignore browser chrome).
- If mockup shows many product cards, set type product_grid with productCardCount matching density (4–8 typical) and backendHooks including catalog_products.
- Product grid photos in the mockup are LAYOUT REFERENCE only — live site will load real shop inventory.
- Include category_nav if circular category icons exist.
- Include benefits / testimonials / faq only if clearly present.
- Do NOT invent APIs; only use backendHooks from the allowed list.`
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence?.[1]?.trim() || trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

export async function analyzePartnerWebsiteMockup(input: {
  locale: WebLocale
  userId: string
  title: string
  briefText?: string
  siteSlug: string
  approvedMockupUrl: string
  extraImageUrls?: string[]
}): Promise<
  | { ok: true; spec: PartnerWebsiteMockupUiSpec; model: string }
  | { ok: false; error: string }
> {
  const mockupUrl = input.approvedMockupUrl.trim()
  if (!mockupUrl || !/^https?:\/\//i.test(mockupUrl)) {
    return { ok: false, error: 'Invalid mockup URL' }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openaiKey) {
    return {
      ok: false,
      error:
        input.locale === 'vi'
          ? 'Thiếu OPENAI_API_KEY để phân tích mockup.'
          : 'Missing OPENAI_API_KEY to analyze mockup.',
    }
  }

  const prompt = buildAnalyzePrompt({
    locale: input.locale,
    title: input.title,
    briefText: input.briefText,
    siteSlug: input.siteSlug,
  })

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } }
  > = [{ type: 'text', text: prompt }]

  const urls = [mockupUrl, ...(input.extraImageUrls ?? [])]
    .filter((u): u is string => Boolean(u?.trim()))
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 4)

  for (const url of urls) {
    const img = await loadImageBufferFromUrl(url)
    if (!img) continue
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}`,
        detail: 'high',
      },
    })
  }
  if (userContent.length < 2) {
    return {
      ok: false,
      error:
        input.locale === 'vi'
          ? 'Không tải được ảnh mockup để phân tích.'
          : 'Could not load mockup image for analysis.',
    }
  }

  const modelId = PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL
  const body: Record<string, unknown> = {
    model: modelId,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: ANALYZE_SYSTEM },
      { role: 'user', content: userContent },
    ],
  }
  const m = modelId.toLowerCase()
  if (m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) {
    body.max_completion_tokens = 4096
  } else {
    body.max_tokens = 4096
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify(body),
    })
    const rawText = await res.text()
    if (!res.ok) {
      return {
        ok: false,
        error:
          input.locale === 'vi'
            ? 'GPT không phân tích được mockup — thử lại.'
            : 'GPT could not analyze mockup — retry.',
      }
    }
    const data = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
    if (!text) {
      return { ok: false, error: 'Empty analyze response' }
    }
    trackOpenAiStyleCompletionUsage({
      userId: input.userId,
      model: modelId,
      feature: 'partner-website-mockup-analyze',
      usage: data?.usage,
      fallbackPromptChars: prompt.length,
      fallbackOutputChars: text.length,
    })

    const parsed = extractJsonObject(text)
    const spec = normalizePartnerWebsiteMockupUiSpec(parsed)
    if (!spec) {
      return {
        ok: false,
        error:
          input.locale === 'vi'
            ? 'Kết quả phân tích mockup không hợp lệ — thử lại.'
            : 'Invalid mockup analysis — retry.',
      }
    }
    return { ok: true, spec, model: modelId }
  } catch {
    return {
      ok: false,
      error:
        input.locale === 'vi'
          ? 'Lỗi khi phân tích mockup.'
          : 'Error analyzing mockup.',
    }
  }
}
