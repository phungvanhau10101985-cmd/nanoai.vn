import type { WebLocale } from '@/lib/i18n/config'
import type {
  PartnerWebsitePage,
  PartnerWebsiteRenderMode,
  PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'

export type {
  PartnerWebsitePage,
  PartnerWebsiteRenderMode,
  PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'
import type {
  PartnerWebsiteCreationJournal,
  PartnerWebsiteCreationJournalsV2,
} from '@/lib/partner-website/partner-website-creation-journal'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import {
  normalizeTemplatePages,
  normalizeTemplateTheme,
} from '@/lib/partner-website/template/default-landing-v1'

export type PartnerWebsiteFileKind = 'html' | 'css' | 'js' | 'json' | 'asset'

export type PartnerWebsiteProjectFile = {
  path: string
  kind: PartnerWebsiteFileKind
  content: string
}

export type PartnerWebsiteProject = {
  entryPath: string
  files: PartnerWebsiteProjectFile[]
}

export type PartnerWebsiteRow = {
  id: string
  partnerId: string
  siteSlug: string
  title: string
  briefText: string
  logoUrl: string | null
  referenceImageUrls: string[]
  renderMode: PartnerWebsiteRenderMode
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  project: PartnerWebsiteProject
  htmlSource: string | null
  locale: WebLocale
  /** W2.3 — null/empty = shell defaults. */
  navJson: unknown | null
  footerJson: unknown | null
  isPublished: boolean
  publishedAt: string | null
  sourceThreadId: string | null
  creationJournal: PartnerWebsiteCreationJournal
  creationJournals: PartnerWebsiteCreationJournalsV2
  createdAt: string
  updatedAt: string
}

export type PartnerWebsiteRevisionRow = {
  id: string
  partnerId: string
  websiteId: string
  title: string
  briefText: string
  logoUrl: string | null
  referenceImageUrls: string[]
  renderMode: PartnerWebsiteRenderMode
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  project: PartnerWebsiteProject
  htmlSource: string | null
  locale: WebLocale
  changeNote: string | null
  createdAt: string
}

export type PartnerWebsitePublicRow = {
  siteSlug: string
  title: string
  logoUrl: string | null
  renderMode: PartnerWebsiteRenderMode
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  project: PartnerWebsiteProject
  htmlSource: string
  locale: WebLocale
  navJson: unknown | null
  footerJson: unknown | null
  partnerSlug: string
  partnerDisplayName: string
  chatPath: string
  facebookPixelId: string | null
  ga4MeasurementId: string | null
  googleAdsId: string | null
  tiktokPixelId: string | null
  gtmContainerId: string | null
  /** S0.10 */
  defaultCurrency?: string | null
}

export function mapTemplateFieldsFromDb(input: {
  render_mode?: string | null
  template_id?: string | null
  theme_json?: unknown
  pages_json?: unknown
  logo_url?: string | null
}): {
  renderMode: PartnerWebsiteRenderMode
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
} {
  const renderMode: PartnerWebsiteRenderMode =
    input.render_mode === 'template' ? 'template' : 'legacy'
  return {
    renderMode,
    templateId: input.template_id?.trim() || 'landing-v1',
    theme: normalizeTemplateTheme(input.theme_json, input.logo_url),
    pages: normalizeTemplatePages(input.pages_json),
  }
}

export { DEFAULT_PARTNER_WEBSITE_THEME }
