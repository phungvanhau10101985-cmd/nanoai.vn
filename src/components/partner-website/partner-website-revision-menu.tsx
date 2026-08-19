'use client'

import { useCallback, useState } from 'react'
import { Eye, History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { WebLocale } from '@/lib/i18n/config'
import {
  getPartnerWebsiteCopy,
  type PartnerWebsiteCopy,
} from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRevisionRow, PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { revisionDaysRemaining } from '@/lib/partner-website/partner-website-revision-policy'

function formatRevisionTime(locale: WebLocale, iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function revisionNoteLabel(t: PartnerWebsiteCopy, note: string | null): string {
  const key = note?.trim() || ''
  if (!key || key === 'before_restore') return t.revisionNoteBeforeRestore
  if (key === 'update_theme_colors') return t.revisionNoteTheme
  if (key === 'update_brand') return t.revisionNoteBrand
  if (key === 'update_nav_footer') return t.revisionNoteNavFooter
  if (key === 'update_floating_cta') return t.revisionNoteCta
  if (key === 'update_chat_launcher') return t.revisionNoteChatLauncher
  return t.revisionNoteSession
}

export function PartnerWebsiteRevisionMenu({
  locale,
  partnerId,
  disabled,
  onRestored,
  onPreviewVersion,
  onExitPreview,
  onError,
}: {
  locale: WebLocale
  partnerId: string
  disabled?: boolean
  onRestored: (payload: { website: PartnerWebsiteRow; publicUrl: string | null }) => void
  onPreviewVersion?: (theme: PartnerWebsiteTheme) => void
  onExitPreview?: () => void
  onError: (message: string) => void
}) {
  const t = getPartnerWebsiteCopy(locale)
  const [open, setOpen] = useState(false)
  const [revisions, setRevisions] = useState<PartnerWebsiteRevisionRow[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)

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
        setPreviewingId(null)
        onRestored({ website: json.website, publicUrl: json.publicUrl ?? null })
        setOpen(false)
        void loadRevisions()
      } finally {
        setRestoringId(null)
      }
    },
    [partnerId, restoringId, onError, onRestored, loadRevisions, t.errorGeneric]
  )

  const busy = Boolean(restoringId) || loadingList

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          void loadRevisions()
          return
        }
        setPreviewingId(null)
        onExitPreview?.()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled || Boolean(restoringId)}>
          {restoringId ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <History className="mr-1.5 h-3.5 w-3.5" />
          )}
          {restoringId ? t.restoring : t.restoreButton}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(32rem,85vh)] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.revisionHistory}</DialogTitle>
          <DialogDescription>{t.revisionHistoryHint}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
          {loadingList ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t.revisionLoading}
            </p>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.restoreNone}</p>
          ) : (
            revisions.map((revision) => {
              const daysLeft = revisionDaysRemaining(revision.createdAt)
              const viewing = previewingId === revision.id
              return (
                <div
                  key={revision.id}
                  className={`rounded-md border p-2.5 ${viewing ? 'border-primary bg-muted/40' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatRevisionTime(locale, revision.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        {revisionNoteLabel(t, revision.changeNote)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t.revisionExpiresIn.replace('{n}', String(daysLeft))}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {onPreviewVersion ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={busy}
                          onClick={() => {
                            setPreviewingId(revision.id)
                            onPreviewVersion(revision.theme)
                          }}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          {t.viewVersionButton}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={busy}
                        onClick={() => void restoreRevision(revision.id)}
                      >
                        {restoringId === revision.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {t.restoreVersionButton}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
