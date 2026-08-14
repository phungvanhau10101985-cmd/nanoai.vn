import {
  fetchPartnerProfileForWebsitePg,
  fetchPartnerWebsiteByPartnerIdPg,
  setPartnerWebsitePublishedPg,
  upsertPartnerWebsitePg,
} from '@/lib/db/messaging-partner-websites-pg'
import type { WebLocale } from '@/lib/i18n/config'
import { buildPartnerWebsiteStudioBrief } from '@/lib/partner-website/partner-website-studio-flow'
import type { PartnerWebsiteStudioAnswers } from '@/lib/partner-website/partner-website-studio-flow'
import { normalizePartnerWebsiteSlug, validatePartnerWebsiteSlug } from '@/lib/partner-website/partner-website-slug'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'
import {
  DEFAULT_PARTNER_WEBSITE_THEME,
  type PartnerWebsitePage,
  type PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'
import {
  getShopTemplatePreset,
  type ShopTemplatePresetFlags,
  type ShopTemplatePresetId,
} from '@/lib/partner-website/template/shop-template-presets'
import { fetchPartnerCapabilitiesForPartnerFromPg } from '@/lib/db/messaging-partners-pg'
import { mergeTemplateFlagsWithCapabilities } from '@/lib/partner-website/partner-capabilities'
import { syncTemplateToProject } from '@/lib/partner-website/template/sync-template-project'
import { themeFromPresetPartial } from '@/lib/partner-website/template/partner-website-theme-tokens'

export type BuildPartnerWebsiteFromTemplateStudioInput = {
  locale: WebLocale
  partnerId: string
  answers: PartnerWebsiteStudioAnswers
  /** Shop look preset chosen by the merchant (fashion-orange). */
  presetId?: string | null
  /** Optional override; otherwise derived from partner slug / existing row. */
  siteSlug?: string
}

export type BuildPartnerWebsiteFromTemplateStudioResult =
  | { ok: true; website: PartnerWebsiteRow; assistantMessage: string }
  | { ok: false; error: string }

type FeatureFlags = ShopTemplatePresetFlags

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function parseFeatureFlags(raw: string | undefined): FeatureFlags {
  const s = normalizeText(raw ?? '')
  const has = (...keys: string[]) => keys.some((k) => s.includes(normalizeText(k)))
  if (
    !s.trim() ||
    has('day du', 'full', 'all', 'mac dinh', 'default', 'tat ca', 'everything')
  ) {
    return {
      products: true,
      personalize: true,
      chat: true,
      lead: true,
      faq: true,
      features: false,
      testimonials: false,
      pricing: false,
      trust: false,
      categories: true,
    }
  }
  const personalize = has(
    'yeu thich',
    'favorite',
    'wishlist',
    'vua xem',
    'recent',
    'goi y',
    'recommend',
    'ca nhan',
    'personal'
  )
  const lead = has('form', 'lien he', 'contact', 'lead')
  const testimonials = has('danh gia', 'testimonial', 'review', 'khach hang')
  const pricing = has('bang gia', 'pricing', 'goi dich vu')
  // Shop essentials always stay on; optional blocks follow keywords.
  return {
    products: true,
    personalize,
    chat: true,
    lead,
    faq: true,
    features: false,
    testimonials,
    pricing,
    trust: false,
    categories: true,
  }
}

/** Map free-text palette answers to theme colors. */
export function themeFromStudioPalette(raw: string | undefined): Partial<PartnerWebsiteTheme> {
  const text = (raw ?? '').trim()
  if (!text) return {}
  const hexes = text.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)
  if (hexes?.length) {
    return {
      primaryColor: hexes[0]!,
      accentColor: hexes[1] || hexes[0]!,
    }
  }
  const s = normalizeText(text)
  if (s.includes('beige') || (s.includes('den') && s.includes('be'))) {
    return {
      primaryColor: '#1c1917',
      accentColor: '#a8a29e',
      backgroundColor: '#fafaf9',
      textColor: '#0c0a09',
      mutedColor: '#78716c',
    }
  }
  if (s.includes('hong') || s.includes('pink') || s.includes('pastel')) {
    return {
      primaryColor: '#9d174d',
      accentColor: '#f472b6',
      backgroundColor: '#fff1f2',
      textColor: '#831843',
      mutedColor: '#9f1239',
    }
  }
  if (s.includes('navy') || s.includes('gold') || s.includes('vang')) {
    return {
      primaryColor: '#1e3a5f',
      accentColor: '#d4a017',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      mutedColor: '#64748b',
    }
  }
  if (s.includes('xanh') || s.includes('green') || s.includes('mint')) {
    return {
      primaryColor: '#065f46',
      accentColor: '#10b981',
      backgroundColor: '#ecfdf5',
      textColor: '#064e3b',
      mutedColor: '#047857',
    }
  }
  if (s.includes('toi') || s.includes('dark') || s.includes('den')) {
    return {
      primaryColor: '#0f172a',
      accentColor: '#f97316',
      backgroundColor: '#0b1220',
      textColor: '#f8fafc',
      mutedColor: '#94a3b8',
    }
  }
  return {}
}

