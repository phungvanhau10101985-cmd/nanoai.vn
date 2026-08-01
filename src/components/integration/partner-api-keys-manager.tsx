'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useStepUpOtp } from '@/components/auth/step-up-otp-provider'
import { isStepUpRequiredError } from '@/lib/auth/step-up-otp-shared'
import type { PartnerApiKeysManagerStrings } from '@/lib/integration/api-keys-hub-copy'
import {
  clearPartnerImageSearchApiSecret,
  generatePartnerImageSearchApiSecret,
  generatePartnerOutboundWebhookSecret,
  getPartnerApiKeysBundle,
  getPartnerImageSearchApiSecret,
  savePartnerOutboundWebhookSettings,
  sendPartnerOutboundWebhookTest,
  setPartnerImageSearchApiEnabled,
} from '@/app/dashboard/messaging/actions'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { PARTNER_OUTBOUND_WEBHOOK_EVENTS } from '@/lib/messaging/partner-outbound-webhook-types'

const MASK = '••••••••••••••••••••••••••••'

type BundleOk = {
  ok: true
  embedKey: string
  imageSearchConfigured: boolean
  imageSearchEnabled: boolean
  aiSettingsRowExists: boolean
  outboundWebhook: {
    configured: boolean
    isEnabled: boolean
    secretConfigured: boolean
    events: string[]
    webhookUrl: string
  }
}

export type PartnerApiKeysManagerPartner = {
  id: string
  display_name: string | null
  slug?: string
}

type Props = {
  partners: PartnerApiKeysManagerPartner[]
  t: PartnerApiKeysManagerStrings
  /** Đồng bộ với hướng dẫn nhúng — truyền cả hai khi có shop */
  partnerId?: string
  onPartnerIdChange?: (id: string) => void
}

