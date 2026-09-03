import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import type { PartnerVisualHtmlTarget } from '@/lib/partner-website/shop/render-partner-visual-html'
import {
  liveVisualHtmlPathsForTarget,
  mergePartnerWebsiteProjectFiles,
  missingLiveVisualHtmlPaths,
} from '@/lib/partner-website/shop/live-visual-html-paths'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export type LiveVisualWebsitePick = {
  siteSlug: string
  project?: PartnerWebsiteProject | null
  htmlSource?: string | null
  theme?: PartnerWebsiteTheme | null
}

export async function ensureLiveVisualWebsite<T extends LiveVisualWebsitePick>(
  site: T,
  target: PartnerVisualHtmlTarget,
  device: VisualDeviceVariant,
  options?: { allowDraft?: boolean }
): Promise<T> {
  const paths = missingLiveVisualHtmlPaths(site.project, liveVisualHtmlPathsForTarget(target, device))
  if (!paths.length) return site
  const slim = await fetchPublishedPartnerWebsiteBySlugPg(site.siteSlug, {
    allowDraft: options?.allowDraft !== false,
    projectFiles: { paths },
  })
  if (!slim) return site
  return {
    ...site,
    project: mergePartnerWebsiteProjectFiles(site.project, slim.project),
    htmlSource: slim.htmlSource || site.htmlSource,
    theme: site.theme || slim.theme,
  }
}

export async function ensureLiveHomeChromeWebsite<T extends LiveVisualWebsitePick>(
  site: T,
  device: VisualDeviceVariant,
  options?: { allowDraft?: boolean }
): Promise<T> {
  return ensureLiveVisualWebsite(site, { kind: 'page', pageKey: 'home' }, device, options)
}
