import { GoogleGenerativeAI } from '@google/generative-ai'
import { loadImageBufferFromUrl } from '@/lib/hub-agent/sharpen-pipeline'
import { GEMINI_25_PRO } from '@/lib/gemini-config'
import type { WebLocale } from '@/lib/i18n/config'
import { resolvePartnerWebsiteGeminiApiKey } from '@/lib/partner-website/partner-website-gemini-key'
import {
  applyLogoGuardToProject,
  PARTNER_WEBSITE_LOGO_PROMPT_RULES,
} from '@/lib/partner-website/partner-website-logo-guard'
import {
  PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES,
  PARTNER_WEBSITE_RESPONSIVE_RULES,
  PARTNER_WEBSITE_SHARED_CHROME_PROMPT_RULES,
  PARTNER_WEBSITE_STUDIO_BUILD_SYSTEM_EXTRA,
} from '@/lib/partner-website/partner-website-mockup-build-rules'
import { trackFromUsageMetadata, trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import {
  composeStandaloneHtml,
  normalizePartnerWebsiteProject,
} from '@/lib/partner-website/partner-website-project'
import {
  collectSectionImageUrls,
  ensureSectionImagesInProject,
} from '@/lib/partner-website/pro/ensure-section-images-in-project'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteSiteType } from '@/lib/partner-website/partner-website-studio-flow'

/** Mockup + section photos attached to vision (gpt-4o supports many images). */
const VISION_IMAGE_ATTACH_LIMIT = 12

export const PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL =
  process.env.PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL?.trim() || 'gpt-4o'

export type PartnerWebsiteStudioBuildProvider = 'openai' | 'gemini'

/** Image-based UI build always uses GPT; env gemini is legacy override only. */
export const PARTNER_WEBSITE_STUDIO_BUILD_PROVIDER: PartnerWebsiteStudioBuildProvider = (() => {
  const raw = process.env.PARTNER_WEBSITE_STUDIO_BUILD_PROVIDER?.trim().toLowerCase()
  if (raw === 'gemini') return 'gemini'
  return 'openai'
})()

const STUDIO_BUILD_SYSTEM_PROMPT = `You are a senior front-end engineer specializing in high-fidelity landing pages and ecommerce shop homepages.
You receive an approved design mockup image and must output production-ready static HTML/CSS/vanilla JS that visually matches the mockup as closely as possible.
Do NOT reuse generic Bootstrap-style templates. Match colors, typography, spacing, section order, and visual hierarchy from the mockup.
Output ONLY valid JSON (no markdown fences).

${PARTNER_WEBSITE_STUDIO_BUILD_SYSTEM_EXTRA}`

