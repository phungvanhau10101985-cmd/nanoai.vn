import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  setPartnerWebsitePublishedPg,
  upsertPartnerWebsitePg,
} from '@/lib/db/messaging-partner-websites-pg'
import { loadImageBufferFromUrl } from '@/lib/hub-agent/sharpen-pipeline'
import type { WebLocale } from '@/lib/i18n/config'
import { PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL } from '@/lib/partner-website/generate-partner-website-from-mockup-vision'
import {
  applyLogoGuardToProject,
  ensureBrandLogoInHtml,
  ensureBrandLogoInProject,
  PARTNER_WEBSITE_LOGO_PROMPT_RULES,
} from '@/lib/partner-website/partner-website-logo-guard'
import {
  PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES,
  PARTNER_WEBSITE_RESPONSIVE_RULES,
  PARTNER_WEBSITE_SHARED_CHROME_PROMPT_RULES,
} from '@/lib/partner-website/partner-website-mockup-build-rules'
import { getPartnerWebsitePageDef, normalizePartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import {
  buildPartnerSiteChatMuaButtonHtml,
  htmlHasChromeChatMua,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import { applyChatIconLogoToHtml } from '@/lib/partner-website/visual-editor/apply-chat-icon-logo'
import {
  composeStandaloneHtml,
  extractIndexHtml,
} from '@/lib/partner-website/partner-website-project'
import {
  buildPartnerWebsiteStudioBrief,
  resolvePartnerWebsiteSiteType,
  type PartnerWebsiteStudioAnswers,
} from '@/lib/partner-website/partner-website-studio-flow'
import { normalizePartnerWebsiteSlug, validatePartnerWebsiteSlug } from '@/lib/partner-website/partner-website-slug'
import type { PartnerWebsiteProject, PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import {
  formatProContentForBuildPrompt,
  generatePartnerWebsiteProContent,
  type PartnerWebsiteProContent,
} from '@/lib/partner-website/pro/partner-website-pro-content'
import {
  generatePartnerWebsiteProSectionImages,
} from '@/lib/partner-website/pro/partner-website-pro-images'
import {
  collectImageSlotsFromSpec,
  formatMockupSpecForPrompt,
  resolveBackendHookSnippet,
  type PartnerWebsiteBuildArtifacts,
  type PartnerWebsiteMockupSection,
  type PartnerWebsiteMockupUiSpec,
} from '@/lib/partner-website/pro/partner-website-mockup-ui-spec'
import { ensureSectionImagesInProject } from '@/lib/partner-website/pro/ensure-section-images-in-project'
import {
  buildLiveCatalogSectionHtml,
} from '@/lib/partner-website/shop/build-partner-site-catalog-bootstrap-script'
import {
  partnerSiteCartPath,
  partnerSiteProductsPath,
  partnerSiteWishlistPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'

export type IncrementalBuildStage = 'prepare' | 'shell' | 'section' | 'wire_hooks' | 'finalize'

export type RunIncrementalBuildStepInput = {
  locale: WebLocale
  userId: string
  partnerId: string
  answers: PartnerWebsiteStudioAnswers
  approvedMockupUrl: string
  pageKey?: string
  referenceImageUrls?: string[]
  stage: IncrementalBuildStage
  sectionId?: string
  mockupSpec: PartnerWebsiteMockupUiSpec
  artifacts?: PartnerWebsiteBuildArtifacts | null
}

export type RunIncrementalBuildStepResult =
  | {
      ok: true
      website: PartnerWebsiteRow
      stage: IncrementalBuildStage
      sectionId?: string
      artifacts: PartnerWebsiteBuildArtifacts
      progressMessage: string
      nextStage: IncrementalBuildStage | 'done'
      nextSectionId?: string
      remainingSectionIds: string[]
    }
  | { ok: false; error: string; stage: IncrementalBuildStage }

function mergePageIntoProject(
  existing: PartnerWebsiteProject | null | undefined,
  generated: PartnerWebsiteProject,
  pageKey: string
): { project: PartnerWebsiteProject; htmlSource: string | null } {
  const def = getPartnerWebsitePageDef(pageKey)
  const htmlPath = def?.htmlPath ?? 'index.html'
  const pageHtml = extractIndexHtml(generated) || ''
  const genCss = generated.files.find((f) => f.path === 'css/main.css')
  const genJs = generated.files.find((f) => f.path === 'js/main.js')

  if (pageKey === 'home' || !existing?.files.length) {
    const files = generated.files.map((f) => {
      if (f.kind === 'html' && (f.path === generated.entryPath || f.path === 'index.html' || f.path === htmlPath)) {
        return { ...f, path: 'index.html' }
      }
      return f
    })
    const project: PartnerWebsiteProject = { entryPath: 'index.html', files }
    if (existing?.files.length && pageKey === 'home') {
      for (const f of existing.files) {
        if (f.path === 'index.html' || f.path.startsWith('css/') || f.path.startsWith('js/')) continue
        if (!files.some((x) => x.path === f.path)) files.push(f)
      }
    }
    return { project, htmlSource: composeStandaloneHtml(project) }
  }

  const byPath = new Map(existing.files.map((f) => [f.path, f]))
  byPath.set(htmlPath, { path: htmlPath, kind: 'html', content: pageHtml })
  const hasHomeCss = Boolean(existing.files.find((f) => f.path === 'css/main.css')?.content?.trim())
  const hasHomeJs = Boolean(existing.files.find((f) => f.path === 'js/main.js')?.content?.trim())
  if (!hasHomeCss && genCss?.content.trim()) byPath.set('css/main.css', genCss)
  if (!hasHomeJs && genJs?.content.trim()) byPath.set('js/main.js', genJs)
  const project: PartnerWebsiteProject = {
    entryPath: existing.entryPath || 'index.html',
    files: Array.from(byPath.values()),
  }
  const homeProject: PartnerWebsiteProject = {
    entryPath: 'index.html',
    files: project.files.filter(
      (f) => f.path === 'index.html' || f.path.startsWith('css/') || f.path.startsWith('js/')
    ),
  }
  return {
    project,
    htmlSource:
      composeStandaloneHtml(homeProject) ||
      existing.files.find((f) => f.path === 'index.html')?.content ||
      null,
  }
}

export { mergePageIntoProject }

function pageHtmlPath(pageKey: string): string {
  return getPartnerWebsitePageDef(pageKey)?.htmlPath ?? 'index.html'
}

/**
 * Wipe previously built page code before a rebuild so old HTML/CSS/JS cannot linger.
 * - home: remove index.html + css/* + js/* (keep other page HTML files)
 * - other pages: remove that page's HTML only
 */
export function clearBuiltCodeForPageRebuild(
  project: PartnerWebsiteProject | null | undefined,
  pageKey: string
): PartnerWebsiteProject {
  const key = normalizePartnerWebsitePageKey(pageKey)
  const htmlPath = pageHtmlPath(key)
  const files = project?.files ?? []

  if (key === 'home') {
    const kept = files.filter(
      (f) =>
        f.kind === 'html' &&
        f.path !== 'index.html' &&
        f.path !== htmlPath &&
        !f.path.startsWith('css/') &&
        !f.path.startsWith('js/')
    )
    return { entryPath: 'index.html', files: kept }
  }

  return {
    entryPath: project?.entryPath || 'index.html',
    files: files.filter((f) => f.path !== htmlPath),
  }
}

function getPageHtml(project: PartnerWebsiteProject, pageKey: string): string {
  const path = pageHtmlPath(pageKey)
  return (
    project.files.find((f) => f.path === path)?.content ||
    extractIndexHtml(project) ||
    ''
  )
}

function setPageHtml(project: PartnerWebsiteProject, pageKey: string, html: string): PartnerWebsiteProject {
  const path = pageHtmlPath(pageKey)
  const byPath = new Map(project.files.map((f) => [f.path, f]))
  byPath.set(path, { path, kind: 'html', content: html })
  if (pageKey === 'home' && path !== 'index.html') {
    byPath.set('index.html', { path: 'index.html', kind: 'html', content: html })
  }
  return {
    entryPath: project.entryPath || 'index.html',
    files: Array.from(byPath.values()),
  }
}

function contentSectionsForBuild(spec: PartnerWebsiteMockupUiSpec): PartnerWebsiteMockupSection[] {
  return spec.sections.filter((s) => s.type !== 'header' && s.type !== 'footer')
}

export function listBuildableSectionIds(spec: PartnerWebsiteMockupUiSpec): string[] {
  return contentSectionsForBuild(spec).map((s) => s.id)
}

function remainingAfter(
  spec: PartnerWebsiteMockupUiSpec,
  built: string[] | undefined
): string[] {
  const builtSet = new Set(built ?? [])
  return listBuildableSectionIds(spec).filter((id) => !builtSet.has(id))
}

function nextAfterStage(
  stage: IncrementalBuildStage,
  spec: PartnerWebsiteMockupUiSpec,
  artifacts: PartnerWebsiteBuildArtifacts,
  sectionId?: string
): { nextStage: IncrementalBuildStage | 'done'; nextSectionId?: string; remainingSectionIds: string[] } {
  const remaining = remainingAfter(spec, artifacts.builtSectionIds)
  if (stage === 'prepare') {
    return { nextStage: 'shell', remainingSectionIds: remaining }
  }
  if (stage === 'shell') {
    if (remaining.length) {
      return { nextStage: 'section', nextSectionId: remaining[0], remainingSectionIds: remaining }
    }
    return { nextStage: 'wire_hooks', remainingSectionIds: [] }
  }
  if (stage === 'section') {
    const after = remainingAfter(spec, [
      ...(artifacts.builtSectionIds ?? []),
      ...(sectionId ? [sectionId] : []),
    ])
    if (after.length) {
      return { nextStage: 'section', nextSectionId: after[0], remainingSectionIds: after }
    }
    return { nextStage: 'wire_hooks', remainingSectionIds: [] }
  }
  if (stage === 'wire_hooks') {
    return { nextStage: 'finalize', remainingSectionIds: [] }
  }
  return { nextStage: 'done', remainingSectionIds: [] }
}

async function callOpenAiJson(input: {
  userId: string
  system: string
  prompt: string
  feature: string
  maxTokens?: number
  temperature?: number
  imageUrls?: string[]
}): Promise<{ text: string | null; model: string }> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const modelId = PARTNER_WEBSITE_STUDIO_BUILD_OPENAI_MODEL
  if (!openaiKey) return { text: null, model: modelId }

  const userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' | 'auto' } }
  > = [{ type: 'text', text: input.prompt }]

  for (const url of (input.imageUrls ?? []).slice(0, 6)) {
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

  const body: Record<string, unknown> = {
    model: modelId,
    temperature: input.temperature ?? 0.35,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: userContent },
    ],
  }
  const m = modelId.toLowerCase()
  const maxTok = input.maxTokens ?? 8192
  if (m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) {
    body.max_completion_tokens = maxTok
  } else {
    body.max_tokens = maxTok
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
      feature: input.feature,
      usage: data?.usage,
      fallbackPromptChars: input.prompt.length,
      fallbackOutputChars: text.length,
    })
    return { text, model: modelId }
  } catch {
    return { text: null, model: modelId }
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence?.[1]?.trim() || trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

async function resolveSiteContext(input: RunIncrementalBuildStepInput): Promise<
  | {
      ok: true
      title: string
      siteSlug: string
      logoUrl: string | null
      chatPath: string
      siteType: ReturnType<typeof resolvePartnerWebsiteSiteType>
      briefText: string
      pageKey: string
    }
  | { ok: false; error: string }
> {
  const partner = await fetchPartnerProfileForWebsitePg(input.partnerId)
  if (!partner) return { ok: false, error: 'Partner not found' }

  const briefText = buildPartnerWebsiteStudioBrief(input.answers, input.locale)
  if (briefText.length < 8) return { ok: false, error: 'Brief too short' }

  const title =
    input.answers.brand_name?.trim() ||
    partner.brandName?.trim() ||
    partner.displayName?.trim() ||
    'Website'

  const existingWebsiteForSlug = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  const siteSlugRaw =
    existingWebsiteForSlug?.siteSlug?.trim().toLowerCase() ||
    (() => {
      const candidates = [
        partner.slug.trim().toLowerCase(),
        normalizePartnerWebsiteSlug(`${partner.slug}-shop`),
      ]
      for (const c of candidates) {
        if (c && !validatePartnerWebsiteSlug(c)) return c
      }
      return partner.slug.trim().toLowerCase()
    })()

  if (validatePartnerWebsiteSlug(siteSlugRaw)) {
    return { ok: false, error: validatePartnerWebsiteSlug(siteSlugRaw)! }
  }

  const existingWebsite = existingWebsiteForSlug
  const logoFromAnswer = input.answers.logo_url?.trim()
  const logoFromWebsite = existingWebsite?.logoUrl?.trim()
  const logoUrl =
    (logoFromAnswer && /^https?:\/\//i.test(logoFromAnswer) ? logoFromAnswer : null) ||
    (logoFromWebsite && /^https?:\/\//i.test(logoFromWebsite) ? logoFromWebsite : null) ||
    partner.logoUrl?.trim() ||
    null

  return {
    ok: true,
    title,
    siteSlug: siteSlugRaw,
    logoUrl,
    chatPath: `/messaging/p/${encodeURIComponent(partner.slug)}`,
    siteType: resolvePartnerWebsiteSiteType(),
    briefText,
    pageKey: normalizePartnerWebsitePageKey(input.pageKey),
  }
}

function insertSectionBeforeMainEnd(html: string, sectionHtml: string): string {
  if (/<\/main>/i.test(html)) return html.replace(/<\/main>/i, `${sectionHtml}\n</main>`)
  if (/<footer\b/i.test(html)) return html.replace(/<footer\b/i, `${sectionHtml}\n<footer`)
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${sectionHtml}\n</body>`)
  return `${html}\n${sectionHtml}`
}

/** Replace static mockup product collages with live shop-inventory catalog sections. */
function ensureLiveCatalogSectionsInHtml(
  html: string,
  siteSlug: string,
  spec: PartnerWebsiteMockupUiSpec,
  locale: WebLocale
): string {
  let out = html
  const productSections = spec.sections.filter((s) => s.type === 'product_grid')

  for (const section of productSections) {
    const limit = Math.max(4, Math.min(12, section.productCardCount || 8))
    const live = buildLiveCatalogSectionHtml({
      sectionId: section.id,
      title: section.titleHint || (locale === 'en' ? 'Products' : 'Sản phẩm'),
      siteSlug,
      limit,
      locale,
    })
    const re = new RegExp(
      `<section[^>]*data-pw-section-id=["']${section.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>[\\s\\S]*?<\\/section>`,
      'i'
    )
    if (re.test(out)) {
      out = out.replace(re, live)
    } else if (!new RegExp(`data-pw-section-id=["']${section.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(out)) {
      out = insertSectionBeforeMainEnd(out, live)
    }
  }

  // If analysis missed product_grid but page has a heading like "Sản phẩm" + static cards, add one live grid.
  if (
    !productSections.length &&
    !/data-pw-catalog\b/i.test(out) &&
    /sản phẩm|products|新着|상품/i.test(out)
  ) {
    out = insertSectionBeforeMainEnd(
      out,
      buildLiveCatalogSectionHtml({
        sectionId: 'products-live-catalog',
        title: locale === 'en' ? 'Products' : 'Sản phẩm',
        siteSlug,
        limit: 8,
        locale,
      })
    )
  }

  // Ensure every data-pw-catalog has an empty data-pw-grid (strip fake collage children).
  out = out.replace(
    /(<section\b[^>]*data-pw-catalog\b[^>]*>)([\s\S]*?)(<\/section>)/gi,
    (_m, open: string, inner: string, close: string) => {
      let nextInner = inner
      if (!/data-pw-grid/i.test(nextInner)) {
        nextInner += `\n<div data-pw-grid class="pw-product-grid"></div>\n<p class="pw-catalog-empty" hidden></p>`
      } else {
        // Clear static AI product cards inside the live grid.
        nextInner = nextInner.replace(
          /(<div\b[^>]*data-pw-grid\b[^>]*>)([\s\S]*?)(<\/div>)/i,
          '$1$3'
        )
      }
      return `${open}${nextInner}${close}`
    }
  )

  return out
}

function ensureChromeChatMuaInHtml(
  html: string,
  siteSlug: string,
  locale: WebLocale,
  logoUrl?: string | null,
  chatIconLogoUrl?: string | null
): string {
  if (htmlHasChromeChatMua(html)) return html
  const btn = buildPartnerSiteChatMuaButtonHtml({
    siteSlug,
    locale,
    style: 'icon',
    place: 'header',
    logoUrl,
    chatIconLogoUrl,
  })
  if (!btn) return html
  if (/<div\b[^>]*class=["'][^"']*pw-header-actions/i.test(html)) {
    return html.replace(/(<div\b[^>]*class=["'][^"']*pw-header-actions[^"']*["'][^>]*>)/i, `$1${btn}`)
  }
  if (/<\/header>/i.test(html)) {
    return html.replace(/<\/header>/i, `${btn}\n</header>`)
  }
  return html.replace(/<\/body>/i, `${btn}\n</body>`)
}

function wireHooksIntoHtml(
  html: string,
  siteSlug: string,
  spec: PartnerWebsiteMockupUiSpec,
  locale: WebLocale = 'vi',
  logoUrl?: string | null,
  chatIconLogoUrl?: string | null
): string {
  let out = ensureLiveCatalogSectionsInHtml(html, siteSlug, spec, locale)
  const allHooks = new Set(spec.sections.flatMap((s) => s.backendHooks))

  if (allHooks.has('open_chat') && !/data-nanoai-open-chat/i.test(out)) {
    out = out.replace(
      /<(button|a)(\s[^>]*class=["'][^"']*(?:cta|btn|button|mua)[^"']*["'][^>]*)>/i,
      '<$1$2 data-nanoai-open-chat>'
    )
  }
  out = ensureChromeChatMuaInHtml(out, siteSlug, locale, logoUrl, chatIconLogoUrl)
  if (chatIconLogoUrl && /^https?:\/\//i.test(chatIconLogoUrl.trim())) {
    out = applyChatIconLogoToHtml(out, chatIconLogoUrl.trim())
  }

  const productsHref = partnerSiteProductsPath(siteSlug)
  const cartHref = partnerSiteCartPath(siteSlug)
  const wishHref = partnerSiteWishlistPath(siteSlug)

  if (allHooks.has('nav_products') && !out.includes(productsHref)) {
    out = out.replace(
      /(<nav[^>]*>)/i,
      `$1\n<a href="${productsHref}">Sản phẩm</a>`
    )
  }
  if (allHooks.has('nav_cart') && !out.includes(cartHref)) {
    out = out.replace(/(<\/header>|<header[^>]*>)/i, (m) =>
      m.startsWith('</')
        ? `<a href="${cartHref}" class="pw-cart-link">Giỏ hàng</a>\n${m}`
        : `${m}\n<a href="${cartHref}" class="pw-cart-link">Giỏ hàng</a>`
    )
  }
  if (allHooks.has('nav_wishlist') && !out.includes(wishHref)) {
    out = out.replace(
      /(<nav[^>]*>)/i,
      `$1\n<a href="${wishHref}">Yêu thích</a>`
    )
  }

  if (
    allHooks.has('personalize_recommended') &&
    !/data-pw-personalize\s*=\s*["']recommended["']/i.test(out)
  ) {
    const block = `
<section id="products-live" data-pw-personalize="recommended" data-limit="8" class="pw-personalize">
  <div data-pw-grid class="pw-product-grid"></div>
  <p class="pw-personalize-empty" hidden></p>
</section>`
    if (/<footer\b/i.test(out)) {
      out = out.replace(/<footer\b/i, `${block}\n<footer`)
    } else if (/<\/main>/i.test(out)) {
      out = out.replace(/<\/main>/i, `${block}\n</main>`)
    } else if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${block}\n</body>`)
    } else {
      out = `${out}\n${block}`
    }
  }

  // Same-platform search: mark header search inputs so bootstrap auto-connects.
  if (!/data-pw-search\b/i.test(out)) {
    out = out.replace(
      /(<input\b[^>]*type=["']search["'][^>]*)(>)/i,
      '$1 data-pw-search$2'
    )
  }
  if (!/data-pw-search-form\b/i.test(out)) {
    out = out.replace(
      /(<form\b[^>]*)(>[^<]*<input\b[^>]*data-pw-search)/i,
      '$1 data-pw-search-form$2'
    )
  }
  if (!/data-pw-image-search\b/i.test(out) && /data-pw-search\b/i.test(out)) {
    out = out.replace(
      /(<input\b[^>]*data-pw-search[^>]*>)/i,
      '$1<button type="button" data-pw-image-search aria-label="Search by image">📷</button>'
    )
  }

  return out
}

async function saveProject(input: {
  partnerId: string
  siteSlug: string
  title: string
  briefText: string
  logoUrl: string | null
  chatPath: string
  locale: WebLocale
  pageKey: string
  project: PartnerWebsiteProject
  referenceImageUrls: string[]
  changeNote: string
}): Promise<PartnerWebsiteRow | null> {
  const existing = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  const merged = mergePageIntoProject(existing?.project, input.project, input.pageKey)
  const guarded = applyLogoGuardToProject(merged.project)
  return upsertPartnerWebsitePg({
    partnerId: input.partnerId,
    siteSlug: input.siteSlug,
    title: input.title,
    briefText: input.briefText.slice(0, 12000),
    logoUrl: input.logoUrl,
    referenceImageUrls: input.referenceImageUrls.slice(0, 20),
    renderMode: 'legacy',
    templateId: 'custom-mockup-v1',
    project: guarded,
    htmlSource: composeStandaloneHtml(guarded) || merged.htmlSource,
    locale: input.locale,
    chatPath: input.chatPath,
    changeNote: input.changeNote,
    skipRevision: false,
  })
}

export async function runPartnerWebsiteIncrementalBuildStep(
  input: RunIncrementalBuildStepInput
): Promise<RunIncrementalBuildStepResult> {
  const ctx = await resolveSiteContext(input)
  if (!ctx.ok) return { ok: false, error: ctx.error, stage: input.stage }

  const vi = input.locale === 'vi'
  const spec = input.mockupSpec
  const artifacts: PartnerWebsiteBuildArtifacts = {
    ...(input.artifacts ?? {}),
    approvedMockupUrl: input.approvedMockupUrl,
    siteSlug: ctx.siteSlug,
    chatPath: ctx.chatPath,
    title: ctx.title,
  }

  const clientRefs = (input.referenceImageUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u))
  const existingSite = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  const existingRefs = existingSite?.referenceImageUrls ?? []
  const allRefs = [...clientRefs, ...existingRefs]
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 12)

  // ——— prepare ———
  if (input.stage === 'prepare') {
    const contentResult = await generatePartnerWebsiteProContent({
      locale: input.locale,
      userId: input.userId,
      title: ctx.title,
      briefText: ctx.briefText,
      siteType: ctx.siteType,
      siteSlug: ctx.siteSlug,
      mockupSpecText: formatMockupSpecForPrompt(spec),
    })
    if ('error' in contentResult) {
      return { ok: false, error: contentResult.error, stage: 'prepare' }
    }

    // Skip product_* collage slots — product grids hydrate from shop inventory API.
    const slots = collectImageSlotsFromSpec(spec).filter(
      (s) => s === 'hero' || s === 'material' || s === 'lifestyle' || /^ref_\d+$/.test(s)
    )

    const imagesResult = await generatePartnerWebsiteProSectionImages({
      locale: input.locale,
      userId: input.userId,
      title: ctx.title,
      briefText: ctx.briefText,
      siteType: ctx.siteType,
      content: contentResult,
      approvedMockupUrl: input.approvedMockupUrl,
      logoUrl: ctx.logoUrl,
      userReferenceImageUrls: allRefs,
      onlySlots: slots,
    })
    if ('error' in imagesResult) {
      return { ok: false, error: imagesResult.error, stage: 'prepare' }
    }

    // Attach leftover user refs as ref_N for later inject
    const sectionImages: Record<string, string> = { ...imagesResult }
    let refIdx = 0
    for (const url of allRefs) {
      if (Object.values(sectionImages).includes(url)) continue
      if (url === input.approvedMockupUrl.trim()) continue
      refIdx += 1
      if (refIdx > 8) break
      sectionImages[`ref_${refIdx}`] = url
    }

    artifacts.contentJson = formatProContentForBuildPrompt(contentResult)
    artifacts.sectionImages = sectionImages
    artifacts.builtSectionIds = []

    // Always wipe previous build code for this page before shell/sections run.
    const clearedProject = clearBuiltCodeForPageRebuild(existingSite?.project, ctx.pageKey)
    const hadPreviousCode = Boolean(
      existingSite?.project?.files?.some((f) => {
        if (ctx.pageKey === 'home') {
          return (
            f.path === 'index.html' ||
            f.path.startsWith('css/') ||
            f.path.startsWith('js/')
          )
        }
        return f.path === pageHtmlPath(ctx.pageKey)
      })
    )

    const website = await upsertPartnerWebsitePg({
      partnerId: input.partnerId,
      siteSlug: ctx.siteSlug,
      title: ctx.title,
      briefText: ctx.briefText.slice(0, 12000),
      logoUrl: ctx.logoUrl,
      referenceImageUrls: [input.approvedMockupUrl, ...Object.values(sectionImages)].slice(0, 20),
      renderMode: 'legacy',
      templateId: 'custom-mockup-v1',
      project: clearedProject,
      htmlSource: ctx.pageKey === 'home' ? null : existingSite?.htmlSource ?? null,
      locale: input.locale,
      chatPath: ctx.chatPath,
      changeNote: hadPreviousCode ? 'studio_rebuild_clear_previous' : 'studio_prepare_artifacts',
      skipRevision: true,
    })

    if (!website) return { ok: false, error: 'Could not save prepare state', stage: 'prepare' }

    const nav = nextAfterStage('prepare', spec, artifacts)
    return {
      ok: true,
      website,
      stage: 'prepare',
      artifacts,
      progressMessage: vi
        ? `${hadPreviousCode ? 'Đã xóa code lần dựng trước. ' : ''}Đã chuẩn bị nội dung + ${Object.keys(sectionImages).length} ảnh theo mockup.`
        : `${hadPreviousCode ? 'Cleared previous build code. ' : ''}Prepared content + ${Object.keys(sectionImages).length} images from mockup.`,
      ...nav,
    }
  }

  if (!artifacts.contentJson || !artifacts.sectionImages) {
    return {
      ok: false,
      error: vi ? 'Chưa có artifacts — chạy bước prepare trước.' : 'Missing artifacts — run prepare first.',
      stage: input.stage,
    }
  }

  try {
    JSON.parse(artifacts.contentJson) as PartnerWebsiteProContent
  } catch {
    return { ok: false, error: 'Invalid content artifacts', stage: input.stage }
  }

  const sectionImages = artifacts.sectionImages
  const refUrls = [
    input.approvedMockupUrl,
    ...Object.values(sectionImages).filter(Boolean),
  ].filter((u, i, arr) => arr.indexOf(u) === i)

  // ——— shell ———
  if (input.stage === 'shell') {
    const prompt = `Build ONLY the website shell matching the mockup analysis.

Brand: ${ctx.title}
Locale: ${input.locale}
Site slug: ${ctx.siteSlug}
Logo URL: ${ctx.logoUrl || '(text wordmark)'}
Chat path: ${ctx.chatPath}

${formatMockupSpecForPrompt(spec)}

COPY JSON:
${artifacts.contentJson}

SECTION IMAGE URLS:
${Object.entries(sectionImages)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Return JSON:
{
  "html": "<!DOCTYPE html>... with header, empty <main id=\\"pw-main\\"></main>, footer — NO content sections yet",
  "css": "${
    ctx.pageKey === 'home'
      ? 'full css/main.css with CSS variables from palette (fresh rebuild — do not omit)'
      : '(return empty string — CSS inherited from homepage)'
  }",
  "js": "minimal js or empty"
}

Rules:
- Pure HTML/CSS/vanilla JS
- Header/footer from mockup (nav links using /site/${ctx.siteSlug}/products, /site/${ctx.siteSlug}/cart, /site/${ctx.siteSlug}/wishlist when hooks say so)
- ONE desktop header only (full width, min-height ~88px) — do not stack a thin bar above a second hero nav
- MUST use the exact Logo URL above in header: <img class="pw-logo site-logo" src="${ctx.logoUrl || ''}" alt="${ctx.title}" /> — never invent another logo image, never omit when Logo URL is present
${PARTNER_WEBSITE_LOGO_PROMPT_RULES}
- Primary CTAs: data-nanoai-open-chat
- Chat mua in header actions: <button type="button" class="pw-icon-btn pw-chat-open" data-pw-chrome-btn="chat" data-nanoai-open-chat> with shop logo as <img class="pw-chrome-chat-logo">. NEVER invent .pw-fab-chat / data-nanoai-chat-bubble / a floating NanoAI embed icon.
- Search bar: <form data-pw-search-form><input data-pw-search type="search" name="q" /> <button type="button" data-pw-image-search>📷</button></form>
  (platform auto-connects text + image search — do NOT invent search APIs)
- Product card actions (optional): buttons with data-pw-add-cart / data-pw-favorite and data-inventory-id="{uuid}" — platform wires cart/favorites APIs
- <main id="pw-main"></main> must be empty placeholder for sections
- Match palette hex from spec
${PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES}
${PARTNER_WEBSITE_RESPONSIVE_RULES}
${PARTNER_WEBSITE_SHARED_CHROME_PROMPT_RULES}`

    const { text } = await callOpenAiJson({
      userId: input.userId,
      system:
        'You are a senior front-end engineer. Output ONLY JSON with html/css/js strings for a website shell.',
      prompt,
      feature: 'partner-website-incremental-shell',
      imageUrls: [input.approvedMockupUrl],
      maxTokens: 12288,
    })
    const parsed = text ? parseJsonObject(text) : null
    const rawHtml = String(parsed?.html ?? '').trim()
    const html = ensureBrandLogoInHtml(rawHtml, ctx.logoUrl, ctx.title)
    const css = String(parsed?.css ?? '').trim()
    const js = String(parsed?.js ?? '').trim()
    if (!html || html.length < 80) {
      return {
        ok: false,
        error: vi ? 'Không tạo được khung HTML — thử lại.' : 'Shell HTML generation failed.',
        stage: 'shell',
      }
    }

    let project: PartnerWebsiteProject
    if (ctx.pageKey === 'home') {
      project = {
        entryPath: 'index.html',
        files: [
          { path: 'index.html', kind: 'html', content: html },
          ...(css ? [{ path: 'css/main.css' as const, kind: 'css' as const, content: css }] : []),
          ...(js ? [{ path: 'js/main.js' as const, kind: 'js' as const, content: js }] : []),
        ],
      }
    } else {
      // Non-home: replace only this page HTML; keep shared css/js from home.
      const keptShared = (existingSite?.project?.files ?? []).filter(
        (f) => f.path.startsWith('css/') || f.path.startsWith('js/') || f.path === 'index.html'
      )
      project = {
        entryPath: existingSite?.project?.entryPath || 'index.html',
        files: [
          ...keptShared.filter((f) => f.path !== pageHtmlPath(ctx.pageKey)),
          { path: pageHtmlPath(ctx.pageKey), kind: 'html', content: html },
        ],
      }
    }

    const website = await saveProject({
      partnerId: input.partnerId,
      siteSlug: ctx.siteSlug,
      title: ctx.title,
      briefText: `${ctx.briefText}\n\n---\n${artifacts.contentJson}`.slice(0, 12000),
      logoUrl: ctx.logoUrl,
      chatPath: ctx.chatPath,
      locale: input.locale,
      pageKey: ctx.pageKey,
      project,
      referenceImageUrls: refUrls,
      changeNote: `studio_shell_${ctx.pageKey}`,
    })
    if (!website) return { ok: false, error: 'Could not save shell', stage: 'shell' }

    const nav = nextAfterStage('shell', spec, artifacts)
    return {
      ok: true,
      website,
      stage: 'shell',
      artifacts,
      progressMessage: vi ? 'Đã dựng khung header/footer + CSS.' : 'Built header/footer shell + CSS.',
      ...nav,
    }
  }

  // ——— section ———
  if (input.stage === 'section') {
    const sectionId = input.sectionId?.trim()
    const section = spec.sections.find((s) => s.id === sectionId)
    if (!section || section.type === 'header' || section.type === 'footer') {
      return {
        ok: false,
        error: vi ? 'Thiếu sectionId hợp lệ.' : 'Missing valid sectionId.',
        stage: 'section',
      }
    }

    const site = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
    if (!site?.project?.files.length) {
      return { ok: false, error: 'Shell project missing — run shell first.', stage: 'section' }
    }

    const currentHtml = getPageHtml(site.project, ctx.pageKey)
    if (!currentHtml) {
      return { ok: false, error: 'Page HTML missing', stage: 'section' }
    }

    // Product grids: never bake mockup collage images — live shop inventory only.
    if (section.type === 'product_grid') {
      const limit = Math.max(4, Math.min(12, section.productCardCount || 8))
      const sectionHtml = buildLiveCatalogSectionHtml({
        sectionId: section.id,
        title: section.titleHint || (vi ? 'Sản phẩm' : 'Products'),
        siteSlug: ctx.siteSlug,
        limit,
        locale: input.locale,
      })
      let html = currentHtml
      const re = new RegExp(
        `<section[^>]*data-pw-section-id=["']${section.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>[\\s\\S]*?<\\/section>`,
        'i'
      )
      if (re.test(html)) html = html.replace(re, sectionHtml)
      else html = insertSectionBeforeMainEnd(html, sectionHtml)

      const project = setPageHtml(site.project, ctx.pageKey, html)
      const website = await saveProject({
        partnerId: input.partnerId,
        siteSlug: ctx.siteSlug,
        title: ctx.title,
        briefText: site.briefText || ctx.briefText,
        logoUrl: ctx.logoUrl,
        chatPath: ctx.chatPath,
        locale: input.locale,
        pageKey: ctx.pageKey,
        project,
        referenceImageUrls: refUrls,
        changeNote: `studio_section_catalog_${section.id}`,
      })
      if (!website) return { ok: false, error: 'Could not save section', stage: 'section' }

      artifacts.builtSectionIds = [...new Set([...(artifacts.builtSectionIds ?? []), section.id])]
      const nav = nextAfterStage('section', spec, artifacts, section.id)
      return {
        ok: true,
        website,
        stage: 'section',
        sectionId: section.id,
        artifacts,
        progressMessage: vi
          ? `Đã gắn lưới「${section.titleHint}」với sản phẩm kho shop (live).`
          : `Wired「${section.titleHint}」to live shop inventory.`,
        ...nav,
      }
    }

    const slotUrls: Array<{ key: string; url: string }> = []
    for (const k of section.imageSlots) {
      const url = sectionImages[k]
      if (typeof url === 'string' && url.trim()) slotUrls.push({ key: k, url: url.trim() })
    }

    const hookHints = section.backendHooks
      .map((h) => resolveBackendHookSnippet(h, ctx.siteSlug).htmlHint)
      .join('; ')

    const prompt = `Append ONE section into an existing page HTML to match the mockup.

Section to build:
- id: ${section.id}
- type: ${section.type}
- titleHint: ${section.titleHint}
- copyHints: ${section.copyHints}
- backend hooks: ${hookHints || 'none'}

Images for this section (MUST use exact URLs in img/background):
${slotUrls.map((x) => `- ${x.key}: ${x.url}`).join('\n') || '(no dedicated URLs — use CSS/icons only)'}

Full copy JSON (pick relevant fields):
${artifacts.contentJson}

Existing HTML (keep header/footer/bottom-nav; insert section before </main> or before footer):
\`\`\`html
${currentHtml.slice(0, 28000)}
\`\`\`

Return JSON: { "html": "FULL updated HTML document with the new section added", "sectionHtml": "just the section markup" }

Rules:
- Match mockup layout/typography/colors for this section
- Do NOT invent product grids or fake product photo collages — product sections are platform-injected separately
- Do NOT empty other sections
- Do NOT put static product cards inside data-pw-grid / data-pw-catalog
- data-pw-section-id="${section.id}" on the section root
- Pure HTML fragment inside full document
${PARTNER_WEBSITE_MOCKUP_FIDELITY_RULES}`

    const { text } = await callOpenAiJson({
      userId: input.userId,
      system:
        'You are a senior front-end engineer. Insert one high-fidelity section into existing HTML. Output ONLY JSON.',
      prompt,
      feature: 'partner-website-incremental-section',
      imageUrls: [input.approvedMockupUrl, ...slotUrls.map((x) => x.url)].slice(0, 6),
      maxTokens: 16384,
    })
    const parsed = text ? parseJsonObject(text) : null
    let html = String(parsed?.html ?? '').trim()
    const sectionHtml = String(parsed?.sectionHtml ?? '').trim()

    if ((!html || html.length < 80) && sectionHtml) {
      html = insertSectionBeforeMainEnd(currentHtml, sectionHtml)
    }

    if (!html || html.length < 80) {
      return {
        ok: false,
        error: vi
          ? `Không dựng được section「${section.titleHint}」.`
          : `Failed to build section「${section.titleHint}」.`,
        stage: 'section',
      }
    }

    // Idempotent: if section id already present, replace that block when possible
    if (
      currentHtml.includes(`data-pw-section-id="${section.id}"`) &&
      sectionHtml &&
      /data-pw-section-id=/i.test(html) === false
    ) {
      html = currentHtml.replace(
        new RegExp(
          `<section[^>]*data-pw-section-id=["']${section.id}["'][^>]*>[\\s\\S]*?<\\/section>`,
          'i'
        ),
        sectionHtml
      )
    }

    const project = setPageHtml(site.project, ctx.pageKey, html)
    const website = await saveProject({
      partnerId: input.partnerId,
      siteSlug: ctx.siteSlug,
      title: ctx.title,
      briefText: site.briefText || ctx.briefText,
      logoUrl: ctx.logoUrl,
      chatPath: ctx.chatPath,
      locale: input.locale,
      pageKey: ctx.pageKey,
      project,
      referenceImageUrls: refUrls,
      changeNote: `studio_section_${section.id}`,
    })
    if (!website) return { ok: false, error: 'Could not save section', stage: 'section' }

    artifacts.builtSectionIds = [...new Set([...(artifacts.builtSectionIds ?? []), section.id])]
    const nav = nextAfterStage('section', spec, artifacts, section.id)
    return {
      ok: true,
      website,
      stage: 'section',
      sectionId: section.id,
      artifacts,
      progressMessage: vi
        ? `Đã dựng khối「${section.titleHint}」(${section.type}).`
        : `Built block「${section.titleHint}」(${section.type}).`,
      ...nav,
    }
  }

  // ——— wire_hooks ———
  if (input.stage === 'wire_hooks') {
    const site = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
    if (!site?.project) {
      return { ok: false, error: 'Project missing', stage: 'wire_hooks' }
    }
    const html = wireHooksIntoHtml(
      ensureBrandLogoInHtml(getPageHtml(site.project, ctx.pageKey), ctx.logoUrl, ctx.title),
      ctx.siteSlug,
      spec,
      input.locale,
      ctx.logoUrl,
      site.theme?.chatIconLogoUrl
    )
    const project = setPageHtml(site.project, ctx.pageKey, html)
    const website = await saveProject({
      partnerId: input.partnerId,
      siteSlug: ctx.siteSlug,
      title: ctx.title,
      briefText: site.briefText || ctx.briefText,
      logoUrl: ctx.logoUrl,
      chatPath: ctx.chatPath,
      locale: input.locale,
      pageKey: ctx.pageKey,
      project,
      referenceImageUrls: refUrls,
      changeNote: `studio_wire_hooks_${ctx.pageKey}`,
    })
    if (!website) return { ok: false, error: 'Could not save hooks', stage: 'wire_hooks' }

    const nav = nextAfterStage('wire_hooks', spec, artifacts)
    return {
      ok: true,
      website,
      stage: 'wire_hooks',
      artifacts,
      progressMessage: vi
        ? 'Đã gắn hook backend (chat, catalog, cart, personalize).'
        : 'Wired backend hooks (chat, catalog, cart, personalize).',
      ...nav,
    }
  }

  // ——— finalize ———
  if (input.stage === 'finalize') {
    const site = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
    if (!site?.project) {
      return { ok: false, error: 'Project missing', stage: 'finalize' }
    }

    let project = ensureSectionImagesInProject(site.project, sectionImages, {
      locale: input.locale,
    })
    project = ensureBrandLogoInProject(project, ctx.logoUrl, ctx.title)
    project = applyLogoGuardToProject(project)
    // Re-apply hooks after inject
    project = setPageHtml(
      project,
      ctx.pageKey,
      wireHooksIntoHtml(
        ensureBrandLogoInHtml(getPageHtml(project, ctx.pageKey), ctx.logoUrl, ctx.title),
        ctx.siteSlug,
        spec,
        input.locale,
        ctx.logoUrl,
        site.theme?.chatIconLogoUrl
      )
    )

    const website = await saveProject({
      partnerId: input.partnerId,
      siteSlug: ctx.siteSlug,
      title: ctx.title,
      briefText: `${ctx.briefText}\n\n---\n${artifacts.contentJson}`.slice(0, 12000),
      logoUrl: ctx.logoUrl,
      chatPath: ctx.chatPath,
      locale: input.locale,
      pageKey: ctx.pageKey,
      project,
      referenceImageUrls: refUrls,
      changeNote: `studio_finalize_${ctx.pageKey}`,
    })
    if (!website) return { ok: false, error: 'Could not finalize', stage: 'finalize' }

    // Publish so /site/{slug}, cart, and catalog APIs resolve without a separate Publish click.
    const published =
      (await setPartnerWebsitePublishedPg({ partnerId: input.partnerId, isPublished: true })) || website

    return {
      ok: true,
      website: published,
      stage: 'finalize',
      artifacts,
      progressMessage: vi
        ? 'Hoàn tất dựng web — đã khớp mockup và backend nền tảng.'
        : 'Build complete — mockup fidelity + platform backend wired.',
      nextStage: 'done',
      remainingSectionIds: [],
    }
  }

  return { ok: false, error: 'Unknown stage', stage: input.stage }
}

/** Server-side full orchestration (legacy single build action). */
export async function buildPartnerWebsiteIncrementalFull(
  input: Omit<RunIncrementalBuildStepInput, 'stage' | 'sectionId' | 'artifacts'> & {
    mockupSpec: PartnerWebsiteMockupUiSpec
  }
): Promise<
  | {
      ok: true
      website: PartnerWebsiteRow
      assistantMessage: string
      artifacts: PartnerWebsiteBuildArtifacts
    }
  | { ok: false; error: string; stage?: IncrementalBuildStage }
> {
  let artifacts: PartnerWebsiteBuildArtifacts = {}
  let website: PartnerWebsiteRow | null = null
  const messages: string[] = []

  const prepare = await runPartnerWebsiteIncrementalBuildStep({
    ...input,
    stage: 'prepare',
    artifacts,
  })
  if (!prepare.ok) return { ok: false, error: prepare.error, stage: 'prepare' }
  artifacts = prepare.artifacts
  website = prepare.website
  messages.push(prepare.progressMessage)

  const shell = await runPartnerWebsiteIncrementalBuildStep({
    ...input,
    stage: 'shell',
    artifacts,
  })
  if (!shell.ok) return { ok: false, error: shell.error, stage: 'shell' }
  artifacts = shell.artifacts
  website = shell.website
  messages.push(shell.progressMessage)

  for (const sectionId of listBuildableSectionIds(input.mockupSpec)) {
    const step = await runPartnerWebsiteIncrementalBuildStep({
      ...input,
      stage: 'section',
      sectionId,
      artifacts,
    })
    if (!step.ok) return { ok: false, error: step.error, stage: 'section' }
    artifacts = step.artifacts
    website = step.website
    messages.push(step.progressMessage)
  }

  const hooks = await runPartnerWebsiteIncrementalBuildStep({
    ...input,
    stage: 'wire_hooks',
    artifacts,
  })
  if (!hooks.ok) return { ok: false, error: hooks.error, stage: 'wire_hooks' }
  artifacts = hooks.artifacts
  website = hooks.website
  messages.push(hooks.progressMessage)

  const fin = await runPartnerWebsiteIncrementalBuildStep({
    ...input,
    stage: 'finalize',
    artifacts,
  })
  if (!fin.ok) return { ok: false, error: fin.error, stage: 'finalize' }
  website = fin.website
  messages.push(fin.progressMessage)

  return {
    ok: true,
    website,
    assistantMessage: messages.join('\n'),
    artifacts: fin.artifacts,
  }
}