function filterPagesByFeatures(pages: PartnerWebsitePage[], flags: FeatureFlags): PartnerWebsitePage[] {
  const keep = new Set<string>(['hero-v1', 'footer-v1'])
  if (flags.trust) keep.add('trust-bar-v1')
  if (flags.products) keep.add('products-v1')
  if (flags.personalize) {
    keep.add('recently-viewed-v1')
    keep.add('favorites-v1')
    keep.add('recommended-for-you-v1')
  }
  if (flags.features) keep.add('features-v1')
  if (flags.testimonials) keep.add('testimonials-v1')
  if (flags.pricing) keep.add('pricing-v1')
  if (flags.faq) keep.add('faq-v1')
  if (flags.lead) keep.add('lead-form-v1')
  if (flags.chat) keep.add('chat-cta-v1')
  if (flags.categories || flags.products) keep.add('categories-v1')

  return pages.map((page) => ({
    ...page,
    sections: page.sections.filter((s) => keep.has(s.type)),
  }))
}

function applyBriefCopyToPages(
  pages: PartnerWebsitePage[],
  input: {
    brand: string
    valueProp: string
    productsSell: string
    audience: string
    locale: WebLocale
  }
): PartnerWebsitePage[] {
  const subtitleParts = [input.valueProp, input.productsSell, input.audience].filter(Boolean)
  const heroSubtitle =
    subtitleParts[0]?.slice(0, 180) ||
    (input.locale === 'vi'
      ? 'Sản phẩm chất lượng — tư vấn & đặt hàng nhanh qua chat'
      : 'Quality products — chat to order fast')

  return pages.map((page) => ({
    ...page,
    title: page.slug === '/' || page.slug === 'index' ? input.brand : page.title,
    sections: page.sections.map((section) => {
      if (section.type === 'hero-v1') {
        return {
          ...section,
          props: {
            ...section.props,
            // Keep collection headline from template; brief fills subtitle.
            subtitle: heroSubtitle,
          },
        }
      }
      if (section.type === 'footer-v1') {
        return {
          ...section,
          props: {
            ...section.props,
            brandName: input.brand,
          },
        }
      }
      if (section.type === 'features-v1' && input.valueProp) {
        const items = Array.isArray(section.props.items) ? [...section.props.items] : []
        if (items[0] && typeof items[0] === 'object') {
          items[0] = {
            ...(items[0] as Record<string, unknown>),
            description: input.valueProp.slice(0, 160),
          }
        }
        return { ...section, props: { ...section.props, items } }
      }
      return section
    }),
  }))
}

/**
 * Non-AI builder: apply fixed landing-v1 template from studio answers, wire shop hooks, publish.
 */
