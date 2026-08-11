'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles } from 'lucide-react'
import type { LandingAiSectionRow, LandingAiSectionType } from '@/lib/partner-website/landing/landing-ai-types'
import type { PartnerLandingPageRow } from '@/lib/partner-website/landing/partner-landing-types'

/** L3.6/L3.7 — quản lý nội dung Ladipage AI: sinh/tạo lại từng section + SEO. */

type SectionsT = {
  lpSectionsDialogTitle: string
  lpSectionHero: string
  lpSectionHighlights: string
  lpSectionMaterial: string
  lpSectionProductsGrid: string
  lpSectionTrustCta: string
  lpSectionFaq: string
  lpSectionStatusPending: string
  lpSectionStatusReady: string
  lpSectionStatusError: string
  lpSectionStatusGenerating: string
  lpSectionGenerate: string
  lpSectionRegenerate: string
  lpSectionCustomPromptPlaceholder: string
  lpSectionSaveManual: string
  lpSeoTitle: string
  lpSeoGenerate: string
  lpSeoMetaTitleLabel: string
  lpSeoMetaDescriptionLabel: string
  errorGeneric: string
}

const SECTION_LABEL_KEY: Record<LandingAiSectionType, keyof SectionsT> = {
  hero: 'lpSectionHero',
  highlights: 'lpSectionHighlights',
  material: 'lpSectionMaterial',
  products_grid: 'lpSectionProductsGrid',
  trust_cta: 'lpSectionTrustCta',
  faq: 'lpSectionFaq',
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ready') return 'default'
  if (status === 'error') return 'destructive'
  if (status === 'generating') return 'secondary'
  return 'outline'
}

export function LandingAiSectionsDialog({
  partnerId,
  landing,
  t,
  open,
  onOpenChange,
  onToast,
}: {
  partnerId: string
  landing: PartnerLandingPageRow
  t: SectionsT
  open: boolean
  onOpenChange: (open: boolean) => void
  onToast: (message: string, variant?: 'default' | 'destructive') => void
}) {
  const [sections, setSections] = useState<LandingAiSectionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busySectionId, setBusySectionId] = useState<string | null>(null)
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})
  const [metaTitle, setMetaTitle] = useState(landing.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(landing.metaDescription ?? '')
  const [seoBusy, setSeoBusy] = useState(false)

  const base = `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(landing.id)}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${base}/sections`)
      const json = (await res.json()) as { sections?: LandingAiSectionRow[]; error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      setSections(json.sections ?? [])
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setLoading(false)
    }
  }, [base, onToast, t.errorGeneric])

  useEffect(() => {
    if (open) {
      void load()
      setMetaTitle(landing.metaTitle ?? '')
      setMetaDescription(landing.metaDescription ?? '')
    }
  }, [open, load, landing.metaTitle, landing.metaDescription])

  async function generate(section: LandingAiSectionRow, mode: 'generate' | 'regenerate') {
    setBusySectionId(section.id)
    try {
      const url = `${base}/sections/${encodeURIComponent(section.id)}/${mode}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'all', customPrompt: customPrompts[section.id] || undefined }),
      })
      const json = (await res.json()) as { section?: LandingAiSectionRow; error?: string }
      if (!res.ok || !json.section) throw new Error(json.error || t.errorGeneric)
      setSections((prev) => prev.map((s) => (s.id === json.section!.id ? json.section! : s)))
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
      await load()
    } finally {
      setBusySectionId(null)
    }
  }

  async function generateSeo() {
    setSeoBusy(true)
    try {
      const res = await fetch(`${base}/generate-seo`, { method: 'POST' })
      const json = (await res.json()) as { metaTitle?: string; metaDescription?: string; error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      setMetaTitle(json.metaTitle ?? '')
      setMetaDescription(json.metaDescription ?? '')
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setSeoBusy(false)
    }
  }

  async function saveSeo() {
    setSeoBusy(true)
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaTitle, metaDescription }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      onToast('OK')
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setSeoBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t.lpSectionsDialogTitle}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map((s) => {
              const busy = busySectionId === s.id
              const isProductsGrid = s.sectionType === 'products_grid'
              return (
                <div key={s.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{t[SECTION_LABEL_KEY[s.sectionType]]}</p>
                    <Badge variant={statusBadgeVariant(s.status)}>
                      {s.status === 'ready'
                        ? t.lpSectionStatusReady
                        : s.status === 'error'
                          ? t.lpSectionStatusError
                          : s.status === 'generating'
                            ? t.lpSectionStatusGenerating
                            : t.lpSectionStatusPending}
                    </Badge>
                  </div>
                  {s.errorMessage ? <p className="mt-1 text-xs text-destructive">{s.errorMessage}</p> : null}
                  {!isProductsGrid ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={customPrompts[s.id] ?? ''}
                        onChange={(e) => setCustomPrompts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder={t.lpSectionCustomPromptPlaceholder}
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={s.status === 'ready' ? 'secondary' : 'default'}
                          disabled={busy}
                          onClick={() => void generate(s, s.status === 'ready' ? 'regenerate' : 'generate')}
                        >
                          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                          {s.status === 'ready' ? t.lpSectionRegenerate : t.lpSectionGenerate}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}

            <div className="rounded-lg border border-border/60 p-3">
              <p className="mb-2 text-sm font-medium">{t.lpSeoTitle}</p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t.lpSeoMetaTitleLabel}</Label>
                  <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.lpSeoMetaDescriptionLabel}</Label>
                  <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={seoBusy} onClick={() => void generateSeo()}>
                    {seoBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {t.lpSeoGenerate}
                  </Button>
                  <Button type="button" size="sm" disabled={seoBusy} onClick={() => void saveSeo()}>
                    {t.lpSectionSaveManual}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
