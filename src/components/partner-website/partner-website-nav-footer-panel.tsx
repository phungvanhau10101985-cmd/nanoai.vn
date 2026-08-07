'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import {
  DEFAULT_PARTNER_SITE_FOOTER_LINKS,
  DEFAULT_PARTNER_SITE_NAV_LINKS,
  normalizePartnerSiteNavLinks,
  type PartnerSiteNavLinkItem,
} from '@/lib/partner-website/shop/partner-site-nav-footer'
import { ChevronDown, ChevronUp, Loader2, Menu } from 'lucide-react'

type Props = {
  locale: WebLocale
  website: PartnerWebsiteRow | null
  partnerId: string
  sectionId?: string
  onToast: (message: string, variant?: 'default' | 'destructive') => void
  onWebsiteRefresh: (website: PartnerWebsiteRow) => void
}

function moveItem(list: PartnerSiteNavLinkItem[], index: number, dir: -1 | 1): PartnerSiteNavLinkItem[] {
  const next = [...list]
  const j = index + dir
  if (j < 0 || j >= next.length) return list
  const tmp = next[index]!
  next[index] = next[j]!
  next[j] = tmp
  return next.map((item, i) => ({ ...item, sortOrder: i }))
}

export function PartnerWebsiteNavFooterPanel({
  locale,
  website,
  partnerId,
  sectionId,
  onToast,
  onWebsiteRefresh,
}: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const [nav, setNav] = useState<PartnerSiteNavLinkItem[]>(DEFAULT_PARTNER_SITE_NAV_LINKS)
  const [footer, setFooter] = useState<PartnerSiteNavLinkItem[]>(DEFAULT_PARTNER_SITE_FOOTER_LINKS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!website) return
    setNav(normalizePartnerSiteNavLinks(website.navJson, DEFAULT_PARTNER_SITE_NAV_LINKS))
    setFooter(normalizePartnerSiteNavLinks(website.footerJson, DEFAULT_PARTNER_SITE_FOOTER_LINKS))
  }, [website])

  if (!website || website.renderMode !== 'template') return null
  const isLocked = Boolean(website.theme.useVisualHtml)

  const save = async () => {
    if (isLocked || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_nav_footer', navJson: nav, footerJson: footer }),
      })
      const json = (await res.json()) as { website?: PartnerWebsiteRow; error?: string }
      if (!res.ok || !json.website) {
        onToast(t.navFooterSaveError, 'destructive')
        return
      }
      onWebsiteRefresh(json.website)
      onToast(t.navFooterSaveSuccess)
    } catch {
      onToast(t.navFooterSaveError, 'destructive')
    } finally {
      setSaving(false)
    }
  }

  const renderList = (
    list: PartnerSiteNavLinkItem[],
    setList: (v: PartnerSiteNavLinkItem[]) => void,
    title: string
  ) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {list.map((item, index) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
          >
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={item.visible}
                disabled={isLocked}
                onChange={(e) => {
                  const next = [...list]
                  next[index] = { ...item, visible: e.target.checked }
                  setList(next)
                }}
              />
              <span>{item.labelOverride?.trim() || item.hrefKey}</span>
              <span className="text-[11px] text-muted-foreground">/{item.hrefKey}</span>
            </label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={isLocked || index === 0}
              onClick={() => setList(moveItem(list, index, -1))}
              aria-label={t.sectionsMoveUp}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={isLocked || index >= list.length - 1}
              onClick={() => setList(moveItem(list, index, 1))}
              aria-label={t.sectionsMoveDown}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <Card id={sectionId} className="scroll-mt-24 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Menu className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {t.navFooterPanelTitle}
        </CardTitle>
        <CardDescription className="text-xs">{t.navFooterPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-4 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t.templateModeBadge}</Badge>
        </div>
        {isLocked ? (
          <p className="text-xs text-amber-700">{t.navFooterLockedNote}</p>
        ) : (
          <>
            {renderList(nav, setNav, t.navFooterNavTitle)}
            {renderList(footer, setFooter, t.navFooterFooterTitle)}
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t.navFooterSave}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
