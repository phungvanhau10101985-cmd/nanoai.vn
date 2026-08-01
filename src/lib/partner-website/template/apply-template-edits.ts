import type {
  PartnerWebsitePage,
  PartnerWebsiteTemplateEditPayload,
  PartnerWebsiteTemplateSite,
  PartnerWebsiteTheme,
  TemplateSectionEditOp,
} from '@/lib/partner-website/template/partner-website-template-types'
import {
  defaultPropsForSection,
  getSectionRegistryEntry,
  isSectionTypeEnabled,
} from '@/lib/partner-website/template/section-registry'

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function mergeTheme(base: PartnerWebsiteTheme, patch?: Partial<PartnerWebsiteTheme>): PartnerWebsiteTheme {
  if (!patch) return base
  return { ...base, ...patch }
}

function findSection(pages: PartnerWebsitePage[], sectionId: string): {
  page: PartnerWebsitePage
  index: number
} | null {
  for (const page of pages) {
    const index = page.sections.findIndex((s) => s.id === sectionId)
    if (index >= 0) return { page, index }
  }
  return null
}

function applySectionOp(
  pages: PartnerWebsitePage[],
  op: TemplateSectionEditOp,
  enabledTypes: string[]
): { pages: PartnerWebsitePage[]; error?: string } {
  const next = pages.map((p) => ({ ...p, sections: [...p.sections] }))

  if (op.op === 'update') {
    const hit = findSection(next, op.sectionId)
    if (!hit) return { pages: next, error: `section not found: ${op.sectionId}` }
    const sec = hit.page.sections[hit.index]!
    const entry = getSectionRegistryEntry(sec.type)
    if (entry?.platformLocked) {
      const allowed = new Set(entry.editableFields)
      const filtered: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(op.props)) {
        if (allowed.has(k)) filtered[k] = v
      }
      hit.page.sections[hit.index] = { ...sec, props: { ...sec.props, ...filtered } }
    } else {
      hit.page.sections[hit.index] = { ...sec, props: { ...sec.props, ...op.props } }
    }
    return { pages: next }
  }

  if (op.op === 'remove') {
    const hit = findSection(next, op.sectionId)
    if (!hit) return { pages: next, error: `section not found: ${op.sectionId}` }
    const sec = hit.page.sections[hit.index]!
    if (getSectionRegistryEntry(sec.type)?.platformLocked) {
      return { pages: next, error: `cannot remove platform section: ${sec.type}` }
    }
    hit.page.sections.splice(hit.index, 1)
    return { pages: next }
  }

  if (op.op === 'add') {
    if (!isSectionTypeEnabled(op.type, enabledTypes)) {
      return { pages: next, error: `section type disabled: ${op.type}` }
    }
    const page = next.find((p) => p.slug === op.pageSlug) ?? next[0]
    if (!page) return { pages: next, error: 'no page' }
    const section = {
      id: uid('sec'),
      type: op.type,
      props: { ...defaultPropsForSection(op.type), ...op.props },
    }
    if (op.afterSectionId) {
      const idx = page.sections.findIndex((s) => s.id === op.afterSectionId)
      if (idx >= 0) page.sections.splice(idx + 1, 0, section)
      else page.sections.push(section)
    } else {
      page.sections.push(section)
    }
    return { pages: next }
  }

  if (op.op === 'reorder') {
    const page = next.find((p) => p.slug === op.pageSlug)
    if (!page) return { pages: next, error: 'page not found' }
    const map = new Map(page.sections.map((s) => [s.id, s]))
    const reordered = op.sectionIds.map((id) => map.get(id)).filter(Boolean) as typeof page.sections
    if (reordered.length !== page.sections.length) {
      return { pages: next, error: 'reorder ids mismatch' }
    }
    page.sections = reordered
    return { pages: next }
  }

  return { pages: next }
}

export function applyTemplateEditPayload(
  site: PartnerWebsiteTemplateSite,
  payload: PartnerWebsiteTemplateEditPayload,
  enabledTypes: string[]
): { site: PartnerWebsiteTemplateSite; errors: string[] } {
  const errors: string[] = []
  let pages = site.pages.map((p) => ({ ...p, sections: [...p.sections] }))
  const theme = mergeTheme(site.theme, payload.theme)

  for (const op of payload.sectionOps ?? []) {
    const result = applySectionOp(pages, op, enabledTypes)
    pages = result.pages
    if (result.error) errors.push(result.error)
  }

  return { site: { ...site, theme, pages }, errors }
}

export function parseTemplateEditPayload(raw: string): PartnerWebsiteTemplateEditPayload | null {
  const trimmed = raw.trim()
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0] ?? null
  if (!jsonText) return null
  try {
    const parsed = JSON.parse(jsonText) as PartnerWebsiteTemplateEditPayload
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}
