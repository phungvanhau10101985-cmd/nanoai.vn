import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerVisualHtmlTarget } from '@/lib/partner-website/shop/render-partner-visual-html'
import {
  categoryVisualHtmlPath,
  cmsVisualHtmlPath,
  productVisualHtmlPath,
  productVisualShellHtmlPath,
  visualEditorHtmlPath,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of paths) {
    const path = raw.replace(/\\/g, '/').replace(/^\/+/, '').trim()
    if (!path || path.includes('..') || seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

/** Live customer view: only the HTML file for this page + machine (plus same-device home for chrome). */
export function liveVisualHtmlPathsForTarget(
  target: PartnerVisualHtmlTarget,
  device: VisualDeviceVariant
): string[] {
  const home = visualEditorHtmlPath('home', device)
  if (target.kind === 'page') {
    const page = visualEditorHtmlPath(target.pageKey, device)
    return uniquePaths(target.pageKey === 'home' ? [page] : [page, home])
  }
  if (target.kind === 'product') {
    return uniquePaths([
      productVisualShellHtmlPath(device),
      productVisualHtmlPath(target.productId, device),
      home,
    ])
  }
  if (target.kind === 'category') {
    return uniquePaths([categoryVisualHtmlPath(target.categoryPath, device), home])
  }
  return uniquePaths([cmsVisualHtmlPath(target.cmsSlug, device), home])
}

export function missingLiveVisualHtmlPaths(
  project: PartnerWebsiteProject | null | undefined,
  paths: string[]
): string[] {
  const files = project?.files ?? []
  return paths.filter(
    (path) =>
      !files.some((file) => file.path === path && file.kind === 'html' && file.content.trim().length >= 40)
  )
}

export function projectHasLiveVisualHtmlPaths(
  project: PartnerWebsiteProject | null | undefined,
  paths: string[]
): boolean {
  return missingLiveVisualHtmlPaths(project, paths).length === 0
}

export function mergePartnerWebsiteProjectFiles(
  base: PartnerWebsiteProject | null | undefined,
  extra: PartnerWebsiteProject | null | undefined
): PartnerWebsiteProject {
  const files = new Map<string, PartnerWebsiteProject['files'][number]>()
  for (const file of base?.files ?? []) files.set(file.path, file)
  for (const file of extra?.files ?? []) files.set(file.path, file)
  const merged = [...files.values()]
  const entryPath =
    extra?.entryPath && merged.some((file) => file.path === extra.entryPath)
      ? extra.entryPath
      : base?.entryPath && merged.some((file) => file.path === base.entryPath)
        ? base.entryPath
        : merged.find((file) => file.path === 'index.html')?.path ||
          merged.find((file) => file.kind === 'html')?.path ||
          'index.html'
  return { entryPath, files: merged }
}
