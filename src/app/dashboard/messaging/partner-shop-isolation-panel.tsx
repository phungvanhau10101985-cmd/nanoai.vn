'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { WebLocale } from '@/lib/i18n/config'
import { partnerIsolationCopy } from '@/lib/i18n/partner-shop-isolation-copy'
import {
  isPartnerIsolationAckId,
  partnerIsolationProgress,
  partnerIsolationSectionForItem,
  type PartnerIsolationItem,
  type PartnerIsolationItemId,
} from '@/lib/partner-website/shop/partner-shop-isolation'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

type Props = {
  partnerId: string
  locale: WebLocale
  onOpenSection: (sectionId: string) => void
}

export function PartnerShopIsolationPanel({ partnerId, locale, onOpenSection }: Props) {
  const copy = useMemo(() => partnerIsolationCopy(locale), [locale])
  const [items, setItems] = useState<PartnerIsolationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/isolation`, {
        credentials: 'same-origin',
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; items?: PartnerIsolationItem[] } | null
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

  async function toggleAck(item: PartnerIsolationItem) {
    if (!isPartnerIsolationAckId(item.id) || savingId) return
    setSavingId(item.id)
    setSaveError(false)
    try {
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/isolation`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id, done: !item.done }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; items?: PartnerIsolationItem[] } | null
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        setSaveError(true)
        return
      }
      setItems(json.items)
    } catch {
      setSaveError(true)
    } finally {
      setSavingId(null)
    }
  }

  const progress = partnerIsolationProgress(items)
  const auto = items.filter((item) => item.required && !isPartnerIsolationAckId(item.id))
  const ack = items.filter((item) => isPartnerIsolationAckId(item.id))
  const optional = items.filter((item) => !item.required)

  function renderGroup(title: string, list: PartnerIsolationItem[]) {
    if (list.length === 0) return null
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <ul className="space-y-2">
          {list.map((item) => {
            const meta = copy.items[item.id as PartnerIsolationItemId]
            const Icon = item.done ? CheckCircle2 : Circle
            const ackItem = isPartnerIsolationAckId(item.id)
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${item.done ? 'text-emerald-600' : item.state === 'shared' ? 'text-red-600' : 'text-muted-foreground'}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {meta.label}{' '}
                      <span className={`text-[11px] font-normal ${item.state === 'shared' ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {copy.states[item.state]}
                      </span>
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{meta.hint}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {ackItem ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={item.done ? 'outline' : 'default'}
                      disabled={savingId === item.id}
                      onClick={() => void toggleAck(item)}
                    >
                      {savingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                      {item.done ? copy.unmark : copy.markDone}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenSection(partnerIsolationSectionForItem(item.id))}
                  >
                    {copy.openItem}
                  </Button>
                </div>
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
          <p className="text-sm text-muted-foreground">{copy.loadError}</p>
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
            {saveError ? <p className="text-xs text-red-600">{copy.saveError}</p> : null}
            {renderGroup(copy.autoTitle, auto)}
            {renderGroup(copy.ackTitle, ack)}
            {renderGroup(copy.optionalTitle, optional)}
          </>
        )}
      </CardContent>
    </Card>
  )
}
