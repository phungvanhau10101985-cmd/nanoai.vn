'use client'

import { useCallback, useState } from 'react'
import { History, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRevisionRow, PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'

function formatRevisionTime(locale: WebLocale, iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function PartnerWebsiteRevisionMenu({
  locale,
  partnerId,
  disabled,
  onRestored,
  onError,
}: {
  locale: WebLocale
  partnerId: string
  disabled?: boolean
  onRestored: (payload: { website: PartnerWebsiteRow; publicUrl: string | null }) => void
  onError: (message: string) => void
}) {
  const t = getPartnerWebsiteCopy(locale)
  const [revisions, setRevisions] = useState<PartnerWebsiteRevisionRow[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const loadRevisions = useCallback(async () => {
    if (!partnerId) return
    setLoadingList(true)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}/revisions`)
      const json = (await res.json().catch(() => ({}))) as {
        revisions?: PartnerWebsiteRevisionRow[]
        error?: string
      }
      if (!res.ok) {
        onError(json.error || t.errorGeneric)
        return
      }
      setRevisions(json.revisions ?? [])
    } finally {
      setLoadingList(false)
    }
  }, [partnerId, onError, t.errorGeneric])

  const restoreRevision = useCallback(
    async (revisionId: string) => {
      if (!partnerId || restoringId) return
      setRestoringId(revisionId)
      try {
        const res = await fetch(
          `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/revisions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ revisionId }),
          }
        )
        const json = (await res.json().catch(() => ({}))) as {
          website?: PartnerWebsiteRow
          publicUrl?: string | null
          error?: string
        }
        if (!res.ok || !json.website) {
          onError(json.error || t.errorGeneric)
          return
        }
        onRestored({ website: json.website, publicUrl: json.publicUrl ?? null })
        void loadRevisions()
      } finally {
        setRestoringId(null)
      }
    },
    [partnerId, restoringId, onError, onRestored, loadRevisions, t.errorGeneric]
  )

  const busy = Boolean(restoringId) || loadingList
  const latestId = revisions[0]?.id

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void loadRevisions()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy}>
          {restoringId ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          )}
          {restoringId ? t.restoring : t.restoreButton}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          {t.revisionHistory}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loadingList ? (
          <DropdownMenuItem disabled>{t.restoring}</DropdownMenuItem>
        ) : revisions.length === 0 ? (
          <DropdownMenuItem disabled className="whitespace-normal text-xs leading-relaxed">
            {t.restoreNone}
          </DropdownMenuItem>
        ) : (
          revisions.map((revision) => (
            <DropdownMenuItem
              key={revision.id}
              disabled={Boolean(restoringId)}
              className="flex flex-col items-start gap-0.5"
              onClick={() => void restoreRevision(revision.id)}
            >
              <span className="text-xs font-medium">
                {formatRevisionTime(locale, revision.createdAt)}
              </span>
              {revision.changeNote && revision.changeNote !== 'before_restore' ? (
                <span className="line-clamp-2 text-[11px] text-muted-foreground">
                  {revision.changeNote}
                </span>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        {latestId && revisions.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={Boolean(restoringId)}
              onClick={() => void restoreRevision(latestId)}
            >
              {t.undoLastButton}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
