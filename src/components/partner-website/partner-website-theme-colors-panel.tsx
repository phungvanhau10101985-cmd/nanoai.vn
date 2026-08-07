'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { Loader2, Palette } from 'lucide-react'

/**
 * W2.3 (phần theme) — color picker trực tiếp cho 5 token màu, không cần chat AI.
 * Khoá khi `theme.useVisualHtml === true` cùng lý do với `PartnerWebsiteSectionsPanel`: lúc đó
 * trang render thẳng từ HTML thô đã lưu, đổi `theme_json` sẽ không có tác dụng lên trang thật.
 */

type ColorKey = 'primaryColor' | 'accentColor' | 'backgroundColor' | 'textColor' | 'mutedColor'
const COLOR_KEYS: ColorKey[] = ['primaryColor', 'accentColor', 'backgroundColor', 'textColor', 'mutedColor']

type Props = {
  locale: WebLocale
  website: PartnerWebsiteRow | null
  partnerId: string
  sectionId?: string
  onToast: (message: string, variant?: 'default' | 'destructive') => void
  onWebsiteRefresh: (website: PartnerWebsiteRow) => void
}

export function PartnerWebsiteThemeColorsPanel({ locale, website, partnerId, sectionId, onToast, onWebsiteRefresh }: Props) {
  const t = getPartnerWebsiteCopy(locale)
  const [draft, setDraft] = useState<Record<ColorKey, string>>({
    primaryColor: '#f97316',
    accentColor: '#ea580c',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    mutedColor: '#6b7280',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!website) return
    setDraft({
      primaryColor: website.theme.primaryColor || '#f97316',
      accentColor: website.theme.accentColor || '#ea580c',
      backgroundColor: website.theme.backgroundColor || '#ffffff',
      textColor: website.theme.textColor || '#1f2937',
      mutedColor: website.theme.mutedColor || '#6b7280',
    })
  }, [website])

  if (!website || website.renderMode !== 'template') return null
  const isLocked = Boolean(website.theme.useVisualHtml)

  const colorLabel: Record<ColorKey, string> = {
    primaryColor: t.themeColorPrimary,
    accentColor: t.themeColorAccent,
    backgroundColor: t.themeColorBackground,
    textColor: t.themeColorText,
    mutedColor: t.themeColorMuted,
  }

  const save = async () => {
    if (isLocked || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_theme_colors', themeColors: draft }),
      })
      const json = (await res.json()) as { website?: PartnerWebsiteRow; error?: string }
      if (!res.ok || !json.website) {
        onToast(t.themeColorsSaveError, 'destructive')
        return
      }
      onWebsiteRefresh(json.website)
      onToast(t.themeColorsSaveSuccess)
    } catch {
      onToast(t.themeColorsSaveError, 'destructive')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id={sectionId} className="scroll-mt-24 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Palette className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {t.themeColorsPanelTitle}
        </CardTitle>
        <CardDescription className="text-xs">{t.themeColorsPanelHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-4 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{t.templateModeBadge}</Badge>
        </div>
        {isLocked ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
            {t.themeColorsVisualHtmlLockedNote}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {COLOR_KEYS.map((key) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs font-medium">{colorLabel[key]}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft[key]}
                  disabled={isLocked}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <code className="text-xs text-muted-foreground">{draft[key]}</code>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" size="sm" disabled={isLocked || saving} onClick={() => void save()}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {t.themeColorsSave}
        </Button>
      </CardContent>
    </Card>
  )
}
