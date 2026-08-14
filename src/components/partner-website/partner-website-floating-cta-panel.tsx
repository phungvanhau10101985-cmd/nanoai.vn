'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import {
  getMessagingPartnerContactChannels,
  savePartnerMessagingContactChannels,
} from '@/app/dashboard/messaging/actions'
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
  const [contactPhone, setContactPhone] = useState('')
  const [contactZaloUrl, setContactZaloUrl] = useState('')
  const [contactMessengerUrl, setContactMessengerUrl] = useState('')
  const [contactInstagramUrl, setContactInstagramUrl] = useState('')
  const [chatPending, startChatTransition] = useTransition()

  useEffect(() => {
    if (!website) return
    const cta = website.theme.floatingCta
    setEnabled(Boolean(cta?.enabled))
    setLabel(cta?.label ?? '')
    setHref(cta?.href ?? '')
    setImageUrl(cta?.imageUrl ?? '')
  }, [website])

  useEffect(() => {
    if (!partnerId) return
    void (async () => {
      const res = await getMessagingPartnerContactChannels(partnerId)
      if ('channels' in res && res.channels) {
        setContactPhone(res.channels.contact_phone || '')
        setContactZaloUrl(res.channels.contact_zalo_url || '')
        setContactMessengerUrl(res.channels.contact_messenger_url || '')
        setContactInstagramUrl(res.channels.contact_instagram_url || '')
      }
    })()
  }, [partnerId])

  const saveChatButtons = () => {
    if (!partnerId) return
    startChatTransition(async () => {
      const res = await savePartnerMessagingContactChannels(partnerId, {
        contact_phone: contactPhone,
        contact_zalo_url: contactZaloUrl,
        contact_messenger_url: contactMessengerUrl,
        contact_instagram_url: contactInstagramUrl,
      })
      if ('error' in res && res.error) {
        onToast(res.error || t.floatingCtaChatSaveError, 'destructive')
        return
      }
      onToast(t.floatingCtaChatSaveSuccess)
    })
  }

  const save = async () => {
    if (saving || !website) return
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
      <CardContent className="space-y-5 pb-4 pt-0">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.floatingCtaChatTitle}
            </p>
            <p className="text-[11px] text-muted-foreground">{t.floatingCtaChatHint}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t.floatingCtaChatPhone}</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+84..."
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t.floatingCtaChatZalo}</Label>
              <Input
                value={contactZaloUrl}
                onChange={(e) => setContactZaloUrl(e.target.value)}
                placeholder="https://zalo.me/..."
                className="h-9 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t.floatingCtaChatMessenger}</Label>
              <Input
                value={contactMessengerUrl}
                onChange={(e) => setContactMessengerUrl(e.target.value)}
                placeholder="https://m.me/..."
                className="h-9 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t.floatingCtaChatInstagram}</Label>
              <Input
                value={contactInstagramUrl}
                onChange={(e) => setContactInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/..."
                className="h-9 font-mono text-sm"
              />
            </div>
          </div>
          <Button type="button" size="sm" disabled={chatPending || !partnerId} onClick={saveChatButtons}>
            {chatPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {t.floatingCtaChatSave}
          </Button>
        </div>

        {website ? (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.floatingCtaPromoTitle}
            </p>
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
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
