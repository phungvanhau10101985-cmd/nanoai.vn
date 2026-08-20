import { upsertPartnerStaticPageBySlugFromPg } from '@/lib/db/messaging-partner-static-pages-pg'
import {
  fetchPartnerWebsiteByPartnerIdPg,
  updatePartnerWebsiteDraftPg,
} from '@/lib/db/messaging-partner-websites-pg'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import {
  applyInfoPageCmsToWebsiteProject,
  extractInfoPageCmsFromHtml,
  isVisualInfoContentPageKey,
  stampPartnerSiteInfoPageSeoInHtml,
  visualInfoPageCmsSlug,
} from '@/lib/partner-website/pages/partner-info-page-visual'
import { isPartnerTextArticlePage } from '@/lib/partner-website/pages/partner-text-article-page'

export function stampAndExtractInfoPageHtml(html: string): {
  html: string
  cmsSlug: string
  extract: ReturnType<typeof extractInfoPageCmsFromHtml>
} | null {
  const stamped = stampPartnerSiteInfoPageSeoInHtml(html)
  if (!stamped.trim()) return null
  return {
    html: stamped,
    cmsSlug: '',
    extract: extractInfoPageCmsFromHtml(stamped),
  }
}

export async function publishVisualInfoPageToCms(input: {
  partnerId: string
  html: string
  pageKey?: PartnerWebsitePageKey | null
  cmsSlug?: string | null
}): Promise<string> {
  const slug = visualInfoPageCmsSlug(input.pageKey || undefined, input.cmsSlug)
  if (!slug) return input.html
  const stamped = stampPartnerSiteInfoPageSeoInHtml(input.html, {
    pageKey: input.pageKey,
    cmsSlug: input.cmsSlug,
  })
  const extract = extractInfoPageCmsFromHtml(stamped)
  await upsertPartnerStaticPageBySlugFromPg(input.partnerId, {
    slug,
    title: extract.title,
    content: extract.content,
    seoTitle: extract.seoTitle,
    seoDescription: extract.seoDescription,
    seoIndex: true,
    isPublished: true,
  })
  return stamped
}

export function shouldPublishVisualPageToCms(input: {
  pageKey?: string | null
  cmsSlug?: string | null
  html?: string | null
}): boolean {
  if (input.cmsSlug?.trim()) return true
  return isPartnerTextArticlePage({
    pageKey: input.pageKey,
    cmsSlug: input.cmsSlug,
    html: input.html,
  }) || isVisualInfoContentPageKey(input.pageKey)
}

export async function syncCmsIntoVisualInfoHtml(input: {
  partnerId: string
  slug: string
  title: string
  content: string
  seoTitle?: string
  seoDescription?: string
  visualPageKey?: PartnerWebsitePageKey | null
}): Promise<void> {
  const website = await fetchPartnerWebsiteByPartnerIdPg(input.partnerId)
  if (!website?.project) return
  const next = applyInfoPageCmsToWebsiteProject(website.project, {
    visualPageKey: input.visualPageKey,
    cmsSlug: input.visualPageKey ? null : input.slug,
    title: input.title,
    content: input.content,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  })
  if (next === website.project) return
  await updatePartnerWebsiteDraftPg({
    partnerId: input.partnerId,
    project: next,
    changeNote: 'cms_info_sync',
    skipRevision: true,
  })
}
