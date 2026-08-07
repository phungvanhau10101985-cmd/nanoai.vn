'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { Loader2, Megaphone } from 'lucide-react'

type Props = {
  locale: WebLocale
  website: PartnerWebsiteRow | null
  partnerId: string
  sectionId?: string
  onToast: (message: string, variant?: 'default' | 'destructive') => void
  onWebsiteRefresh: (website: PartnerWebsiteRow) => void
}

export function PartnerWebsiteFloatingCtaPanel({
  locale,
  website,
  partnerId,
  sectionId,
  onToast,
  onWebsiteRefresh,
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const [enabled, setEnabled] = useState(false)
  const [label, setLabel] = useState('')
  const [href, setHref] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!website) return
    const cta = website.theme.floatingCta
    setEnabled(Boolean(cta?.enabled))
    setLabel(cta?.label ?? '')
    setHref(cta?.href ?? '')
    setImageUrl(cta?.imageUrl ?? '')
  }, [website])

  if (!website) return null

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_floating_cta',
          floatingCta: {
            enabled,
            label: label.trim(),
            href: href.trim(),
            imageUrl: imageUrl.trim() || null,
          },
        }),
      })
      const json = (await res.json()) as { website?: PartnerWebsiteRow; error?: string }
      if (!res.ok || !json.website) {
        onToast(t.floatingCtaSaveError, 'destructive')
        return
      }
      onWebsiteRefresh(json.website)
      onToast(t.floatingCtaSaveSuccess)
    } catch {
      onToast(t.floatingCtaSaveError, 'destructive')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id={sectionId} className="scroll-mt-24 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Megaphone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {t.floatingCtaPanelTitle}
        </CardTitle>
        <CardDescription className="text-xs">{t.floatingCtaPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-4 pt-0">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs font-medium">{t.floatingCtaEnabled}</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t.floatingCtaLabel}</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t.floatingCtaLabelPlaceholder}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t.floatingCtaHref}</Label>
          <Input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder={t.floatingCtaHrefPlaceholder}
            className="h-9 font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t.floatingCtaImageUrl}</Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="h-9 font-mono text-sm"
          />
        </div>
        <Button type="button" size="sm" disabled={saving || (enabled && !href.trim())} onClick={() => void save()}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {t.floatingCtaSave}
        </Button>
      </CardContent>
    </Card>
  )
}
