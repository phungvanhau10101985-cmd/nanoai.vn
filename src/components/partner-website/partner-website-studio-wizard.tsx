'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteStudioAnswers } from '@/lib/partner-website/partner-website-studio-flow'
import {
  DEFAULT_SHOP_TEMPLATE_PRESET_ID,
  listShopTemplatePresets,
  shopTemplatePresetDescription,
  shopTemplatePresetLabel,
  type ShopTemplatePresetId,
} from '@/lib/partner-website/template/shop-template-presets'
import { cn } from '@/lib/utils'
import { Loader2, Sparkles } from 'lucide-react'

type Phase = 'setup' | 'building'

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  defaultBrandName?: string
  onComplete: (payload: {
    website: PartnerWebsiteRow
    publicUrl: string | null
    assistantMessage: string
    source: string
  }) => void
  onSkip?: () => void
  onError: (message: string) => void
}

const STORAGE_PREFIX = 'partner-website-studio:'

export function PartnerWebsiteStudioWizard({
  locale,
  t,
  partnerId,
  defaultBrandName,
  onComplete,
  onSkip,
  onError,
}: Props) {
  const storageKey = `${STORAGE_PREFIX}${partnerId}`
  const presets = useMemo(() => listShopTemplatePresets(), [])

  const [answers, setAnswers] = useState<PartnerWebsiteStudioAnswers>(() => {
    if (typeof window === 'undefined') return { brand_name: defaultBrandName ?? '' }
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${partnerId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as PartnerWebsiteStudioAnswers
        return { brand_name: defaultBrandName ?? '', ...parsed }
      }
    } catch {
      /* ignore */
    }
    return { brand_name: defaultBrandName ?? '' }
  })

  const [phase, setPhase] = useState<Phase>('setup')
  const [selectedPresetId, setSelectedPresetId] = useState<ShopTemplatePresetId>(
    DEFAULT_SHOP_TEMPLATE_PRESET_ID
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers))
    } catch {
      /* ignore */
    }
  }, [answers, storageKey])

  async function applyTemplate() {
    const brand = answers.brand_name?.trim() || ''
    if (brand.length < 2) {
      onError(t.studioAnswerRequired)
      return
    }
    setPhase('building')
    setBusy(true)
    try {
      const res = await fetch('/api/messaging/partner-website/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_template',
          partnerId,
          locale,
          pageKey: 'home',
          answers,
          presetId: selectedPresetId,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        publicUrl?: string | null
        assistantMessage?: string
        source?: string
        error?: string
      }
      if (!res.ok || !json.website) {
        onError(json.error || t.errorGeneric)
        setPhase('setup')
        return
      }
      try {
        localStorage.removeItem(storageKey)
      } catch {
        /* ignore */
      }
      onComplete({
        website: json.website,
        publicUrl: json.publicUrl ?? null,
        assistantMessage: json.assistantMessage ?? t.studioBuildComplete,
        source: json.source ?? 'template',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto w-full max-w-2xl border-violet-200/70 shadow-md dark:border-violet-900/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-violet-600" aria-hidden />
          {t.studioTitle}
        </CardTitle>
        <CardDescription>{t.studioWebHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t.studioQ_brand_name}</p>
            <Input
              value={answers.brand_name ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, brand_name: e.target.value }))}
              placeholder={t.titleLabel}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t.logoLabel}</p>
            <p className="text-xs text-muted-foreground">{t.logoGenerateHint}</p>
            <Input
              value={answers.logo_url ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, logo_url: e.target.value }))}
              placeholder={t.logoUrlPlaceholder}
              disabled={busy}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{t.studioPickTemplateTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.studioPickTemplateHint}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {presets.map((preset) => {
              const selected = selectedPresetId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={busy || phase === 'building'}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={cn(
                    'rounded-lg border-2 p-2.5 text-left transition-colors',
                    selected
                      ? 'border-violet-600 bg-background ring-2 ring-violet-600/20'
                      : 'border-border bg-background/80 hover:border-violet-400'
                  )}
                >
                  <div className="mb-2 flex h-10 overflow-hidden rounded-md" aria-hidden>
                    <span className="flex-1" style={{ background: preset.swatch.primary }} />
                    <span className="w-1/3" style={{ background: preset.swatch.accent }} />
                    <span className="w-1/4" style={{ background: preset.swatch.background }} />
                  </div>
                  <p className="text-sm font-semibold">{shopTemplatePresetLabel(preset, locale)}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {shopTemplatePresetDescription(preset, locale)}
                  </p>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSkip ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onSkip}>
                {t.studioSkipToEditor}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              disabled={busy || phase === 'building'}
              onClick={() => void applyTemplate()}
            >
              {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              {t.studioApproveDesign}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
