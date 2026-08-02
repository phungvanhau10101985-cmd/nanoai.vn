import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteCartPath,
  partnerSiteProductsPath,
  partnerSiteWishlistPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

/** Canonical section types detected on an approved mockup. */
export type PartnerWebsiteMockupSectionType =
  | 'header'
  | 'hero'
  | 'category_nav'
  | 'product_grid'
  | 'banner'
  | 'benefits'
  | 'testimonials'
  | 'faq'
  | 'cta'
  | 'footer'
  | 'other'

/** Platform backend hooks — models must only pick from this catalog. */
export type PartnerWebsiteBackendHook =
  | 'open_chat'
  | 'nav_products'
  | 'nav_cart'
  | 'nav_wishlist'
  | 'catalog_products'
  | 'personalize_recommended'
  | 'search_text'
  | 'search_image'

export type PartnerWebsiteImageSlotKey =
  | 'hero'
  | 'material'
  | 'lifestyle'
  | 'product_1'
  | 'product_2'
  | 'product_3'
  | 'product_4'
  | `ref_${number}`

export type PartnerWebsiteMockupSection = {
  id: string
  type: PartnerWebsiteMockupSectionType
  titleHint: string
  imageSlots: PartnerWebsiteImageSlotKey[]
  copyHints: string
  backendHooks: PartnerWebsiteBackendHook[]
  /** Approximate product card count when type is product_grid. */
  productCardCount?: number
}

export type PartnerWebsiteMockupUiSpec = {
  version: 1
  summary: string
  palette: {
    primary: string
    secondary?: string
    accent?: string
    background?: string
    text?: string
  }
  typography: {
    headlineStyle: string
    bodyStyle: string
    googleFontsHint?: string
  }
  layoutNotes: string
  sections: PartnerWebsiteMockupSection[]
}

export const PARTNER_WEBSITE_BACKEND_HOOKS: PartnerWebsiteBackendHook[] = [
  'open_chat',
  'nav_products',
  'nav_cart',
  'nav_wishlist',
  'catalog_products',
  'personalize_recommended',
  'search_text',
  'search_image',
]

export const PARTNER_WEBSITE_SECTION_TYPES: PartnerWebsiteMockupSectionType[] = [
  'header',
  'hero',
  'category_nav',
  'product_grid',
  'banner',
  'benefits',
  'testimonials',
  'faq',
  'cta',
  'footer',
  'other',
]

const IMAGE_SLOT_RE = /^(hero|material|lifestyle|product_[1-4]|ref_\d+)$/

function asHook(raw: unknown): PartnerWebsiteBackendHook | null {
  const v = String(raw ?? '').trim() as PartnerWebsiteBackendHook
  return PARTNER_WEBSITE_BACKEND_HOOKS.includes(v) ? v : null
}

function asSectionType(raw: unknown): PartnerWebsiteMockupSectionType {
  const v = String(raw ?? '').trim() as PartnerWebsiteMockupSectionType
  return PARTNER_WEBSITE_SECTION_TYPES.includes(v) ? v : 'other'
}

function asImageSlot(raw: unknown): PartnerWebsiteImageSlotKey | null {
  const v = String(raw ?? '').trim()
  if (!IMAGE_SLOT_RE.test(v)) return null
  return v as PartnerWebsiteImageSlotKey
}

function slugId(raw: string, index: number): string {
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return base || `section-${index + 1}`
}

