import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { injectPartnerWebsiteLogoGuardIntoHtml } from '@/lib/partner-website/partner-website-logo-guard'
import {
  extractIndexHtml,
  resolvePartnerWebsiteDisplayHtml,
} from '@/lib/partner-website/partner-website-project'
import { hydratePartnerWebsitePages } from '@/lib/partner-website/template/hydrate-template-pages'
import { renderTemplateSiteToHtml } from '@/lib/partner-website/template/render-template-html'

/** Homepage HTML from Sửa nhanh — as saved, no template CSS/JS injected. */
export function resolveExactVisualHomepageHtml(
  website: Pick<PartnerWebsiteRow, 'theme' | 'project' | 'htmlSource'>
): string {
  if (!website.theme?.useVisualHtml) return ''
  const source = website.htmlSource?.trim() || ''
  if (source.length >= 40) return source
  return extractIndexHtml(website.project)?.trim() || ''
}

function resolveVisualHtmlOverride(
  website: Pick<PartnerWebsiteRow, 'theme' | 'project' | 'htmlSource'>
): string {
  return resolveExactVisualHomepageHtml(website)
}

type ComposeInput = Pick<
  PartnerWebsiteRow,
  | 'renderMode'
  | 'templateId'
  | 'theme'
  | 'pages'
  | 'project'
  | 'htmlSource'
  | 'locale'
  | 'title'
  | 'logoUrl'
  | 'partnerId'
  | 'siteSlug'
>

export function composePartnerWebsiteHtml(
  website: Pick<
    PartnerWebsiteRow,
    'renderMode' | 'templateId' | 'theme' | 'pages' | 'project' | 'htmlSource' | 'locale' | 'title' | 'logoUrl'
  > & { siteSlug?: string },
  options?: { chatPath?: string; enabledSectionTypes?: string[] }
): string {
  if (website.renderMode === 'template') {
    const visual = resolveVisualHtmlOverride(website)
    if (visual.length >= 20) {
      return visual
    }
    return renderTemplateSiteToHtml({
      locale: website.locale,
      title: website.title,
      templateId: website.templateId,
      theme: website.theme,
      pages: website.pages,
      chatPath: options?.chatPath,
      siteSlug: website.siteSlug,
      logoUrl: website.logoUrl,
      enabledSectionTypes: options?.enabledSectionTypes,
    })
  }
  return injectPartnerWebsiteLogoGuardIntoHtml(
    resolvePartnerWebsiteDisplayHtml({
      project: website.project,
      htmlSource: website.htmlSource,
    })
  )
}

export async function composePartnerWebsiteHtmlAsync(
  website: ComposeInput,
  options?: { chatPath?: string; enabledSectionTypes?: string[]; hydrateInventory?: boolean }
): Promise<string> {
  if (website.renderMode === 'template') {
    const visual = resolveVisualHtmlOverride(website)
    if (visual.length >= 20) {
      return visual
    }
    let pages = website.pages
    if (options?.hydrateInventory !== false && website.partnerId) {
      pages = await hydratePartnerWebsitePages(website.partnerId, pages, website.siteSlug)
    }
    return renderTemplateSiteToHtml({
      locale: website.locale,
      title: website.title,
      templateId: website.templateId,
      theme: website.theme,
      pages,
      chatPath: options?.chatPath,
      siteSlug: website.siteSlug,
      logoUrl: website.logoUrl,
      enabledSectionTypes: options?.enabledSectionTypes,
    })
  }
  return composePartnerWebsiteHtml(website, options)
}
