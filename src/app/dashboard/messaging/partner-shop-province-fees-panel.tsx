'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import { partnerShippingOpsCopy } from '@/lib/i18n/partner-shipping-ops-copy'
import { normalizeVietnamProvinceKey, VIETNAM_PROVINCES } from '@/lib/partner-website/shop/vietnam-provinces'
import { Loader2 } from 'lucide-react'

type Props = {
  partnerId: string
  locale: WebLocale
  canEdit: boolean
}

function digits(raw: string): string {
  return raw.replace(/[^\d]/g, '').slice(0, 12)
}

export function PartnerShopProvinceFeesPanel({ partnerId, locale, canEdit }: Props) {
  const copy = useMemo(() => partnerShippingOpsCopy(locale), [locale])
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defaultFee, setDefaultFee] = useState(0)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/messaging/partners/${encodeURIComponent(partnerId)}/shipping/province-fees`,
        { credentials: 'same-origin' }
      )
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean
        defaultFeeAmount?: number
        rates?: Record<string, number>
      } | null
      if (!res.ok || !json?.ok) {
        setDraft({})
        return
      }
      setDefaultFee(Math.max(0, Math.round(json.defaultFeeAmount ?? 0)))
      const next: Record<string, string> = {}
      for (const [province, fee] of Object.entries(json.rates || {})) {
        next[province] = String(Math.max(0, Math.round(Number(fee) || 0)))
      }
      setDraft(next)
    } finally {
      setLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = normalizeVietnamProvinceKey(query)
    if (!q) return [...VIETNAM_PROVINCES]
    return VIETNAM_PROVINCES.filter((name) => {
      const key = normalizeVietnamProvinceKey(name)
      return key.includes(q) || name.toLowerCase().includes(query.trim().toLowerCase())
    })
  }, [query])

  const overrideCount = Object.values(draft).filter((value) => value.trim() !== '').length

  async function save() {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      const rates = Object.entries(draft)
        .filter(([, value]) => value.trim() !== '')
        .map(([province, value]) => ({ province, feeAmount: Number(value) || 0 }))
      const res = await fetch(
        `/api/messaging/partners/${encodeURIComponent(partnerId)}/shipping/province-fees`,
        {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rates }),
        }
      )
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null
      if (!res.ok || !json?.ok) {
        toast({ title: copy.provinceLoadError, variant: 'destructive' })
        return
      }
      toast({ title: copy.provinceSaved })
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="px-4 py-3 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{copy.provinceTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        <p className="text-[11px] leading-relaxed text-muted-foreground">{copy.provinceHint}</p>
        <p className="text-[11px] text-muted-foreground">
          {copy.provinceOverrideCount.replace('{n}', String(overrideCount))}
        </p>
        <div className="space-y-2">
          <Label className="text-xs font-medium">{copy.provinceSearch}</Label>
          <Input
            className="h-9 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.provinceSearch}
          />
        </div>
        {loading ? (
          <div className="flex min-h-[6rem] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-auto rounded-md border border-border/60">
            <table className="w-full text-sm">
              <tbody>
                {filtered.map((province) => (
                  <tr key={province} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 align-middle">{province}</td>
                    <td className="w-40 px-3 py-1.5">
                      <Input
                        className="h-8 text-sm"
                        inputMode="numeric"
                        disabled={!canEdit}
                        value={draft[province] ?? ''}
                        placeholder={`${defaultFee}`}
                        onChange={(e) => {
                          const next = digits(e.target.value)
                          setDraft((prev) => {
                            const copyDraft = { ...prev }
                            if (!next) delete copyDraft[province]
                            else copyDraft[province] = next
                            return copyDraft
                          })
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{copy.provinceEmptyMeansDefault}</p>
        {canEdit ? (
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {copy.provinceSave}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