/** Normalize/validate AI JSON into a safe MockupUiSpec. */
export function normalizePartnerWebsiteMockupUiSpec(raw: unknown): PartnerWebsiteMockupUiSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const sectionsRaw = Array.isArray(o.sections) ? o.sections : []
  if (!sectionsRaw.length) return null

  const seenIds = new Set<string>()
  const sections: PartnerWebsiteMockupSection[] = []
  for (let i = 0; i < sectionsRaw.length; i++) {
    const row = sectionsRaw[i]
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const type = asSectionType(r.type)
    let id = String(r.id ?? '').trim() || slugId(`${type}-${i}`, i)
    id = slugId(id, i)
    if (seenIds.has(id)) id = `${id}-${i + 1}`
    seenIds.add(id)

    const imageSlots = Array.isArray(r.imageSlots)
      ? (r.imageSlots.map(asImageSlot).filter(Boolean) as PartnerWebsiteImageSlotKey[])
      : []
    const backendHooks = Array.isArray(r.backendHooks)
      ? (r.backendHooks.map(asHook).filter(Boolean) as PartnerWebsiteBackendHook[])
      : []

    const productCardCount =
      typeof r.productCardCount === 'number' && r.productCardCount > 0
        ? Math.min(12, Math.round(r.productCardCount))
        : type === 'product_grid'
          ? Math.max(4, imageSlots.filter((s) => s.startsWith('product_')).length || 4)
          : undefined

    const hooks = [...new Set(backendHooks)]
    // Product grids always load live shop inventory (not mockup collage images).
    if (type === 'product_grid' && !hooks.includes('catalog_products')) {
      hooks.push('catalog_products')
    }

    sections.push({
      id,
      type,
      titleHint: String(r.titleHint ?? r.title ?? type).trim().slice(0, 120) || type,
      imageSlots: [...new Set(imageSlots)],
      copyHints: String(r.copyHints ?? r.copy ?? '').trim().slice(0, 800),
      backendHooks: hooks,
      productCardCount,
    })
  }

  if (!sections.length) return null

  // Ensure minimum ecommerce structure if mockup analysis omitted obvious pieces.
  const types = new Set(sections.map((s) => s.type))
  if (!types.has('header')) {
    sections.unshift({
      id: 'header',
      type: 'header',
      titleHint: 'Header',
      imageSlots: [],
      copyHints: 'Logo, search, cart, account',
      backendHooks: [
        'nav_products',
        'nav_cart',
        'nav_wishlist',
        'open_chat',
        'search_text',
        'search_image',
      ],
    })
  }
  if (!types.has('footer')) {
    sections.push({
      id: 'footer',
      type: 'footer',
      titleHint: 'Footer',
      imageSlots: [],
      copyHints: 'About, policies, support, contact',
      backendHooks: ['open_chat'],
    })
  }

  const paletteObj = (o.palette && typeof o.palette === 'object' ? o.palette : {}) as Record<
    string,
    unknown
  >
  const typoObj = (o.typography && typeof o.typography === 'object' ? o.typography : {}) as Record<
    string,
    unknown
  >

  return {
    version: 1,
    summary: String(o.summary ?? '').trim().slice(0, 1200) || 'Mockup layout analysis',
    palette: {
      primary: String(paletteObj.primary ?? '#f97316').trim() || '#f97316',
      secondary: paletteObj.secondary ? String(paletteObj.secondary).trim() : undefined,
      accent: paletteObj.accent ? String(paletteObj.accent).trim() : undefined,
      background: paletteObj.background ? String(paletteObj.background).trim() : undefined,
      text: paletteObj.text ? String(paletteObj.text).trim() : undefined,
    },
    typography: {
      headlineStyle: String(typoObj.headlineStyle ?? 'serif display').trim() || 'serif display',
      bodyStyle: String(typoObj.bodyStyle ?? 'clean sans').trim() || 'clean sans',
      googleFontsHint: typoObj.googleFontsHint
        ? String(typoObj.googleFontsHint).trim()
        : undefined,
    },
    layoutNotes: String(o.layoutNotes ?? '').trim().slice(0, 2000),
    sections,
  }
}

export function collectImageSlotsFromSpec(spec: PartnerWebsiteMockupUiSpec): PartnerWebsiteImageSlotKey[] {
  const out: PartnerWebsiteImageSlotKey[] = []
  const seen = new Set<string>()
  for (const section of spec.sections) {
    for (const slot of section.imageSlots) {
      if (seen.has(slot)) continue
      seen.add(slot)
      out.push(slot)
    }
  }
  // Default product slots when product_grid exists but slots empty
  if (spec.sections.some((s) => s.type === 'product_grid') && !out.some((s) => s.startsWith('product_'))) {
    for (const s of ['product_1', 'product_2', 'product_3', 'product_4'] as const) {
      out.push(s)
    }
  }
  if (spec.sections.some((s) => s.type === 'hero') && !out.includes('hero')) {
    out.unshift('hero')
  }
  return out
}

