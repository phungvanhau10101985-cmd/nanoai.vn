import type {
  PartnerWebsiteFileKind,
  PartnerWebsiteProject,
  PartnerWebsiteProjectFile,
} from '@/lib/partner-website/partner-website-types'

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
    : files.find((f) => f.kind === 'html')?.path ?? files[0]!.path

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
  if (entry?.content.trim()) return entry.content.trim()
  const firstHtml = project.files.find((f) => f.kind === 'html')
  return firstHtml?.content.trim() || null
}

/** Inline linked CSS/JS from project into index.html for iframe/public render. */
export function composeStandaloneHtml(project: PartnerWebsiteProject): string | null {
  const indexHtml = extractIndexHtml(project)
  if (!indexHtml) return null

  const cssBlocks = project.files
    .filter((f) => f.kind === 'css')
    .map((f) => `<style data-path="${f.path}">\n${f.content}\n</style>`)
  const jsBlocks = project.files
    .filter((f) => f.kind === 'js')
    .map((f) => `<script data-path="${f.path}">\n${f.content}\n</script>`)

  if (!cssBlocks.length && !jsBlocks.length) return indexHtml

  const headInject = cssBlocks.join('\n')
  const bodyInject = jsBlocks.join('\n')

  if (/<\/head>/i.test(indexHtml)) {
    let out = indexHtml.replace(/<\/head>/i, `${headInject}\n</head>`)
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${bodyInject}\n</body>`)
    } else {
      out = `${out}\n${bodyInject}`
    }
    return out
  }

  return `${indexHtml}\n${headInject}\n${bodyInject}`
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
