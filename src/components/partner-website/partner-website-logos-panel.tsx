'use client'

import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { uploadPartnerImageFile } from '@/components/partner-website/partner-website-asset-panel'
import {
  extractLogoInventoryFromProject,
  type PartnerWebsiteDeviceLogoSlot,
  type PartnerWebsiteLogoSlot,
} from '@/lib/partner-website/visual-editor/apply-slot-logo'
import {
  VISUAL_DEVICE_VARIANTS,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

type Props = {
  locale: WebLocale
  website: PartnerWebsiteRow | null
  partnerId: string
  sectionId?: string
  embedded?: boolean
  onToast: (message: string, variant?: 'default' | 'destructive') => void
  onWebsiteRefresh: (website: PartnerWebsiteRow) => void
}

type BusyKey = string

function slotPreview(url: string) {
  if (!url || !/^https?:\/\//i.test(url)) return null
  return url
}

export function PartnerWebsiteLogosPanel({
  locale,
  website,
  partnerId,
  sectionId = 'partner-website-logos',
  embedded = false,
  onToast,
  onWebsiteRefresh,
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingSlot = useRef<{ slot: PartnerWebsiteLogoSlot; device?: VisualDeviceVariant } | null>(null)
  const [device, setDevice] = useState<VisualDeviceVariant>('desktop')
  const [busy, setBusy] = useState<BusyKey | null>(null)

  const inventory = useMemo(
    () =>
      extractLogoInventoryFromProject(
        website?.project,
        website?.theme?.faviconUrl,
        website?.theme?.chatIconLogoUrl
      ),
    [website?.project, website?.theme?.faviconUrl, website?.theme?.chatIconLogoUrl]
  )

  const deviceLabels: Record<VisualDeviceVariant, string> = {
    desktop: t.visualEditDeviceDesktop,
    laptop: t.visualEditDeviceLaptop,
    tablet: t.visualEditDeviceTablet,
    mobile: t.visualEditDeviceMobile,
  }

  async function saveSlot(
    slot: PartnerWebsiteLogoSlot,
    logoUrl: string | null,
    visualDevice?: VisualDeviceVariant
  ) {
    if (!partnerId) return
    const key = `${slot}:${visualDevice || 'all'}`
    setBusy(key)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'update_logo_slot',
          logoSlot: slot,
          logoUrl,
          visualDevice,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        error?: string
      }
      if (!res.ok || !json.website) {
        onToast(json.error || t.logosSaveError, 'destructive')
        return
      }
      onWebsiteRefresh(json.website)
      onToast(t.logosSaved)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.logosSaveError, 'destructive')
    } finally {
      setBusy(null)
    }
  }

  function pickFile(slot: PartnerWebsiteLogoSlot, visualDevice?: VisualDeviceVariant) {
    pendingSlot.current = { slot, device: visualDevice }
    fileRef.current?.click()
  }

  async function onFileChange(files: FileList | null) {
    const target = pendingSlot.current
    pendingSlot.current = null
    if (!files?.length || !partnerId || !target) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onToast(t.imageInvalidType, 'destructive')
      return
    }
    const key = `${target.slot}:${target.device || 'all'}`
    setBusy(key)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      await saveSlot(target.slot, url, target.device)
    } catch (e) {
      setBusy(null)
      onToast(e instanceof Error ? e.message : t.uploadFailed, 'destructive')
    }
  }

  function renderRow(opts: {
    slot: PartnerWebsiteLogoSlot
    label: string
    hint?: string
    url: string
    device?: VisualDeviceVariant
  }) {
    const key = `${opts.slot}:${opts.device || 'all'}`
    const preview = slotPreview(opts.url)
    const disabled = Boolean(busy) || !partnerId || !website
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/10 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{opts.label}</p>
          {opts.hint ? <p className="text-[11px] text-muted-foreground">{opts.hint}</p> : null}
        </div>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-10 w-10 rounded border bg-white object-contain p-0.5" />
        ) : (
          <span className="text-[11px] text-muted-foreground">{t.logosEmpty}</span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          disabled={disabled}
          onClick={() => pickFile(opts.slot, opts.device)}
        >
          {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {t.logoUpload}
        </Button>
        {preview ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={disabled}
            onClick={() => void saveSlot(opts.slot, '', opts.device)}
          >
            {t.logoRemove}
          </Button>
        ) : null}
      </div>
    )
  }

  const deviceSlots: Array<{ slot: PartnerWebsiteDeviceLogoSlot; label: string }> = [
    { slot: 'header', label: t.logosHeaderLabel },
    { slot: 'footer', label: t.logosFooterLabel },
  ]

  return (
    <Card id={sectionId} className={cn('scroll-mt-24', embedded && 'border-border/70 shadow-sm')}>
      <CardHeader className={embedded ? 'space-y-1 px-4 py-3 pb-2' : 'space-y-1'}>
        <CardTitle className={embedded ? 'text-sm font-medium text-muted-foreground' : 'text-base'}>
          {t.logosPanelTitle}
        </CardTitle>
        <CardDescription className={embedded ? 'text-xs' : undefined}>{t.logosPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className={embedded ? 'space-y-3 px-4 pb-4 pt-0' : 'space-y-3'}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onFileChange(e.target.files)
            e.target.value = ''
          }}
        />
        {renderRow({
          slot: 'favicon',
          label: t.logosFaviconLabel,
          hint: t.logosFaviconHint,
          url: inventory.faviconUrl,
        })}
        {renderRow({
          slot: 'chat',
          label: t.logosChatLabel,
          hint: t.logosChatHint,
          url: inventory.chatUrl,
        })}
        <div
          className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5"
          role="tablist"
          aria-label={t.visualEditDeviceHint}
        >
          {VISUAL_DEVICE_VARIANTS.map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant="ghost"
              role="tab"
              aria-selected={device === id}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-medium',
                device === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setDevice(id)}
            >
              {deviceLabels[id]}
            </Button>
          ))}
        </div>
        {deviceSlots.map((row) =>
          renderRow({
            slot: row.slot,
            label: row.label,
            url: inventory[row.slot][device],
            device,
          })
        )}
      </CardContent>
    </Card>
  )
}
