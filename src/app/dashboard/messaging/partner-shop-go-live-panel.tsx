'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { WebLocale } from '@/lib/i18n/config'
import { partnerGoLiveCopy } from '@/lib/i18n/partner-shop-go-live-copy'
import {
  partnerGoLiveProgress,
  partnerGoLiveSectionForItem,
  type PartnerGoLiveItem,
  type PartnerGoLiveItemId,
} from '@/lib/partner-website/shop/partner-shop-go-live'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

type Props = {
  partnerId: string
  locale: WebLocale
  onOpenSection: (sectionId: string) => void
}

export function PartnerShopGoLivePanel({ partnerId, locale, onOpenSection }: Props) {
  const copy = useMemo(() => partnerGoLiveCopy(locale), [locale])
  const [items, setItems] = useState<PartnerGoLiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/go-live`, {
        credentials: 'same-origin',
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; items?: PartnerGoLiveItem[] } | null
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        setError(true)
        setItems([])
        return
      }
      setItems(json.items)
    } catch {
      setError(true)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    void load()
  }, [load])

  const progress = partnerGoLiveProgress(items)
  const required = items.filter((item) => item.required)
  const optional = items.filter((item) => !item.required)

  function renderGroup(title: string, list: PartnerGoLiveItem[]) {
    if (list.length === 0) return null
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <ul className="space-y-2">
          {list.map((item) => {
            const meta = copy.items[item.id as PartnerGoLiveItemId]
            const Icon = item.done ? CheckCircle2 : Circle
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${item.done ? 'text-emerald-600' : 'text-muted-foreground'}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {meta.label}{' '}
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {item.done ? copy.done : copy.todo}
                      </span>
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{meta.hint}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => onOpenSection(partnerGoLiveSectionForItem(item.id))}
                >
                  {copy.openItem}
                </Button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-4 px-4 py-4">
        {loading ? (
          <div className="flex min-h-[6rem] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{copy.notReadyBanner}</p>
        ) : (
          <>
            <p
              className={`rounded-md border px-3 py-2 text-sm ${
                progress.ready
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100'
              }`}
            >
              {progress.ready ? copy.readyBanner : copy.notReadyBanner}
            </p>
            <p className="text-xs text-muted-foreground">
              {copy.requiredProgress
                .replace('{done}', String(progress.requiredDone))
                .replace('{total}', String(progress.requiredTotal))}
            </p>
            {renderGroup(copy.requiredTitle, required)}
            {renderGroup(copy.optionalTitle, optional)}
          </>
        )}
      </CardContent>
    </Card>
  )
}
