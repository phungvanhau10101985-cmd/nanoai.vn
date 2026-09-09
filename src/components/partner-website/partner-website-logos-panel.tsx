'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { buildAdminLogoCreatePrompt } from '@/lib/partner-website/visual-editor/build-admin-logo-create-prompt'
import {
  VISUAL_DEVICE_VARIANTS,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import {
  listMessagingWorkspaceLogoVersions,
  recordGeneratedPartnerChatIcon,
} from '@/app/dashboard/messaging/actions'

type LogoVersionRow = {
  id: string
  normalized_logo_url: string
  charged_credits: number
  is_active: boolean
}

type Props = {
  locale: WebLocale
  website: PartnerWebsiteRow | null
  partnerId: string
  shopTitle?: string
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

function rowKey(slot: PartnerWebsiteLogoSlot, device?: VisualDeviceVariant) {
  return `${slot}:${device || 'all'}`
}

export function PartnerWebsiteLogosPanel({
  locale,
  website,
  partnerId,
  shopTitle = '',
  sectionId = 'partner-website-logos',
  embedded = false,
  onToast,
  onWebsiteRefresh,
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const fileRef = useRef<HTMLInputElement>(null)
  const refFileRef = useRef<HTMLInputElement>(null)
  const pendingSlot = useRef<{ slot: PartnerWebsiteLogoSlot; device?: VisualDeviceVariant } | null>(null)
  const [device, setDevice] = useState<VisualDeviceVariant>('desktop')
  const [busy, setBusy] = useState<BusyKey | null>(null)
  const [createKey, setCreateKey] = useState<string | null>(null)
  const [createHint, setCreateHint] = useState('')
  const [createRefUrl, setCreateRefUrl] = useState('')
  const [logoVersions, setLogoVersions] = useState<LogoVersionRow[]>([])

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

  const loadLogoVersions = useCallback(() => {
    if (!partnerId) {
      setLogoVersions([])
      return
    }
    void (async () => {
      const res = await listMessagingWorkspaceLogoVersions(partnerId)
      if ('rows' in res) setLogoVersions((res.rows ?? []) as LogoVersionRow[])
    })()
  }, [partnerId])

  useEffect(() => {
    loadLogoVersions()
  }, [loadLogoVersions])

  async function saveSlot(
    slot: PartnerWebsiteLogoSlot,
    logoUrl: string | null,
    visualDevice?: VisualDeviceVariant,
    opts?: { silent?: boolean; keepBusy?: boolean }
  ) {
    if (!partnerId) return false
    const key = rowKey(slot, visualDevice)
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
        return false
      }
      onWebsiteRefresh(json.website)
      if (!opts?.silent) onToast(t.logosSaved)
      return true
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.logosSaveError, 'destructive')
      return false
    } finally {
      if (!opts?.keepBusy) setBusy(null)
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
    const key = rowKey(target.slot, target.device)
    setBusy(key)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      await saveSlot(target.slot, url, target.device)
    } catch (e) {
      setBusy(null)
      onToast(e instanceof Error ? e.message : t.uploadFailed, 'destructive')
    }
  }

  async function onRefFileChange(files: FileList | null) {
    if (!files?.length || !partnerId) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onToast(t.imageInvalidType, 'destructive')
      return
    }
    setBusy('ref')
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      setCreateRefUrl(url)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.uploadFailed, 'destructive')
    } finally {
      setBusy(null)
    }
  }

  function openCreate(slot: PartnerWebsiteLogoSlot, visualDevice?: VisualDeviceVariant) {
    const key = rowKey(slot, visualDevice)
    if (createKey === key) {
      setCreateKey(null)
      return
    }
    setCreateKey(key)
    setCreateHint('')
    setCreateRefUrl('')
  }

  async function createLogo(slot: PartnerWebsiteLogoSlot, visualDevice?: VisualDeviceVariant) {
    if (!partnerId || !website) return
    if (!window.confirm(t.logosCreateConfirm)) return
    const key = `create:${rowKey(slot, visualDevice)}`
    const extra = createHint.trim()
    const source = createRefUrl.trim()
    const prompt = buildAdminLogoCreatePrompt({
      slot,
      shopTitle: shopTitle || website.title,
      extra,
      hasReference: Boolean(source),
      device: visualDevice,
    })
    const aspectRatio = slot === 'header' || slot === 'footer' ? '16:9' : '1:1'
    setBusy(key)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}/visual-edit-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          prompt,
          kind: 'logo',
          aspectRatio,
          title: shopTitle || website.title || 'Shop',
          referenceImageUrls: source ? [source] : undefined,
          referenceImageMeta: source ? [{ screenKey: `${slot}_style`, label: 'Logo style reference' }] : undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        publicUrl?: string
        charged?: number
        error?: string
      }
      if (!res.ok || !json.publicUrl) {
        onToast(json.error || t.logosCreateError, 'destructive')
        return
      }
      const ok = await saveSlot(slot, json.publicUrl, visualDevice, { silent: true, keepBusy: true })
      if (!ok) return
      if (slot === 'chat') {
        await recordGeneratedPartnerChatIcon({
          partnerId,
          logoUrl: json.publicUrl,
          sourceLogoUrl: source || undefined,
          prompt,
          chargedCredits: Number(json.charged) || 0,
        })
        loadLogoVersions()
      }
      onToast(
        json.charged
          ? `${t.logosCreateSuccess} (−${json.charged} credits)`
          : t.logosCreateSuccess
      )
      setCreateKey(null)
      setCreateHint('')
      setCreateRefUrl('')
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.logosCreateError, 'destructive')
    } finally {
      setBusy(null)
    }
  }

  async function applyVersion(url: string) {
    if (!url) return
    const ok = await saveSlot('chat', url)
    if (ok) loadLogoVersions()
  }

  function renderCreateForm(slot: PartnerWebsiteLogoSlot, visualDevice?: VisualDeviceVariant) {
    const key = rowKey(slot, visualDevice)
    if (createKey !== key) return null
    const createBusy = busy === `create:${key}` || busy === 'ref'
    return (
      <div className="mt-2 grid w-full gap-2 rounded-md border border-border/60 bg-background/80 p-2.5">
        <p className="text-[11px] text-muted-foreground">{t.logosCreateHint}</p>
        {slot === 'chat' ? (
          <p className="rounded-md bg-muted/70 px-2 py-1 text-[11px] leading-4 text-foreground">
            {t.logosChatDefaultPrompt}
          </p>
        ) : null}
        <div className="space-y-1">
          <Label className="text-[11px]">{t.logosCreatePromptLabel}</Label>
          <Textarea
            value={createHint}
            onChange={(e) => setCreateHint(e.target.value)}
            placeholder={t.logosCreatePromptPlaceholder}
            rows={3}
            className="resize-y text-sm"
            disabled={Boolean(busy)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">{t.logosCreateRefLabel}</Label>
          <Input
            value={createRefUrl}
            onChange={(e) => setCreateRefUrl(e.target.value)}
            placeholder="https://..."
            className="h-8 text-xs"
            disabled={Boolean(busy)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={Boolean(busy) || !partnerId}
              onClick={() => refFileRef.current?.click()}
            >
              {busy === 'ref' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t.logosCreateRefUpload}
            </Button>
            {createRefUrl.trim() && /^https?:\/\//i.test(createRefUrl.trim()) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={createRefUrl.trim()} alt="" className="h-10 w-10 rounded border bg-white object-contain" />
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 w-fit px-2.5 text-xs"
          disabled={createBusy || !partnerId || !website}
          onClick={() => void createLogo(slot, visualDevice)}
        >
          {createBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {createBusy ? t.logosCreateBusy : t.logosCreateCost}
        </Button>
      </div>
    )
  }

  function renderRow(opts: {
    slot: PartnerWebsiteLogoSlot
    label: string
    hint?: string
    url: string
    device?: VisualDeviceVariant
  }) {
    const key = rowKey(opts.slot, opts.device)
    const preview = slotPreview(opts.url)
    const disabled = Boolean(busy) || !partnerId || !website
    const createOpen = createKey === key
    return (
      <div className="rounded-lg border border-border/70 bg-muted/10 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
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
          <Button
            type="button"
            variant={createOpen ? 'secondary' : 'outline'}
            size="sm"
            className="h-8 px-2.5 text-xs"
            disabled={!partnerId || !website || (Boolean(busy) && busy !== `create:${key}` && busy !== 'ref')}
            onClick={() => openCreate(opts.slot, opts.device)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t.logosCreate}
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
        {renderCreateForm(opts.slot, opts.device)}
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
        <input
          ref={refFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onRefFileChange(e.target.files)
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
        {logoVersions.length > 0 ? (
          <div className="space-y-2 rounded-md border border-border/70 p-3">
            <p className="text-xs font-medium text-muted-foreground">{t.logosVersionsTitle}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {logoVersions.map((lv) => {
                const inUse = Boolean(
                  lv.normalized_logo_url &&
                    inventory.chatUrl &&
                    lv.normalized_logo_url === inventory.chatUrl
                )
                return (
                  <div key={lv.id} className="rounded border p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lv.normalized_logo_url}
                      alt=""
                      className="h-14 w-14 rounded border bg-white object-contain"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {inUse
                        ? t.logosVersionActive
                        : t.logosVersionCost.replace('{credits}', String(lv.charged_credits))}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-1 h-7 px-2 text-[11px]"
                      variant={inUse ? 'outline' : 'default'}
                      disabled={Boolean(busy) || inUse || !website}
                      onClick={() => void applyVersion(lv.normalized_logo_url)}
                    >
                      {inUse ? t.logosVersionActive : t.logosVersionUse}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
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
