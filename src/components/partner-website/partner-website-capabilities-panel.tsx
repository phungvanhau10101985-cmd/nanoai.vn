'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerCapabilities } from '@/lib/partner-website/partner-capabilities'
import {
  getPartnerCapabilitiesBundle,
  savePartnerCapabilities,
} from '@/app/dashboard/messaging/actions'
import { Loader2 } from 'lucide-react'

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  sectionId?: string
  /** Nested under Sửa nhanh — no extra Card, collapsed by default. */
  compact?: boolean
}

type CapKey =
  | 'website.enabled'
  | 'website.products'
  | 'website.cart'
  | 'website.personalize'
  | 'website.chat'
  | 'website.lead_form'
  | 'website.faq'
  | 'website.categories'
  | 'website.booking'
  | 'commerce.cart'
  | 'commerce.order_tracking'

function patchCapabilities(prev: PartnerCapabilities, key: CapKey, value: boolean): PartnerCapabilities {
  const next = structuredClone(prev)
  if (key === 'website.enabled') next.website.enabled = value
  if (key === 'website.products') next.website.products = value
  if (key === 'website.cart') next.website.cart = value
  if (key === 'website.personalize') next.website.personalize = value
  if (key === 'website.chat') next.website.chat = value
  if (key === 'website.lead_form') next.website.lead_form = value
  if (key === 'website.faq') next.website.faq = value
  if (key === 'website.categories') next.website.categories = value
  if (key === 'website.booking') next.website.booking = value
  if (key === 'commerce.cart') next.commerce.cart = value
  if (key === 'commerce.order_tracking') next.commerce.order_tracking = value
  return next
}

export function PartnerWebsiteCapabilitiesPanel({ t, partnerId, sectionId, compact }: Props) {
  const { toast } = useToast()
  const [caps, setCaps] = useState<PartnerCapabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const load = useCallback(async () => {
    if (!partnerId) return
    setLoading(true)
    const res = await getPartnerCapabilitiesBundle(partnerId)
    if ('error' in res) {
      toast({ title: res.error, variant: 'destructive' })
      setCaps(null)
    } else {
      setCaps(res.capabilities)
    }
    setLoading(false)
  }, [partnerId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const onToggle = (key: CapKey, checked: boolean) => {
    if (!caps) return
    const next = patchCapabilities(caps, key, checked)
    setCaps(next)
    startTransition(async () => {
      const res = await savePartnerCapabilities(partnerId, next)
      if ('error' in res) {
        toast({ title: res.error, variant: 'destructive' })
        void load()
        return
      }
      setCaps(res.capabilities)
      toast({ title: t.capabilitiesSaveSuccess })
    })
  }

  const rows: Array<{ key: CapKey; label: string; hint?: string }> = [
    { key: 'website.enabled', label: t.capWebsiteEnabled, hint: t.capWebsiteEnabledHint },
    { key: 'website.products', label: t.capWebsiteProducts },
    { key: 'website.categories', label: t.capWebsiteCategories },
    { key: 'website.cart', label: t.capWebsiteCart },
    { key: 'website.personalize', label: t.capWebsitePersonalize },
    { key: 'website.chat', label: t.capWebsiteChat },
    { key: 'website.lead_form', label: t.capWebsiteLeadForm },
    { key: 'website.faq', label: t.capWebsiteFaq },
    { key: 'website.booking', label: t.capWebsiteBooking, hint: t.capWebsiteBookingHint },
    { key: 'commerce.cart', label: t.capCommerceCart },
    { key: 'commerce.order_tracking', label: t.capCommerceOrderTracking },
  ]

  const valueFor = (key: CapKey): boolean => {
    if (!caps) return false
    if (key.startsWith('website.')) {
      const k = key.replace('website.', '') as keyof PartnerCapabilities['website']
      return Boolean(caps.website[k])
    }
    const k = key.replace('commerce.', '') as keyof PartnerCapabilities['commerce']
    return Boolean(caps.commerce[k])
  }

  const body = (
    <div className="space-y-4">
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.capabilitiesLoading}
        </p>
      ) : !caps ? (
        <p className="text-sm text-muted-foreground">{t.errorGeneric}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor={`cap-${row.key}`} className="text-sm font-medium leading-snug">
                    {row.label}
                  </Label>
                  {row.hint ? (
                    <p className="text-[11px] text-muted-foreground">{row.hint}</p>
                  ) : null}
                </div>
                <Switch
                  id={`cap-${row.key}`}
                  checked={valueFor(row.key)}
                  disabled={pending}
                  onCheckedChange={(checked) => onToggle(row.key, checked)}
                />
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void load()}>
            {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {t.capabilitiesReload}
          </Button>
        </>
      )}
    </div>
  )

  if (compact) {
    return (
      <details id={sectionId} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-medium">
          {t.capabilitiesPanelTitle}
        </summary>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{t.capabilitiesPanelHint}</p>
        <div className="mt-3">{body}</div>
      </details>
    )
  }

  return (
    <Card id={sectionId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t.capabilitiesPanelTitle}</CardTitle>
        <CardDescription className="text-xs">{t.capabilitiesPanelHint}</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
