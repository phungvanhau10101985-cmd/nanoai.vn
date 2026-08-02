import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { injectPartnerWebsiteLogoGuardIntoHtml } from '@/lib/partner-website/partner-website-logo-guard'
import {
  composeStandaloneHtml,
  resolvePartnerWebsiteDisplayHtml,
} from '@/lib/partner-website/partner-website-project'
import { hydratePartnerWebsitePages } from '@/lib/partner-website/template/hydrate-template-pages'
import { renderTemplateSiteToHtml } from '@/lib/partner-website/template/render-template-html'

function resolveVisualHtmlOverride(
  website: Pick<PartnerWebsiteRow, 'theme' | 'project' | 'htmlSource'>
): string {
  if (!website.theme?.useVisualHtml) return ''
  return (
    resolvePartnerWebsiteDisplayHtml({
      project: website.project,
      htmlSource: website.htmlSource,
    }) ||
    composeStandaloneHtml(website.project) ||
    website.htmlSource?.trim() ||
    ''
  )
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
      return injectPartnerWebsiteLogoGuardIntoHtml(visual)
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
      return injectPartnerWebsiteLogoGuardIntoHtml(visual)
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
