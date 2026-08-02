'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

export type PartnerWebsiteTenantSection = 'editor' | 'leads' | 'sections' | 'landings'

type SectionLabels = {
  editor: string
  leads: string
  sections: string
  landings: string
  publicSite: string
}

type Props = {
  partnerTitle: string
  siteSlug?: string | null
  isPublished: boolean
  publishedLabel: string
  draftLabel: string
  publicUrl: string | null
  sections: SectionLabels
  activeSection?: PartnerWebsiteTenantSection
  onSectionSelect?: (section: PartnerWebsiteTenantSection) => void
}

export function PartnerWebsiteTenantAdminBar({
  partnerTitle,
  siteSlug,
  isPublished,
  publishedLabel,
  draftLabel,
  publicUrl,
  sections,
  activeSection = 'editor',
  onSectionSelect,
}: Props) {
  const tabs: Array<{ key: PartnerWebsiteTenantSection; label: string }> = [
    { key: 'editor', label: sections.editor },
    { key: 'landings', label: sections.landings },
    { key: 'leads', label: sections.leads },
    { key: 'sections', label: sections.sections },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-3 md:flex-row md:items-center md:justify-between md:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="truncate text-sm font-semibold">{partnerTitle}</p>
        <Badge variant={isPublished ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
          {isPublished ? publishedLabel : draftLabel}
        </Badge>
        {siteSlug ? (
          <span className="text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1 py-0.5">{siteSlug}</code>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5"
          role="tablist"
          aria-label={sections.editor}
        >
          {tabs.map(({ key, label }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="ghost"
              role="tab"
              aria-selected={activeSection === key}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-medium',
                activeSection === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onSectionSelect?.(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        {publicUrl ? (
          <Button asChild variant="outline" size="sm" className="h-7 text-xs">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              {sections.publicSite}
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
