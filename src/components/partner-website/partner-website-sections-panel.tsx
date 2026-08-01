'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { getSectionRegistryEntry } from '@/lib/partner-website/template/section-registry'

function sectionLabel(locale: WebLocale, type: string): string {
  const entry = getSectionRegistryEntry(type)
  if (!entry) return type
  return entry.label[locale] ?? entry.label.en ?? type
}

export function PartnerWebsiteSectionsPanel({
  locale,
  website,
  sectionId,
}: {
  locale: WebLocale
  website: PartnerWebsiteRow | null
  sectionId?: string
}) {
  const t = getPartnerWebsiteCopy(locale)

  if (!website || website.renderMode !== 'template') return null

  const home = website.pages.find((p) => p.slug === '/') ?? website.pages[0]
  const sections = home?.sections ?? []

  return (
    <Card id={sectionId} className="scroll-mt-24 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{t.sectionsPanelTitle}</CardTitle>
        <CardDescription className="text-xs">{t.sectionsPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pb-4 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t.templateModeBadge}</Badge>
          <Badge variant="outline">{website.templateId}</Badge>
        </div>
        <ul className="space-y-2">
          {sections.map((section, idx) => (
            <li
              key={section.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
            >
              <span>
                <span className="text-muted-foreground">{idx + 1}.</span>{' '}
                {sectionLabel(locale, section.type)}
              </span>
              <code className="text-[10px] text-muted-foreground">{section.type}</code>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t.sectionsPanelLockedNote}</p>
      </CardContent>
    </Card>
  )
}