type AiProjectPayload = {
  assistantMessage?: string
  entryPath?: string
  files?: unknown
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

function parseAiPayload(text: string): {
  project: PartnerWebsiteProject | null
  assistantMessage: string | null
} {
  const parsed = extractJsonObject(text) as AiProjectPayload | null
  if (!parsed) return { project: null, assistantMessage: null }
  const project = normalizePartnerWebsiteProject(parsed)
  const assistantMessage =
    typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage.trim() : null
  return { project, assistantMessage }
}

function buildMockupVisionPrompt(input: {
  locale: WebLocale
  title: string
  briefText: string
  logoUrl?: string | null
  chatPath: string
  siteSlug: string
  siteType: PartnerWebsiteSiteType
  extraInstructions?: string
  sectionImages?: Record<string, string | undefined>
}): string {
  const logoLine = input.logoUrl?.trim()
    ? `Logo URL (use exact img in header): ${input.logoUrl.trim()}`
    : 'No logo URL — use elegant text wordmark matching mockup typography.'
  const sectionUrls = collectSectionImageUrls(input.sectionImages)
  const sectionUrlBlock =
    sectionUrls.length > 0
      ? `
MANDATORY SECTION IMAGE URLS (each URL MUST appear verbatim in HTML — count = ${sectionUrls.length}):
${sectionUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}
- Hero URL → full-bleed hero background or <img>
- material / lifestyle → visible banner/section images
- product_1..N → visible product card <img src> in a dense grid (NOT inside an empty data-pw-grid only)
- Do NOT omit any URL. Do NOT use placeholder gray boxes when these URLs exist.`
      : ''

  const shopHooks =
    input.siteType === 'web_shop'
      ? `
- Featured products MUST be a VISIBLE static grid (4–6 cards) matching mockup density, using product_* image URLs above.
  Example structure (put REAL img src on each card — never leave the grid empty):
  <section id="products-featured" class="pw-products">
    <div class="pw-product-grid">
      <article class="pw-product-card"><img src="PRODUCT_URL" alt="..." /><h3>...</h3><p class="price">...</p><a href="#" data-nanoai-open-chat>Mua</a></article>
      <!-- repeat for each product_* URL -->
    </div>
  </section>
- Optionally ADD a separate live-catalog hook AFTER the static grid (do not put static cards inside data-pw-grid — hydrate replaces that grid):
  <section id="products-live" data-pw-personalize="recommended" data-limit="8">
    <div data-pw-grid class="pw-product-grid"></div>
    <p class="pw-personalize-empty" hidden></p>
  </section>
- Header/nav link to catalog: /site/${input.siteSlug}/products
- Cart link (optional): /site/${input.siteSlug}/cart`
      : ''

  return `Recreate the attached design mockup as a complete static website project.

Brand/title: ${input.title}
UI language: ${input.locale}
${logoLine}
Primary chat/consult CTA must use attribute data-nanoai-open-chat on buttons OR class pw-chat-open (platform opens shop chat widget).
Optional chat path reference: ${input.chatPath}
${sectionUrlBlock}
${shopHooks}

Customer brief:
${input.briefText}

${input.extraInstructions?.trim() ? `Additional instructions:\n${input.extraInstructions.trim()}\n` : ''}

Technical rules:
- Pure HTML/CSS/vanilla JS — no React, no Tailwind CDN, no external UI frameworks
- index.html links css/main.css; optional js/main.js
- Use Google Fonts via link tags if mockup uses distinctive typography
- Semantic HTML; accessible contrast
- Do NOT invent backend APIs — use data attributes and hrefs above for platform hooks
- Hero/sections/copy should reflect the mockup content, not generic placeholder lorem
- Match mockup IMAGE COUNT: many photos in mockup ⇒ many <img> in HTML (not 1 lonely image + empty space)
${PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES}
${PARTNER_WEBSITE_RESPONSIVE_RULES}
${PARTNER_WEBSITE_SHARED_CHROME_PROMPT_RULES}
${PARTNER_WEBSITE_LOGO_PROMPT_RULES}

Return JSON:
{
  "assistantMessage": "Short summary in ${input.locale}",
  "entryPath": "index.html",
  "files": [
    { "path": "index.html", "kind": "html", "content": "<!DOCTYPE html>..." },
    { "path": "css/main.css", "kind": "css", "content": "..." },
    { "path": "js/main.js", "kind": "js", "content": "..." }
  ]
}`
}

async function generateWithOpenAiVision(input: {
  prompt: string
  mockupUrl: string
  userId: string
  extraImageUrls?: string[]
}): Promise<{ text: string | null; model: string }> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (!openaiKey) return { text: null, model: PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL }

  const loaded = await loadImageBufferFromUrl(input.mockupUrl)
  if (!loaded) return { text: null, model: PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL }

  const modelId = PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL
  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } }
  > = [{ type: 'text', text: input.prompt }]
  const imageUrls = [input.mockupUrl, ...(input.extraImageUrls ?? [])]
    .filter((u): u is string => Boolean(u?.trim()))
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, VISION_IMAGE_ATTACH_LIMIT)
  for (const url of imageUrls) {
    const img = await loadImageBufferFromUrl(url)
    if (img) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}`,
          detail: 'high',
        },
      })
    }
  }
  if (userContent.length < 2) return { text: null, model: modelId }

  const body: Record<string, unknown> = {
    model: modelId,
    temperature: 0.35,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: STUDIO_BUILD_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  }
  const m = modelId.toLowerCase()
  if (m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) {
    body.max_completion_tokens = 16384
  } else {
    body.max_tokens = 16384
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
    if (!res.ok) return { text: null, model: modelId }
    const data = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
    if (!text) return { text: null, model: modelId }
    trackOpenAiStyleCompletionUsage({
      userId: input.userId,
      model: modelId,
      feature: 'partner-website-studio-build',
      usage: data?.usage,
      fallbackPromptChars: input.prompt.length,
      fallbackOutputChars: text.length,
    })
    return { text, model: modelId }
  } catch {
    return { text: null, model: modelId }
  }
}

async function generateWithGeminiVision(input: {
  prompt: string
  mockupUrl: string
  userId: string
  extraImageUrls?: string[]
}): Promise<{ text: string | null; model: string }> {
  const key = resolvePartnerWebsiteGeminiApiKey()
  if (!key) return { text: null, model: GEMINI_25_PRO.model }

  const imageUrls = [input.mockupUrl, ...(input.extraImageUrls ?? [])]
    .filter((u): u is string => Boolean(u?.trim()))
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, VISION_IMAGE_ATTACH_LIMIT)

  const parts: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  > = [{ text: `${STUDIO_BUILD_SYSTEM_PROMPT}\n\n${input.prompt}` }]

  for (const url of imageUrls) {
    const loaded = await loadImageBufferFromUrl(url)
    if (!loaded) continue
    parts.push({
      inlineData: {
        data: loaded.buffer.toString('base64'),
        mimeType: loaded.mimeType || 'image/png',
      },
    })
  }
  if (parts.length < 2) return { text: null, model: GEMINI_25_PRO.model }

  try {
    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: GEMINI_25_PRO.model,
      generationConfig: { temperature: 0.35, maxOutputTokens: 16384, responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(parts)
    const text = result.response.text()?.trim() ?? ''
    if (!text) return { text: null, model: GEMINI_25_PRO.model }
    trackFromUsageMetadata(
      result.response.usageMetadata,
      GEMINI_25_PRO.model,
      'partner-website-studio-build',
      input.userId
    )
    return { text, model: GEMINI_25_PRO.model }
  } catch {
    return { text: null, model: GEMINI_25_PRO.model }
  }
}

export async function generatePartnerWebsiteFromMockupVision(input: {
  locale: WebLocale
  userId: string
  title: string
  briefText: string
  logoUrl?: string | null
  approvedMockupUrl: string
  chatPath: string
  siteSlug: string
  siteType: PartnerWebsiteSiteType
  extraInstructions?: string
  sectionImages?: Record<string, string | undefined>
}): Promise<
  | {
      project: PartnerWebsiteProject
      htmlSource: string
      assistantMessage: string
      model: string
      provider: 'openai' | 'gemini'
    }
  | { error: string }
> {
  const mockupUrl = input.approvedMockupUrl.trim()
  if (!mockupUrl || !/^https?:\/\//i.test(mockupUrl)) {
    return { error: 'Invalid mockup URL' }
  }

  const prompt = buildMockupVisionPrompt(input)

  let text: string | null = null
  let model = PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL
  let provider: 'openai' | 'gemini' = 'openai'

  const extraImageUrls = collectSectionImageUrls(input.sectionImages)

  const tryOpenAi = async () =>
    generateWithOpenAiVision({
      prompt,
      mockupUrl,
      userId: input.userId,
      extraImageUrls,
    })
  const tryGemini = async () =>
    generateWithGeminiVision({
      prompt,
      mockupUrl,
      userId: input.userId,
      extraImageUrls,
    })

  // Mockup build = always image → GPT vision by default.
  const attempts: Array<'openai' | 'gemini'> =
    PARTNER_WEBSITE_STUDIO_BUILD_PROVIDER === 'gemini' ? ['gemini', 'openai'] : ['openai']

  for (const attempt of attempts) {
    const result = attempt === 'openai' ? await tryOpenAi() : await tryGemini()
    if (result.text) {
      text = result.text
      model = result.model
      provider = attempt
      break
    }
  }

  if (!text) {
    const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim())
    const hasGemini = Boolean(resolvePartnerWebsiteGeminiApiKey())
    if (!hasOpenAi && !hasGemini) {
      return {
        error:
          input.locale === 'vi'
            ? 'Thiếu OPENAI_API_KEY để dựng web từ mockup (GPT vision).'
            : 'Missing OPENAI_API_KEY for mockup-to-website build (GPT vision).',
      }
    }
    return {
      error:
        input.locale === 'vi'
          ? 'GPT không tạo được mã nguồn từ mockup — thử lại hoặc kiểm tra OPENAI_API_KEY.'
          : 'GPT could not generate code from mockup — retry or check OPENAI_API_KEY.',
    }
  }

  const parsed = parseAiPayload(text)
  if (!parsed.project?.files.length) {
    return {
      error:
        input.locale === 'vi'
          ? 'AI trả về dữ liệu không hợp lệ — thử lại.'
          : 'AI returned invalid project data — retry.',
    }
  }

  const project = ensureSectionImagesInProject(
    applyLogoGuardToProject(parsed.project),
    input.sectionImages,
    { locale: input.locale }
  )
  const htmlSource = composeStandaloneHtml(project)
  if (!htmlSource || htmlSource.length < 200) {
    return {
      error:
        input.locale === 'vi'
          ? 'HTML sinh ra quá ngắn — thử lại.'
          : 'Generated HTML too short — retry.',
    }
  }

  return {
    project,
    htmlSource,
    assistantMessage:
      parsed.assistantMessage ||
      (input.locale === 'vi'
        ? `Đã dựng frontend từ mockup (${model}). Chat và catalog đã gắn backend nền tảng.`
        : `Built frontend from mockup (${model}). Chat and catalog wired to platform backend.`),
    model,
    provider,
  }
}
