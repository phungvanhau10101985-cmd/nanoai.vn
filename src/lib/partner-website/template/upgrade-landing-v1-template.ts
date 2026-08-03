import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePage, PartnerWebsiteSection } from '@/lib/partner-website/template/partner-website-template-types'
import {
  buildLandingV1PersonalizationSections,
  getLandingV1SectionCopy,
} from '@/lib/partner-website/template/default-landing-v1'
import { defaultPropsForSection } from '@/lib/partner-website/template/section-registry'

const PERSONALIZATION_TYPES = ['recently-viewed-v1', 'favorites-v1', 'recommended-for-you-v1'] as const

function sectionTypes(sections: PartnerWebsiteSection[]): Set<string> {
  return new Set(sections.map((s) => s.type))
}

function insertAfterType(
  sections: PartnerWebsiteSection[],
  afterType: string,
  toInsert: PartnerWebsiteSection[]
): PartnerWebsiteSection[] {
  const idx = sections.findIndex((s) => s.type === afterType)
  if (idx < 0) return [...sections, ...toInsert]
  return [...sections.slice(0, idx + 1), ...toInsert, ...sections.slice(idx + 1)]
}

function ensureHeroUtmVariants(sections: PartnerWebsiteSection[]): {
  sections: PartnerWebsiteSection[]
  changed: boolean
} {
  let changed = false
  const next = sections.map((s) => {
    if (s.type !== 'hero-v1') return s
    if (Array.isArray(s.props.utmVariants)) return s
    changed = true
    return {
      ...s,
      props: {
        ...s.props,
        utmVariants: defaultPropsForSection('hero-v1').utmVariants ?? [],
      },
    }
  })
  return { sections: next, changed }
}

/**
 * Adds platform personalization sections to landing-v1 when missing (idempotent).
 */
export function upgradeLandingV1Pages(input: {
  pages: PartnerWebsitePage[]
  locale: WebLocale
}): { pages: PartnerWebsitePage[]; changed: boolean } {
  const locale = input.locale
  const productCta = getLandingV1SectionCopy(locale).productCta
  let changed = false

  const pages = input.pages.map((page) => {
    if (page.slug !== '/' && page.slug !== 'index') return page

    let sections = [...page.sections]
    let pageChanged = false
    const types = sectionTypes(sections)
    const missing = PERSONALIZATION_TYPES.filter((t) => !types.has(t))
    if (missing.length) {
      const toAdd = buildLandingV1PersonalizationSections(locale, productCta).filter((s) =>
        missing.includes(s.type as (typeof PERSONALIZATION_TYPES)[number])
      )
      if (toAdd.length) {
        sections = insertAfterType(sections, 'products-v1', toAdd)
        if (!types.has('products-v1')) {
          sections = [...sections, ...toAdd]
        }
        pageChanged = true
      }
    }

    const heroPatch = ensureHeroUtmVariants(sections)
    if (heroPatch.changed) {
      sections = heroPatch.sections
      pageChanged = true
    }

    if (pageChanged) {
      changed = true
      return { ...page, sections }
    }
    return page
  })

  return { pages, changed }
}

export function isFullLandingV1Template(input: {
  renderMode?: string
  templateId?: string
}): boolean {
  if (input.renderMode !== 'template') return false
  const id = (input.templateId ?? 'landing-v1').trim()
  // Commerce / fashion / hospitality presets share the landing-v1 section contract.
  return (
    id === 'landing-v1' ||
    id.startsWith('fashion-') ||
    id.startsWith('commerce-') ||
    id.startsWith('hospitality-')
  )
}
