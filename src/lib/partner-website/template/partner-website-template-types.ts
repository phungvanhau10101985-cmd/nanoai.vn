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
  primaryColor: '#1e3a5f',
  accentColor: '#f97316',
  backgroundColor: '#ffffff',
  textColor: '#0f172a',
  mutedColor: '#64748b',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  logoUrl: null,
}
