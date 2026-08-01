import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTemplateSite } from '@/lib/partner-website/template/partner-website-template-types'

export function syncTemplateToProject(site: PartnerWebsiteTemplateSite): PartnerWebsiteProject {
  const config = {
    renderMode: 'template',
    templateId: site.templateId,
    theme: site.theme,
    pages: site.pages,
  }
  return {
    entryPath: 'site.config.json',
    files: [
      {
        path: 'site.config.json',
        kind: 'json',
        content: JSON.stringify(config, null, 2),
      },
    ],
  }
}

export function parseTemplateSiteFromProject(
  project: PartnerWebsiteProject | null | undefined,
  fallback: PartnerWebsiteTemplateSite
): PartnerWebsiteTemplateSite | null {
  const file = project?.files.find((f) => f.path === 'site.config.json')
  if (!file?.content.trim()) return null
  try {
    const parsed = JSON.parse(file.content) as PartnerWebsiteTemplateSite & { renderMode?: string }
    if (!parsed?.pages?.length) return null
    return {
      templateId: parsed.templateId ?? fallback.templateId,
      theme: { ...fallback.theme, ...parsed.theme },
      pages: parsed.pages,
    }
  } catch {
    return null
  }
}