export function formatMockupSpecForPrompt(spec: PartnerWebsiteMockupUiSpec): string {
  const sectionLines = spec.sections
    .map(
      (s, i) =>
        `${i + 1}. [${s.id}] type=${s.type} title="${s.titleHint}" images=[${s.imageSlots.join(', ') || '—'}] hooks=[${s.backendHooks.join(', ') || '—'}]${s.productCardCount ? ` cards≈${s.productCardCount}` : ''}\n   copy: ${s.copyHints || '(from mockup)'}`
    )
    .join('\n')
  return `SUMMARY: ${spec.summary}
PALETTE: primary=${spec.palette.primary}${spec.palette.accent ? ` accent=${spec.palette.accent}` : ''}${spec.palette.background ? ` bg=${spec.palette.background}` : ''}
TYPOGRAPHY: ${spec.typography.headlineStyle} / ${spec.typography.bodyStyle}${spec.typography.googleFontsHint ? ` fonts=${spec.typography.googleFontsHint}` : ''}
LAYOUT: ${spec.layoutNotes || '(see sections)'}
SECTIONS (top → bottom):
${sectionLines}`
}

export function summarizeMockupSpecForJournal(
  spec: PartnerWebsiteMockupUiSpec,
  locale: WebLocale
): string {
  const names = spec.sections.map((s) => s.titleHint || s.type).join(' → ')
  if (locale === 'vi') {
    return `Đã phân tích mockup: ${spec.sections.length} khối (${names}).\n${spec.summary}`
  }
  return `Mockup analyzed: ${spec.sections.length} blocks (${names}).\n${spec.summary}`
}

/** Map hook → concrete HTML/href snippets for builders. */
export function resolveBackendHookSnippet(
  hook: PartnerWebsiteBackendHook,
  siteSlug: string
): { attr?: string; href?: string; htmlHint: string } {
  switch (hook) {
    case 'open_chat':
      return {
        attr: 'data-nanoai-open-chat',
        htmlHint: 'button/a with data-nanoai-open-chat',
      }
    case 'nav_products':
      return {
        href: partnerSiteProductsPath(siteSlug),
        htmlHint: `a[href="${partnerSiteProductsPath(siteSlug)}"]`,
      }
    case 'nav_cart':
      return {
        href: partnerSiteCartPath(siteSlug),
        htmlHint: `a[href="${partnerSiteCartPath(siteSlug)}"]`,
      }
    case 'nav_wishlist':
      return {
        href: partnerSiteWishlistPath(siteSlug),
        htmlHint: `a[href="${partnerSiteWishlistPath(siteSlug)}"]`,
      }
    case 'catalog_products':
      return {
        htmlHint:
          '<section data-pw-catalog data-limit="8" data-sort="newest"><div data-pw-grid class="pw-product-grid"></div></section>',
      }
    case 'personalize_recommended':
      return {
        htmlHint:
          '<section data-pw-personalize="recommended" data-limit="8"><div data-pw-grid class="pw-product-grid"></div></section>',
      }
    case 'search_text':
      return {
        htmlHint:
          '<form data-pw-search-form role="search"><input data-pw-search type="search" name="q" placeholder="Search" /></form>',
      }
    case 'search_image':
      return {
        htmlHint: '<button type="button" data-pw-image-search aria-label="Search by image">📷</button>',
      }
  }
}

export type PartnerWebsiteBuildArtifacts = {
  contentJson?: string
  sectionImages?: Record<string, string>
  approvedMockupUrl?: string
  builtSectionIds?: string[]
  siteSlug?: string
  chatPath?: string
  title?: string
}
