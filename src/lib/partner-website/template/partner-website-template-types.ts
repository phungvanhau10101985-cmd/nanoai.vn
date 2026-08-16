import type { WebLocale } from '@/lib/i18n/config'

export type PartnerWebsiteRenderMode = 'legacy' | 'template'

export type PartnerWebsiteTheme = {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  mutedColor: string
  /** Nút Mua hàng — mặc định = primaryColor. */
  buyButtonColor?: string
  /** Nút Thêm giỏ — mặc định xám phụ trợ. */
  cartButtonColor?: string
  /** Nền nhạt (hover / card wash). */
  surfaceColor?: string
  borderColor?: string
  fontFamily: string
  logoUrl?: string | null
  /**
   * When true, preview/public prefer saved project/htmlSource from visual «Sửa nhanh»
   * instead of re-rendering from template pages.
   */
  useVisualHtml?: boolean
  /** Homepage has a separate mobile «Sửa nhanh» HTML (`index.mobile.html`). */
  useVisualMobileHtml?: boolean
  /** Homepage has a separate tablet «Sửa nhanh» HTML (`index.tablet.html`). */
  useVisualTabletHtml?: boolean
  /** Non-home pages that have a saved «Sửa nhanh» HTML override in project.files. */
  visualPageKeys?: string[]
  /** Non-home pages with a separate mobile «Sửa nhanh» HTML (`*.mobile.html`). */
  visualMobilePageKeys?: string[]
  /** Non-home pages with a separate tablet «Sửa nhanh» HTML (`*.tablet.html`). */
  visualTabletPageKeys?: string[]
  /** Category paths (`ao-nam`, `thoi-trang/ao`) with desktop «Sửa nhanh» HTML. */
  visualCategoryPaths?: string[]
  /** Category paths with mobile «Sửa nhanh» HTML. */
  visualMobileCategoryPaths?: string[]
  /** Category paths with tablet «Sửa nhanh» HTML. */
  visualTabletCategoryPaths?: string[]
  /** Inventory UUIDs with desktop «Sửa nhanh» HTML (per product). */
  visualProductIds?: string[]
  /** Inventory UUIDs with mobile «Sửa nhanh» HTML. */
  visualMobileProductIds?: string[]
  /** Inventory UUIDs with tablet «Sửa nhanh» HTML. */
  visualTabletProductIds?: string[]
  /** Custom CMS slugs (`/pages/{slug}`) with desktop «Sửa nhanh» HTML. */
  visualCmsSlugs?: string[]
  /** Custom CMS slugs with mobile «Sửa nhanh» HTML. */
  visualMobileCmsSlugs?: string[]
  /** Custom CMS slugs with tablet «Sửa nhanh» HTML. */
  visualTabletCmsSlugs?: string[]
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
  buyButtonColor: '#f97316',
  cartButtonColor: '#6b7280',
  surfaceColor: '#fff7ed',
  borderColor: '#e5e7eb',
  fontFamily:
    '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  logoUrl: null,
}
