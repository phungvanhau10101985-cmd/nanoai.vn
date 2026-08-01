import { normalizePartnerWebsiteProject } from '@/lib/partner-website/partner-website-project'
import type { PartnerWebsiteProject, PartnerWebsiteProjectFile } from '@/lib/partner-website/partner-website-types'

export type PartnerWebsitePatch = {
  search: string
  replace: string
}

export type PartnerWebsiteFileEdit = {
  path: string
  patches?: PartnerWebsitePatch[]
  /** Replace entire file when patches are impractical */
  content?: string
}

export type PartnerWebsiteEditPayload = {
  assistantMessage?: string
  edits?: PartnerWebsiteFileEdit[]
  newFiles?: Array<{ path: string; kind?: string; content: string }>
}

export type ApplyEditsResult = {
  project: PartnerWebsiteProject
  appliedPaths: string[]
  failedPaths: string[]
}

function normalizePath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.\.(\/|$)/g, '')
}

function inferKind(path: string): PartnerWebsiteProjectFile['kind'] {
  const lower = path.toLowerCase()
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'js'
  if (lower.endsWith('.json')) return 'json'
  return 'asset'
}

function applyPatchesToContent(content: string, patches: PartnerWebsitePatch[]): {
  content: string
  ok: boolean
} {
  let next = content
  for (const patch of patches) {
    const search = patch.search
    const replace = patch.replace
    if (!search) return { content: next, ok: false }
    if (!next.includes(search)) return { content: next, ok: false }
    next = next.replace(search, replace)
  }
  return { content: next, ok: true }
}

export function applyPartnerWebsiteEdits(
  project: PartnerWebsiteProject,
  payload: PartnerWebsiteEditPayload
): ApplyEditsResult {
  const fileMap = new Map(project.files.map((f) => [f.path, { ...f }]))
  const appliedPaths: string[] = []
  const failedPaths: string[] = []

  for (const edit of payload.edits ?? []) {
    const path = normalizePath(edit.path)
    if (!path) continue

    const existing = fileMap.get(path)
    if (edit.content !== undefined && String(edit.content).trim()) {
      fileMap.set(path, {
        path,
        kind: existing?.kind ?? inferKind(path),
        content: String(edit.content),
      })
      appliedPaths.push(path)
      continue
    }

    if (!existing || !edit.patches?.length) {
      failedPaths.push(path)
      continue
    }

    const result = applyPatchesToContent(existing.content, edit.patches)
    if (!result.ok) {
      failedPaths.push(path)
      continue
    }
    fileMap.set(path, { ...existing, content: result.content })
    appliedPaths.push(path)
  }

  for (const nf of payload.newFiles ?? []) {
    const path = normalizePath(nf.path)
    const content = String(nf.content ?? '').trim()
    if (!path || !content) continue
    fileMap.set(path, {
      path,
      kind: (nf.kind as PartnerWebsiteProjectFile['kind']) || inferKind(path),
      content,
    })
    appliedPaths.push(path)
  }

  const files = [...fileMap.values()]
  const normalized =
    normalizePartnerWebsiteProject({
      entryPath: project.entryPath,
      files,
    }) ?? project

  return { project: normalized, appliedPaths, failedPaths }
}