export async function buildPartnerWebsiteFromTemplateStudio(
  input: BuildPartnerWebsiteFromTemplateStudioInput
): Promise<BuildPartnerWebsiteFromTemplateStudioResult> {
  const partnerId = input.partnerId.trim()
  if (!partnerId) return { ok: false, error: 'partnerId required' }

  const partner = await fetchPartnerProfileForWebsitePg(partnerId)
  if (!partner) return { ok: false, error: 'Partner not found' }

  const existing = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const brand =
    input.answers.brand_name?.trim() ||
    existing?.title?.trim() ||
    partner.brandName?.trim() ||
    partner.displayName?.trim() ||
    'Shop'

  const logoUrl =
    input.answers.logo_url?.trim() ||
    existing?.logoUrl?.trim() ||
    partner.logoUrl?.trim() ||
    null

  const siteSlug =
    input.siteSlug?.trim().toLowerCase() ||
    existing?.siteSlug?.trim().toLowerCase() ||
    normalizePartnerWebsiteSlug(partner.slug) ||
    partner.slug.trim().toLowerCase()

  if (validatePartnerWebsiteSlug(siteSlug)) {
    return { ok: false, error: 'Invalid site slug' }
  }

  const briefText = buildPartnerWebsiteStudioBrief(input.answers, input.locale)
  const preset = getShopTemplatePreset(input.presetId)
  const paletteTheme = themeFromStudioPalette(input.answers.color_palette)
  const partnerCaps = await fetchPartnerCapabilitiesForPartnerFromPg(partnerId)
  // Preset wins for structure; intersect with partner capabilities; free-text when no preset.
  const presetFlags: FeatureFlags = input.presetId
    ? preset.flags
    : parseFeatureFlags(input.answers.site_features)
  const flags: FeatureFlags = mergeTemplateFlagsWithCapabilities(presetFlags, partnerCaps)

  const templateSite = buildDefaultLandingV1Site({
    locale: input.locale,
    title: brand,
    briefText,
    logoUrl,
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      ...preset.theme,
      ...paletteTheme,
      logoUrl,
    },
  })

  let pages = filterPagesByFeatures(templateSite.pages, flags)
  pages = applyBriefCopyToPages(pages, {
    brand,
    valueProp: input.answers.value_prop?.trim() || '',
    productsSell: input.answers.products_sell?.trim() || '',
    audience: input.answers.target_audience?.trim() || '',
    locale: input.locale,
  })

  const theme: PartnerWebsiteTheme = {
    ...themeFromPresetPartial(
      { ...DEFAULT_PARTNER_WEBSITE_THEME, ...templateSite.theme, ...preset.theme },
      { ...preset.theme, ...paletteTheme }
    ),
    logoUrl,
    // Re-apply template clears visual «Sửa nhanh» HTML overrides.
    useVisualHtml: false,
    useVisualMobileHtml: false,
    visualPageKeys: [],
    visualMobilePageKeys: [],
    visualCategoryPaths: [],
    visualMobileCategoryPaths: [],
    visualProductIds: [],
    visualMobileProductIds: [],
    visualCmsSlugs: [],
    visualMobileCmsSlugs: [],
  }
  const templateId = preset.templateId
  const project = syncTemplateToProject({
    templateId,
    theme,
    pages,
  })
  const chatPath = `/messaging/p/${encodeURIComponent(partner.slug)}`

  const website = await upsertPartnerWebsitePg({
    partnerId,
    siteSlug,
    title: brand.slice(0, 200),
    briefText: briefText.slice(0, 12000),
    logoUrl,
    referenceImageUrls: existing?.referenceImageUrls ?? [],
    renderMode: 'template',
    templateId,
    theme,
    pages,
    project,
    locale: input.locale,
    changeNote: `studio_apply_template_${preset.id as ShopTemplatePresetId}`,
    chatPath,
  })

  if (!website) return { ok: false, error: 'Could not save website' }

  const published =
    (await setPartnerWebsitePublishedPg({ partnerId, isPublished: true })) || website

  const assistantMessage =
    input.locale === 'vi'
      ? `Đã áp mẫu «${preset.label.vi}». Bạn có thể chỉnh module và giao diện trên preview.`
      : `Applied «${preset.label.en}». You can adjust modules and layout in the preview.`

  return { ok: true, website: published, assistantMessage }
}