export function PartnerApiKeysManager({ partners, t, partnerId: partnerIdProp, onPartnerIdChange }: Props) {
  const { toast } = useToast()
  const { runWithStepUp } = useStepUpOtp()
  const [internalPartnerId, setInternalPartnerId] = useState(partners[0]?.id ?? '')
  const isControlled = typeof onPartnerIdChange === 'function'
  const partnerId = isControlled ? (partnerIdProp ?? '') : internalPartnerId
  const setPartnerId = isControlled ? onPartnerIdChange! : setInternalPartnerId
  const [bundle, setBundle] = useState<BundleOk | null>(null)
  const [imageVisible, setImageVisible] = useState(false)
  const [imageSecret, setImageSecret] = useState<string | null>(null)
  const [ephemeralSecret, setEphemeralSecret] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [fetchingSecret, setFetchingSecret] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [webhookEvents, setWebhookEvents] = useState<string[]>([...PARTNER_OUTBOUND_WEBHOOK_EVENTS])
  const [webhookSecretEphemeral, setWebhookSecretEphemeral] = useState<string | null>(null)
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [webhookTesting, setWebhookTesting] = useState(false)
  const [webhookGenerating, setWebhookGenerating] = useState(false)

  const loadBundle = useCallback(
    (pid: string) => {
      if (!pid) return
      void (async () => {
        const res = await getPartnerApiKeysBundle(pid)
        if ('error' in res && res.error) {
          setBundle(null)
          toast({ title: t.loadError, description: res.error, variant: 'destructive' })
          return
        }
        if ('ok' in res && res.ok) {
          setBundle(res)
          setWebhookUrl(res.outboundWebhook?.webhookUrl ?? '')
          setWebhookEnabled(Boolean(res.outboundWebhook?.isEnabled))
          setWebhookEvents(
            res.outboundWebhook?.events?.length
              ? [...res.outboundWebhook.events]
              : [...PARTNER_OUTBOUND_WEBHOOK_EVENTS]
          )
        }
      })()
    },
    [t.loadError, toast]
  )

  useEffect(() => {
    if (!partnerId) return
    setImageVisible(false)
    setImageSecret(null)
    setEphemeralSecret(null)
    loadBundle(partnerId)
  }, [partnerId, loadBundle])

  const imageConfigured = bundle?.imageSearchConfigured ?? false
  const imageEnabled = bundle?.imageSearchEnabled ?? false
  const aiRow = bundle?.aiSettingsRowExists ?? false

  const displayImageValue = () => {
    if (ephemeralSecret && imageVisible) return ephemeralSecret
    if (imageVisible && imageSecret) return imageSecret
    if (imageConfigured) return MASK
    return '—'
  }

  const ensureImageSecretForReveal = useCallback(async () => {
    if (!partnerId || !imageConfigured) return
    if (ephemeralSecret) {
      setImageVisible(true)
      return
    }
    setFetchingSecret(true)
    try {
      const res = await getPartnerImageSearchApiSecret(partnerId)
      if ('error' in res && res.error) {
        toast({ title: t.loadError, description: res.error, variant: 'destructive' })
        return
      }
      if ('ok' in res && res.secret) {
        setImageSecret(res.secret)
        setImageVisible(true)
      }
    } finally {
      setFetchingSecret(false)
    }
  }, [ephemeralSecret, imageConfigured, partnerId, t.loadError, toast])

  const hideImageSecret = () => {
    setImageVisible(false)
    setImageSecret(null)
  }

  const copyText = async (value: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: okMsg })
    } catch {
      toast({ title: t.copyFailed, variant: 'destructive' })
    }
  }

  const copyImage = async () => {
    if (!partnerId) return
    if (ephemeralSecret) {
      await copyText(ephemeralSecret, t.copied)
      return
    }
    if (imageSecret) {
      await copyText(imageSecret, t.copied)
      return
    }
    if (!imageConfigured) return
    setFetchingSecret(true)
    try {
      const res = await getPartnerImageSearchApiSecret(partnerId)
      if ('error' in res && res.error) {
        toast({ title: t.loadError, description: res.error, variant: 'destructive' })
        return
      }
      if ('ok' in res && res.secret) {
        setImageSecret(res.secret)
        await copyText(res.secret, t.copied)
      }
    } finally {
      setFetchingSecret(false)
    }
  }

  const runGenerate = async () => {
    if (!partnerId) return
    setGenerating(true)
    try {
      const res = await runWithStepUp(() => generatePartnerImageSearchApiSecret(partnerId))
      if ('error' in res && res.error) {
        if (!isStepUpRequiredError(res)) {
          toast({ title: res.error, variant: 'destructive' })
        }
        return
      }
      if ('ok' in res && res.secret) {
        setEphemeralSecret(res.secret)
        setImageSecret(null)
        setImageVisible(true)
        try {
          await navigator.clipboard.writeText(res.secret)
        } catch {
          /* ignore */
        }
        toast({ title: t.keyCreatedTitle, description: t.keyCreatedDescription })
        loadBundle(partnerId)
      }
    } finally {
      setGenerating(false)
    }
  }

  const runDelete = async () => {
    if (!partnerId) return
    setDeleting(true)
    try {
      const res = await runWithStepUp(() => clearPartnerImageSearchApiSecret(partnerId))
      if ('error' in res && res.error) {
        if (!isStepUpRequiredError(res)) {
          toast({ title: res.error, variant: 'destructive' })
        }
        return
      }
      setEphemeralSecret(null)
      hideImageSecret()
      loadBundle(partnerId)
      toast({ title: t.keyDeletedOk })
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const toggleEnabled = async (checked: boolean) => {
    if (!partnerId) return
    setToggling(true)
    try {
      const res = await setPartnerImageSearchApiEnabled(partnerId, checked)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      loadBundle(partnerId)
    } finally {
      setToggling(false)
    }
  }

  const showImageDisabled = fetchingSecret || (!imageConfigured && !ephemeralSecret)

  if (partners.length === 0) {
    return (
      <Card id="partner-api-keys">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.cardTitle}</CardTitle>
          <CardDescription>{t.noShops}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card id="partner-api-keys">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.cardTitle}</CardTitle>
          <CardDescription className="leading-relaxed">{t.cardLead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t.selectShop}</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {(p.display_name?.trim() || p.slug || p.id.slice(0, 8)) +
                      (p.slug ? ` — slug: ${p.slug}` : '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground font-mono break-all">
              {t.partnerIdLabel}: {partnerId}
            </p>
            {(() => {
              const slug = partners.find((p) => p.id === partnerId)?.slug?.trim()
              return slug ? (
                <p className="text-[11px] text-muted-foreground font-mono break-all">slug: {slug}</p>
              ) : null
            })()}
          </div>

          <div className="space-y-3 rounded-lg border border-emerald-300/40 bg-emerald-50/15 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div>
              <p className="text-sm font-medium">{t.embedTitle}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{t.embedHint}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md border bg-background px-2 py-1.5 text-[11px] font-mono">
                {bundle?.embedKey?.trim() || t.noEmbedKey}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1"
                onClick={() => void copyText(bundle?.embedKey?.trim() ?? '', t.copied)}
                disabled={!bundle?.embedKey?.trim()}
              >
                <Copy className="h-3.5 w-3.5" />
                {t.copy}
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-violet-300/40 bg-violet-50/15 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t.imageSearchTitle}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{t.imageSearchHint}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {imageConfigured ? t.keyPresent : t.keyAbsent}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-medium">{t.enableApi}</p>
                  <p className="text-[10px] text-muted-foreground max-w-[200px]">{t.enableApiHint}</p>
                </div>
                <Switch
                  checked={imageEnabled}
                  onCheckedChange={(c) => void toggleEnabled(c)}
                  disabled={toggling || !aiRow}
                  aria-label={t.enableApi}
                />
              </div>
            </div>
            {!aiRow ? <p className="text-xs text-amber-800 dark:text-amber-200">{t.saveAiFirstHint}</p> : null}

            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md border bg-background px-2 py-1.5 text-[11px] font-mono">
                {displayImageValue()}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1"
                onClick={() => {
                  if (imageVisible) {
                    hideImageSecret()
                    setEphemeralSecret(null)
                  } else {
                    void ensureImageSecretForReveal()
                  }
                }}
                disabled={showImageDisabled}
                aria-pressed={imageVisible}
              >
                {imageVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {imageVisible ? t.hide : t.show}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1"
                onClick={() => void copyImage()}
                disabled={(!imageConfigured && !ephemeralSecret) || fetchingSecret}
              >
                <Copy className="h-3.5 w-3.5" />
                {t.copy}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={!imageConfigured || deleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.deleteKey}
              </Button>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void runGenerate()}
              disabled={generating || !aiRow}
            >
              {generating ? t.generating : t.generate}
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border border-sky-300/40 bg-sky-50/15 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
            <div>
              <p className="text-sm font-medium">{t.webhookTitle}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{t.webhookHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-webhook-url">{t.webhookUrlLabel}</Label>
              <Input
                id="partner-webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://shop.example.com/api/nanoai/webhook"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={webhookEnabled}
                onCheckedChange={setWebhookEnabled}
                aria-label={t.webhookEnabled}
              />
              <span className="text-xs">{t.webhookEnabled}</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {PARTNER_OUTBOUND_WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={webhookEvents.includes(ev)}
                    onCheckedChange={(checked) => {
                      setWebhookEvents((prev) => {
                        if (checked) return prev.includes(ev) ? prev : [...prev, ev]
                        const next = prev.filter((x) => x !== ev)
                        return next.length > 0 ? next : [...PARTNER_OUTBOUND_WEBHOOK_EVENTS]
                      })
                    }}
                  />
                  {ev === 'order.created'
                    ? t.webhookEventOrderCreated
                    : ev === 'lead.created'
                      ? t.webhookEventLeadCreated
                      : t.webhookEventPaymentPaid}
                </label>
              ))}
            </div>
            {webhookSecretEphemeral ? (
              <code className="block break-all rounded-md border bg-background px-2 py-1.5 text-[11px] font-mono">
                {webhookSecretEphemeral}
              </code>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={webhookSaving || !partnerId}
                onClick={() => {
                  if (!partnerId) return
                  setWebhookSaving(true)
                  void (async () => {
                    const res = await savePartnerOutboundWebhookSettings({
                      partnerId,
                      webhookUrl,
                      isEnabled: webhookEnabled,
                      events: webhookEvents,
                    })
                    setWebhookSaving(false)
                    if ('error' in res && res.error) {
                      toast({ title: res.error, variant: 'destructive' })
                      return
                    }
                    toast({ title: t.webhookSaved })
                    loadBundle(partnerId)
                  })()
                }}
              >
                {t.webhookSave}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={webhookGenerating || !partnerId}
                onClick={() => {
                  if (!partnerId) return
                  setWebhookGenerating(true)
                  void runWithStepUp(async () => {
                    const res = await generatePartnerOutboundWebhookSecret(partnerId)
                    setWebhookGenerating(false)
                    if ('error' in res && res.error) {
                      if (isStepUpRequiredError(res.error)) throw new Error(res.error)
                      toast({ title: res.error, variant: 'destructive' })
                      return
                    }
                    if ('secret' in res && res.secret) {
                      setWebhookSecretEphemeral(res.secret)
                      toast({ title: t.webhookSecretGenerated })
                    }
                    loadBundle(partnerId)
                  }).catch(() => setWebhookGenerating(false))
                }}
              >
                {t.webhookGenerateSecret}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={webhookTesting || !partnerId}
                onClick={() => {
                  if (!partnerId) return
                  setWebhookTesting(true)
                  void (async () => {
                    const res = await sendPartnerOutboundWebhookTest(partnerId)
                    setWebhookTesting(false)
                    if ('error' in res && res.error) {
                      toast({ title: t.webhookTestFailed, description: res.error, variant: 'destructive' })
                      return
                    }
                    toast({ title: t.webhookTestOk })
                  })()
                }}
              >
                {t.webhookTest}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.deleteDialogCancel}</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={() => void runDelete()}>
              {deleting ? t.deleting : t.deleteDialogConfirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
