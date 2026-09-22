import { NextResponse } from 'next/server'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { SHOP_PUBLIC_ROOT_SEGMENTS } from '@/lib/messaging/partner-custom-domain-site-path'
import { PARTNER_WEBSITE_PAGE_CATALOG } from '@/lib/partner-website/partner-website-page-catalog'
import { composeStandaloneHtml } from '@/lib/partner-website/partner-website-project'
import { renderPartnerWebsiteHtml } from '@/lib/partner-website/partner-website-render'
import { PARTNER_WEBSITE_SYSTEM_404_PATH } from '@/lib/partner-website/partner-website-system-pages'
import { redirectPartnerShopMissingPageToHome } from '@/lib/partner-website/shop/partner-site-not-found'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

export const dynamic = 'force-dynamic'

const RESERVED_FIRST_SEGMENTS = new Set(SHOP_PUBLIC_ROOT_SEGMENTS)

function resolveProjectHtmlPath(segments: string[]): string | null {
  if (!segments.length) return null
  const first = segments[0]?.toLowerCase() ?? ''
  if (RESERVED_FIRST_SEGMENTS.has(first)) return null
  const joined = segments.join('/').replace(/^\/+|\/+$/g, '').toLowerCase()
  if (!joined || joined.includes('..') || joined.includes('\\')) return null
  if (joined === '404' || joined === '404.html') return PARTNER_WEBSITE_SYSTEM_404_PATH
  if (joined.endsWith('.html')) return joined

  const route = `/${joined}`
  const catalogHit = PARTNER_WEBSITE_PAGE_CATALOG.find(
    (def) => def.routePath.replace(/\/$/, '') === route.replace(/\/$/, '')
  )
  if (catalogHit) return catalogHit.htmlPath
  return `${joined}.html`
}

function htmlFromProjectFile(project: PartnerWebsiteProject, htmlPath: string): string | null {
  const file = project.files.find((f) => f.path === htmlPath && f.kind === 'html')
  if (!file?.content.trim()) return null
  const pageProject: PartnerWebsiteProject = {
    entryPath: htmlPath,
    files: project.files.filter(
      (f) => f.path === htmlPath || f.path.startsWith('css/') || f.path.startsWith('js/')
    ),
  }
  return composeStandaloneHtml(pageProject) || file.content
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string; path: string[] }> }
) {
  const { slug, path: pathSegments } = await ctx.params
  const segments = (pathSegments ?? []).filter(Boolean)
  if (!segments.length) {
    return redirectPartnerShopMissingPageToHome(req, slug)
  }

  const htmlPath = resolveProjectHtmlPath(segments)
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug, {
    projectFiles: htmlPath ? { paths: [htmlPath], includeAssetFiles: true } : 'none',
  }).catch(() => null)
  if (!site) {
    return redirectPartnerShopMissingPageToHome(req, slug)
  }

  const pageHtml =
    htmlPath && htmlPath !== PARTNER_WEBSITE_SYSTEM_404_PATH
      ? htmlFromProjectFile(site.project, htmlPath)
      : null

  if (pageHtml) {
    const html = renderPartnerWebsiteHtml({
      project: site.project,
      htmlSource: pageHtml,
      chatPath: site.chatPath,
      siteSlug: site.siteSlug,
      locale: site.locale,
      facebookPixelId: site.facebookPixelId,
      ga4MeasurementId: site.ga4MeasurementId,
      googleAdsId: site.googleAdsId,
      tiktokPixelId: site.tiktokPixelId,
    })
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    })
  }

  return redirectPartnerShopMissingPageToHome(req, site.siteSlug)
}
