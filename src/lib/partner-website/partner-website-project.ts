import type {
  PartnerWebsiteFileKind,
  PartnerWebsiteProject,
  PartnerWebsiteProjectFile,
} from '@/lib/partner-website/partner-website-types'
import {
  appendLogoGuardToProjectCss,
  injectPartnerWebsiteLogoGuardIntoHtml,
} from '@/lib/partner-website/partner-website-logo-guard'
import { appendResponsiveBaselineToProjectCss } from '@/lib/partner-website/partner-website-mockup-build-rules'
import { PARTNER_WEBSITE_SYSTEM_404_PATH } from '@/lib/partner-website/partner-website-system-pages'

/** System HTML must never be treated as the shop homepage entry. */
function isSystemHtmlPath(path: string): boolean {
  const p = path.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase()
  return p === PARTNER_WEBSITE_SYSTEM_404_PATH.toLowerCase()
}

const ALLOWED_KINDS = new Set<PartnerWebsiteFileKind>(['html', 'css', 'js', 'json', 'asset'])

function inferKind(path: string): PartnerWebsiteFileKind {
  const lower = path.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'js'
  if (lower.endsWith('.json')) return 'json'
  return 'asset'
}

function normalizePath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.\.(\/|$)/g, '')
}

export function normalizePartnerWebsiteProject(raw: unknown): PartnerWebsiteProject | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as { entryPath?: unknown; files?: unknown }
  const filesRaw = Array.isArray(obj.files) ? obj.files : []
  const files: PartnerWebsiteProjectFile[] = []

  for (const row of filesRaw) {
    if (!row || typeof row !== 'object') continue
    const path = normalizePath(String((row as { path?: string }).path ?? ''))
    const content = String((row as { content?: string }).content ?? '')
    if (!path || !content.trim()) continue
    const kindRaw = String((row as { kind?: string }).kind ?? '').trim() as PartnerWebsiteFileKind
    const kind = ALLOWED_KINDS.has(kindRaw) ? kindRaw : inferKind(path)
    files.push({ path, kind, content })
  }

  if (!files.length) return null

  const entryCandidate = normalizePath(String(obj.entryPath ?? 'index.html'))
  const entryPath = files.some((f) => f.path === entryCandidate)
    ? entryCandidate
    : files.find((f) => f.path === 'index.html')?.path ??
      files.find((f) => f.kind === 'html' && !isSystemHtmlPath(f.path))?.path ??
      files[0]!.path

  return { entryPath, files }
}

export function projectFilesToJson(project: PartnerWebsiteProject): unknown {
  return {
    entryPath: project.entryPath,
    files: project.files.map((f) => ({ path: f.path, kind: f.kind, content: f.content })),
  }
}

export function parseProjectFilesFromDb(raw: unknown): PartnerWebsiteProject {
  const normalized = normalizePartnerWebsiteProject(raw)
  if (normalized) return normalized
  return { entryPath: 'index.html', files: [] }
}

export function extractIndexHtml(project: PartnerWebsiteProject): string | null {
  const entry = project.files.find((f) => f.path === project.entryPath && f.kind === 'html')
  if (entry?.content.trim() && !isSystemHtmlPath(entry.path)) return entry.content.trim()

  const indexHtml = project.files.find((f) => f.path === 'index.html' && f.kind === 'html')
  if (indexHtml?.content.trim()) return indexHtml.content.trim()

  // Never fall back to system pages (e.g. 404.html) — template shops store pages in
  // site.config.json and rely on composed htmlSource for preview/public render.
  const firstHtml = project.files.find(
    (f) => f.kind === 'html' && !isSystemHtmlPath(f.path) && f.content.trim()
  )
  return firstHtml?.content.trim() || null
}

/** Inline linked CSS/JS from project into index.html for iframe/public render. */
export function composeStandaloneHtml(project: PartnerWebsiteProject): string | null {
  const indexHtml = extractIndexHtml(project)
  if (!indexHtml) return null

  const cssWithGuard = project.files
    .filter((f) => f.kind === 'css')
    .map((f) => {
      const guarded = appendResponsiveBaselineToProjectCss(appendLogoGuardToProjectCss(f.content))
      const css = guarded === f.content ? f.content : guarded
      return `<style data-path="${f.path}">\n${css}\n</style>`
    })
  const jsBlocks = project.files
    .filter((f) => f.kind === 'js')
    .map((f) => `<script data-path="${f.path}">\n${f.content}\n</script>`)

  if (!cssWithGuard.length && !jsBlocks.length) {
    return injectPartnerWebsiteLogoGuardIntoHtml(indexHtml)
  }

  const headInject = cssWithGuard.join('\n')
  const bodyInject = jsBlocks.join('\n')

  if (/<\/head>/i.test(indexHtml)) {
    let out = indexHtml.replace(/<\/head>/i, `${headInject}\n</head>`)
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${bodyInject}\n</body>`)
    } else {
      out = `${out}\n${bodyInject}`
    }
    return injectPartnerWebsiteLogoGuardIntoHtml(out)
  }

  return injectPartnerWebsiteLogoGuardIntoHtml(`${indexHtml}\n${headInject}\n${bodyInject}`)
}

/** Remove <link>/<script src> for project files already inlined into the document. */
function stripInlinedProjectAssetRefs(html: string, project: PartnerWebsiteProject): string {
  let out = html
  for (const file of project.files) {
    if (file.kind !== 'css' && file.kind !== 'js') continue
    const normalized = file.path.replace(/\\/g, '/').replace(/^\.\//, '')
    if (!normalized) continue
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`<link[^>]*href=["'](?:\\./)?${escaped}["'][^>]*>`, 'gi'), '')
    out = out.replace(
      new RegExp(`<script[^>]*src=["'](?:\\./)?${escaped}["'][^>]*>\\s*</script>`, 'gi'),
      ''
    )
  }
  return out
}

/** Prefer composed HTML (CSS/JS inlined) over cached htmlSource snapshots. */
export function resolvePartnerWebsiteDisplayHtml(input: {
  project: PartnerWebsiteProject
  htmlSource?: string | null
}): string {
  const composed = composeStandaloneHtml(input.project)
  if (composed) return stripInlinedProjectAssetRefs(composed, input.project)
  const fallback = input.htmlSource?.trim()
  if (fallback) return injectPartnerWebsiteLogoGuardIntoHtml(fallback)
  return injectPartnerWebsiteLogoGuardIntoHtml(
    '<!DOCTYPE html><html><body><p>Site not ready.</p></body></html>'
  )
}

export function defaultProjectFromHtml(html: string, title: string): PartnerWebsiteProject {
  const safeTitle = title.trim() || 'Landing Page'
  return {
    entryPath: 'index.html',
    files: [
      {
        path: 'index.html',
        kind: 'html',
        content: html,
      },
      {
        path: 'README.md',
        kind: 'asset',
        content: `# ${safeTitle}\n\nGenerated landing page project.\n`,
      },
    ],
  }
}
