import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { composeStandaloneHtml } from '@/lib/partner-website/partner-website-project'
import { hydratePartnerWebsitePages } from '@/lib/partner-website/template/hydrate-template-pages'
import { renderTemplateSiteToHtml } from '@/lib/partner-website/template/render-template-html'

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
  return (
    website.htmlSource?.trim() ||
    composeStandaloneHtml(website.project) ||
    '<!DOCTYPE html><html><body><p>Site not ready.</p></body></html>'
  )
}

export async function composePartnerWebsiteHtmlAsync(
  website: ComposeInput,
  options?: { chatPath?: string; enabledSectionTypes?: string[]; hydrateInventory?: boolean }
): Promise<string> {
  if (website.renderMode === 'template') {
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
