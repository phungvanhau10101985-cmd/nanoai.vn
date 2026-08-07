import type { WebLocale } from '@/lib/i18n/config'

export type PartnerWebsiteRenderMode = 'legacy' | 'template'

export type PartnerWebsiteTheme = {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  mutedColor: string
  fontFamily: string
  logoUrl?: string | null
  /**
   * When true, preview/public prefer saved project/htmlSource from visual «Sửa nhanh»
   * instead of re-rendering from template pages.
   */
  useVisualHtml?: boolean
  /** M3.2 — optional fixed bottom-right CTA above chat FAB. */
  floatingCta?: {
    enabled: boolean
    label: string
    href: string
    imageUrl?: string | null
  }
}

export type PartnerWebsiteSection = {
  id: string
  type: string
  props: Record<string, unknown>
}

export type PartnerWebsitePage = {
  slug: string
  title: string
  sections: PartnerWebsiteSection[]
}

export type PartnerWebsiteTemplateSite = {
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
}

export type PartnerWebsiteTemplateRenderInput = {
  locale: WebLocale
  title: string
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  chatPath?: string
  siteSlug?: string
  logoUrl?: string | null
  enabledSectionTypes?: string[]
  /** Public template gallery: full shop chrome + static demo products (no live inventory). */
  samplePreview?: boolean
}

export type TemplateSectionEditOp =
  | { op: 'update'; sectionId: string; props: Record<string, unknown> }
  | { op: 'add'; pageSlug: string; type: string; props: Record<string, unknown>; afterSectionId?: string }
  | { op: 'remove'; sectionId: string }
  | { op: 'reorder'; pageSlug: string; sectionIds: string[] }

export type PartnerWebsiteTemplateEditPayload = {
  assistantMessage?: string
  theme?: Partial<PartnerWebsiteTheme>
  sectionOps?: TemplateSectionEditOp[]
}

export const DEFAULT_PARTNER_WEBSITE_THEME: PartnerWebsiteTheme = {
  primaryColor: '#f97316',
  accentColor: '#ea580c',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  mutedColor: '#6b7280',
  fontFamily: '"Outfit", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  logoUrl: null,
}
