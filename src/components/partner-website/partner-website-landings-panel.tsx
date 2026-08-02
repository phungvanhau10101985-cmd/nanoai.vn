'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerLandingPageRow } from '@/lib/partner-website/landing/partner-landing-types'
import { PARTNER_LANDING_MAX_PRODUCTS } from '@/lib/partner-website/landing/partner-landing-types'
import { cn } from '@/lib/utils'
import { ExternalLink, Loader2, MessageSquarePlus, Trash2 } from 'lucide-react'

type InventoryPickRow = {
  id: string
  name: string
  sku: string | null
  priceHint: string
  imageUrl: string
  description: string
}

type LandingListItem = PartnerLandingPageRow & {
  publicUrl?: string | null
  previewPath?: string | null
}

type ChatPhase = 'idle' | 'products' | 'brief' | 'building'

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  siteSlug?: string | null
  websiteReady: boolean
  sectionId?: string
  autoStartChat?: boolean
  onToast: (message: string, variant?: 'default' | 'destructive') => void
  onChatStarted?: () => void
}

export function PartnerWebsiteLandingsPanel({
  locale,
  t,
  partnerId,
  siteSlug,
  websiteReady,
  sectionId = 'partner-website-landings',
  autoStartChat = false,
  onToast,
  onChatStarted,
}: Props) {
  const [landings, setLandings] = useState<LandingListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [title, setTitle] = useState('')
  const [briefText, setBriefText] = useState('')
  const [landingSlug, setLandingSlug] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [inventory, setInventory] = useState<InventoryPickRow[]>([])
  const [invLoading, setInvLoading] = useState(false)

  const loadLandings = useCallback(async () => {
    if (!partnerId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings`
      )
      const json = (await res.json()) as { landings?: LandingListItem[]; error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      setLandings(json.landings ?? [])
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setLoading(false)
    }
  }, [partnerId, onToast, t.errorGeneric])

  const loadInventory = useCallback(async () => {
    if (!partnerId) return
    setInvLoading(true)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/inventory?page=0&pageSize=60`
      )
      const json = (await res.json()) as { rows?: InventoryPickRow[]; error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      setInventory(json.rows ?? [])
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setInvLoading(false)
    }
  }, [partnerId, onToast, t.errorGeneric])

  useEffect(() => {
    void loadLandings()
  }, [loadLandings])

  const startChat = useCallback(() => {
    if (!websiteReady) {
      onToast(t.studioWebFirstNote, 'destructive')
      return
    }
    setPhase('products')
    setTitle('')
    setBriefText('')
    setLandingSlug('')
    setSelectedIds([])
    void loadInventory()
    onChatStarted?.()
  }, [websiteReady, onToast, t.studioWebFirstNote, loadInventory, onChatStarted])

  useEffect(() => {
    if (autoStartChat && websiteReady && phase === 'idle') {
      startChat()
    }
  }, [autoStartChat, websiteReady, phase, startChat])

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= PARTNER_LANDING_MAX_PRODUCTS) {
        onToast(t.lpMaxProducts.replace('{n}', String(PARTNER_LANDING_MAX_PRODUCTS)), 'destructive')
        return prev
      }
      return [...prev, id]
    })
  }

  const handleCreateAndBuild = async () => {
    if (!websiteReady) {
      onToast(t.lpNeedWebsite, 'destructive')
      return
    }
    if (title.trim().length < 2) {
      onToast(t.lpTitleRequired, 'destructive')
      return
    }
    if (selectedIds.length < 1) {
      onToast(t.lpProductsRequired, 'destructive')
      return
    }
    setPhase('building')
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            briefText: briefText.trim(),
            landingSlug: landingSlug.trim() || undefined,
            inventoryIds: selectedIds,
            locale,
          }),
        }
      )
      const json = (await res.json()) as { landing?: PartnerLandingPageRow; error?: string }
      if (!res.ok || !json.landing) throw new Error(json.error || t.errorGeneric)

      setBusyId(json.landing.id)
      const buildRes = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(json.landing.id)}/build`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale, regenerateMockup: true }),
        }
      )
      const buildJson = (await buildRes.json()) as { error?: string; assistantMessage?: string }
      if (!buildRes.ok) throw new Error(buildJson.error || t.lpBuildFailed)

      onToast(buildJson.assistantMessage || t.lpBuildSuccess)
      setPhase('idle')
      setTitle('')
      setBriefText('')
      setLandingSlug('')
      setSelectedIds([])
      await loadLandings()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
      setPhase('brief')
      await loadLandings()
    } finally {
      setBusyId(null)
    }
  }

  const handlePublish = async (landingId: string, publish: boolean) => {
    setBusyId(landingId)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(landingId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: publish ? 'publish' : 'unpublish' }),
        }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      onToast(publish ? t.lpPublishSuccess : t.lpUnpublishSuccess)
      await loadLandings()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setBusyId(null)
    }
  }

  const handleRebuild = async (landingId: string) => {
    setBusyId(landingId)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(landingId)}/build`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale, regenerateMockup: true }),
        }
      )
      const json = (await res.json()) as { error?: string; assistantMessage?: string }
      if (!res.ok) throw new Error(json.error || t.lpBuildFailed)
      onToast(json.assistantMessage || t.lpBuildSuccess)
      await loadLandings()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (landingId: string) => {
    if (!window.confirm(t.lpDeleteConfirm)) return
    setBusyId(landingId)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(landingId)}`,
        { method: 'DELETE' }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      onToast(t.lpDeleteSuccess)
      await loadLandings()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setBusyId(null)
    }
  }

  const inChat = phase !== 'idle'

  return (
    <Card id={sectionId} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t.lpChatTitle}</CardTitle>
            <CardDescription className="mt-1 text-xs">{t.lpChatHint}</CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!websiteReady || phase === 'building'}
            onClick={() => (inChat ? setPhase('idle') : startChat())}
          >
            <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
            {inChat ? t.lpCancelCreate : t.lpChatStart}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!websiteReady ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">{t.studioWebFirstNote}</p>
        ) : null}

        {inChat ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="space-y-2 text-sm">
              <p className="rounded-lg bg-background px-3 py-2 shadow-sm">{t.lpChatStepProducts}</p>
              {phase !== 'products' ? (
                <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs">
                  {selectedIds.length} {t.lpProductsShort}
                </p>
              ) : null}
              {phase === 'brief' || phase === 'building' ? (
                <>
                  <p className="rounded-lg bg-background px-3 py-2 shadow-sm">{t.lpChatStepBrief}</p>
                  {title.trim() ? (
                    <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs">{title}</p>
                  ) : null}
                </>
              ) : null}
              {phase === 'building' ? (
                <p className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t.lpChatStepBuild}
                </p>
              ) : null}
            </div>

            {phase === 'products' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>
                    {t.lpProductsLabel} ({selectedIds.length}/{PARTNER_LANDING_MAX_PRODUCTS})
                  </Label>
                  {invLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                </div>
                <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                  {inventory.map((row) => {
                    const checked = selectedIds.includes(row.id)
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => toggleProduct(row.id)}
                        className={cn(
                          'flex gap-2 rounded-lg border p-2 text-left transition-colors',
                          checked
                            ? 'border-primary bg-primary/5'
                            : 'border-border/60 bg-background hover:bg-muted/40'
                        )}
                      >
                        {row.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.imageUrl}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-md object-cover bg-muted"
                          />
                        ) : (
                          <span className="h-14 w-14 shrink-0 rounded-md bg-muted" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{row.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.priceHint || row.sku || '—'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {!invLoading && inventory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t.lpInventoryEmpty}</p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedIds.length < 1}
                  onClick={() => setPhase('brief')}
                >
                  {t.lpChatContinueProducts}
                </Button>
              </div>
            ) : null}

            {phase === 'brief' ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="lp-title">{t.lpTitleLabel}</Label>
                    <Input
                      id="lp-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t.lpTitlePlaceholder}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lp-slug">{t.lpSlugLabel}</Label>
                    <Input
                      id="lp-slug"
                      value={landingSlug}
                      onChange={(e) => setLandingSlug(e.target.value)}
                      placeholder={t.lpSlugPlaceholder}
                    />
                    {siteSlug ? (
                      <p className="text-[11px] text-muted-foreground">
                        /site/{siteSlug}/lp/{landingSlug.trim() || '…'}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lp-brief">{t.lpBriefLabel}</Label>
                  <Textarea
                    id="lp-brief"
                    value={briefText}
                    onChange={(e) => setBriefText(e.target.value)}
                    placeholder={t.lpBriefPlaceholder}
                    rows={3}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setPhase('products')}>
                    {t.studioBack}
                  </Button>
                  <Button type="button" size="sm" onClick={() => void handleCreateAndBuild()}>
                    {t.lpChatContinueBrief}
                  </Button>
                </div>
              </div>
            ) : null}

            {phase === 'building' ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.lpBuilding}
              </p>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.lpLoading}
          </p>
        ) : landings.length === 0 && !inChat ? (
          <p className="text-sm text-muted-foreground">{t.lpEmpty}</p>
        ) : landings.length > 0 ? (
          <ul className="space-y-3">
            {landings.map((lp) => {
              const busy = busyId === lp.id
              const previewHref =
                lp.previewPath ||
                `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(lp.id)}/preview`
              return (
                <li
                  key={lp.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lp.title}</p>
                    <p className="text-xs text-muted-foreground">
                      /lp/{lp.landingSlug} · {lp.inventoryIds.length} {t.lpProductsShort} ·{' '}
                      {lp.isPublished ? t.publishedBadge : t.draftBadge}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a href={previewHref} target="_blank" rel="noopener noreferrer">
                        {t.previewButton}
                      </a>
                    </Button>
                    {lp.publicUrl ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={lp.publicUrl} target="_blank" rel="noopener noreferrer">
                          {t.lpOpenPublic}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void handleRebuild(lp.id)}
                    >
                      {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      {t.lpRebuild}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        busy || (lp.isPublished ? false : !(lp.htmlSource || lp.project.files.length))
                      }
                      onClick={() => void handlePublish(lp.id, !lp.isPublished)}
                    >
                      {lp.isPublished ? t.unpublishButton : t.publishButton}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void handleDelete(lp.id)}
                      aria-label={t.lpDelete}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
