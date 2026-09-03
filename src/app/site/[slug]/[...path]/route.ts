import { NextResponse } from 'next/server'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { PARTNER_WEBSITE_PAGE_CATALOG } from '@/lib/partner-website/partner-website-page-catalog'
import { composeStandaloneHtml } from '@/lib/partner-website/partner-website-project'
import { renderPartnerWebsiteHtml } from '@/lib/partner-website/partner-website-render'
import {
  getPartnerWebsite404HtmlFromProject,
  PARTNER_WEBSITE_SYSTEM_404_PATH,
} from '@/lib/partner-website/partner-website-system-pages'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

export const dynamic = 'force-dynamic'

const RESERVED_FIRST_SEGMENTS = new Set([
  'products',
  'cart',
  'orders',
  'account',
  'addresses',
  'lp',
  'wishlist',
  'recently-viewed',
  'about',
  'contact',
  'faq',
  'sale',
  'shipping',
  'returns',
  'privacy',
  'terms',
  'payment',
  'thank-you',
  'stores',
  'lookbook',
  'size-guide',
  'blog',
])

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
  _req: Request,
  ctx: { params: Promise<{ slug: string; path: string[] }> }
) {
  const { slug, path: pathSegments } = await ctx.params
  const segments = (pathSegments ?? []).filter(Boolean)
  if (!segments.length) {
    return new NextResponse('Not found', { status: 404 })
  }

  const htmlPath = resolveProjectHtmlPath(segments)
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug, {
    projectFiles: htmlPath ? { paths: [htmlPath], includeAssetFiles: true } : 'none',
  }).catch(() => null)
  if (!site) {
    return new NextResponse('Not found', { status: 404 })
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

  const homeHref = `/site/${encodeURIComponent(site.siteSlug)}`
  const notFoundHtml = getPartnerWebsite404HtmlFromProject(site.project, {
    shopTitle: site.title,
    locale: site.locale,
    homeHref,
  })
  const html = renderPartnerWebsiteHtml({
    project: {
      entryPath: PARTNER_WEBSITE_SYSTEM_404_PATH,
      files: [
        {
          path: PARTNER_WEBSITE_SYSTEM_404_PATH,
          kind: 'html',
          content: notFoundHtml,
        },
      ],
    },
    htmlSource: notFoundHtml,
    chatPath: site.chatPath,
    siteSlug: site.siteSlug,
    locale: site.locale,
    enablePersonalization: false,
  })

  return new NextResponse(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
